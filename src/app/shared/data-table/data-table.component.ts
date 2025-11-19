import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ParsedEntry, SortableKey, SortDirection } from 'app/types';

@Component({
  selector: 'app-data-table',
  standalone: true,
  template: `
    <div class="overflow-auto max-h-[60vh] border border-outline-variant rounded-lg">
      <table class="min-w-full border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-surface">
          <tr>
            @for (key of headers(); track key) {
              <th 
                class="p-4 text-left font-medium text-on-surface-variant whitespace-nowrap border-b border-outline-variant"
                [class.cursor-pointer]="isSortable(key)"
                [class.sticky]="key === 'id'"
                [class.left-0]="key === 'id'"
                [class.bg-inherit]="key === 'id'"
                [style.min-width]="colMinWidth[key]"
                (click)="isSortable(key) && sort.emit(key)">
                <div class="flex items-center gap-2" [class.active]="sortConfig()?.key === key">
                  {{ headerMap[key] || key }}
                  @if (sortConfig()?.key === key) {
                    <span class="material-symbols-outlined text-base transition-transform" [class.rotate-180]="sortConfig()?.direction === 'descending'">arrow_upward</span>
                  }
                </div>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (entry of data(); track entry.id; let qaIdx = $index) {
            @if (entry.note) {
              <tr class="data-table-row even-row" (click)="rowClick.emit(entry)">
                @for (key of headers(); track key; let colIdx = $index) {
                  @if (colIdx < noteStartIndex()) {
                    <td class="p-4 align-top border-t border-outline-variant"
                        [class.sticky]="key === 'id'"
                        [class.left-0]="key === 'id'"
                        [class.bg-inherit]="key === 'id'">
                      {{ key === 'id' ? entry.id : '' }}
                    </td>
                  } @else if (colIdx === noteStartIndex()) {
                    <td class="p-4 align-top border-t border-outline-variant italic text-on-surface-variant" [attr.colspan]="noteColSpan()">
                      Anmerkung: {{ entry.note }} (Fundstelle: {{ entry.sourceReference || 'N/A' }})
                    </td>
                  }
                }
              </tr>
            } @else {
              <tr class="data-table-row" 
                  [class.bg-surface-container-low]="(qaPairCounter(qaIdx)) % 2 === 0"
                  (click)="rowClick.emit(entry)">
                @for (key of headers(); track key) {
                  <td class="p-4 align-top border-t border-outline-variant"
                      [style.min-width]="colMinWidth[key]"
                      [class.sticky]="key === 'id'"
                      [class.left-0]="key === 'id'"
                      [class.bg-inherit]="key === 'id'"
                      [class.font-medium]="key === 'id' || key === 'questioner' || key === 'witness' || key === 'Fraktion'">
                      {{ getCellValue(key, entry, qaPairCounter(qaIdx)) }}
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .data-table-row:hover {
      background-color: color-mix(in srgb, var(--md-sys-color-primary) 8%, var(--md-sys-color-surface)) !important;
      cursor: pointer;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  data = input.required<ParsedEntry[]>();
  sortConfig = input<{ key: SortableKey; direction: SortDirection } | null>();
  visibleColumns = input<SortableKey[]>();
  
  rowClick = output<ParsedEntry>();
  sort = output<SortableKey>();

  headerMap: Record<string, string> = {
    id: '#', sourceReference: 'Fundstelle', questioner: 'Fragesteller', question: 'Frage', witness: 'Zeuge', answer: 'Antwort', kernaussage: 'Kernaussage', zugeordneteKategorien: 'Zugeordnete Kategorie(n)', begruendung: 'Begründung', note: 'Anmerkung', Fraktion: 'Fraktion', searchReason: 'Relevanzgrund'
  };
  colMinWidth: Record<string, string> = {
    kernaussage: '300px', begruendung: '300px', zugeordneteKategorien: '250px', question: '450px', answer: '450px', searchReason: '300px'
  };

  headers = computed((): SortableKey[] => {
    const visible = this.visibleColumns();
    if (visible && visible.length > 0) {
      return visible.includes('id') ? ['id', ...visible.filter(k => k !== 'id')] : visible;
    }
    if (this.data().length === 0) return [];
    
    const baseKeys: SortableKey[] = ['id', 'sourceReference', 'questioner', 'question', 'witness', 'answer'];
    const hasAnalysisData = this.data().some(d => d.kernaussage || d.zugeordneteKategorien || d.begruendung);
    if (hasAnalysisData) baseKeys.push('kernaussage', 'zugeordneteKategorien', 'begruendung');
    
    const allKeys = Object.keys(this.data()[0]);
    return baseKeys.filter(k => allKeys.includes(k)) as SortableKey[];
  });

  private _qaCounterCache = new Map<number, number>();
  qaPairCounter(index: number): number {
      if (this._qaCounterCache.has(index)) {
          return this._qaCounterCache.get(index)!;
      }
      let counter = 0;
      for (let i = 0; i <= index; i++) {
          if (!this.data()[i].note) {
              counter++;
          }
      }
      this._qaCounterCache.set(index, counter);
      return counter;
  }

  noteStartIndex = computed(() => this.headers().findIndex(h => h === 'sourceReference' || h === 'questioner') || 1);
  noteColSpan = computed(() => this.headers().length - this.noteStartIndex());

  isSortable = (key: SortableKey) => key !== 'note';

  getCellValue(key: SortableKey, entry: ParsedEntry, qaCounter: number): string | number {
    if (key === 'id' && entry.question) return qaCounter;
    return String(entry[key] ?? '');
  }
}
