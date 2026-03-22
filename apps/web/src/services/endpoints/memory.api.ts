import type { UpdateMemoryResult } from "@clawview/shared";

import { apiPatch } from "../api-client";

export function updateMemory(
  memoryId: string,
  options: {
    content: string;
  },
): Promise<UpdateMemoryResult> {
  return apiPatch<UpdateMemoryResult>(
    `/api/v1/memory-entries/${memoryId}`,
    options,
  );
}
