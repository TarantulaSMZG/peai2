import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-io-field',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div>
      <div class="flex justify-between items-center mb-2 min-h-[40px] flex-wrap gap-2">
        <div class="flex items-center gap-4 flex-wrap">
          <label class="md-typescale-body-large" [for]="id()">{{ label() }}</label>
          <ng-content select="[labelAdornment]" />
        </div>
        <div class="flex gap-1 items-center">
          <ng-content select="[customActions]" />
          @if (canCopy()) {
            <md-icon-button (click)="handleCopy()" title="In Zwischenablage kopieren" [disabled]="disabled()">
              <span class="material-symbols-outlined">{{ copyIcon() }}</span>
            </md-icon-button>
          }
          @if (canClear()) {
            <md-icon-button (click)="clear.emit()" title="Text leeren" [disabled]="disabled()">
              <span class="material-symbols-outlined">close</span>
            </md-icon-button>
          }
        </div>
      </div>
      <md-outlined-text-field
        [id]="id()"
        type="textarea"
        [rows]="rows()"
        class="w-full"
        style="max-height: 40vh; resize: vertical;"
        [value]="value()"
        (input)="onValueChange($event)"
        [disabled]="disabled()"
        [readOnly]="isOutput()"
        [label]="placeholder()"
      />
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
