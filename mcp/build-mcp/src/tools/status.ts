import { readHistory } from "../config.js";

export interface StatusInput {
  buildId?: string;   // specific build ID
  limit?: number;     // when no buildId, return recent N
}

export interface StatusResult {
  builds: Array<{
    id: string;
    timestamp: string;
    type: string;
    repo?: string;
    status: string;
    artifact?: string;
    sizeBytes?: number;
    durationMs: number;
    error?: string;
  }>;
  total: number;
}

export async function buildStatus(input: StatusInput): Promise<StatusResult> {
  if (input.buildId) {
    const all = readHistory(500);
    const found = all.filter(e => e.id === input.buildId);
    return { builds: found, total: found.length };
  }
  const entries = readHistory(input.limit ?? 30);
  return { builds: entries, total: entries.length };
}
