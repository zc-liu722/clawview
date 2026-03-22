import type { MemoryEntry } from "@clawview/shared";

import { MemoryPanel } from "@/features/memory/components/memory-panel";

interface MemoryTabProps {
  memory: MemoryEntry[];
}

export function MemoryTab({ memory }: MemoryTabProps) {
  return <MemoryPanel memory={memory} />;
}
