import { Injectable, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { liveQuery } from 'dexie';
import { db } from './db';
import { ParsedEntry } from 'app/types';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  private notificationService = inject(NotificationService);
  
  public readonly parsedData = toSignal(
    from(liveQuery(() => db.parsedEntries.toArray())),
    { initialValue: [] as ParsedEntry[] }
  );

  // FIX: 'signal' was not defined. It is now imported from '@angular/core'.
  private readonly _isLoading = signal<boolean>(false);
  public readonly isLoading = this._isLoading.asReadonly();

  async loadDataIntoDb(entries: ParsedEntry[]): Promise<void> {
    if (!entries) return;
    this._isLoading.set(true);
    try {
      await db.transaction('rw', db.parsedEntries, async () => {
        await db.parsedEntries.clear();
        await db.parsedEntries.bulkAdd(entries);
      });
    } catch (error) {
      console.error("Error writing to IndexedDB:", error);
      this.notificationService.showError('Fehler beim Speichern der Daten in der Datenbank.');
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateEntry(entry: ParsedEntry): Promise<void> {
    try {
      await db.parsedEntries.put(entry);
    } catch (error) {
      console.error(`Failed to update entry #${entry.id}:`, error);
      this.notificationService.showError(`Fehler beim Aktualisieren von Eintrag #${entry.id}.`);
    }
  }

  async clearDatabase(): Promise<void> {
    this._isLoading.set(true);
    try {
      await db.parsedEntries.clear();
      this.notificationService.showStatus('Datenbank erfolgreich zurückgesetzt.');
    } catch (error) {
        console.error("Failed to clear database:", error);
        this.notificationService.showError('Fehler beim Zurücksetzen der Datenbank.');
    } finally {
      this._isLoading.set(false);
    }
  }
}