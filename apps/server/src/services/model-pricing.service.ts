import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config, resolveOpenClawHome } from "../lib/config";
import { expandHomePath } from "../lib/path-utils";

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  source:
    | "openclaw_config"
    | "clawview_override"
    | "builtin_registry";
  sourceUrl?: string;
  note?: string;
}

interface OpenClawModelConfig {
  id?: string;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

interface OpenClawConfig {
  models?: {
    providers?: Record<
      string,
      {
        models?: OpenClawModelConfig[];
      }
    >;
  };
}

interface RegistryEntry {
  keys?: string[];
  currency?: "USD" | "CNY";
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  note?: string;
}

interface PricingRegistryFile {
  models?: RegistryEntry[];
}

function getPricingRegistryPaths(): string[] {
  const serviceDir = dirname(fileURLToPath(import.meta.url));

  return [
    resolve(serviceDir, "../../pricing-registry.json"),
    resolve(serviceDir, "../../../../pricing-registry.json"),
    resolve(process.cwd(), "apps/server/pricing-registry.json"),
    resolve(process.cwd(), "pricing-registry.json"),
  ];
}

let cachedPricing:
  | {
      expiresAt: number;
      value: Map<string, ModelPricing>;
    }
  | undefined;

function normalizeNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function normalizePricing(
  pricing: Partial<Record<keyof Omit<ModelPricing, "source" | "sourceUrl" | "note">, unknown>>,
): Omit<ModelPricing, "source" | "sourceUrl" | "note"> | null {
  const normalized = {
    input: normalizeNonNegativeNumber(pricing.input),
    output: normalizeNonNegativeNumber(pricing.output),
    cacheRead: normalizeNonNegativeNumber(pricing.cacheRead),
    cacheWrite: normalizeNonNegativeNumber(pricing.cacheWrite),
  };

  return normalized.input > 0 ||
    normalized.output > 0 ||
    normalized.cacheRead > 0 ||
    normalized.cacheWrite > 0
    ? normalized
    : null;
}

function getOpenClawConfigPaths(): string[] {
  const configuredFile = expandHomePath(config.CLAWVIEW_OPENCLAW_CONFIG_FILE);
  const openClawHome = resolveOpenClawHome();

  return [
    isAbsolute(configuredFile)
      ? configuredFile
      : resolve(openClawHome, configuredFile),
    resolve(openClawHome, "openclaw.json"),
  ];
}

function convertCurrencyToCny(value: number, currency: string | undefined): number {
  if (currency === "USD") {
    return value * config.CLAWVIEW_USD_TO_CNY_RATE;
  }

  return value;
}

function readPricingRegistry(): Map<string, ModelPricing> {
  for (const registryPath of getPricingRegistryPaths()) {
    if (!existsSync(registryPath)) {
      continue;
    }

    try {
      const raw = readFileSync(registryPath, "utf8");
      const parsed = JSON.parse(raw) as PricingRegistryFile;
      const pricingMap = new Map<string, ModelPricing>();

      for (const entry of parsed.models ?? []) {
        const keys = entry.keys?.filter(Boolean) ?? [];
        if (keys.length === 0) {
          continue;
        }

        const normalized = normalizePricing({
          input: convertCurrencyToCny(entry.input ?? 0, entry.currency),
          output: convertCurrencyToCny(entry.output ?? 0, entry.currency),
          cacheRead: convertCurrencyToCny(
            entry.cacheRead ?? 0,
            entry.currency,
          ),
          cacheWrite: convertCurrencyToCny(
            entry.cacheWrite ?? 0,
            entry.currency,
          ),
        });
        if (!normalized) {
          continue;
        }

        for (const key of keys) {
          pricingMap.set(key, {
            ...normalized,
            source: "builtin_registry",
            sourceUrl: entry.sourceUrl,
            note: entry.note,
          });
        }
      }

      return pricingMap;
    } catch {
      continue;
    }
  }

  return new Map();
}

function readOpenClawModelPricing(): Map<string, ModelPricing> {
  for (const configPath of getOpenClawConfigPaths()) {
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      const raw = readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw) as OpenClawConfig;
      const pricingMap = new Map<string, ModelPricing>();

      for (const [provider, providerConfig] of Object.entries(
        parsed.models?.providers ?? {},
      )) {
        for (const model of providerConfig.models ?? []) {
          if (!model.id) {
            continue;
          }

          const normalized = normalizePricing(model.cost ?? {});
          if (!normalized) {
            continue;
          }

          const pricing: ModelPricing = {
            ...normalized,
            source: "openclaw_config",
          };

          pricingMap.set(`${provider}/${model.id}`, pricing);
          pricingMap.set(model.id, pricing);
        }
      }

      return pricingMap;
    } catch {
      continue;
    }
  }

  return new Map();
}

function readOverridePricing(): Map<string, ModelPricing> {
  if (!config.CLAWVIEW_MODEL_PRICING_OVERRIDES.trim()) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(
      config.CLAWVIEW_MODEL_PRICING_OVERRIDES,
    ) as Record<
      string,
      Partial<Record<keyof Omit<ModelPricing, "source" | "sourceUrl" | "note">, unknown>>
    >;
    const pricingMap = new Map<string, ModelPricing>();

    for (const [modelKey, pricing] of Object.entries(parsed)) {
      const normalized = normalizePricing(pricing);
      if (!normalized) {
        continue;
      }

      pricingMap.set(modelKey, {
        ...normalized,
        source: "clawview_override",
      });
    }

    return pricingMap;
  } catch {
    return new Map();
  }
}

function buildPricingCache(): Map<string, ModelPricing> {
  const pricingMap = readPricingRegistry();

  for (const [modelKey, pricing] of readOpenClawModelPricing()) {
    pricingMap.set(modelKey, pricing);
  }

  for (const [modelKey, pricing] of readOverridePricing()) {
    pricingMap.set(modelKey, pricing);
  }

  return pricingMap;
}

function getCachedPricing(): Map<string, ModelPricing> {
  const now = Date.now();
  if (cachedPricing && cachedPricing.expiresAt > now) {
    return cachedPricing.value;
  }

  const value = buildPricingCache();
  cachedPricing = {
    expiresAt: now + 30_000,
    value,
  };
  return value;
}

export function getModelPricing(
  provider: string | null | undefined,
  modelId: string | null | undefined,
): ModelPricing | null {
  if (!modelId) {
    return null;
  }

  const pricing = getCachedPricing();
  const fullKey =
    provider && modelId ? pricing.get(`${provider}/${modelId}`) : undefined;

  return fullKey ?? pricing.get(modelId) ?? null;
}

export function invalidateModelPricingCache(): void {
  cachedPricing = undefined;
}
