import { readHistory, HistoryEntry } from "../config.js";

export interface HistoryInput {
  programId?: string;
  limit?: number;
}

export interface HistoryResult {
  entries: HistoryEntry[];
  total: number;
}

export async function history(input: HistoryInput): Promise<HistoryResult> {
  const entries = readHistory(input.limit ?? 50, input.programId);
  return { entries, total: entries.length };
}
