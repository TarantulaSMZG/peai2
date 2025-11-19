import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo-icon',
  standalone: true,
  template: `
    @if (simple()) {
      <svg 
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <path d="M 35 25 H 65 V 75 H 35 Z" />
        <path d="M 42 35 H 58 M 42 45 H 58 M 42 55 H 50" />
        <circle cx="58" cy="58" r="14" />
        <line x1="69" y1="69" x2="82" y2="82" />
      </svg>
    } @else {
      <svg
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="50" fill="var(--md-sys-color-on-background)" />
        <g stroke="var(--md-sys-color-background)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 35 25 H 65 V 75 H 35 Z" fill="none" />
          <path d="M 42 35 H 58 M 42 45 H 58 M 42 55 H 50" fill="none" />
          <circle cx="58" cy="58" r="14" fill="none" />
          <line x1="69" y1="69" x2="82" y2="82" />
        </g>
      </svg>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoIconComponent {
  simple = input<boolean>(false);
}
