export interface MemoryEntry {
  /** Stable identifier for a memory item. */
  id: string;
  /** Short, user-readable summary of what the agent currently remembers. */
  summary: string;
  /** Plain-text content prepared for mobile-friendly reading and editing. */
  content: string;
  /** Raw markdown content stored on disk for safe round-tripping. */
  rawContent: string;
  /** Source artifact or conversation that created this memory. */
  sourceLabel: string;
  /** Timestamp of the last time the memory was referenced. */
  lastUsedAt: number;
  /** Timestamp of the latest write or update. */
  updatedAt: number;
  /** Optional expiration timestamp for governed memory lifecycle. */
  expiresAt: number | null;
  /** Whether the memory can still be used during retrieval. */
  active: boolean;
}

export interface MemoryRestartStatus {
  success: boolean;
  message: string;
  command: string | null;
}

export interface UpdateMemoryResult {
  entries: MemoryEntry[];
  restart: MemoryRestartStatus;
}
