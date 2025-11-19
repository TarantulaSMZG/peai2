import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ParsedEntry } from 'app/types';

@Component({
  selector: 'app-edit-modal',
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>
      Eintrag #{{ editedEntry().id }} bearbeiten
      <span class="text-gray-500 ml-4 font-normal">
          ({{ editedEntry().sourceReference }})
      </span>
    </h2>
    <mat-dialog-content class="dialog-content-grid">
      @if (editedEntry().note) {
        <mat-form-field appearance="outline">
          <mat-label>Anmerkung</mat-label>
          <textarea matInput rows="5"
            [value]="editedEntry().note || ''"
            (input)="handleChange('note', ($event.target as HTMLInputElement).value)">
          </textarea>
        </mat-form-field>
      } @else {
        <mat-form-field appearance="outline">
          <mat-label>Fragesteller</mat-label>
          <textarea matInput cdkTextareaAutosize [cdkAutosizeMinRows]="1"
            [value]="editedEntry().questioner || ''" (input)="handleChange('questioner', ($event.target as HTMLInputElement).value)"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Frage</mat-label>
          <textarea matInput cdkTextareaAutosize [cdkAutosizeMinRows]="3"
            [value]="editedEntry().question || ''" (input)="handleChange('question', ($event.target as HTMLInputElement).value)"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Zeuge</mat-label>
          <textarea matInput cdkTextareaAutosize [cdkAutosizeMinRows]="1"
            [value]="editedEntry().witness || ''" (input)="handleChange('witness', ($event.target as HTMLInputElement).value)"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Antwort</mat-label>
          <textarea matInput cdkTextareaAutosize [cdkAutosizeMinRows]="5"
            [value]="editedEntry().answer || ''" (input)="handleChange('answer', ($event.target as HTMLInputElement).value)"></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Abbrechen</button>
        <button mat-flat-button color="primary" [mat-dialog-close]="editedEntry()">Speichern</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditModalComponent {
  public dialogRef = inject(MatDialogRef<EditModalComponent>);
  private data: ParsedEntry = inject(MAT_DIALOG_DATA);

  editedEntry = signal<ParsedEntry>({ ...this.data });

  handleChange(field: keyof ParsedEntry, value: string) {
    this.editedEntry.update(entry => ({ ...entry, [field]: value || null }));
  }
}