import { Component, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA, input, output, viewChild, ElementRef, signal, effect, computed } from '@angular/core';
import { ParsedEntry } from 'app/types';

type DialogElement = HTMLElement & { show: () => void; close: (returnValue?: string) => void; returnValue: string };

@Component({
  selector: 'app-edit-modal',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-dialog #dialog (close)="onDialogClose()">
      @if (editedEntry(); as entry) {
        <div slot="headline">
            Eintrag #{{ entry.id }} bearbeiten
            <span class="text-on-surface-variant ml-4">
                ({{ entry.sourceReference }})
            </span>
        </div>
        <div slot="content" class="dialog-content-grid">
            @if (entry.note) {
              <md-outlined-text-field
                  label="Anmerkung" type="textarea" rows="5"
                  class="w-full"
                  [value]="entry.note || ''"
                  (input)="handleChange('note', $event.target.value)">
              </md-outlined-text-field>
            } @else {
              <md-outlined-text-field label="Fragesteller" type="textarea" rows="1" class="w-full" [value]="entry.questioner || ''" (input)="handleChange('questioner', $event.target.value)"></md-outlined-text-field>
              <md-outlined-text-field label="Frage" type="textarea" rows="5" class="w-full" [value]="entry.question || ''" (input)="handleChange('question', $event.target.value)"></md-outlined-text-field>
              <md-outlined-text-field label="Zeuge" type="textarea" rows="1" class="w-full" [value]="entry.witness || ''" (input)="handleChange('witness', $event.target.value)"></md-outlined-text-field>
              <md-outlined-text-field label="Antwort" type="textarea" rows="8" class="w-full" [value]="entry.answer || ''" (input)="handleChange('answer', $event.target.value)"></md-outlined-text-field>
            }
        </div>
        <div slot="actions">
            <md-outlined-button (click)="dialogRef()?.close('cancel')">Abbrechen</md-outlined-button>
            <md-filled-button (click)="onSave()" value="save">Speichern</md-filled-button>
        </div>
      }
    </md-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditModalComponent {
  entry = input<ParsedEntry | null>();
  close = output<void>();
  save = output<ParsedEntry>();

  dialog = viewChild<ElementRef<DialogElement>>('dialog');
  dialogRef = computed(() => this.dialog()?.nativeElement);

  editedEntry = signal<ParsedEntry | null>(null);

  constructor() {
    effect(() => {
      const currentEntry = this.entry();
      if (currentEntry) {
        this.editedEntry.set({ ...currentEntry });
        this.dialogRef()?.show();
      } else {
        this.dialogRef()?.close();
      }
    });
  }

  handleChange(field: keyof ParsedEntry, value: string) {
    this.editedEntry.update(entry => entry ? { ...entry, [field]: value || null } : null);
  }

  onSave() {
    if (this.editedEntry()) {
      this.save.emit(this.editedEntry()!);
      this.dialogRef()?.close('save');
    }
  }

  onDialogClose() {
    if (this.dialogRef()?.returnValue !== 'save') {
      this.close.emit();
    }
  }
}