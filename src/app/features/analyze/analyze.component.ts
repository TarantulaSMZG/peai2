import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ModuleWrapperComponent } from 'app/shared/module-wrapper/module-wrapper.component';
import { DataTableComponent } from 'app/shared/data-table/data-table.component';
import { DataService } from 'app/services/data.service';
import { FileService } from 'app/services/file.service';
import { generateFilename } from 'app/utils/filename';
import { ParsedEntry, SortableKey, SortDirection } from 'app/types';

const VISIBLE_COLUMNS: SortableKey[] = ['id', 'Fraktion', 'witness', 'kernaussage', 'zugeordneteKategorien'];

@Component({
  selector: 'app-analyze',
  standalone: true,
  imports: [
    ModuleWrapperComponent, DataTableComponent, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatButtonModule, MatIconModule
  ],
  template: `
    <app-module-wrapper
      title="Analyse-Modul"
      description="Durchsuchen und filtern Sie die zentral in der Datenbank gespeicherten Protokolldaten.">
      
      @if (dataService.isLoading()) {
        <div class="placeholder-card" style="min-height: 400px; justify-content: center;">
          <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
          <h3 class="mat-h3">Lade Daten aus der Datenbank...</h3>
        </div>
      } @else if (allData().length === 0) {
        <div class="placeholder-card">
          <span class="material-symbols-outlined">dataset_linked</span>
          <h3 class="mat-h3">Keine Daten gefunden</h3>
          <p class="mat-body-1">Bitte laden Sie zuerst eine Datei im <strong>Parser</strong>-Modul hoch, um die Daten zu analysieren.</p>
        </div>
      } @else {
        <div class="p-4 flex flex-col gap-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 class="mat-h2 w-full m-0">Filter</h2>
          
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Volltextsuche (Frage, Antwort, Kernaussage...)</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput
              [value]="filterSearchText()"
              (input)="filterSearchText.set(($event.target as HTMLInputElement).value)">
          </mat-form-field>

          <div class="flex gap-4 flex-wrap">
            <mat-form-field appearance="outline" class="min-w-[250px]">
              <mat-label>Fraktion</mat-label>
              <mat-select [value]="filterFraktion()" (selectionChange)="filterFraktion.set($event.value)">
                @for (f of uniqueFraktionen(); track f) {
                  <mat-option [value]="f">{{ f || 'Alle Fraktionen' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="min-w-[250px]">
              <mat-label>Kategorie</mat-label>
              <mat-select [value]="filterKategorie()" (selectionChange)="filterKategorie.set($event.value)">
                 @for (k of uniqueKategorien(); track k) {
                  <mat-option [value]="k">{{ k || 'Alle Kategorien' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <div class="mt-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="mat-h2">Gefilterte Daten ({{ filteredData().length }} / {{ allData().length }})</h2>
            <div class="flex gap-2">
              <button mat-icon-button title="Export Filtered as CSV" (click)="fileService.exportToCsv(filteredData(), generateFilename('analyse', 'filtered') + '.csv')">
                <mat-icon>csv</mat-icon>
              </button>
              <button mat-icon-button title="Export Filtered as XLSX" (click)="fileService.exportToXlsx(filteredData(), generateFilename('analyse', 'filtered') + '.xlsx')">
                <mat-icon>description</mat-icon>
              </button>
            </div>
          </div>
          <app-data-table 
              [data]="sortedData()" 
              (sort)="onSort($event)" 
              [sortConfig]="sortConfig()"
              [visibleColumns]="visibleColumns" />
        </div>
      }
    </app-module-wrapper>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyzeComponent {
  dataService: DataService = inject(DataService);
  fileService: FileService = inject(FileService);

  allData = this.dataService.parsedData;
  visibleColumns = VISIBLE_COLUMNS;

  filterSearchText = signal('');
  filterFraktion = signal('');
  filterKategorie = signal('');
  sortConfig = signal<{ key: SortableKey; direction: SortDirection } | null>({ key: 'id', direction: 'ascending' });

  uniqueFraktionen = signal<string[]>(['']);
  uniqueKategorien = signal<string[]>(['']);

  constructor() {
    effect(() => {
        const data = this.allData();
        if (data.length > 0) {
            const fraktionen = new Set(data.map(e => e.Fraktion).filter(Boolean) as string[]);
            this.uniqueFraktionen.set(['', ...Array.from(fraktionen)].sort());

            const kategorien = new Set<string>();
            data.forEach(e => e.zugeordneteKategorien?.split(';').forEach(k => kategorien.add(k.trim())));
            this.uniqueKategorien.set(['', ...Array.from(kategorien)].sort());
        }
    });
  }

  filteredData = computed(() => {
    const data = this.allData();
    const searchText = this.filterSearchText().toLowerCase();
    const fraktion = this.filterFraktion();
    const kategorie = this.filterKategorie();

    return data.filter(entry => {
      if (searchText && ![entry.question, entry.answer, entry.kernaussage, entry.begruendung].join(' ').toLowerCase().includes(searchText)) return false;
      if (fraktion && entry.Fraktion !== fraktion) return false;
      if (kategorie && !(entry.zugeordneteKategorien || '').split(';').map(k => k.trim()).includes(kategorie)) return false;
      return true;
    });
  });

  sortedData = computed(() => {
    const data = this.filteredData();
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

  onSort(key: SortableKey) {
    const current = this.sortConfig();
    const direction: SortDirection = (current?.key === key && current.direction === 'ascending') ? 'descending' : 'ascending';
    this.sortConfig.set({ key, direction });
  }
}