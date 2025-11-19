import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-module-wrapper',
  standalone: true,
  template: `
    <div class="shadow-[var(--md-sys-elevation-level1)] rounded-[28px] bg-surface-container-low hover:shadow-[var(--md-sys-elevation-level2)] transition-shadow">
      <div class="p-6 flex flex-col gap-6">
          <div>
              <h1 class="md-typescale-headline-small m-0 mb-2">{{ title() }}</h1>
              <p class="md-typescale-body-large m-0 text-on-surface-variant">
                  {{ description() }}
              </p>
          </div>
          <ng-content />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleWrapperComponent {
  title = input.required<string>();
  description = input.required<string>();
}
