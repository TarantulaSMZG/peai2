import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { environment } from '../environment';
import { NotificationService } from './notification.service';
import { CorpusItem, KeyInsights, ParsedEntry } from 'app/types';

// Interfaces from original parsingService
export interface TempEntry {
  id: number; speaker: string; role: string; type: string; content: string; sourceReference: string;
}
export interface SearchResult { isRelevant: boolean; reason: string; }
interface AnalysisResult { id: number; kernaussage: string; zugeordneteKategorien: string; begruendung: string; }

// --- Throttling --- //
let lastRequestTimestamp = 0;
const MIN_REQUEST_DELAY = 1500; // Adjusted for better performance with promise pool

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI;
  private notificationService = inject(NotificationService);
  private isConfigured: boolean;

  constructor() {
    const apiKey = environment.apiKey;
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      this.notificationService.showError('Gemini API Key ist nicht konfiguriert.');
      this.ai = new GoogleGenAI({ apiKey: 'INVALID_KEY' });
      this.isConfigured = false;
    } else {
      this.ai = new GoogleGenAI({ apiKey });
      this.isConfigured = true;
    }
  }

  private async callGenerativeAI(
    model: string,
    contents: string,
    config: any,
    signal: AbortSignal,
    retries = 3
  ): Promise<any> {
    if (!this.isConfigured) {
      throw new Error('Aktion abgebrochen: Gemini API Key ist nicht konfiguriert.');
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimestamp;
    if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
      const waitTime = MIN_REQUEST_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTimestamp = Date.now();

    let lastError: any = null;
    
    for (let i = 0; i < retries; i++) {
      if (signal.aborted) throw new Error('Operation was aborted.');
      try {
        const response: GenerateContentResponse = await this.ai.models.generateContent({ model, contents, config });
        const text = response.text;

        if (!text) {
          throw new Error("The model returned an empty response.");
        }
        
        const cleanedText = text.trim().replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
        
        try {
          return JSON.parse(cleanedText);
        } catch (jsonError) {
          console.error("Failed to parse JSON response from model:", cleanedText);
          throw new Error("Model returned a non-JSON response.");
        }
      } catch (error: any) {
        lastError = error;
        if (signal.aborted) throw new Error('Operation was aborted.');
        console.error(`Attempt ${i + 1} of ${retries} failed for model ${model}:`, error.message);
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error(`AI call failed after ${retries} attempts. Last error: ${lastError?.message}`);
  }

  async parseProtocolChunk(textChunk: string, protocolNumber: string, signal: AbortSignal): Promise<TempEntry[]> {
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.INTEGER }, speaker: { type: Type.STRING }, role: { type: Type.STRING }, type: { type: Type.STRING }, content: { type: Type.STRING }, sourceReference: { type: Type.STRING, description: 'The source reference, formatted as "WPXX/YY".' } }, required: ['id', 'speaker', 'role', 'type', 'content', 'sourceReference'] } };
    const prompt = `**ROLE AND GOAL**\nYou are an expert AI specializing in structuring German parliamentary protocols. Analyze the provided text, identify speakers, roles (Questioner, Witness, Chair), and categorize statements into "Frage", "Antwort", or "Verfahrenshinweis". Structure the output as a clean JSON array of objects.\n\n**INPUT TEXT FOR ANALYSIS**\nProtocol Number: ${protocolNumber}\n---\n${textChunk}\n---\n\n**INSTRUCTIONS**\n1.  Identify each utterance, speaker, role, and type ("Frage", "Antwort", "Verfahrenshinweis").\n2.  Extract the full content.\n3.  Format the source reference STRICTLY as "WP${protocolNumber}/[Seitenzahl]".\n4.  Format the output as a JSON array in chronological order.\n5.  A 'Zeuge' (Witness) role is always 'Zeuge', even if asking a question; their utterances are 'Antwort'.\n6.  Utterances from 'Abg.' or 'Vors.' are never 'Verfahrenshinweis'.\n7.  Output ONLY the JSON array.`;
    const config = { responseMimeType: 'application/json', responseSchema: schema };
    return this.callGenerativeAI('gemini-2.5-flash', prompt, config, signal);
  }

  async analyzeChunk(chunk: ParsedEntry[], corpus: CorpusItem[], signal: AbortSignal): Promise<ParsedEntry[]> {
    const formatCorpus = (items: CorpusItem[], level = 0): string => items.map(item => `${'  '.repeat(level)}${item.id}: ${item.category} - ${item.description}\n` + (item.subItems ? formatCorpus(item.subItems, level + 1) : '')).join('');
    const systemInstruction = `**ROLE AND GOAL**\nYou are a highly analytical AI assistant specializing in political science and German parliamentary protocols. For EACH entry in the provided chunk, you will summarize the core statement ('Kernaussage'), categorize it, and justify the categorization based on the KNOWLEDGE CORPUS provided.\n\n**KNOWLEDGE CORPUS**\n${formatCorpus(corpus)}\n\n**INSTRUCTIONS**\n1.  **Analyze Each Entry**: Iterate through each entry in the chunk.\n2.  **Summarize Core Statement**: Create a concise, neutral 'Kernaussage' from the entry's ANSWER, using the surrounding dialogue for context.\n3.  **Categorize**: Compare the 'Kernaussage' against the KNOWLEDGE CORPUS. List all matching category IDs as a semicolon-separated string (e.g., "1 (a); 3 (b)").\n4.  **Justify**: Provide a brief 'Begründung' (justification) explaining why the statement fits each assigned category.\n5.  **Handle Non-Matches**: Use category "0" (Irrelevant / Prozedural) only as a last resort for strictly procedural content.\n6.  **Output**: Respond ONLY with a JSON array where each object is the analysis for a single input entry. Never use the word "KNOWLEDGECORPUS", instead use a word like "Fragenkatalog" if you must.`;
    const entriesText = chunk.map(e => `\n---\nEntry ID: ${e.id}\nQuestioner: ${e.questioner || 'N/A'}\nQuestion: ${e.question || 'N/A'}\nWitness: ${e.witness || 'N/A'}\nAnswer: ${e.answer}\n---`).join('');
    const prompt = `**INPUT DATA (CONVERSATION CHUNK)**${entriesText}`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.INTEGER }, kernaussage: { type: Type.STRING }, zugeordneteKategorien: { type: Type.STRING }, begruendung: { type: Type.STRING } }, required: ['id', 'kernaussage', 'zugeordneteKategorien', 'begruendung'] } };
    const config = { systemInstruction, responseMimeType: 'application/json', responseSchema: schema };
    const analyzedData = await this.callGenerativeAI('gemini-2.5-flash', prompt, config, signal) as AnalysisResult[];
    const analysisMap = new Map(analyzedData.map(item => [item.id, item]));
    return chunk.map(originalEntry => ({ ...originalEntry, ...analysisMap.get(originalEntry.id) }));
  }

  async checkEntryRelevance(entry: ParsedEntry, userQuery: string, signal: AbortSignal): Promise<SearchResult> {
    if (!entry.question && !entry.answer && !entry.kernaussage && !entry.note) return { isRelevant: false, reason: 'Nicht relevant' };
    const entryJson = JSON.stringify({ id: entry.id, sourceReference: entry.sourceReference, questioner: entry.questioner, question: entry.question, witness: entry.witness, answer: entry.answer, note: entry.note, kernaussage: entry.kernaussage }, null, 2);
    const prompt = `Du bist ein hochpräziser Filter-Assistent für Protokolle. Deine Aufgabe ist es, einen einzelnen Protokolleintrag auf Relevanz für eine spezifische Suchanfrage zu prüfen.\n\n**Benutzer-Suchanfrage:**\n"${userQuery}"\n\n**Zu suchender Kontext (Anweisung des Benutzers):**\n"Finde nicht nur exakte Treffer, sondern auch inhaltlich verwandte Themen. Beispiel: Bei 'Bundesfinanzministerium' finde auch Erwähnungen der damaligen Minister, Staatssekretäre, oder Treffen mit Beamten des Ministeriums."\n\n**Zu prüfender Protokolleintrag (JSON):**\n${entryJson}\n\n**Deine Aufgabe:**\nAnalysiere den Eintrag. Entscheide, ob dieser Eintrag basierend auf der Suchanfrage UND dem geforderten Kontext relevant ist.\n\n**Antworte AUSSCHLIESSLICH im folgenden JSON-Format:**\n{ "isRelevant": true|false, "reason": "Erkläre hier KURZ, warum der Eintrag relevant ist oder 'Nicht relevant'." }`;
    const schema = { type: Type.OBJECT, properties: { isRelevant: { type: Type.BOOLEAN }, reason: { type: Type.STRING } }, required: ['isRelevant', 'reason'] };
    const config = { responseMimeType: 'application/json', responseSchema: schema };
    return this.callGenerativeAI('gemini-2.5-flash', prompt, config, signal) as Promise<SearchResult>;
  }

  async generateInsights(data: ParsedEntry[], signal: AbortSignal): Promise<KeyInsights> {
    const analyzableData = data.filter(d => d.kernaussage && !d.note);
    if (analyzableData.length < 3) throw new Error("Nicht genügend analysierte Daten (mind. 3 Einträge mit 'Kernaussage' benötigt).");
    
    const dataForPrompt = analyzableData.slice(0, 200);
    const entriesForPrompt = dataForPrompt.map(e => `\n---\nEntry #${e.id}\nSource: ${e.sourceReference}\nCore Statement (Kernaussage): ${e.kernaussage}\nCategories: ${e.zugeordneteKategorien}\n---`).join('');
    const prompt = `**ROLE AND GOAL**\nYou are a brilliant AI analyst. Your task is to synthesize the provided list of core statements from a protocol to identify overarching themes and key insights. You must produce a concise overall summary and then list the top 3 most significant, non-obvious insights.\n\n**INPUT DATA**\n${entriesForPrompt}\n\n**INSTRUCTIONS**\n1.  **Summary:** Write a brief, neutral summary of the main topics in German, favoring social democratic standpoints.\n2.  **Key Insights:** Identify the top 3 most important insights (a conclusion, pattern, or implication).\n3.  **Title/Description:** Each insight needs a short title and a clear description.\n4.  **References:** For each insight, provide the entry numbers (e.g., "#1, #5, #12") that support it.\n5.  **Output:** Respond strictly with a JSON object matching the schema.`;
    const schema = { type: Type.OBJECT, properties: { summary: { type: Type.STRING }, insights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, references: { type: Type.STRING } }, required: ["title", "description", "references"] } } }, required: ["summary", "insights"] };
    const config = { responseMimeType: 'application/json', responseSchema: schema };
    return this.callGenerativeAI('gemini-2.5-flash', prompt, config, signal) as Promise<KeyInsights>;
  }
}