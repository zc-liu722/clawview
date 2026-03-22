import { Hono } from "hono";

import { handleSseStream } from "../realtime/sse-manager";

export const realtimeRoute = new Hono();

realtimeRoute.get("/events", async (c) => {
  return handleSseStream(c);
});
