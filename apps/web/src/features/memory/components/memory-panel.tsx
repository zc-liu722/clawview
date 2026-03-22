import type { MemoryEntry } from "@clawview/shared";
import { useState } from "react";

import { Panel } from "@/components/ui/panel";
import { formatRelativeTime } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/sanitize-display";

import { useMemorySearch } from "../hooks/use-memory-search";
import { MemoryDetailSheet } from "./memory-detail-sheet";
import { MemorySearchBar } from "./memory-search-bar";

interface MemoryPanelProps {
  memory: MemoryEntry[];
}

export function MemoryPanel({ memory }: MemoryPanelProps) {
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const { query, setQuery, filteredMemories } = useMemorySearch(memory);

  return (
    <Panel title="记忆中心" eyebrow="查看 / 编辑">
      <MemorySearchBar query={query} onQueryChange={setQuery} />
      <div className="stack-list">
        {filteredMemories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="list-card memory-card"
            onClick={() => setSelectedEntry(entry)}
          >
            <div>
              <strong>{entry.summary}</strong>
              <p>{entry.sourceLabel}</p>
              <p>{sanitizeDisplayText(entry.content, "暂无内容", 120)}</p>
              <p>最后使用：{formatRelativeTime(entry.lastUsedAt)}</p>
            </div>
            <span className="memory-card-status">可编辑</span>
          </button>
        ))}
      </div>
      <MemoryDetailSheet
        entry={selectedEntry}
        open={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
      />
    </Panel>
  );
}
