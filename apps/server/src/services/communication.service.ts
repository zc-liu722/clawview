import { execFile } from "node:child_process";

import { config } from "../lib/config";
import { logger } from "../lib/logger";

export interface OutboundMessageOptions {
  channel: string;
  target: string;
  message: string;
}

export function sendOutboundMessage({
  channel,
  target,
  message,
}: OutboundMessageOptions): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    execFile(
      "openclaw",
      [
        "message",
        "send",
        "--channel",
        channel,
        "--target",
        target,
        "--message",
        message,
        "--json",
      ],
      { timeout: config.CLAWVIEW_STATUS_MESSAGE_COOLDOWN_MS },
      (error, stdout, stderr) => {
        if (error) {
          logger.warn(
            {
              channel,
              target,
              stdout: stdout.trim() || null,
              stderr: stderr.trim() || null,
            },
            "Failed to send outbound ClawView message",
          );
          resolve({
            success: false,
            message: stderr.trim() || "消息发送失败。",
          });
          return;
        }

        resolve({
          success: true,
          message: stdout.trim() || "消息已发送。",
        });
      },
    );
  });
}
