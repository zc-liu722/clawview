import { EventEmitter } from "node:events";

import type { ClawEvent } from "@clawview/shared";

const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);

export function publishEvent(event: ClawEvent): void {
  eventBus.emit("event", event);
}

export function subscribeToEvents(
  listener: (event: ClawEvent) => void,
): () => void {
  eventBus.on("event", listener);
  return () => {
    eventBus.off("event", listener);
  };
}
