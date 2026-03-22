import { exec } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import type {
  MemoryEntry,
  MemoryRestartStatus,
  UpdateMemoryResult,
} from "@clawview/shared";

import {
  invalidateOpenClawSnapshot,
  readOpenClawSnapshot,
} from "../adapters/openclaw-files.adapter";
import { config, resolveClawdDir } from "../lib/config";
import { NotFoundError, ValidationError } from "../lib/errors";
import { logger } from "../lib/logger";
import { invalidateGatewayUsageCostSummary } from "./gateway-usage.service";
import { getDashboardSnapshot, mockMemory } from "./mock-data.service";

const execAsync = promisify(exec);

function getOpenClawMemoryEntry(memoryId: string): MemoryEntry {
  const target = readOpenClawSnapshot().memory.find(
    (entry) => entry.id === memoryId,
  );

  if (!target) {
    const error = new NotFoundError();
    error.message = "未找到对应的记忆条目。";
    throw error;
  }

  return target;
}

function writeAtomicFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, filePath);
}

function deriveSummaryFromContent(content: string): string {
  return (
    content
      .split("\n")
      .map((line) => line.replace(/^[-*#\s]+/, "").trim())
      .find(Boolean)
      ?.slice(0, 140) ?? "OpenClaw 记忆条目"
  );
}

async function triggerGatewayRestart(): Promise<MemoryRestartStatus> {
  if (!config.CLAWVIEW_ENABLE_OPENCLAW_CLI) {
    return {
      success: false,
      message: "记忆已保存，但当前部署未启用 OpenClaw CLI，未自动重启网关。",
      command: "disabled",
    };
  }

  const restartCommand = config.CLAWVIEW_GATEWAY_RESTART_COMMAND.trim();

  try {
    const { stdout, stderr } = restartCommand
      ? await execAsync(restartCommand, {
          timeout: 10_000,
        })
      : await execAsync(`${config.CLAWVIEW_OPENCLAW_BIN} gateway restart`, {
          timeout: 10_000,
        });

    return {
      success: true,
      message: stdout.trim() || stderr.trim() || "网关已重启。",
      command: restartCommand || `${config.CLAWVIEW_OPENCLAW_BIN} gateway restart`,
    };
  } catch (error) {
    logger.warn({ error }, "Gateway restart failed after memory update");
    return {
      success: false,
      message: "记忆已保存，但网关重启失败，请稍后手动重启。",
      command: restartCommand || `${config.CLAWVIEW_OPENCLAW_BIN} gateway restart`,
    };
  }
}

export function getMemoryEntries(): MemoryEntry[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().memory;
  }

  return getDashboardSnapshot().memory;
}

export async function updateMemoryEntry(
  memoryId: string,
  updates: {
    content: string;
  },
): Promise<UpdateMemoryResult> {
  const nextContent = updates.content.trim();

  if (!nextContent) {
    const error = new ValidationError();
    error.message = "记忆内容不能为空。";
    throw error;
  }

  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    const target = getOpenClawMemoryEntry(memoryId);

    writeAtomicFile(
      resolve(resolveClawdDir(), target.sourceLabel),
      `${nextContent}\n`,
    );

    invalidateOpenClawSnapshot();
    invalidateGatewayUsageCostSummary();
    const restart = await triggerGatewayRestart();
    const entries = readOpenClawSnapshot().memory;

    return {
      entries,
      restart,
    };
  }

  const target = mockMemory.find((memory) => memory.id === memoryId);
  if (!target) {
    const error = new NotFoundError();
    error.message = "未找到对应的记忆条目。";
    throw error;
  }

  target.content = nextContent;
  target.rawContent = `${nextContent}\n`;
  target.summary = deriveSummaryFromContent(nextContent);
  target.updatedAt = Date.now();

  return {
    entries: mockMemory,
    restart: {
      success: true,
      message: "模拟模式下无需重启网关。",
      command: null,
    },
  };
}
