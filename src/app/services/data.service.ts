import { Injectable, signal } from '@angular/core';
import { from, tap, catchError, of } from 'rxjs';
import { db } from './db';
import { ParsedEntry } from 'app/types';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  private notificationService = new NotificationService();
  
  private readonly _parsedData = signal<ParsedEntry[]>([]);
  public readonly parsedData = this._parsedData.asReadonly();
  
  private readonly _isLoading = signal<boolean>(true);
  public readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this._isLoading.set(true);
    from(db.parsedEntries.toArray()).pipe(
      tap(data => {
        this._parsedData.set(data);
        this._isLoading.set(false);
      }),
      catchError(err => {
        console.error("Error loading initial data from IndexedDB:", err);
        this.notificationService.showError('Fehler beim Laden der initialen Daten.');
        this._isLoading.set(false);
        return of([]);
      })
    ).subscribe();
  }
  
  async loadDataIntoDb(entries: ParsedEntry[]): Promise<void> {
    if (!entries) return;
    this._isLoading.set(true);
    try {
      // FIX: Cast db to any to avoid TypeScript errors with missing 'transaction' property in strict mode
      await (db as any).transaction('rw', db.parsedEntries, async () => {
        await db.parsedEntries.clear(); // Clear previous data
        await db.parsedEntries.bulkAdd(entries); // bulkAdd is highly optimized
      });
      this.loadInitialData(); // Refresh signal after update
    } catch (error) {
      console.error("Error writing to IndexedDB:", error);
      this.notificationService.showError('Fehler beim Speichern der Daten in der Datenbank.');
      this._isLoading.set(false);
    }
  }

  async updateEntry(entry: ParsedEntry): Promise<void> {
    try {
      await db.parsedEntries.put(entry);
      this.loadInitialData(); // Refresh signal after update
    } catch (error) {
      console.error(`Failed to update entry #${entry.id}:`, error);
      this.notificationService.showError(`Fehler beim Aktualisieren von Eintrag #${entry.id}.`);
    }
  }

  async clearDatabase(): Promise<void> {
    this._isLoading.set(true);
    try {
      await db.parsedEntries.clear();
      this.loadInitialData(); // Refresh signal after update
      this.notificationService.showStatus('Datenbank erfolgreich zurückgesetzt.');
    } catch (error) {
        console.error("Failed to clear database:", error);
        this.notificationService.showError('Fehler beim Zurücksetzen der Datenbank.');
        this._isLoading.set(false);
    }
  }
}