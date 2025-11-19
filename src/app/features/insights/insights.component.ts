import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ModuleWrapperComponent } from 'app/shared/module-wrapper/module-wrapper.component';
import { DataTableComponent } from 'app/shared/data-table/data-table.component';
import { EditModalComponent } from 'app/shared/edit-modal/edit-modal.component';
import { DataService } from 'app/services/data.service';
import { GeminiService } from 'app/services/gemini.service';
import { FileService } from 'app/services/file.service';
import { NotificationService } from 'app/services/notification.service';
import { generateFilename } from 'app/utils/filename';
import { renderMarkdown } from 'app/utils/markdown';
import { KeyInsights, ParsedEntry, SortableKey, SortDirection } from 'app/types';

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [
    ModuleWrapperComponent, DataTableComponent, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <app-module-wrapper
      title="Insights"
      description="Die KI synthetisiert die in der Datenbank gespeicherten Daten, um eine Zusammenfassung und die drei wichtigsten Kernaussagen zu generieren.">
      
      @if (dataService.isLoading()) {
        <div class="placeholder-card" style="min-height: 400px; justify-content: center;">
          <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
          <h3 class="mat-h3">Lade Daten...</h3>
        </div>
      } @else if (data().length === 0) {
        <div class="placeholder-card">
          <span class="material-symbols-outlined">dataset_linked</span>
          <h3 class="mat-h3">Keine Daten gefunden</h3>
          <p class="mat-body-1">Bitte laden Sie zuerst eine Datei im <strong>Parser</strong>-Modul hoch, um Einblicke zu generieren.</p>
        </div>
      } @else {
        <div class="action-buttons">
          <button mat-flat-button color="primary" (click)="findInsights()" [disabled]="isLoading()">
              <mat-icon>insights</mat-icon>
              Find Insights
          </button>
          @if (isGenerating()) {
              <button mat-stroked-button (click)="abort()">
                   <mat-icon>cancel</mat-icon>
                  Abbrechen
              </button>
          }
        </div>
        
        @if (insights(); as result) {
          <div class="bg-gray-200 dark:bg-gray-800 p-6 rounded-3xl flex flex-col gap-6">
            <div class="flex justify-between items-center">
              <h2 class="mat-h2">Generated Insights</h2>
              <div class="flex gap-2">
                  <button mat-icon-button (click)="copyInsights()" title="Copy as Markdown"><mat-icon>{{ copyIcon() }}</mat-icon></button>
                  <button mat-icon-button (click)="exportInsights()" title="Export as Markdown"><mat-icon>download</mat-icon></button>
              </div>
            </div>
            <div>
              <h3 class="mat-h3">Zusammenfassung</h3>
              <p class="mat-body-1 mt-2" [innerHTML]="sanitize(renderMarkdown(result.summary))"></p>
            </div>
            <div class="flex flex-col gap-6">
              <h3 class="mat-h3">Kernaussagen</h3>
              @for (item of result.insights; track $index) {
                <div class="p-4 rounded-lg shadow-md bg-white dark:bg-gray-700">
                  <h4 class="mat-h4 m-0 mb-2">{{ item.title }}</h4>
                  <p class="mat-body-1 m-0 mb-3" [innerHTML]="sanitize(renderMarkdown(item.description))"></p>
                  <p class="mat-body-1 m-0" [innerHTML]="renderReferences(item.references)"></p>
                </div>
              }
            </div>
          </div>
        } @else {
          @if (isGenerating()) {
            <div class="placeholder-card"><mat-progress-spinner mode="indeterminate"></mat-progress-spinner><h3 class="mat-h3">Generating Insights...</h3></div>
          } @else {
            <div class="placeholder-card">
              <span class="material-symbols-outlined">auto_awesome</span>
              <h3 class="mat-h3">Bereit, Einblicke zu generieren</h3>
              <p class="mat-body-1">Klicken Sie auf "Find Insights", um die {{ data().length }} Einträge aus der Datenbank zu analysieren.</p>
            </div>
          }
        }
        
        <div class="mt-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="mat-h2">Quelldaten ({{ data().length }})</h2>
            <div class="flex gap-2">
              <button mat-icon-button title="Export as CSV" (click)="fileService.exportToCsv(data(), generateFilename(protocolNumber(), 'analyzed') + '.csv')" [disabled]="isLoading()">
                <mat-icon>csv</mat-icon>
              </button>
              <button mat-icon-button title="Export as XLSX" (click)="fileService.exportToXlsx(data(), generateFilename(protocolNumber(), 'analyzed') + '.xlsx')" [disabled]="isLoading()">
                <mat-icon>description</mat-icon>
              </button>
            </div>
          </div>
          <app-data-table [data]="sortedData()" (rowClick)="openEditModal($event)" (sort)="onSort($event)" [sortConfig]="sortConfig()" />
        </div>
      }
    </app-module-wrapper>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsComponent {
  dataService: DataService = inject(DataService);
  geminiService: GeminiService = inject(GeminiService);
  fileService: FileService = inject(FileService);
  notificationService: NotificationService = inject(NotificationService);
  sanitizer: DomSanitizer = inject(DomSanitizer);
  dialog: MatDialog = inject(MatDialog);

  insights = signal<KeyInsights | null>(null);
  isGenerating = signal(false);
  copyIcon = signal('content_copy');

  sortConfig = signal<{ key: SortableKey; direction: SortDirection } | null>({ key: 'id', direction: 'ascending' });
  
  abortController: AbortController | null = null;
  data = this.dataService.parsedData;
  isLoading = computed(() => this.isGenerating() || this.dataService.isLoading());

  protocolNumber = computed(() => {
    const d = this.data();
    if (d.length === 0 || !d[0].sourceReference) return 'XX';
    return d[0].sourceReference.match(/WP(\d+)/i)?.[1] || 'XX';
  });

  async findInsights() {
    this.abortController = new AbortController();
    this.insights.set(null);
    this.isGenerating.set(true);
    this.notificationService.showLoading('Generiere Kernaussagen...');

    try {
      const result = await this.geminiService.generateInsights(this.data(), this.abortController.signal);
      this.insights.set(result);
      this.notificationService.showStatus('Kernaussagen erfolgreich generiert.');
    } catch (e: any) {
       if (e.message !== 'Operation was aborted.') this.notificationService.showError(`Fehler bei der Generierung: ${e.message}`);
       else this.notificationService.showStatus('Generierung abgebrochen.');
    } finally {
      this.isGenerating.set(false);
      this.notificationService.clear();
      this.abortController = null;
    }
  }

  abort() { this.abortController?.abort(); }
  
  getInsightsAsMarkdown(): string {
    const result = this.insights();
    if (!result) return '';
    let text = `# Generated Insights\n\n## Summary\n\n${result.summary}\n\n---\n\n## Key Insights\n\n`;
    result.insights.forEach((item, index) => {
        text += `### ${index + 1}. ${item.title}\n${item.description}\n**References:** ${item.references}\n\n`;
    });
    return text.trim();
  }

  copyInsights() {
    const markdown = this.getInsightsAsMarkdown();
    if (markdown) {
        navigator.clipboard.writeText(markdown);
        this.copyIcon.set('check');
        setTimeout(() => this.copyIcon.set('content_copy'), 2000);
        this.notificationService.showStatus('Insights als Markdown kopiert.');
    }
  }

  exportInsights() {
    const markdown = this.getInsightsAsMarkdown();
    if (markdown) {
        const filename = `${generateFilename(this.protocolNumber(), 'insights')}.md`;
        this.fileService.exportTextFile(markdown, filename, 'text/markdown');
    }
  }

  onSort(key: SortableKey) {
    const current = this.sortConfig();
    const direction: SortDirection = (current?.key === key && current.direction === 'ascending') ? 'descending' : 'ascending';
    this.sortConfig.set({ key, direction });
  }

  sortedData = computed(() => {
    const data = this.data();
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
    await this.dataService.updateEntry(updatedEntry);
    this.notificationService.showStatus(`Eintrag #${updatedEntry.id} aktualisiert.`);
  }

  renderReferences(references: string): string {
    if (!references) return 'Belege: N/A';
    const refs = references.split(',').map(r => r.trim()).filter(Boolean);
    if (refs.length === 0) return 'Belege: N/A';
    // Using a placeholder for color, will be handled by theme
    return 'Belege: ' + refs.map(ref => `<strong class="text-primary-600 dark:text-primary-400 font-medium">${ref}</strong>`).join(', ');
  }

  sanitize(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}