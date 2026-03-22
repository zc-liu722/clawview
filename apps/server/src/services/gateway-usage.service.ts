import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { config, resolveOpenClawHome } from "../lib/config";

interface GatewayUsageTotals {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  totalCost?: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  missingCostEntries?: number;
}

interface GatewayUsageModelAggregate {
  provider?: string;
  model?: string;
  count?: number;
  totals?: GatewayUsageTotals;
}

interface GatewayUsageDailyAggregate {
  date?: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  tokens?: number;
  totalCost?: number;
  cost?: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  missingCostEntries?: number;
}

interface RawGatewayUsageSummary {
  updatedAt?: number;
  totals?: GatewayUsageTotals;
  daily?: GatewayUsageDailyAggregate[];
  aggregates?: {
    byModel?: GatewayUsageModelAggregate[];
    daily?: GatewayUsageDailyAggregate[];
  };
}

export interface GatewayUsageSummary {
  updatedAt?: number;
  source: "local_log" | "gateway_cli";
  hasAuthoritativeCosts: boolean;
  totals: GatewayUsageTotals;
  aggregates?: {
    byModel?: GatewayUsageModelAggregate[];
    daily?: GatewayUsageDailyAggregate[];
  };
}

const CACHE_TTL_MS = 30_000;
const FAILURE_CACHE_TTL_MS = 10_000;

let cachedSummary:
  | {
      value: GatewayUsageSummary | null;
      expiresAt: number;
    }
  | undefined;

function normalizeUsageSummary(
  raw: RawGatewayUsageSummary,
  source: GatewayUsageSummary["source"],
): GatewayUsageSummary | null {
  const totals = raw.totals;
  if (!totals) {
    return null;
  }

  const daily = raw.aggregates?.daily ?? raw.daily;
  const hasAuthoritativeCosts =
    typeof totals.totalCost === "number" && totals.totalCost > 0
      ? true
      : (totals.inputCost ?? 0) > 0 ||
          (totals.outputCost ?? 0) > 0 ||
          (totals.cacheReadCost ?? 0) > 0 ||
          (totals.cacheWriteCost ?? 0) > 0 ||
          (totals.missingCostEntries ?? 0) > 0;

  return {
    updatedAt: raw.updatedAt,
    source,
    hasAuthoritativeCosts,
    totals: {
      ...totals,
      totalCost: hasAuthoritativeCosts ? totals.totalCost : undefined,
    },
    aggregates: {
      byModel: raw.aggregates?.byModel,
      daily: daily?.map((entry) => ({
        ...entry,
        tokens: entry.tokens ?? entry.totalTokens,
        cost:
          hasAuthoritativeCosts && typeof entry.cost === "number"
            ? entry.cost
            : hasAuthoritativeCosts && typeof entry.totalCost === "number"
              ? entry.totalCost
              : undefined,
      })),
    },
  };
}

function parseEmbeddedUsageSummary(line: string): GatewayUsageSummary | null {
  try {
    const parsedLine = JSON.parse(line) as Record<string, unknown>;
    const embeddedPayload =
      typeof parsedLine["0"] === "string" ? parsedLine["0"] : null;
    if (!embeddedPayload || !embeddedPayload.includes("\"updatedAt\"")) {
      return null;
    }

    const parsedPayload = JSON.parse(embeddedPayload) as RawGatewayUsageSummary;
    return normalizeUsageSummary(parsedPayload, "local_log");
  } catch {
    return null;
  }
}

function getGatewayLogDirCandidates(): string[] {
  const configuredDir = config.CLAWVIEW_OPENCLAW_LOG_DIR.trim();
  const openClawHome = resolveOpenClawHome();
  return [
    configuredDir || null,
    join(tmpdir(), "openclaw"),
    join(openClawHome, "logs"),
    join(openClawHome, ".logs"),
  ].filter((dirPath): dirPath is string => Boolean(dirPath));
}

function readGatewayUsageSummaryFromLogs(): GatewayUsageSummary | null {
  for (const logDir of getGatewayLogDirCandidates()) {
    if (!existsSync(logDir)) {
      continue;
    }

    const logFiles = readdirSync(logDir)
      .filter((entry) => entry.startsWith("openclaw-") && entry.endsWith(".log"))
      .map((entry) => join(logDir, entry))
      .sort(
        (left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs,
      );

    for (const logFile of logFiles.slice(0, 3)) {
      try {
        const raw = readFileSync(logFile, "utf8");
        const lines = raw.split("\n").reverse();

        for (const line of lines) {
          if (
            !line.includes("\"updatedAt\"") ||
            !line.includes("\"totalTokens\"")
          ) {
            continue;
          }

          const summary = parseEmbeddedUsageSummary(line);
          if (summary) {
            return summary;
          }
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function readGatewayUsageSummaryViaCli(): GatewayUsageSummary | null {
  const configuredCommand = config.CLAWVIEW_GATEWAY_USAGE_COMMAND.trim();
  const result = configuredCommand
    ? spawnSync(configuredCommand, {
        encoding: "utf8",
        shell: true,
        timeout: 2_500,
      })
    : spawnSync(
        config.CLAWVIEW_OPENCLAW_BIN,
        ["gateway", "usage-cost", "--json", "--days", "30", "--timeout", "2000"],
        {
          encoding: "utf8",
          timeout: 2_500,
        },
      );

  if (result.status !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout) as RawGatewayUsageSummary;
    return normalizeUsageSummary(parsed, "gateway_cli");
  } catch {
    return null;
  }
}

function trySelfHealGateway(): boolean {
  if (!config.CLAWVIEW_GATEWAY_SELF_HEAL) {
    return false;
  }

  const restartCommand = config.CLAWVIEW_GATEWAY_RESTART_COMMAND.trim();
  const result = restartCommand
    ? spawnSync(restartCommand, {
        encoding: "utf8",
        shell: true,
        timeout: 15_000,
      })
    : spawnSync(config.CLAWVIEW_OPENCLAW_BIN, ["gateway", "restart"], {
        encoding: "utf8",
        timeout: 15_000,
      });

  if (result.status === 0) {
    return true;
  }

  return false;
}

export function getGatewayUsageCostSummary(): GatewayUsageSummary | null {
  const now = Date.now();
  if (cachedSummary && cachedSummary.expiresAt > now) {
    return cachedSummary.value;
  }

  const logSummary = readGatewayUsageSummaryFromLogs();
  if (logSummary) {
    cachedSummary = {
      value: logSummary,
      expiresAt: now + CACHE_TTL_MS,
    };
    return logSummary;
  }

  const cliSummary = readGatewayUsageSummaryViaCli();
  if (cliSummary) {
    cachedSummary = {
      value: cliSummary,
      expiresAt: now + CACHE_TTL_MS,
    };
    return cliSummary;
  }

  const healed = trySelfHealGateway();
  if (healed) {
    const healedSummary =
      readGatewayUsageSummaryFromLogs() ?? readGatewayUsageSummaryViaCli();
    if (healedSummary) {
      cachedSummary = {
        value: healedSummary,
        expiresAt: now + CACHE_TTL_MS,
      };
      return healedSummary;
    }
  }

  cachedSummary = {
    value: null,
    expiresAt: now + FAILURE_CACHE_TTL_MS,
  };
  return null;
}

export function invalidateGatewayUsageCostSummary(): void {
  cachedSummary = undefined;
}
