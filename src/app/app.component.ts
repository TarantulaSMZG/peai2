import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from 'app/core/footer/footer.component';
import { ThemeToggleButtonComponent } from 'app/core/theme-toggle-button/theme-toggle-button.component';
import { FloatingStatusComponent } from 'app/shared/floating-status/floating-status.component';
import { ThemeService } from 'app/services/theme.service';

@Component({
  selector: 'app-root',
  template: `
    <main>
      <router-outlet />
    </main>
    <app-floating-status />
    <app-footer />
    <app-theme-toggle-button />
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterOutlet,
    FooterComponent,
    ThemeToggleButtonComponent,
    FloatingStatusComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent {
  // FIX: Injected service as a class property with an explicit type to ensure proper type inference.
  private themeService: ThemeService = inject(ThemeService);

  constructor() {
    this.themeService.initializeTheme();
  }
}