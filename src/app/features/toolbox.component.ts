import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-toolbox',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="pt-8 flex flex-col gap-6">
      <router-outlet />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolboxComponent {}
