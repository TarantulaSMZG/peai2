import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['./landing.component.css'],
  template: `
    <div class="h-full flex flex-col pt-4">
      <!-- Header -->
      <header class="flex justify-between items-center mb-16">
        <span class="material-symbols-outlined text-on-surface text-2xl">menu</span>
        <span class="md-typescale-title-large font-brand text-on-surface" style="font-size: 22px;">
          pea I
        </span>
        <div class="w-8 h-8 rounded-full p-0.5" style="background: linear-gradient(45deg, #4285F4, #EA4335, #FBBC04, #34A853);">
          <div class="w-full h-full rounded-full bg-surface flex items-center justify-center overflow-hidden">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
              alt="User Profile" 
              class="w-full h-full"
            />
          </div>
        </div>
      </header>

      <!-- Greeting -->
      <div class="mb-10">
        <h1 class="font-brand leading-tight m-0 mb-2 inline-block" style="font-size: clamp(48px, 8vw, 64px); background: linear-gradient(90deg, #4285F4, #9B72CB, #EA4335); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em;">
          Hi there
        </h1>
        <h2 class="font-brand leading-tight m-0 text-outline font-normal" style="font-size: clamp(48px, 8vw, 64px); letter-spacing: -0.02em;">
          Where should we start?
        </h2>
      </div>

      <!-- Action Pills -->
      <div class="flex flex-col gap-1 items-start">
        @for (mod of modules; track mod.title) {
          <a [routerLink]="mod.route" class="gemini-pill">
            <span class="material-symbols-outlined text-2xl text-transparent bg-clip-text" [style.background]="mod.color">
              {{ mod.icon }}
            </span>
            <span class="md-typescale-label-large" style="font-size: 1.1rem; font-weight: 500;">
              {{ mod.title }}
            </span>
          </a>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  modules = [
    { title: 'Extract Text (OCR)', icon: 'document_scanner', color: 'linear-gradient(135deg, #EA4335, #FF6D01)', route: '/tools/ocr' },
    { title: 'Parse Protocol', icon: 'mediation', color: 'linear-gradient(135deg, #FBBC04, #F9AB00)', route: '/tools/parser' },
    { title: 'Analyze Data', icon: 'science', color: 'linear-gradient(135deg, #34A853, #0F9D58)', route: '/tools/analyze' },
    { title: 'Semantic Search', icon: 'search', color: 'linear-gradient(135deg, #4285F4, #1967D2)', route: '/tools/search' },
    { title: 'Key Insights', icon: 'insights', color: 'linear-gradient(135deg, #A142F4, #8E24AA)', route: '/tools/insights' },
  ];
}
