import { Injectable, signal } from '@angular/core';

export interface StatusMessage {
  message: string;
  type: 'status' | 'loading' | 'error';
  isSticky?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private static _message = signal<StatusMessage | null>(null);
  public readonly message = NotificationService._message.asReadonly();
  
  private timeoutId: number | null = null;

  private show(msg: StatusMessage) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    NotificationService._message.set(msg);
    
    if (!msg.isSticky) {
      const duration = msg.type === 'error' ? 6000 : 4000;
      this.timeoutId = window.setTimeout(() => this.clear(), duration);
    }
  }

  showStatus(message: string): void {
    this.show({ message, type: 'status' });
  }

  showLoading(message: string): void {
    this.show({ message, type: 'loading', isSticky: true });
  }

  showError(message: string): void {
    this.show({ message, type: 'error' });
  }

  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    NotificationService._message.set(null);
  }
}
