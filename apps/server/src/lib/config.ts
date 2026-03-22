import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

import { expandHomePath } from "./path-utils";

const envFilePath = resolve(process.cwd(), ".env");

if (typeof process.loadEnvFile === "function" && existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

const configSchema = z.object({
  CLAWVIEW_HOST: z.string().default("0.0.0.0"),
  CLAWVIEW_PORT: z.coerce.number().int().default(8787),
  CLAWVIEW_ALLOWED_ORIGIN: z.string().default("*"),
  CLAWVIEW_DATA_SOURCE: z.enum(["mock", "openclaw"]).default("mock"),
  CLAWVIEW_OPENCLAW_HOME: z.string().default("/data/openclaw"),
  CLAWVIEW_OPENCLAW_BIN: z.string().default("openclaw"),
  CLAWVIEW_OPENCLAW_CONFIG_FILE: z.string().default("openclaw.json"),
  CLAWVIEW_OPENCLAW_LOG_DIR: z.string().default(""),
  CLAWVIEW_CLAWD_DIR: z.string().default("~/clawd"),
  CLAWVIEW_OPENCLAW_SESSIONS_DIR: z.string().default("agents/main/sessions"),
  CLAWVIEW_OPENCLAW_MEMORY_FILE: z.string().default("MEMORY.md"),
  CLAWVIEW_OPENCLAW_MEMORY_DIR: z.string().default("memory"),
  CLAWVIEW_AGENT_ID: z.string().default("agent_local"),
  CLAWVIEW_AGENT_NAME: z.string().default("我的 OpenClaw"),
  CLAWVIEW_BASE_URL: z.string().default("http://localhost:5173"),
  CLAWVIEW_STATUS_PATH: z.string().default("/"),
  CLAWVIEW_GATEWAY_RESTART_COMMAND: z.string().default(""),
  CLAWVIEW_GATEWAY_USAGE_COMMAND: z.string().default(""),
  CLAWVIEW_GATEWAY_SELF_HEAL: z.coerce.boolean().default(true),
  CLAWVIEW_MODEL_PRICING_OVERRIDES: z.string().default(""),
  CLAWVIEW_USD_TO_CNY_RATE: z.coerce.number().positive().default(7.2),
  CLAWVIEW_NOTIFY_ON_STATUS: z.coerce.boolean().default(true),
  CLAWVIEW_STATUS_MESSAGE_COOLDOWN_MS: z.coerce.number().int().default(60_000),
  CLAWVIEW_TASK_ACTIVE_WINDOW_MS: z.coerce
    .number()
    .int()
    .default(5 * 60_000),
});

export const config = configSchema.parse(process.env);

function resolveCandidatePath(pathValue: string): string {
  const expandedPath = expandHomePath(pathValue);
  return expandedPath.startsWith("/")
    ? expandedPath
    : resolve(process.cwd(), expandedPath);
}

function directoryLooksLikeMemoryHome(dirPath: string): boolean {
  return (
    existsSync(join(dirPath, config.CLAWVIEW_OPENCLAW_MEMORY_FILE)) ||
    existsSync(join(dirPath, config.CLAWVIEW_OPENCLAW_MEMORY_DIR)) ||
    existsSync(join(dirPath, "workspace"))
  );
}

export function resolveOpenClawHome(): string {
  return resolveCandidatePath(config.CLAWVIEW_OPENCLAW_HOME);
}

export function resolveClawdDir(): string {
  const explicitClawdDir = process.env.CLAWVIEW_CLAWD_DIR?.trim();
  const openClawHome = resolveOpenClawHome();
  const configuredClawdDir = resolveCandidatePath(config.CLAWVIEW_CLAWD_DIR);
  const siblingClawdDir = resolve(openClawHome, "..", "clawd");
  const homeClawdDir = resolve(homedir(), "clawd");
  const candidates = [
    explicitClawdDir ? resolveCandidatePath(explicitClawdDir) : null,
    configuredClawdDir,
    siblingClawdDir,
    homeClawdDir,
    openClawHome,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return (
    candidates.find((candidate) => existsSync(candidate) && directoryLooksLikeMemoryHome(candidate)) ??
    candidates.find((candidate) => existsSync(candidate)) ??
    candidates[0]
  );
}

export function getStatusPageUrl(): string {
  return new URL(
    config.CLAWVIEW_STATUS_PATH,
    config.CLAWVIEW_BASE_URL,
  ).toString();
}
