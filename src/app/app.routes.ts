import { Routes } from '@angular/router';
import { LandingComponent } from 'app/core/landing/landing.component';
import { ToolboxComponent } from 'app/features/toolbox.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: LandingComponent,
    pathMatch: 'full'
  },
  {
    path: 'tools',
    component: ToolboxComponent,
    children: [
      {
        path: 'ocr',
        loadComponent: () => import('app/features/ocr/ocr.component').then(m => m.OcrComponent)
      },
      {
        path: 'parser',
        loadComponent: () => import('app/features/parser/parser.component').then(m => m.ParserComponent)
      },
      {
        path: 'analyze',
        loadComponent: () => import('app/features/analyze/analyze.component').then(m => m.AnalyzeComponent)
      },
      {
        path: 'search',
        loadComponent: () => import('app/features/search/search.component').then(m => m.SearchComponent)
      },
      {
        path: 'insights',
        loadComponent: () => import('app/features/insights/insights.component').then(m => m.InsightsComponent)
      },
      {
        path: '',
        redirectTo: 'ocr',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
