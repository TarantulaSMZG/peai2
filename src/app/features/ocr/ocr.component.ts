import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ModuleWrapperComponent } from 'app/shared/module-wrapper/module-wrapper.component';
import { IoFieldComponent } from 'app/shared/io-field/io-field.component';
import { FileService } from 'app/services/file.service';
import { NotificationService } from 'app/services/notification.service';
import { getRandomQuote } from 'app/utils/quotes';

@Component({
  selector: 'app-ocr',
  standalone: true,
  imports: [ModuleWrapperComponent, IoFieldComponent, MatButtonModule, MatIconModule],
  template: `
    <app-module-wrapper
        title="OCR"
        description="Laden Sie eine PDF-Datei hoch, um deren Rohtextinhalt mittels Optical Character Recognition (OCR) zu extrahieren. Die Ausgabe ist der vollständige Text, bereit zum Parsen.">
      
      <div class="flex flex-col items-center gap-2">
          <div class="action-buttons">
              <input type="file" #fileInput (change)="onFileChange($event)" class="hidden" accept="application/pdf" />
              <button mat-flat-button color="primary" (click)="fileInput.click()" [disabled]="isLoading()">
                  <mat-icon>upload_file</mat-icon>
                  PDF hochladen
              </button>

              @if (isLoading()) {
                  <button mat-stroked-button (click)="onAbort()">
                      <mat-icon>cancel</mat-icon>
                      Abbrechen
                  </button>
              }
          </div>
          @if (fileName()) {
            <span class="mat-body-2 text-gray-500 dark:text-gray-400">Datei: <strong>{{ fileName() }}</strong></span>
          }
      </div>

      <app-io-field
          label="Ausgabe"
          [value]="outputText()"
          (valueChange)="outputText.set($event)"
          [placeholder]="placeholder"
          [rows]="15"
          [showCopy]="true"
          [isOutput]="true"
          [showClear]="true"
          (clear)="onClear()">
        
          @if (ocrConfidence() !== null) {
            <div labelAdornment class="flex items-center gap-2 text-gray-600 dark:text-gray-300" [title]="'Confidence Level: ' + confidenceLabel()">
              <span class="w-3 h-3 rounded-full" [style.backgroundColor]="confidenceColor()"></span>
              <span class="mat-body-2">
                Geschätzte Genauigkeit: <strong>{{ confidenceLabel() }}</strong> ({{ ocrConfidence()?.toFixed(1) }}%)
              </span>
            </div>
          }
      </app-io-field>
    </app-module-wrapper>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcrComponent {
  private fileService: FileService = inject(FileService);
  private notificationService: NotificationService = inject(NotificationService);

  isLoading = signal(false);
  outputText = signal('');
  fileName = signal('');
  ocrConfidence = signal<number | null>(null);
  
  stopSignal = signal(false);
  placeholder = getRandomQuote();

  confidenceColor = () => {
    const conf = this.ocrConfidence();
    if (conf === null) return 'transparent';
    if (conf >= 90) return 'var(--mat-primary-color)';
    if (conf >= 75) return 'var(--mat-accent-color)';
    return 'var(--mat-warn-color)';
  }

  confidenceLabel = () => {
    const conf = this.ocrConfidence();
    if (conf === null) return '';
    if (conf >= 90) return 'Hoch';
    if (conf >= 75) return 'Mittel';
    return 'Gering';
  }

  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.outputText.set('');
    this.ocrConfidence.set(null);
    this.fileName.set(file.name);
    this.isLoading.set(true);
    this.stopSignal.set(false);
    
    try {
      const { text, confidence } = await this.fileService.extractTextFromPdf(file, (msg) => this.notificationService.showLoading(msg), this.stopSignal);
      
      if (this.stopSignal()) {
        this.notificationService.showStatus('Vorgang vom Benutzer abgebrochen.');
      } else {
        this.outputText.set(text);
        this.ocrConfidence.set(confidence);
        this.notificationService.showStatus(`Text aus ${file.name} extrahiert. Geschätzte Genauigkeit: ${confidence.toFixed(1)}%`);
      }
    } catch (e: any) {
      this.notificationService.showError(e.message);
    } finally {
      this.isLoading.set(false);
      this.notificationService.clear();
      input.value = '';
    }
  }

  onAbort() {
    this.stopSignal.set(true);
  }

  onClear() {
    this.outputText.set('');
    this.fileName.set('');
    this.ocrConfidence.set(null);
  }
}