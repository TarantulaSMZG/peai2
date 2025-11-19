import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-io-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-1 min-h-[40px] flex-wrap gap-2">
        <div class="flex items-center gap-4 flex-wrap">
          <label class="mat-body-1" [for]="id()">{{ label() }}</label>
          <ng-content select="[labelAdornment]" />
        </div>
        <div class="flex gap-1 items-center">
          <ng-content select="[customActions]" />
          @if (canCopy()) {
            <button mat-icon-button (click)="handleCopy()" title="In Zwischenablage kopieren" [disabled]="disabled()">
              <mat-icon>{{ copyIcon() }}</mat-icon>
            </button>
          }
          @if (canClear()) {
            <button mat-icon-button (click)="clear.emit()" title="Text leeren" [disabled]="disabled()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
      </div>
      <mat-form-field class="w-full" appearance="outline">
        <mat-label>{{ placeholder() }}</mat-label>
        <textarea
          matInput
          [id]="id()"
          [rows]="rows()"
          class="w-full"
          style="max-height: 40vh; resize: vertical;"
          [value]="value()"
          (input)="onValueChange($event)"
          [disabled]="disabled()"
          [readonly]="isOutput()">
        </textarea>
      </mat-form-field>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IoFieldComponent {
  label = input.required<string>();
  value = input.required<string>();
  placeholder = input<string>('');
  rows = input<number>(8);
  disabled = input<boolean>(false);
  showCopy = input<boolean>(false);
  isOutput = input<boolean>(false);
  showClear = input<boolean>(false);

  valueChange = output<string>();
  clear = output<void>();

  copyIcon = signal('content_copy');

  id = () => this.label().replace(/\s+/g, '-').toLowerCase();
  canCopy = () => !!this.value() && this.showCopy();
  canClear = () => !!this.value() && this.showClear();

  onValueChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }

  handleCopy(): void {
    if (this.value()) {
      navigator.clipboard.writeText(this.value());
      this.copyIcon.set('check');
      setTimeout(() => this.copyIcon.set('content_copy'), 2000);
    }
  }
}