import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { FooterComponent } from 'app/core/footer/footer.component';
import { ThemeToggleButtonComponent } from 'app/core/theme-toggle-button/theme-toggle-button.component';
import { FloatingStatusComponent } from 'app/shared/floating-status/floating-status.component';
import { ThemeService } from 'app/services/theme.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  template: `
    <main>
      <router-outlet />
    </main>
    <app-floating-status />
    @if (showFooter()) {
      <app-footer />
    }
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
  ]
})
export class AppComponent {
  private themeService: ThemeService = inject(ThemeService);
  private router: Router = inject(Router);

  showFooter = signal(false);

  constructor() {
    this.themeService.initializeTheme();
    
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.showFooter.set(event.urlAfterRedirects.startsWith('/tools'));
    });
  }
}
