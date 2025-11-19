import { ChangeDetectionStrategy, Component, computed, effect, input, output, viewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { ParsedEntry, SortableKey, SortDirection } from 'app/types';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [MatTableModule, MatSortModule, MatIconModule],
  template: `
    <div class="overflow-auto max-h-[60vh] border border-gray-300 dark:border-gray-700 rounded-lg">
      <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="min-w-full">

        <!-- Note Row -->
        <ng-container matColumnDef="note">
          <td mat-cell *matCellDef="let entry" [attr.colspan]="displayedColumns().length" class="p-4 italic text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600">
            Anmerkung: {{ entry.note }} (Fundstelle: {{ entry.sourceReference || 'N/A' }})
          </td>
        </ng-container>

        <!-- Standard Columns -->
        @for (key of allColumns; track key) {
          <ng-container [matColumnDef]="key">
            <th mat-header-cell *matHeaderCellDef mat-sort-header [style.min-width]="colMinWidth[key]" class="p-4 text-left font-medium whitespace-nowrap">
              {{ headerMap[key] || key }}
            </th>
            <td mat-cell *matCellDef="let entry" class="p-4 align-top border-t border-gray-200 dark:border-gray-600" [class.font-medium]="key === 'id' || key === 'questioner' || key === 'witness' || key === 'Fraktion'">
                {{ getCellValue(key, entry) }}
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns(); sticky: true"></tr>
        <tr mat-row *matRowDef="let row; columns: isNote(row) ? ['note'] : displayedColumns()" (click)="rowClick.emit(row)" class="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"></tr>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  data = input.required<ParsedEntry[]>();
  sortConfig = input<{ key: SortableKey; direction: SortDirection } | null>();
  visibleColumns = input<SortableKey[]>();
  
  rowClick = output<ParsedEntry>();
  sort = output<SortableKey>();

  // FIX: Use signal-based viewChild instead of the decorator syntax.
  matSort = viewChild(MatSort);

  dataSource = new MatTableDataSource<ParsedEntry>();

  headerMap: Record<string, string> = {
    id: '#', sourceReference: 'Fundstelle', questioner: 'Fragesteller', question: 'Frage', witness: 'Zeuge', answer: 'Antwort', kernaussage: 'Kernaussage', zugeordneteKategorien: 'Zugeordnete Kategorie(n)', begruendung: 'Begründung', note: 'Anmerkung', Fraktion: 'Fraktion', searchReason: 'Relevanzgrund'
  };
  colMinWidth: Record<string, string> = {
    kernaussage: '300px', begruendung: '300px', zugeordneteKategorien: '250px', question: '450px', answer: '450px', searchReason: '300px'
  };

  allColumns: SortableKey[] = ['id', 'sourceReference', 'questioner', 'question', 'witness', 'answer', 'kernaussage', 'zugeordneteKategorien', 'begruendung', 'Fraktion', 'searchReason'];

  private qaCounterCache = new Map<number, number>();

  constructor() {
    effect(() => {
      const entries = this.data();
      this.updateQaCounters(entries);
      this.dataSource.data = entries;
      // FIX: Access matSort as a signal and provide a null fallback for the dataSource.
      this.dataSource.sort = this.matSort() ?? null;
    });
  }

  displayedColumns = computed((): SortableKey[] => {
    const visible = this.visibleColumns();
    if (visible && visible.length > 0) return visible;

    if (this.data().length === 0) return [];
    
    const baseKeys: SortableKey[] = ['id', 'sourceReference', 'questioner', 'question', 'witness', 'answer'];
    const hasAnalysisData = this.data().some(d => d.kernaussage || d.zugeordneteKategorien || d.begruendung);
    if (hasAnalysisData) baseKeys.push('kernaussage', 'zugeordneteKategorien', 'begruendung');
    
    const hasSearchReason = this.data().some(d => d.searchReason);
    if (hasSearchReason) baseKeys.push('searchReason');

    const firstItemKeys = Object.keys(this.data()[0]);
    return baseKeys.filter(k => firstItemKeys.includes(k)) as SortableKey[];
  });

  private updateQaCounters(data: ParsedEntry[]) {
    this.qaCounterCache.clear();
    let counter = 0;
    data.forEach(entry => {
      if (!entry.note) {
        counter++;
      }
      this.qaCounterCache.set(entry.id, counter);
    });
  }

  getCellValue(key: SortableKey, entry: ParsedEntry): string | number {
    if (key === 'id' && !entry.note) return this.qaCounterCache.get(entry.id) || entry.id;
    if (key === 'id' && entry.note) return entry.id;
    return String(entry[key] ?? '');
  }

  isNote = (entry: ParsedEntry): boolean => !!entry.note;

  onSortChange(sortState: any) {
    this.sort.emit(sortState.active as SortableKey);
  }
}