import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ModuleWrapperComponent } from 'app/shared/module-wrapper/module-wrapper.component';
import { IoFieldComponent } from 'app/shared/io-field/io-field.component';
import { DataTableComponent } from 'app/shared/data-table/data-table.component';
import { EditModalComponent } from 'app/shared/edit-modal/edit-modal.component';
import { DataService } from 'app/services/data.service';
import { FileService } from 'app/services/file.service';
import { GeminiService } from 'app/services/gemini.service';
import { NotificationService } from 'app/services/notification.service';
import { ParsedEntry, SortableKey, SortDirection } from 'app/types';
import { promisePool } from 'app/utils/promise-pool';
import { generateFilename } from 'app/utils/filename';

const VISIBLE_COLUMNS: SortableKey[] = ['id', 'question', 'answer', 'kernaussage', 'searchReason'];

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    ModuleWrapperComponent, IoFieldComponent, DataTableComponent,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <app-module-wrapper
      title="Search"
      description="Nutzen Sie die KI-gestützte semantische Suche, um relevante Einträge in den gespeicherten Protokolldaten oder einer hochgeladenen CSV-Datei zu finden.">
      
      @if (dataService.isLoading() && !localData()) {
        <div class="placeholder-card" style="min-height: 400px; justify-content: center;">
          <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
          <h3 class="mat-h3">Lade Daten...</h3>
        </div>
      } @else if (dataToSearch().length === 0) {
          <div class="placeholder-card">
            <span class="material-symbols-outlined">dataset_linked</span>
            <h3 class="mat-h3">Keine Daten gefunden</h3>
            <p class="mat-body-1">Laden Sie eine CSV-Datei hoch, um die Suche zu verwenden. Es sind keine Daten in der zentralen Datenbank vorhanden.</p>
          </div>
          <div class="action-buttons">
              <input type="file" #fileInput (change)="onFileChange($event)" class="hidden" accept=".csv" />
              <button mat-flat-button color="primary" (click)="fileInput.click()" [disabled]="isLoading()">
                   <mat-icon>upload_file</mat-icon>
                   CSV hochladen
              </button>
          </div>
      } @else {
        <app-io-field
          label="Suchanfrage"
          [value]="searchQuery()"
          (valueChange)="searchQuery.set($event)"
          placeholder="z.B. Erwähnungen des Bundesfinanzministeriums oder dessen Beamten"
          [rows]="3"
          [disabled]="isLoading()" />

        <div class="action-buttons">
           <input type="file" #fileInput (change)="onFileChange($event)" class="hidden" accept=".csv" />
           <button mat-stroked-button (click)="fileInput.click()" [disabled]="isLoading()">
              <mat-icon>upload_file</mat-icon>
              CSV hochladen
           </button>
           <button mat-flat-button color="primary" (click)="onSearch()" [disabled]="isLoading() || !searchQuery().trim()">
              <mat-icon>search</mat-icon>
              Suchen
          </button>
          @if (isSearching()) {
              <button mat-stroked-button (click)="abort()">
                   <mat-icon>cancel</mat-icon>
                  Abbrechen
              </button>
          }
        </div>

        @if (localData()) {
          <div class="text-center -mt-2">
              <button mat-button (click)="clearLocalData()">Lokal geladene Daten löschen & Datenbank verwenden</button>
          </div>
        }

        @if (searchResults().length > 0) {
           <div class="mt-6">
              <div class="flex justify-between items-center mb-4">
                  <h2 class="mat-h2">Suchergebnisse ({{ searchResults().length }})</h2>
                  <div class="flex gap-2">
                      <button mat-icon-button title="Ergebnisse als CSV exportieren" (click)="fileService.exportToCsv(searchResults(), generateFilename(protocolNumber(), 'search') + '.csv')" [disabled]="isLoading()">
                          <mat-icon>csv</mat-icon>
                      </button>
                      <button mat-icon-button title="Ergebnisse als XLSX exportieren" (click)="fileService.exportToXlsx(searchResults(), generateFilename(protocolNumber(), 'search') + '.xlsx')" [disabled]="isLoading()">
                          <mat-icon>description</mat-icon>
                      </button>
                      <button mat-icon-button (click)="searchResults.set([])" [disabled]="isLoading()" title="Ergebnisse löschen"><mat-icon>delete_sweep</mat-icon></button>
                  </div>
              </div>
              <app-data-table [data]="sortedData()" (rowClick)="openEditModal($event)" (sort)="onSort($event)" [sortConfig]="sortConfig()" [visibleColumns]="visibleColumns" />
           </div>
        } @else {
          @if(isSearching()) {
            <div class="placeholder-card"><mat-progress-spinner mode="indeterminate"></mat-progress-spinner><h3 class="mat-h3">Suche läuft...</h3></div>
          } @else {
            <div class="placeholder-card">
              <span class="material-symbols-outlined">search</span>
              <h3 class="mat-h3">Bereit zur Suche</h3>
              <p class="mat-body-1">Geben Sie oben eine Suchanfrage ein, um die {{ dataToSearch().length }} Einträge in der {{ dataSourceType() }} zu analysieren.</p>
            </div>
          }
        }
      }
    </app-module-wrapper>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent {
  dataService: DataService = inject(DataService);
  fileService: FileService = inject(FileService);
  geminiService: GeminiService = inject(GeminiService);
  notificationService: NotificationService = inject(NotificationService);
  dialog: MatDialog = inject(MatDialog);

  localData = signal<ParsedEntry[] | null>(null);
  searchResults = signal<ParsedEntry[]>([]);
  searchQuery = signal('');
  isSearching = signal(false);
  
  sortConfig = signal<{ key: SortableKey; direction: SortDirection } | null>({ key: 'id', direction: 'ascending' });
  
  abortController: AbortController | null = null;
  visibleColumns = VISIBLE_COLUMNS;
  
  dataToSearch = computed(() => this.localData() || this.dataService.parsedData());
  dataSourceType = computed(() => this.localData() ? 'lokalen Datei' : 'Datenbank');
  isLoading = computed(() => this.isSearching() || (this.dataService.isLoading() && !this.localData()));

  protocolNumber = computed(() => {
    const data = this.dataToSearch();
    if (data.length === 0 || !data[0].sourceReference) return 'XX';
    const match = data[0].sourceReference.match(/WP(\d+)/i);
    return match ? match[1] : 'XX';
  });

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.notificationService.showLoading(`Verarbeite ${file.name}...`);
    try {
        const { data, warnings } = await this.fileService.processCsvFile(file);
        this.localData.set(data);
        this.searchResults.set([]);
        let status = `${data.length} Einträge aus ${file.name} geladen.`;
        if (warnings.length > 0) status += ` Warnungen: ${warnings.join(' ')}`;
        this.notificationService.showStatus(status);
    } catch (e: any) {
        this.notificationService.showError(`CSV-Verarbeitung fehlgeschlagen: ${e.message}`);
    } finally {
        this.notificationService.clear();
        (event.target as HTMLInputElement).value = '';
    }
  }

  clearLocalData() {
    this.localData.set(null);
    this.searchResults.set([]);
    this.notificationService.showStatus("Lokale Daten gelöscht. Es werden nun die Daten aus der zentralen Datenbank verwendet.");
  }

  async onSearch() {
    if (!this.searchQuery().trim()) {
      this.notificationService.showError("Bitte geben Sie eine Suchanfrage ein.");
      return;
    }
    this.abortController = new AbortController();
    this.isSearching.set(true);
    this.searchResults.set([]);

    try {
        const relevanceResults = await promisePool(this.dataToSearch(), 
          (entry) => this.geminiService.checkEntryRelevance(entry, this.searchQuery(), this.abortController!.signal),
          5, {
            onProgress: ({ completed, total }) => this.notificationService.showLoading(`Suche... ${Math.round((completed / total) * 100)}% abgeschlossen.`)
          });

        const finalResults = this.dataToSearch().map((entry, index) => ({ ...entry, searchReason: relevanceResults[index].reason }))
            .filter((_, index) => relevanceResults[index].isRelevant);
        
        this.searchResults.set(finalResults);
        this.notificationService.showStatus(`Suche abgeschlossen. ${finalResults.length} relevante Einträge gefunden.`);
    } catch (e: any) {
        if (e.message !== 'Operation was aborted.') this.notificationService.showError(`Suche fehlgeschlagen: ${e.message}`);
        else this.notificationService.showStatus('Suche vom Benutzer abgebrochen.');
    } finally {
        this.isSearching.set(false);
        this.notificationService.clear();
        this.abortController = null;
    }
  }

  abort() { this.abortController?.abort(); }
  onSort(key: SortableKey) {
    const current = this.sortConfig();
    const direction: SortDirection = (current?.key === key && current.direction === 'ascending') ? 'descending' : 'ascending';
    this.sortConfig.set({ key, direction });
  }

  sortedData = computed(() => {
    const data = this.searchResults();
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

  async onSaveChanges(updatedEntry: ParsedEntry) {
    if (this.localData()) {
        this.localData.update(data => data?.map(e => e.id === updatedEntry.id ? updatedEntry : e) || null);
    } else {
        await this.dataService.updateEntry(updatedEntry);
    }
    this.searchResults.update(results => results.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    this.notificationService.showStatus(`Eintrag #${updatedEntry.id} aktualisiert.`);
  }
}