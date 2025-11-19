import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  
  private readonly _theme = signal<Theme>('light');
  public readonly theme = this._theme.asReadonly();

  initializeTheme(): void {
    const storedTheme = localStorage.getItem(this.THEME_KEY) as Theme | null;
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = storedTheme || preferredTheme;
    this.setTheme(initialTheme);
  }

  toggleTheme(): void {
    this.setTheme(this._theme() === 'light' ? 'dark' : 'light');
  }

  private setTheme(theme: Theme): void {
    this._theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }
}
