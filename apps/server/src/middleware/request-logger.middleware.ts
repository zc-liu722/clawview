import type { Context, Next } from "hono";

import { logger } from "../lib/logger";

export async function requestLogger(c: Context, next: Next): Promise<void> {
  const startedAt = Date.now();
  await next();
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      durationMs: Date.now() - startedAt,
      status: c.res.status,
    },
    "Request completed",
  );
}
