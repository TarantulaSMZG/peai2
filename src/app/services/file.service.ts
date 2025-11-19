import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ParsedEntry } from 'app/types';
import { promisePool, loadScript } from 'app/utils/promise-pool';
import { WritableSignal } from '@angular/core';

// Define interfaces for Tesseract to provide type safety for the dynamically loaded library.
interface TesseractWorker {
  recognize(image: any): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}
interface TesseractScheduler {
  addWorker(worker: TesseractWorker): Promise<string>;
  addJob(action: 'recognize', image: any): Promise<{ data: { text: string; confidence: number; } }>;
  terminate(): Promise<void>;
}

declare global {
  interface Window {
    Tesseract: {
      createWorker(lang: string): Promise<TesseractWorker>;
      createScheduler(): TesseractScheduler;
    }
    Papa: any;
  }
}

@Injectable({ providedIn: 'root' })
export class FileService {

  private applyGrayscale(context: CanvasRenderingContext2D): void {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
    context.putImageData(imageData, 0, 0);
  }

  private applyThreshold(context: CanvasRenderingContext2D, threshold: number = 170): void {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i]; 
      const newValue = v < threshold ? 0 : 255;
      data[i] = newValue;
      data[i + 1] = newValue;
      data[i + 2] = newValue;
    }
    context.putImageData(imageData, 0, 0);
  }

  async extractTextFromPdf(
    file: File, 
    setLoadingMessage: (msg: string) => void, 
    stopSignal: WritableSignal<boolean>
  ): Promise<{ text: string; confidence: number; }> {
    let pdfjsLib: any;
    try {
        setLoadingMessage('Lade Bibliotheken...');
        const [pdfjsModule] = await Promise.all([
            import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs'),
            loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')
        ]);
        pdfjsLib = pdfjsModule;
    } catch (error) {
        console.error("Library load error:", error);
        throw new Error('Konnte Bibliotheken nicht laden. Bitte Internetverbindung prüfen.');
    }
    
    const { Tesseract } = window;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    let scheduler: TesseractScheduler | null = null;

    try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        setLoadingMessage('Initialisiere OCR-Engine...');
        const concurrency = Math.max(2, navigator.hardwareConcurrency || 2);
        scheduler = Tesseract.createScheduler();
        const workerPromises = Array.from({ length: concurrency }, () =>
            Tesseract.createWorker('deu').then(worker => scheduler!.addWorker(worker))
        );
        await Promise.all(workerPromises);
        setLoadingMessage(`OCR-Engine mit ${concurrency} Workern bereit. Verarbeite ${numPages} Seiten...`);

        const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

        const processPageTask = async (pageNum: number) => {
            if (stopSignal()) return null;

            const page = await pdf.getPage(pageNum);
            
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error(`Could not get 2D context for page ${pageNum}`);
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvas, canvasContext: context, viewport }).promise;

            this.applyGrayscale(context);
            this.applyThreshold(context, 170);

            const { data } = await scheduler!.addJob('recognize', canvas);
            return { pageNum, text: data.text, confidence: data.confidence };
        };
        
        const pageResults = await promisePool(
            pageNumbers,
            processPageTask,
            concurrency,
            { onProgress: ({ completed, total }) => {
                if (stopSignal()) return;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                setLoadingMessage(`Verarbeite PDF... ${percentage}% abgeschlossen.`);
            } }
        );
        
        if (stopSignal()) {
            setLoadingMessage('PDF-Verarbeitung abgebrochen.');
            return { text: '', confidence: 0 };
        }

        const validResults = pageResults
            .filter((r): r is { pageNum: number, text: string, confidence: number } => r !== null && typeof r.confidence === 'number');

        if (validResults.length === 0) return { text: '', confidence: 0 };

        const totalConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0);
        const averageConfidence = totalConfidence / validResults.length;

        const sortedResults = validResults.sort((a, b) => a.pageNum - b.pageNum);
            
        const fullText = sortedResults
            .map(r => `==Start of OCR for page ${r.pageNum}==\n${r.text}\n==End of OCR for page ${r.pageNum}==\n\n`)
            .join('');

        return { text: fullText, confidence: averageConfidence };

    } catch (error) {
        console.error("Error during PDF processing:", error);
        throw new Error(`PDF-Verarbeitung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
        if (scheduler) {
            await scheduler.terminate();
        }
    }
  }

  async processCsvFile(file: File): Promise<{ data: ParsedEntry[], warnings: string[] }> {
    const REQUIRED_HEADERS = ['#', 'Fragesteller', 'Frage', 'Zeuge', 'Antwort'];
    const HEADER_ALIASES: { [key: string]: string[] } = {
      id: ['#', 'id'], sourceReference: ['Fundstelle', 'sourceReference'], questioner: ['Fragesteller', 'questioner'], question: ['Frage', 'question'], witness: ['Zeuge', 'witness'], answer: ['Antwort', 'answer'], note: ['Anmerkung', 'note'], kernaussage: ['Kernaussage', 'kernaussage'], zugeordneteKategorien: ['Zugeordnete Kategorie(n)', 'zugeordneteKategorien'], begruendung: ['Begründung', 'begruendung'],
    };

    return new Promise((resolve, reject) => {
        window.Papa.parse(file, {
            header: true, skipEmptyLines: true, delimitersToGuess: [',', ';', '\t'],
            complete: (results: any) => {
                if (results.errors && results.errors.length > 0) {
                    return reject(new Error(`CSV parsing failed: ${results.errors[0].message}`));
                }
                const parsedData = results.data as { [key: string]: string }[];
                if (parsedData.length === 0) {
                   return reject(new Error("Die CSV-Datei ist leer oder konnte nicht verarbeitet werden."));
                }
                
                // Validation and Mapping
                const headers = Object.keys(parsedData[0] || {});
                const trimmedHeaders = headers.map(h => h.trim().toLowerCase());
                const warnings: string[] = [];
                const missingHeaders = REQUIRED_HEADERS.filter(req => !trimmedHeaders.includes(req.toLowerCase()));
                if (missingHeaders.length > 0) {
                    warnings.push(`Fehlende Spalten: ${missingHeaders.join(', ')}.`);
                }

                let idCounter = 0;
                const mappedData = parsedData.map(row => {
                    idCounter++;
                    const trimmedRow: {[key:string]: any} = {};
                    for(const key in row) trimmedRow[key.trim().toLowerCase()] = row[key];

                    const findValue = (aliases: string[]) => {
                        for (const alias of aliases) {
                            const value = trimmedRow[alias.toLowerCase()];
                            if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
                        }
                        return null;
                    };

                    const noteValue = findValue(HEADER_ALIASES.note);
                    if (noteValue) {
                         return { id: idCounter, sourceReference: findValue(HEADER_ALIASES.sourceReference) || '', questioner: null, question: null, witness: null, answer: null, note: noteValue };
                    }

                    return {
                        id: parseInt(findValue(HEADER_ALIASES.id) || `${idCounter}`, 10),
                        sourceReference: findValue(HEADER_ALIASES.sourceReference) || '',
                        questioner: findValue(HEADER_ALIASES.questioner),
                        question: findValue(HEADER_ALIASES.question),
                        witness: findValue(HEADER_ALIASES.witness),
                        answer: findValue(HEADER_ALIASES.answer),
                        note: null,
                        kernaussage: findValue(HEADER_ALIASES.kernaussage) || undefined,
                        zugeordneteKategorien: findValue(HEADER_ALIASES.zugeordneteKategorien) || undefined,
                        begruendung: findValue(HEADER_ALIASES.begruendung) || undefined,
                    };
                });
                resolve({ data: mappedData, warnings });
            },
            error: (error: any) => reject(new Error(`Failed to read CSV: ${error.message}`))
        });
    });
  }

  private triggerDownload(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToCsv(data: ParsedEntry[], fileName: string): void {
    const hasAnalysis = data.some(d => d.kernaussage || d.zugeordneteKategorien || d.begruendung);
    const hasSearchReason = data.some(d => d.searchReason);
    
    const headers = ['#', 'Fundstelle', 'Fragesteller', 'Frage', 'Zeuge', 'Antwort', 'Anmerkung'];
    if (hasAnalysis) headers.push('Kernaussage', 'Zugeordnete Kategorie(n)', 'Begründung');
    if (hasSearchReason) headers.push('Relevanzgrund');
    
    let qaCounter = 0;
    const rows = data.map(entry => {
        if (entry.note) {
            const noteRow = Array(headers.length).fill('');
            noteRow[6] = entry.note;
            return noteRow;
        }
        qaCounter++;
        const row = [qaCounter, entry.sourceReference, entry.questioner, entry.question, entry.witness, entry.answer, ''];
        if (hasAnalysis) row.push(entry.kernaussage || '', entry.zugeordneteKategorien || '', entry.begruendung || '');
        if (hasSearchReason) row.push(entry.searchReason || '');
        return row;
    });

    const escapeCsvField = (field: any) => {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        return (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) ? `"${stringField.replace(/"/g, '""')}"` : stringField;
    };

    const csvContent = [headers.join(','), ...rows.map(row => row.map(escapeCsvField).join(','))].join('\n');
    this.triggerDownload(`\uFEFF${csvContent}`, fileName, 'text/csv;charset=utf-8;');
  }

  exportToXlsx(data: ParsedEntry[], fileName: string): void {
    const hasAnalysis = data.some(d => d.kernaussage || d.zugeordneteKategorien || d.begruendung);
    const hasSearchReason = data.some(d => d.searchReason);

    const headers = ['#', 'Fundstelle', 'Fragesteller', 'Frage', 'Zeuge', 'Antwort', 'Anmerkung'];
    if (hasAnalysis) headers.push('Kernaussage', 'Zugeordnete Kategorie(n)', 'Begründung');
    if (hasSearchReason) headers.push('Relevanzgrund');

    const worksheetData: (string | number | null)[][] = [headers];
    let qaCounter = 0;
    data.forEach(entry => {
        if (entry.note) {
            const noteRow = Array(headers.length).fill(null);
            noteRow[0] = entry.note;
            worksheetData.push(noteRow);
        } else {
            qaCounter++;
            const row = [qaCounter, entry.sourceReference, entry.questioner, entry.question, entry.witness, entry.answer, null];
            if (hasAnalysis) row.push(entry.kernaussage || null, entry.zugeordneteKategorien || null, entry.begruendung || null);
            if (hasSearchReason) row.push(entry.searchReason || null);
            worksheetData.push(row);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!merges'] = [];
    const font = { name: 'Inter', sz: 11 };
    const headerStyle = { font: { ...font, bold: true, color: { rgb: "534342"} }, fill: { fgColor: { rgb: "ECE0DF" } }, alignment: { vertical: 'top', wrapText: true } };
    const noteStyle = { font: { ...font, italic: true, color: { rgb: "534342"} }, alignment: { horizontal: 'left', vertical: 'top' }, fill: { fgColor: { rgb: "FFF8F7" } }};
    
    let currentQaCounter = 0;
    worksheetData.forEach((row, r) => {
        if (r === 0) return;
        const entry = data[r - 1];
        if (entry.note) {
            ws['!merges']!.push({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } });
            const cellAddress = XLSX.utils.encode_cell({ r, c: 0 });
            if (ws[cellAddress]) {
                ws[cellAddress].v = `Anmerkung: ${entry.note}`;
                ws[cellAddress].s = noteStyle;
            }
        } else {
            currentQaCounter++;
            const fill = { fgColor: { rgb: currentQaCounter % 2 === 0 ? "ECE0DF" : "FFFBFA" } };
            row.forEach((_cell, c) => {
                const cellAddress = XLSX.utils.encode_cell({ r, c });
                if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
                const isBoldColumn = (headers[c] === 'Fragesteller' || headers[c] === 'Zeuge');
                ws[cellAddress].s = { font: { ...font, bold: isBoldColumn }, fill, alignment: { vertical: 'top', wrapText: true } };
            });
        }
    });

    headers.forEach((_, c) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[cellAddress]) ws[cellAddress].s = headerStyle;
    });

    const colWidths = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 60 }, { wch: 25 }, { wch: 60 }, { wch: 20 }];
    if(hasAnalysis) colWidths.push({ wch: 60 }, { wch: 30 }, { wch: 60 });
    if (hasSearchReason) colWidths.push({ wch: 40 });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Protocol Timeline');
    XLSX.writeFile(wb, fileName);
  }

  exportTextFile(content: string, fileName: string, mimeType: string): void {
    this.triggerDownload(content, fileName, mimeType);
  }
}
