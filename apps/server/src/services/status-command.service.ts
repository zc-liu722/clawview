import { getRecentStatusCommandRequests } from "../adapters/openclaw-files.adapter";
import { config, getStatusPageUrl } from "../lib/config";
import { logger } from "../lib/logger";
import { sendOutboundMessage } from "./communication.service";

const sentStatusCommandMap = new Map<string, number>();

function pruneSentStatusCommands(now: number): void {
  for (const [key, sentAt] of sentStatusCommandMap.entries()) {
    if (now - sentAt > config.CLAWVIEW_STATUS_MESSAGE_COOLDOWN_MS) {
      sentStatusCommandMap.delete(key);
    }
  }
}

export async function flushStatusCommandNotifications(): Promise<void> {
  if (!config.CLAWVIEW_NOTIFY_ON_STATUS) {
    return;
  }

  const now = Date.now();
  pruneSentStatusCommands(now);

  const requests = getRecentStatusCommandRequests();

  for (const request of requests) {
    if (!request.channel || !request.target) {
      continue;
    }

    const dedupeKey = `${request.sessionId}:${request.eventId}`;
    if (sentStatusCommandMap.has(dedupeKey)) {
      continue;
    }

    sentStatusCommandMap.set(dedupeKey, now);
    const statusUrl = getStatusPageUrl();
    const result = await sendOutboundMessage({
      channel: request.channel,
      target: request.target,
      message: `状态面板：${statusUrl}`,
    });

    if (!result.success) {
      logger.warn(
        {
          request,
          detail: result.message,
        },
        "Status page link delivery failed",
      );
      sentStatusCommandMap.delete(dedupeKey);
    }
  }
}
