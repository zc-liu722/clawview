import { Hono } from "hono";
import { z } from "zod";

import {
  getMemoryEntries,
  updateMemoryEntry,
} from "../services/memory-governance.service";

export const memoryRoute = new Hono();

const updateMemorySchema = z.object({
  content: z.string().min(1).max(50_000),
});

memoryRoute.get("/", (c) => {
  return c.json({
    data: getMemoryEntries(),
  });
});

memoryRoute.patch("/:memoryId", async (c) => {
  const memoryId = c.req.param("memoryId");
  const body = updateMemorySchema.parse(await c.req.json());

  return c.json({
    data: await updateMemoryEntry(memoryId, body),
  });
});
