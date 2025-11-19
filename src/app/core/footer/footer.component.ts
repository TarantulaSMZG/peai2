import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { LogoIconComponent } from 'app/shared/logo-icon/logo-icon.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass, LogoIconComponent],
  styleUrls: ['./footer.component.css'],
  template: `
    <footer class="fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 flex justify-around items-stretch border-t border-gray-300 dark:border-gray-700 z-[100]">
      @for (tab of tabs; track tab.label) {
        @if (tab.isHome) {
          <a [routerLink]="['/']" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="footer-nav-button" [title]="tab.label">
             <div class="nav-content">
                <app-logo-icon [simple]="true" style="width: 24px; height: 24px;"></app-logo-icon>
                <span class="text-xs font-medium">{{ tab.label }}</span>
              </div>
          </a>
        } @else {
           <a [routerLink]="tab.route" routerLinkActive="active" class="footer-nav-button" [title]="tab.label">
             <div class="nav-content">
                <span class="material-symbols-outlined">{{ tab.icon }}</span>
                <span class="text-xs font-medium">{{ tab.label }}</span>
              </div>
          </a>
        }
      }
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  tabs = [
    { label: 'OCR', icon: 'document_scanner', route: '/tools/ocr', isHome: false },
    { label: 'Parser', icon: 'mediation', route: '/tools/parser', isHome: false },
    { label: 'pea I', icon: 'logo', isHome: true },
    { label: 'Analyze', icon: 'science', route: '/tools/analyze', isHome: false },
    { label: 'Search', icon: 'search', route: '/tools/search', isHome: false },
    { label: 'Insights', icon: 'insights', route: '/tools/insights', isHome: false }
  ];
}