import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NotificationService } from 'app/services/notification.service';

@Component({
  selector: 'app-floating-status',
  standalone: true,
  imports: [NgClass, NgStyle, MatProgressSpinnerModule, MatProgressBarModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <style>
      @keyframes gemini-border-glow {
        0%, 100% {
          box-shadow: 0 0 8px 2px rgba(66, 133, 244, 0.5), 0 0 12px 4px rgba(66, 133, 244, 0.3);
        }
        25% {
          box-shadow: 0 0 8px 2px rgba(219, 68, 55, 0.5), 0 0 12px 4px rgba(219, 68, 55, 0.3);
        }
        50% {
          box-shadow: 0 0 8px 2px rgba(244, 180, 0, 0.5), 0 0 12px 4px rgba(244, 180, 0, 0.3);
        }
        75% {
          box-shadow: 0 0 8px 2px rgba(15, 157, 88, 0.5), 0 0 12px 4px rgba(15, 157, 88, 0.3);
        }
      }
    </style>
    @if (statusMessage(); as msg) {
      <div 
        class="fixed top-6 left-1/2 flex items-center gap-4 px-6 py-3 rounded-full shadow-lg transition-transform duration-300 ease-in-out z-[1000] min-w-[320px] max-w-[90vw] bg-white dark:bg-gray-800"
        [ngClass]="{
          'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100': msg.type === 'error',
          'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100': msg.type !== 'error',
          'translate-y-0 opacity-100': isVisible(),
          '-translate-y-[150%] opacity-0': !isVisible()
        }"
        [style.animation]="isLoading() ? 'gemini-border-glow 3s infinite ease-in-out' : 'none'"
        style="transform: translateX(-50%);"
      >
        @if (msg.type === 'error') {
          <span class="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
        } @else if (isLoading()) {
          <mat-progress-spinner 
            [mode]="progress() === null ? 'indeterminate' : 'determinate'"
            [value]="progress() ? progress()! * 100 : 0"
            diameter="24">
          </mat-progress-spinner>
        }
        <div class="flex flex-col flex-grow gap-1 min-w-0">
          <span class="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            {{ cleanMessage() }}
          </span>
          @if (isLoading() && progress() !== null) {
            <mat-progress-bar [value]="progress()! * 100" mode="determinate"></mat-progress-bar>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingStatusComponent {
  private notificationService = new NotificationService();
  
  readonly statusMessage = this.notificationService.message;
  readonly isVisible = computed(() => !!this.statusMessage());
  readonly isLoading = computed(() => this.statusMessage()?.type === 'loading');

  private readonly progressInfo = computed(() => {
    const message = this.statusMessage()?.message || '';
    if (!this.isLoading()) {
      return { progress: null, cleanMessage: message };
    }
    const progressMatch = message.match(/\b(\d{1,3})%\b/);
    if (progressMatch) {
      const percentage = parseInt(progressMatch[1], 10);
      const progress = percentage / 100;
      const cleanMessage = message.replace(/\s*\b\d{1,3}%\s*(complete)?\.?/i, '...');
      return { progress, cleanMessage };
    }
    return { progress: null, cleanMessage: message };
  });

  readonly progress = computed(() => this.progressInfo().progress);
  readonly cleanMessage = computed(() => this.progressInfo().cleanMessage);
}