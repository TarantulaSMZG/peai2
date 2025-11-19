import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ThemeService } from 'app/services/theme.service';

@Component({
  selector: 'app-theme-toggle-button',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="fixed bottom-24 right-6 z-[99]">
      <md-fab 
          size="small"
          (click)="themeService.toggleTheme()" 
          [title]="'Wechsel zu ' + (isLight() ? 'Dunkel' : 'Hell')"
          [ariaLabel]="'Wechsel zu ' + (isLight() ? 'Dunkel' : 'Hell')">
        <span class="material-symbols-outlined" slot="icon">
          {{ isLight() ? 'dark_mode' : 'light_mode' }}
        </span>
      </md-fab>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleButtonComponent {
  // FIX: Explicitly typed the injected service to ensure correct type inference.
  themeService: ThemeService = inject(ThemeService);
  isLight = () => this.themeService.theme() === 'light';
}