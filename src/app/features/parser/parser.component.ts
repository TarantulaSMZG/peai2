import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ModuleWrapperComponent } from 'app/shared/module-wrapper/module-wrapper.component';
import { IoFieldComponent } from 'app/shared/io-field/io-field.component';
import { DataTableComponent } from 'app/shared/data-table/data-table.component';
import { EditModalComponent } from 'app/shared/edit-modal/edit-modal.component';
import { DataService } from 'app/services/data.service';
import { GeminiService, TempEntry } from 'app/services/gemini.service';
import { FileService } from 'app/services/file.service';
import { NotificationService } from 'app/services/notification.service';
import { getRandomQuote } from 'app/utils/quotes';
import { promisePool } from 'app/utils/promise-pool';
import { generateFilename } from 'app/utils/filename';
import { ParsedEntry, SortableKey, SortDirection } from 'app/types';

@Component({
  selector: 'app-parser',
  standalone: true,
  imports: [
    ModuleWrapperComponent, IoFieldComponent, DataTableComponent,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
  <app-module-wrapper
      title="Parser"
      description="Fügen Sie Rohtext aus einem Protokoll ein, geben Sie eine Protokollnummer an, und die KI wird ihn in ein Frage-Antwort-Format strukturieren und persistent speichern.">
      
      <app-io-field
          label="Eingabetext"
          [value]="inputText()"
          (valueChange)="inputText.set($event)"
          [placeholder]="placeholder"
          [rows]="10"
          [disabled]="isLoading()"
          [showClear]="true"
          (clear)="inputText.set('')"
      />
      
      <mat-form-field appearance="outline" style="width: 200px">
        <mat-label>Protokollnummer</mat-label>
        <input
          matInput
          [value]="protocolNumber()"
          (input)="protocolNumber.set(($event.target as HTMLInputElement).value)"
          [disabled]="isLoading()" />
      </mat-form-field>

      <div class="action-buttons">
          <button mat-flat-button color="primary" (click)="parse()" [disabled]="isLoading() || !inputText().trim()">
              <mat-icon>mediation</mat-icon>
              Text parsen & speichern
          </button>
          @if (isParsing()) {
              <button mat-stroked-button (click)="abort()">
                  <mat-icon>cancel</mat-icon>
                  Abbrechen
              </button>
          }
          <button mat-stroked-button (click)="dataService.clearDatabase()" [disabled]="isLoading() || parsedData().length === 0">
              <mat-icon>delete_forever</mat-icon>
              Datenbank zurücksetzen
          </button>
      </div>

      @if (dataService.isLoading()) {
          <div class="placeholder-card" style="min-height: 400px; justify-content: center">
              <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
              <h3 class="mat-h3">Lade Daten...</h3>
          </div>
      } @else if (parsedData().length > 0) {
          <div class="mt-6 flex flex-col gap-6">
              <div class="flex justify-between items-center">
                  <h2 class="mat-h2">Geparste Daten ({{ parsedData().length }} Einträge in DB)</h2>
                  <div class="flex gap-2">
                      <button mat-icon-button title="Export as CSV" (click)="fileService.exportToCsv(parsedData(), generateFilename(protocolNumber(), 'parsed') + '.csv')" [disabled]="isLoading()">
                          <mat-icon>csv</mat-icon>
                      </button>
                      <button mat-icon-button title="Export as XLSX" (click)="fileService.exportToXlsx(parsedData(), generateFilename(protocolNumber(), 'parsed') + '.xlsx')" [disabled]="isLoading()">
                          <mat-icon>description</mat-icon>
                      </button>
                  </div>
              </div>
              <app-data-table [data]="sortedData()" (rowClick)="openEditModal($event)" (sort)="onSort($event)" [sortConfig]="sortConfig()" />
          </div>
      } @else {
          @if (isParsing()) {
            <div class="placeholder-card" style="min-height: 400px; justify-content: center">
                <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
                <h3 class="mat-h3">Parsing wird ausgeführt...</h3>
            </div>
          } @else {
            <div class="placeholder-card">
              <span class="material-symbols-outlined">article</span>
              <h3 class="mat-h3">Keine Daten in der Datenbank</h3>
              <p class="mat-body-1">Fügen Sie oben Text ein und klicken Sie auf "Text parsen & speichern", um zu beginnen.</p>
            </div>
          }
      }
  </app-module-wrapper>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParserComponent {
  dataService: DataService = inject(DataService);
  geminiService: GeminiService = inject(GeminiService);
  fileService: FileService = inject(FileService);
  notificationService: NotificationService = inject(NotificationService);
  dialog: MatDialog = inject(MatDialog);

  inputText = signal('');
  protocolNumber = signal('20');
  isParsing = signal(false);
  
  sortConfig = signal<{ key: SortableKey; direction: SortDirection } | null>({ key: 'id', direction: 'ascending' });
  
  parsedData = this.dataService.parsedData;
  isLoading = computed(() => this.isParsing() || this.dataService.isLoading());
  placeholder = getRandomQuote();
  abortController: AbortController | null = null;

  constructor() {
    effect(() => {
        sessionStorage.setItem('parser.inputText', this.inputText());
        sessionStorage.setItem('parser.protocolNumber', this.protocolNumber());
    }, { allowSignalWrites: true });

    this.inputText.set(sessionStorage.getItem('parser.inputText') || '');
    this.protocolNumber.set(sessionStorage.getItem('parser.protocolNumber') || '20');
  }

  sortedData = computed(() => {
    const data = this.parsedData();
    const config = this.sortConfig();
    if (!config) return data;
    const sorted = [...data].sort((a, b) => {
        const aVal = a[config.key], bVal = b[config.key];
        if (aVal === null || aVal === undefined) return 1; if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
        return String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
    });
    return config.direction === 'ascending' ? sorted : sorted.reverse();
  });

  async parse() {
    if (!this.inputText().trim()) {
        this.notificationService.showError('Bitte geben Sie Text zum Parsen ein.');
        return;
    }
    
    this.abortController = new AbortController();
    this.isParsing.set(true);
    const allTempEntries: TempEntry[] = [];
    
    try {
        this.notificationService.showLoading('Text wird bereinigt und aufgeteilt...');
        const cleanedInput = this.inputText().replace(/==Start of OCR for page \d+==\n/g, '').replace(/==End of OCR for page \d+==\n\n?/g, '');
        const chunks = this.smartSplit(cleanedInput, 8000);
        
        await promisePool(chunks, 
          (chunk) => this.geminiService.parseProtocolChunk(chunk, this.protocolNumber(), this.abortController!.signal),
          2, {
            onProgress: ({ completed, total }) => this.notificationService.showLoading(`Parse... ${Math.round((completed / total) * 100)}% abgeschlossen.`),
            onResult: (result) => allTempEntries.push(...result)
          });
        
        await this.finalizeParsing(allTempEntries);
        
    } catch (e: any) {
        if (e.message !== 'Operation was aborted.') {
            this.notificationService.showError(`Parsen fehlgeschlagen: ${e.message}`);
        } else {
            this.notificationService.showStatus('Parsen vom Benutzer abgebrochen.');
        }
    } finally {
        this.isParsing.set(false);
        this.notificationService.clear();
        this.abortController = null;
    }
  }

  private async finalizeParsing(entries: TempEntry[]) {
    if (this.abortController?.signal.aborted) return;
    if (entries.length === 0) {
      this.notificationService.showError('Keine verwertbaren Einträge gefunden.');
      return;
    }

    this.notificationService.showLoading('Führe finale Zusammenstellung durch...');
        
    entries.sort((a, b) => {
        const getPage = (ref: string) => parseInt(ref?.split(/[\s/]/).pop() || "0", 10) || 0;
        const pageA = getPage(a.sourceReference), pageB = getPage(b.sourceReference);
        return pageA !== pageB ? pageA - pageB : a.id - b.id;
    });

    const rawCollatedData = this.collateToQAPairs(entries);
    const uniqueData = rawCollatedData.filter((entry, i, self) => i === 0 || !(entry.question === self[i - 1].question && entry.answer === self[i - 1].answer && entry.note === self[i - 1].note));
    const finalData = uniqueData.map((entry, i) => ({ ...entry, id: i + 1 }));
    
    await this.dataService.loadDataIntoDb(finalData);
    const duplicatesRemoved = rawCollatedData.length - finalData.length;
    this.notificationService.showStatus(`${finalData.length} Einträge verarbeitet. (${duplicatesRemoved} Duplikate entfernt)`);
  }

  abort() { this.abortController?.abort(); }
  onSort(key: SortableKey) {
    const current = this.sortConfig();
    const direction: SortDirection = (current?.key === key && current.direction === 'ascending') ? 'descending' : 'ascending';
    this.sortConfig.set({ key, direction });
  }

  openEditModal(entry: ParsedEntry) {
    const dialogRef = this.dialog.open(EditModalComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: entry
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.onSaveChanges(result);
      }
    });
  }

  async onSaveChanges(entry: ParsedEntry) {
    await this.dataService.updateEntry(entry);
    this.notificationService.showStatus(`Eintrag #${entry.id} aktualisiert.`);
  }

  private smartSplit(text: string, limit: number): string[] {
    const chunks: string[] = []; let start = 0;
    while (start < text.length) {
        let end = Math.min(start + limit, text.length);
        if (end < text.length) {
            let splitPos = text.lastIndexOf('\n', end);
            if (splitPos <= start) splitPos = text.lastIndexOf(' ', end);
            if (splitPos > start) end = splitPos;
        }
        chunks.push(text.substring(start, end));
        start = end;
    }
    return chunks;
  }
  
  private collateToQAPairs(entries: TempEntry[]): ParsedEntry[] {
    const collated: ParsedEntry[] = [];
    let lastQuestion: TempEntry | null = null;
    let entryCounter = 1;

    for (const entry of entries) {
        const role = entry.role?.toLowerCase() || '';
        const isWitness = role.includes('zeuge');
        const isQuestionerRole = role.includes('frage');
        
        const isLikelyQuestion = !isWitness && (entry.type === "Frage" || (isQuestionerRole && entry.type !== "Antwort"));
        const isLikelyAnswer = (entry.type === "Antwort" || isWitness) && !isQuestionerRole;

        if (isLikelyQuestion) {
            if (lastQuestion) collated.push({ id: entryCounter++, sourceReference: lastQuestion.sourceReference, questioner: lastQuestion.speaker, question: lastQuestion.content, witness: null, answer: null, note: null });
            lastQuestion = entry;
        } else if (isLikelyAnswer) {
            if (lastQuestion) {
                collated.push({ id: entryCounter++, sourceReference: lastQuestion.sourceReference, questioner: lastQuestion.speaker, question: lastQuestion.content, witness: entry.speaker, answer: entry.content, note: null });
                lastQuestion = null;
            } else {
                collated.push({ id: entryCounter++, sourceReference: entry.sourceReference, questioner: null, question: null, witness: entry.speaker, answer: entry.content, note: null });
            }
        } else {
            if (lastQuestion) {
                collated.push({ id: entryCounter++, sourceReference: lastQuestion.sourceReference, questioner: lastQuestion.speaker, question: lastQuestion.content, witness: null, answer: null, note: null });
                lastQuestion = null;
            }
            collated.push({ id: entryCounter++, sourceReference: entry.sourceReference, questioner: null, question: null, witness: null, answer: null, note: `${entry.speaker}: ${entry.content}` });
        }
    }
    if (lastQuestion) collated.push({ id: entryCounter++, sourceReference: lastQuestion.sourceReference, questioner: lastQuestion.speaker, question: lastQuestion.content, witness: null, answer: null, note: null });
    return collated;
  }
}