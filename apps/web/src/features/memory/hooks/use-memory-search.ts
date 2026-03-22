import type { MemoryEntry } from "@clawview/shared";
import { useMemo, useState } from "react";

export function useMemorySearch(memories: MemoryEntry[]) {
  const [query, setQuery] = useState("");

  const filteredMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return memories;
    }

    return memories.filter((entry) =>
      `${entry.summary} ${entry.content} ${entry.rawContent} ${entry.sourceLabel}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [memories, query]);

  return { query, setQuery, filteredMemories };
}
