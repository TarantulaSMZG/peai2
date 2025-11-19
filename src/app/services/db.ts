import Dexie, { Table } from 'dexie';
import { ParsedEntry } from 'app/types';

export class PeaiDexieDb extends Dexie {
  parsedEntries!: Table<ParsedEntry, number>; 

  constructor() {
    super('peaiDatabase');
    // FIX: Cast to any to avoid TypeScript errors with Dexie's chained method declarations.
    (this as any).version(1).stores({
      // Schema definition: 'primaryKey,indexedProp1,indexedProp2...'
      // We use 'id' from our ParsedEntry type as the primary key.
      // Additional properties are indexed for fast queries.
      parsedEntries: 'id, sourceReference, questioner, kernaussage, zugeordneteKategorien, Fraktion'
    });
  }
}

export const db = new PeaiDexieDb();