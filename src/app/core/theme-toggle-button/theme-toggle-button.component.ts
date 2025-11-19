import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from 'app/services/theme.service';

@Component({
  selector: 'app-theme-toggle-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="fixed bottom-24 right-6 z-[99]">
      <button 
          mat-fab 
          color="primary"
          (click)="themeService.toggleTheme()" 
          [title]="'Wechsel zu ' + (isLight() ? 'Dunkel' : 'Hell')"
          [aria-label]="'Wechsel zu ' + (isLight() ? 'Dunkel' : 'Hell')">
        <mat-icon>{{ isLight() ? 'dark_mode' : 'light_mode' }}</mat-icon>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleButtonComponent {
  themeService: ThemeService = inject(ThemeService);
  isLight = () => this.themeService.theme() === 'light';
}