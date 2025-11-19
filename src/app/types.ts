export interface ParsedEntry {
  id: number;
  sourceReference: string;
  questioner: string | null;
  question: string | null;
  witness: string | null;
  answer: string | null;
  note: string | null;
  kernaussage?: string;
  zugeordneteKategorien?: string;
  begruendung?: string;
  Fraktion?: string;
  searchReason?: string;
}

export type SortableKey = keyof ParsedEntry;
export type SortDirection = 'ascending' | 'descending';

export interface KeyInsightItem {
    title: string;
    description: string;
    references: string;
}

export interface KeyInsights {
    summary: string;
    insights: KeyInsightItem[];
}

export interface CorpusItem {
    id: string;
    category: string;
    description: string;
    subItems?: CorpusItem[];
}
