import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import type {
  AgentStatus,
  AlertEvent,
  ApprovalRequest,
  CostSnapshot,
  MemoryEntry,
  ModelUsageBreakdown,
  TaskExecutionLog,
  TaskStep,
} from "@clawview/shared";

import { config, resolveClawdDir, resolveOpenClawHome } from "../lib/config";
import { getGatewayUsageCostSummary } from "../services/gateway-usage.service";
import { getModelPricing } from "../services/model-pricing.service";

interface TranscriptEvent {
  id?: string;
  type?: string;
  customType?: string;
  parentId?: string | null;
  role?: string;
  tool?: string;
  tool_name?: string;
  model?: string;
  modelId?: string;
  provider?: string;
  status?: string;
  content?: string | string[];
  text?: string;
  query?: string;
  prompt?: string;
  data?: {
    timestamp?: string | number;
    provider?: string;
    modelId?: string;
  };
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_cents?: number;
  cost?: number;
  timestamp?: string | number;
  created_at?: string | number;
  message?: {
    role?: string;
    model?: string;
    provider?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens?: number;
      total_tokens?: number;
      cost?:
        | {
            input?: number;
            output?: number;
            cacheRead?: number;
            cacheWrite?: number;
            total?: number;
          }
        | number;
    };
    content?: Array<{
      type?: string;
      id?: string;
      name?: string;
      arguments?: Record<string, unknown>;
      text?: string;
      thinking?: string;
    }>;
    timestamp?: string | number;
  };
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    totalTokens?: number;
    total_tokens?: number;
    cost?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      total?: number;
    } | number;
  };
  stopReason?: string;
  errorMessage?: string;
}

interface OpenClawSnapshot {
  status: AgentStatus;
  tasks: TaskExecutionLog[];
  costs: CostSnapshot[];
  memory: MemoryEntry[];
  alerts: AlertEvent[];
  approvals: ApprovalRequest[];
}

interface SessionMetadata {
  sessionId?: string;
  updatedAt?: number;
  lastTo?: string;
  deliveryContext?: {
    channel?: string;
    surface?: string;
    to?: string;
  };
  origin?: {
    provider?: string;
    surface?: string;
    to?: string;
    from?: string;
  };
}

interface SessionFileEntry {
  sessionId: string;
  filePath: string;
  updatedAt: number;
  sourceChannel: TaskExecutionLog["sourceChannel"];
  replyChannel: string | null;
  replyTarget: string | null;
}

export interface StatusCommandRequest {
  sessionId: string;
  eventId: string;
  channel: string | null;
  target: string | null;
  timestamp: number;
}

let snapshotCache:
  | {
      value: OpenClawSnapshot;
      expiresAt: number;
    }
  | undefined;

const SESSION_SCAN_MAX_DEPTH = 4;
const DIRECTORY_SCAN_EXCLUDES = new Set([
  ".git",
  "node_modules",
  ".pnpm-store",
  "dist",
  "build",
]);

function getOpenClawBasePath(): string {
  return resolveOpenClawHome();
}

function getMemoryBasePath(): string {
  return resolveClawdDir();
}

function safeReadDir(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function discoverMarkdownFiles(
  dirPath: string,
  depth = 0,
  discovered = new Set<string>(),
): string[] {
  if (depth > 3) {
    return [...discovered];
  }

  for (const entry of safeReadDir(dirPath)) {
    if (DIRECTORY_SCAN_EXCLUDES.has(entry)) {
      continue;
    }

    const entryPath = join(dirPath, entry);

    try {
      const stats = statSync(entryPath);
      if (stats.isDirectory()) {
        const normalizedName = entry.toLowerCase();
        if (
          normalizedName === "memory" ||
          normalizedName === "workspace" ||
          normalizedName === "memories" ||
          depth < 1
        ) {
          discoverMarkdownFiles(entryPath, depth + 1, discovered);
        }
        continue;
      }

      if (
        entry.endsWith(".md") &&
        (entry === config.CLAWVIEW_OPENCLAW_MEMORY_FILE ||
          depth <= 1 ||
          dirPath.endsWith(config.CLAWVIEW_OPENCLAW_MEMORY_DIR))
      ) {
        discovered.add(entryPath);
      }
    } catch {
      continue;
    }
  }

  return [...discovered];
}

function readJsonLines(filePath: string): TranscriptEvent[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TranscriptEvent)
      .filter((item) => typeof item === "object" && item !== null);
  } catch {
    return [];
  }
}

function normalizeTimestamp(
  value: string | number | undefined,
  fallback: number,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getTranscriptContent(event: TranscriptEvent): string {
  const textParts =
    event.message?.content
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean) ?? [];
  const thinkingParts =
    event.message?.content
      ?.map((part) => (typeof part.thinking === "string" ? part.thinking : ""))
      .filter(Boolean) ?? [];
  const nestedMessageContent =
    textParts.join(" ").trim() || thinkingParts.join(" ").trim();
  const candidate =
    nestedMessageContent ||
    event.content ||
    event.text ||
    event.prompt ||
    event.query;
  if (Array.isArray(candidate)) {
    return candidate.join(" ").trim();
  }

  return typeof candidate === "string" ? candidate.trim() : "";
}

function getEventRole(event: TranscriptEvent): string | undefined {
  return event.message?.role ?? event.role;
}

function getEventLabel(event: TranscriptEvent): string {
  const role = getEventRole(event);

  if (event.type === "message" && role) {
    return role;
  }

  return event.customType ?? event.type ?? role ?? "event";
}

interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
}

interface EventCostResolution {
  costCents: number;
  source: "authoritative" | "estimated" | "missing";
}

interface CostedTranscriptEvent {
  event: TranscriptEvent;
  usage: UsageSnapshot;
  cost: EventCostResolution;
}

function normalizeNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function getUsageSnapshot(event: TranscriptEvent): UsageSnapshot {
  const messageUsage = event.message?.usage;
  const eventUsage = event.usage;
  const inputTokens = normalizeNonNegativeNumber(
    messageUsage?.input ?? eventUsage?.input ?? event.input_tokens,
  );
  const outputTokens = normalizeNonNegativeNumber(
    messageUsage?.output ?? eventUsage?.output ?? event.output_tokens,
  );
  const cacheReadTokens = normalizeNonNegativeNumber(
    messageUsage?.cacheRead ?? eventUsage?.cacheRead,
  );
  const cacheWriteTokens = normalizeNonNegativeNumber(
    messageUsage?.cacheWrite ?? eventUsage?.cacheWrite,
  );
  const explicitTotalTokens = normalizeNonNegativeNumber(
    messageUsage?.totalTokens ??
      eventUsage?.totalTokens ??
      eventUsage?.total_tokens ??
      event.total_tokens,
  );
  const totalTokens =
    explicitTotalTokens ||
    inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
  };
}

function getEventProvider(event: TranscriptEvent): string | null {
  return (
    event.message?.provider ??
    event.provider ??
    event.data?.provider ??
    null
  );
}

function getEventModelId(event: TranscriptEvent): string | null {
  return (
    event.message?.model ??
    event.model ??
    event.modelId ??
    event.data?.modelId ??
    null
  );
}

function toExplicitCostCents(event: TranscriptEvent): number | null {
  if (typeof event.cost_cents === "number") {
    return Math.max(0, event.cost_cents);
  }

  if (typeof event.cost === "number") {
    return Math.max(0, event.cost * 100);
  }

  if (typeof event.message?.usage?.cost === "number") {
    return Math.max(0, event.message.usage.cost * 100);
  }

  if (typeof event.message?.usage?.cost?.total === "number") {
    return Math.max(0, event.message.usage.cost.total * 100);
  }

  if (typeof event.usage?.cost === "number") {
    return Math.max(0, event.usage.cost * 100);
  }

  if (typeof event.usage?.cost?.total === "number") {
    return Math.max(0, event.usage.cost.total * 100);
  }

  return null;
}

function estimateCostFromPricing(event: TranscriptEvent): number | null {
  const pricing = getModelPricing(getEventProvider(event), getEventModelId(event));
  if (!pricing) {
    return null;
  }

  const usage = getUsageSnapshot(event);
  const totalCostCents =
    (usage.inputTokens * pricing.input +
      usage.outputTokens * pricing.output +
      usage.cacheReadTokens * pricing.cacheRead +
      usage.cacheWriteTokens * pricing.cacheWrite) /
    10_000;

  return totalCostCents > 0 ? totalCostCents : null;
}

function resolveEventCost(event: TranscriptEvent): EventCostResolution {
  const explicitCostCents = toExplicitCostCents(event);
  if (explicitCostCents && explicitCostCents > 0) {
    return {
      costCents: explicitCostCents,
      source: "authoritative",
    };
  }

  const usage = getUsageSnapshot(event);
  if (usage.totalTokens <= 0) {
    return {
      costCents: 0,
      source: "missing",
    };
  }

  const estimatedCostCents = estimateCostFromPricing(event);
  if (estimatedCostCents !== null) {
    return {
      costCents: estimatedCostCents,
      source: "estimated",
    };
  }

  return {
    costCents: 0,
    source: "missing",
  };
}

function aggregateCostedEventsByModel(
  events: CostedTranscriptEvent[],
  fallbackModelId: string,
): ModelUsageBreakdown[] {
  const modelMap = new Map<string, ModelUsageBreakdown>();

  for (const { event, usage, cost } of events) {
    if (usage.totalTokens <= 0 && cost.costCents <= 0) {
      continue;
    }

    const modelId = getEventModelId(event) ?? fallbackModelId;
    const tokenSplit = splitTokens(usage.totalTokens);
    const current = modelMap.get(modelId) ?? {
      modelId,
      modelDisplayName: modelId,
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      callCount: 0,
    };

    current.inputTokens += tokenSplit.inputTokens;
    current.outputTokens += tokenSplit.outputTokens;
    current.costCents += cost.costCents;
    current.callCount += 1;

    modelMap.set(modelId, current);
  }

  return Array.from(modelMap.values()).sort(
    (left, right) => right.costCents - left.costCents,
  );
}

function estimateCostFromUsageAggregate(usage: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}, modelId: string | null | undefined): number | null {
  const pricing = getModelPricing(null, modelId);
  if (!pricing) {
    return null;
  }

  const inputTokens = normalizeNonNegativeNumber(usage.input);
  const outputTokens = normalizeNonNegativeNumber(usage.output);
  const cacheReadTokens = normalizeNonNegativeNumber(usage.cacheRead);
  const cacheWriteTokens = normalizeNonNegativeNumber(usage.cacheWrite);

  const totalCostCents =
    (inputTokens * pricing.input +
      outputTokens * pricing.output +
      cacheReadTokens * pricing.cacheRead +
      cacheWriteTokens * pricing.cacheWrite) /
    10_000;

  return totalCostCents > 0 ? totalCostCents : null;
}

function stripMarkdownForDisplay(content: string): string {
  return content
    .replace(/```([\s\S]*?)```/gu, (_match, block: string) =>
      block
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n"),
    )
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gmu, "")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/\*([^*]+)\*/gu, "$1")
    .replace(/^\s*[-*+]\s+/gmu, "")
    .replace(/^\s*\d+\.\s+/gmu, "")
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gmu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

const memoryLocalizationDictionary: Array<[RegExp, string]> = [
  [/Your Workspace/giu, "你的工作区"],
  [
    /This folder is home\. Treat it that way\./giu,
    "这里就是你的主工作区，按家一样对待它。",
  ],
  [/Every Session/giu, "每次会话"],
  [/Long-Term Memory/giu, "长期记忆"],
  [/Safety/giu, "安全规则"],
  [/External vs Internal/giu, "外部动作与内部动作"],
  [/Group Chats/giu, "群聊规则"],
  [/Who Am I\?/giu, "我是谁"],
  [/Who You Are/giu, "你的核心设定"],
  [/About Your Human/giu, "关于老板"],
  [/Hello, World/giu, "初始化说明"],
  [/Keep this file empty/giu, "如果想跳过心跳任务，就保持这个文件为空"],
  [/When You're Done/giu, "完成后"],
  [/Name:/giu, "名字："],
  [/Creature:/giu, "身份："],
  [/Vibe:/giu, "风格："],
  [/Avatar:/giu, "头像："],
  [/Notes:/giu, "备注："],
  [/Timezone:/giu, "时区："],
  [/Context/giu, "背景信息"],
  [/Core Truths/giu, "核心原则"],
  [/Boundaries/giu, "边界"],
  [/Continuity/giu, "延续性"],
];

function localizeMemoryDisplay(content: string): string {
  return memoryLocalizationDictionary.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    content,
  );
}

function stripTechnicalNoise(content: string): string {
  return content
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`]*`/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/<\/?[^>]+>/gu, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s*[-*+]\s+/gmu, "")
    .replace(/^\s*\d+\.\s+/gmu, "")
    .replace(/(?:^|\s)(?:[A-Za-z]:)?(?:\/[\w.-]+)+/gu, " ")
    .replace(
      /\b[a-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|sh|py|css|html)\b/giu,
      " ",
    )
    .replace(/(?:^|\s)(?:npm|pnpm|yarn|node|bash|sh|git|curl)\s+[^\n]*/giu, " ")
    .replace(/\{[^{}]{0,400}\}/gu, " ")
    .replace(/\[[^\[\]]{0,400}\]/gu, " ")
    .replace(/[<>{}[\]|\\]{2,}/gu, " ")
    .replace(
      /\b(?:const|let|var|function|return|import|export|class|interface|type)\b[^.!?\n]{0,200}/giu,
      " ",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function extractReadableSentence(content: string): string {
  const normalized = stripTechnicalNoise(content)
    .replace(/[;,:]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const segments = normalized
    .split(/(?<=[.!?。！？])\s+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const readableSegment =
    segments.find((segment) => {
      const hasLetters = /[\p{L}\p{N}]/u.test(segment);
      const looksTechnical =
        /(?:\bjson\b|\btsx?\b|\bjsx?\b|=>|SELECT\s|INSERT\s|UPDATE\s|\w+\()/iu.test(
          segment,
        );

      return hasLetters && !looksTechnical && segment.length >= 6;
    }) ?? normalized;

  return readableSegment;
}

function truncateAtWordBoundary(content: string, limit: number): string {
  if (content.length <= limit) {
    return content;
  }

  const truncated = content.slice(0, limit + 1);
  const boundary = Math.max(
    truncated.lastIndexOf(" "),
    truncated.lastIndexOf("，"),
    truncated.lastIndexOf("。"),
  );

  if (boundary >= Math.floor(limit * 0.6)) {
    return `${truncated.slice(0, boundary).trim()}...`;
  }

  return `${content.slice(0, limit).trim()}...`;
}

function sanitizePromptSummary(content: string): string {
  const readable = extractReadableSentence(content);
  return truncateAtWordBoundary(readable, 80) || "OpenClaw 任务";
}

function sanitizeNarrativeDetail(content: string): string {
  return truncateAtWordBoundary(extractReadableSentence(content), 96);
}

function buildNarrative(event: TranscriptEvent): string {
  const content = getTranscriptContent(event);
  const readableContent = sanitizeNarrativeDetail(content);
  const toolName = event.tool_name ?? event.tool;
  const type = getEventLabel(event);

  if (toolName?.includes("search")) {
    return readableContent
      ? `正在搜索相关资料：${readableContent}`
      : "正在搜索相关资料";
  }

  if (toolName?.includes("file") || toolName?.includes("read")) {
    return readableContent
      ? `正在整理文件内容：${readableContent}`
      : "正在整理文件内容";
  }

  if (toolName?.includes("memory")) {
    return readableContent
      ? `正在更新记忆：${readableContent}`
      : "正在更新记忆";
  }

  if (type.includes("tool")) {
    return readableContent
      ? `正在使用${toolName ?? "工具"}处理任务：${readableContent}`
      : `正在使用${toolName ?? "工具"}处理任务`;
  }

  if (type.includes("assistant")) {
    return readableContent
      ? `正在整理回复内容：${readableContent}`
      : "正在整理回复内容";
  }

  if (type.includes("user")) {
    return readableContent
      ? `收到任务请求：${readableContent}`
      : "收到新的任务请求";
  }

  return readableContent || "正在处理任务";
}

function toStepStatus(event: TranscriptEvent): TaskStep["status"] {
  const value = (event.status ?? getEventLabel(event) ?? "").toLowerCase();

  if (value.includes("error") || value.includes("fail")) {
    return "failed";
  }

  if (value.includes("cancel")) {
    return "cancelled";
  }

  if (value.includes("approval")) {
    return "awaiting_approval";
  }

  if (
    value.includes("complete") ||
    value.includes("done") ||
    value.includes("finish") ||
    value.includes("assistant")
  ) {
    return "completed";
  }

  if (value.includes("user")) {
    return "completed";
  }

  return "running";
}

function findSessionTranscriptPath(sessionDir: string): string | null {
  const directTranscript = join(sessionDir, "transcript.jsonl");
  if (existsSync(directTranscript)) {
    return directTranscript;
  }

  const nestedFiles = safeReadDir(sessionDir)
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => join(sessionDir, entry));

  return nestedFiles[0] ?? null;
}

function getResolvedSessionsDirs(basePath: string): string[] {
  const candidates = [
    resolve(basePath, config.CLAWVIEW_OPENCLAW_SESSIONS_DIR),
    resolve(basePath, "agents/main/sessions"),
    resolve(basePath, "sessions"),
  ];

  const discoveredDirs = discoverNestedSessionsDirs(basePath);

  return [...new Set([...candidates, ...discoveredDirs])].filter((dirPath) =>
    existsSync(dirPath),
  );
}

function directoryContainsTranscriptArtifacts(dirPath: string): boolean {
  return safeReadDir(dirPath).some((entry) => {
    const entryPath = join(dirPath, entry);

    if (entry === "sessions.json" || entry.endsWith(".jsonl")) {
      return true;
    }

    try {
      if (!statSync(entryPath).isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }

    return Boolean(findSessionTranscriptPath(entryPath));
  });
}

function discoverNestedSessionsDirs(
  dirPath: string,
  depth = 0,
): string[] {
  if (depth > SESSION_SCAN_MAX_DEPTH) {
    return [];
  }

  const discovered: string[] = [];

  for (const entry of safeReadDir(dirPath)) {
    if (DIRECTORY_SCAN_EXCLUDES.has(entry)) {
      continue;
    }

    const entryPath = join(dirPath, entry);

    try {
      if (!statSync(entryPath).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    if (entry.toLowerCase() === "sessions" && directoryContainsTranscriptArtifacts(entryPath)) {
      discovered.push(entryPath);
    }

    discovered.push(...discoverNestedSessionsDirs(entryPath, depth + 1));
  }

  return discovered;
}

function readSessionsMetadata(
  sessionsDir: string,
): Record<string, SessionMetadata> {
  const metadataPath = join(sessionsDir, "sessions.json");
  if (!existsSync(metadataPath)) {
    return {};
  }

  try {
    const raw = readFileSync(metadataPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, SessionMetadata>;

    return Object.values(parsed).reduce<Record<string, SessionMetadata>>(
      (accumulator, entry) => {
        if (entry.sessionId) {
          accumulator[entry.sessionId] = entry;
        }

        return accumulator;
      },
      {},
    );
  } catch {
    return {};
  }
}

function toSourceChannel(
  value: string | undefined,
): TaskExecutionLog["sourceChannel"] {
  const normalizedValue = (value ?? "").toLowerCase();

  switch (normalizedValue) {
    case "telegram":
    case "whatsapp":
    case "slack":
    case "discord":
    case "feishu":
    case "wechat":
      return normalizedValue as TaskExecutionLog["sourceChannel"];
    default:
      return "other";
  }
}

function getSessionFiles(basePath: string): SessionFileEntry[] {
  return getResolvedSessionsDirs(basePath)
    .flatMap((sessionsDir) => {
      const metadata = readSessionsMetadata(sessionsDir);

      return safeReadDir(sessionsDir).flatMap((entry) => {
        const entryPath = join(sessionsDir, entry);

        try {
          if (statSync(entryPath).isDirectory()) {
            const transcriptPath = findSessionTranscriptPath(entryPath);
            if (!transcriptPath) {
              return [];
            }

            return [
              {
                sessionId: basename(entryPath),
                filePath: transcriptPath,
                updatedAt: statSync(transcriptPath).mtimeMs,
                sourceChannel: "other",
                replyChannel: null,
                replyTarget: null,
              } satisfies SessionFileEntry,
            ];
          }

          if (!entry.endsWith(".jsonl")) {
            return [];
          }

          const sessionId = entry.replace(/\.jsonl$/u, "");
          const sessionMetadata = metadata[sessionId];

          return [
            {
              sessionId,
              filePath: entryPath,
              updatedAt:
                sessionMetadata?.updatedAt ?? statSync(entryPath).mtimeMs,
              sourceChannel: toSourceChannel(
                sessionMetadata?.deliveryContext?.channel ??
                  sessionMetadata?.deliveryContext?.surface ??
                  sessionMetadata?.origin?.provider ??
                  sessionMetadata?.origin?.surface,
              ),
              replyChannel:
                sessionMetadata?.deliveryContext?.channel ??
                sessionMetadata?.deliveryContext?.surface ??
                sessionMetadata?.origin?.provider ??
                sessionMetadata?.origin?.surface ??
                null,
              replyTarget:
                sessionMetadata?.deliveryContext?.to ??
                sessionMetadata?.lastTo ??
                sessionMetadata?.origin?.to ??
                sessionMetadata?.origin?.from ??
                null,
            } satisfies SessionFileEntry,
          ];
        } catch {
          return [];
        }
      });
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function isRenderableTranscriptEvent(event: TranscriptEvent): boolean {
  if (event.type === "message") {
    return true;
  }

  if (event.type === "custom" && event.customType !== "model-snapshot") {
    return true;
  }

  if (event.tool || event.tool_name) {
    return true;
  }

  return false;
}

function parseTaskFromSession(
  sessionFile: SessionFileEntry,
): TaskExecutionLog | null {
  const transcriptEvents = readJsonLines(sessionFile.filePath);
  const renderableEvents = transcriptEvents.filter(isRenderableTranscriptEvent);
  const stats = statSync(sessionFile.filePath);
  const startedAt = normalizeTimestamp(
    transcriptEvents[0]?.timestamp ??
      transcriptEvents[0]?.message?.timestamp ??
      transcriptEvents[0]?.data?.timestamp,
    stats.mtimeMs,
  );
  const promptEvent = transcriptEvents.find((event) =>
    getEventLabel(event).toLowerCase().includes("user"),
  );
  const userPromptSummary = sanitizePromptSummary(
    getTranscriptContent(promptEvent ?? {}),
  );
  const eventCosts: CostedTranscriptEvent[] = renderableEvents.map((event) => ({
    event,
    usage: getUsageSnapshot(event),
    cost: resolveEventCost(event),
  }));

  const steps = eventCosts.slice(-12).map(({ event, usage, cost }, index) => {
    const stepStartedAt = normalizeTimestamp(
      event.timestamp ??
        event.created_at ??
        event.message?.timestamp ??
        event.data?.timestamp,
      startedAt + index * 1000,
    );
    const stepStatus = toStepStatus(event);

    return {
      id: event.id ?? `${sessionFile.sessionId}_step_${index + 1}`,
      order: index + 1,
      status: stepStatus,
      narrative: buildNarrative(event),
      rawEventType: getEventLabel(event),
      toolName: event.tool_name ?? event.tool ?? null,
      modelName: getEventModelId(event),
      tokensUsed: usage.totalTokens,
      costCents: cost.costCents,
      costSource: cost.source,
      startedAt: stepStartedAt,
      completedAt: stepStatus === "running" ? null : stepStartedAt + 1000,
      durationMs: stepStatus === "running" ? null : 1000,
      errorMessage:
        stepStatus === "failed"
          ? sanitizeNarrativeDetail(getTranscriptContent(event)) ||
            "任务步骤失败。"
          : null,
    } satisfies TaskStep;
  });

  if (steps.length === 0) {
    return null;
  }

  const totalTokens = eventCosts.reduce(
    (sum, { usage }) => sum + usage.totalTokens,
    0,
  );
  const totalCostCents = eventCosts.reduce(
    (sum, { cost }) => sum + cost.costCents,
    0,
  );
  const fallbackModelId = getEventModelId(renderableEvents.at(-1) ?? {}) ?? "unknown";
  const costModels = aggregateCostedEventsByModel(eventCosts, fallbackModelId);
  const taskCostSource = eventCosts.some(({ cost }) => cost.source === "estimated")
    ? "estimated"
    : eventCosts.some(({ cost }) => cost.source === "authoritative")
      ? "authoritative"
      : "missing";
  const latestStep = steps[steps.length - 1];
  const transcriptMtime = stats.mtimeMs;
  const taskStatus =
    latestStep.status === "failed"
      ? "failed"
      : latestStep.status === "cancelled"
        ? "cancelled"
        : latestStep.rawEventType === "assistant"
          ? "completed"
          : "running";

  return {
    taskId: sessionFile.sessionId,
    sessionId: sessionFile.sessionId,
    agentId: config.CLAWVIEW_AGENT_ID,
    userPromptSummary,
    status: taskStatus,
    steps,
    totalTokens,
    totalCostCents,
    costSource: taskCostSource,
    costModels,
    primaryModel: costModels[0]?.modelId ?? latestStep.modelName ?? fallbackModelId,
    startedAt,
    completedAt: taskStatus === "running" ? null : transcriptMtime,
    sourceChannel: sessionFile.sourceChannel,
  };
}

function parseMemoryEntries(basePath: string): MemoryEntry[] {
  const memoryEntries: MemoryEntry[] = [];
  const singleMemoryPath = resolve(
    basePath,
    config.CLAWVIEW_OPENCLAW_MEMORY_FILE,
  );
  const memoryDirPath = resolve(basePath, config.CLAWVIEW_OPENCLAW_MEMORY_DIR);

  const candidateFiles = [
    singleMemoryPath,
    ...safeReadDir(basePath)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => resolve(basePath, entry)),
    ...safeReadDir(memoryDirPath)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => join(memoryDirPath, entry)),
    ...safeReadDir(resolve(basePath, "workspace"))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => resolve(basePath, "workspace", entry)),
    ...discoverMarkdownFiles(basePath),
  ];

  for (const filePath of [...new Set(candidateFiles)]) {
    if (!existsSync(filePath)) {
      continue;
    }

    const rawContent = readFileSync(filePath, "utf8").trim();
    const content = localizeMemoryDisplay(stripMarkdownForDisplay(rawContent));
    if (!content) {
      continue;
    }

    const lines = content
      .split("\n")
      .map((line) => line.replace(/^[-*#\s]+/, "").trim())
      .filter(Boolean);
    const stats = statSync(filePath);

    const sourceLabel = relative(basePath, filePath) || basename(filePath);

    memoryEntries.push({
      id: `memory_${Buffer.from(sourceLabel).toString("base64url")}`,
      summary: lines[0]?.slice(0, 140) ?? "OpenClaw 记忆条目",
      content,
      rawContent,
      sourceLabel,
      lastUsedAt: stats.mtimeMs,
      updatedAt: stats.mtimeMs,
      expiresAt: null,
      active: true,
    });
  }

  return memoryEntries;
}

function buildStatus(tasks: TaskExecutionLog[], basePath: string): AgentStatus {
  const latestSession = getSessionFiles(basePath)[0];
  const latestHeartbeat = latestSession
    ? latestSession.updatedAt
    : Date.now() - 60_000;
  const activeTask = tasks[0];
  const isActive =
    Date.now() - latestHeartbeat <= config.CLAWVIEW_TASK_ACTIVE_WINDOW_MS;
  const latestStep = activeTask?.steps.at(-1);
  const status = !existsSync(basePath)
    ? "offline"
    : !isActive
      ? "online"
      : latestStep?.status === "awaiting_approval"
        ? "awaiting_approval"
        : activeTask?.status === "completed"
          ? "online"
          : latestStep?.toolName
            ? "tool_calling"
            : "thinking";

  return {
    agentId: config.CLAWVIEW_AGENT_ID,
    agentName: config.CLAWVIEW_AGENT_NAME,
    status,
    statusText: !existsSync(basePath)
      ? "还没有找到你的 OpenClaw 数据目录。"
      : activeTask
        ? (latestStep?.narrative ?? "正在处理最近的任务")
        : "已连接你的 OpenClaw，当前没有活跃任务。",
    statusSince: latestHeartbeat,
    lastHeartbeat: latestHeartbeat,
    gatewayConnected: existsSync(basePath),
    activeTaskId: isActive ? (activeTask?.taskId ?? null) : null,
    connectedChannels: [
      {
        type: "other",
        name: "OpenClaw Local",
        connected: existsSync(basePath),
      },
    ],
  };
}

function splitTokens(totalTokens: number): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens = Math.round(totalTokens * 0.55);

  return {
    inputTokens,
    outputTokens: Math.max(0, totalTokens - inputTokens),
  };
}

function aggregateCostsAcrossTasks(tasks: TaskExecutionLog[]) {
  const modelMap = new Map<
    string,
    {
      modelId: string;
      modelDisplayName: string;
      inputTokens: number;
      outputTokens: number;
      costCents: number;
      callCount: number;
    }
  >();

  let totalTokens = 0;
  let totalCostCents = 0;

  for (const task of tasks) {
    totalTokens += task.totalTokens;
    totalCostCents += task.totalCostCents;

    for (const model of task.costModels ?? []) {
      if (model.inputTokens <= 0 && model.outputTokens <= 0 && model.costCents <= 0) {
        continue;
      }

      const current = modelMap.get(model.modelId) ?? {
        modelId: model.modelId,
        modelDisplayName: model.modelDisplayName,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        callCount: 0,
      };

      current.inputTokens += model.inputTokens;
      current.outputTokens += model.outputTokens;
      current.costCents += model.costCents;
      current.callCount += model.callCount;

      modelMap.set(model.modelId, current);
    }
  }

  return {
    totalTokens,
    totalCostCents,
    models: Array.from(modelMap.values()).sort(
      (left, right) => right.costCents - left.costCents,
    ),
  };
}

function toDateKey(timestamp: number): string {
  const date = new Date(timestamp);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildCosts(tasks: TaskExecutionLog[]): CostSnapshot[] {
  const task = tasks[0];
  const now = Date.now();
  const todayKey = toDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  const gatewayUsage = getGatewayUsageCostSummary();
  const gatewayTotals = gatewayUsage?.totals;
  const gatewayHasUsageTotals = typeof gatewayTotals?.totalTokens === "number";
  const gatewayHasAuthoritativeCosts = gatewayUsage?.hasAuthoritativeCosts === true;
  const gatewayDaily = gatewayUsage?.aggregates?.daily?.find(
    (entry) => entry.date === todayKey,
  );
  const gatewayMonthlyCost =
    gatewayUsage?.aggregates?.daily
      ?.filter((entry) => entry.date?.startsWith(monthKey))
      .reduce((sum, entry) => sum + (entry.cost ?? 0), 0) ?? null;
  const dailyTasks = tasks.filter(
    (currentTask) => toDateKey(currentTask.startedAt) === todayKey,
  );
  const monthlyTasks = tasks.filter((currentTask) =>
    toDateKey(currentTask.startedAt).startsWith(monthKey),
  );
  const taskAggregate = task
    ? aggregateCostsAcrossTasks([task])
    : { totalTokens: 0, totalCostCents: 0, models: [] };
  const dailyAggregate = aggregateCostsAcrossTasks(dailyTasks);
  const monthlyAggregate = aggregateCostsAcrossTasks(monthlyTasks);
  const dominantModelId =
    monthlyAggregate.models[0]?.modelId ??
    dailyAggregate.models[0]?.modelId ??
    taskAggregate.models[0]?.modelId ??
    task?.primaryModel ??
    null;
  const estimatedDailyCostFromUsage =
    !gatewayHasAuthoritativeCosts && gatewayDaily
      ? estimateCostFromUsageAggregate(gatewayDaily, dominantModelId)
      : null;
  const estimatedMonthlyCostFromUsage =
    !gatewayHasAuthoritativeCosts && gatewayTotals
      ? estimateCostFromUsageAggregate(gatewayTotals, dominantModelId)
      : null;
  const transcriptHasCostData = tasks.some(
    (currentTask) => currentTask.totalCostCents > 0,
  );
  const hasAnyEstimatedCostData =
    transcriptHasCostData ||
    estimatedDailyCostFromUsage !== null ||
    estimatedMonthlyCostFromUsage !== null;
  const transcriptUsesEstimatedCosts = tasks.some(
    (currentTask) => currentTask.costSource === "estimated",
  );
  const missingCostEntries = gatewayTotals?.missingCostEntries ?? 0;
  const sharedCostStatus: CostSnapshot["costStatus"] = gatewayHasAuthoritativeCosts
    ? missingCostEntries > 0
      ? "partial"
      : "available"
    : hasAnyEstimatedCostData
      ? "available"
      : "missing";
  const sharedNote =
    sharedCostStatus === "missing"
      ? hasAnyEstimatedCostData
        ? gatewayHasUsageTotals
          ? "已读取本地 OpenClaw usage 统计，但官方账单金额不可用，当前金额按模型价格估算。"
          : "网关账单暂不可用，当前金额按本地模型价格估算。"
        : "账单数据暂未从 OpenClaw 网关同步完成，且本地也缺少可用定价，当前不会再误显示为 0。"
      : sharedCostStatus === "partial"
        ? `仍有 ${missingCostEntries} 条会话缺少完整账单，当前金额可能偏低。`
        : !gatewayHasAuthoritativeCosts && hasAnyEstimatedCostData
          ? gatewayHasUsageTotals
            ? "已读取本地 OpenClaw usage 统计，但官方账单金额不可用，当前金额按模型价格估算。"
            : "网关账单暂不可用，当前金额按本地模型价格估算。"
        : null;
  const taskTokenSplit = splitTokens(taskAggregate.totalTokens);
  const dailyTokenTotal = gatewayHasUsageTotals
    ? Math.max(dailyAggregate.totalTokens, gatewayDaily?.tokens ?? 0)
    : dailyAggregate.totalTokens;
  const monthlyTokenTotal = gatewayHasUsageTotals
    ? Math.max(monthlyAggregate.totalTokens, gatewayTotals?.totalTokens ?? 0)
    : monthlyAggregate.totalTokens;
  const dailyTokenSplit = splitTokens(dailyTokenTotal);
  const monthlyTokenSplit = splitTokens(monthlyTokenTotal);
  const dailyCostCents = gatewayHasAuthoritativeCosts
    ? Math.round((gatewayDaily?.cost ?? 0) * 100)
    : estimatedDailyCostFromUsage ?? dailyAggregate.totalCostCents;
  const monthlyCostCents =
    gatewayHasAuthoritativeCosts && gatewayMonthlyCost !== null
      ? Math.round(gatewayMonthlyCost * 100)
      : estimatedMonthlyCostFromUsage ?? monthlyAggregate.totalCostCents;

  return [
    {
      id: "task_cost_live",
      agentId: config.CLAWVIEW_AGENT_ID,
      granularity: "task",
      taskId: task?.taskId ?? null,
      windowStartedAt: task?.startedAt ?? now,
      windowEndedAt: now,
      inputTokens: taskTokenSplit.inputTokens,
      outputTokens: taskTokenSplit.outputTokens,
      totalCostCents: taskAggregate.totalCostCents,
      costStatus:
        taskAggregate.totalCostCents > 0
          ? "available"
          : task
            ? sharedCostStatus
            : "missing",
      note: task
        ? task.costSource === "estimated" && !gatewayHasAuthoritativeCosts
          ? "当前任务金额按本地模型价格估算。"
          : sharedNote
        : "当前还没有可计费的任务数据。",
      models: taskAggregate.models,
      budget: {
        limitCents: 1_000,
        spentCents: taskAggregate.totalCostCents,
        usageRatio: taskAggregate.totalCostCents / 1_000,
        exceeded: taskAggregate.totalCostCents > 1_000,
      },
    },
    {
      id: "daily_cost_live",
      agentId: config.CLAWVIEW_AGENT_ID,
      granularity: "daily",
      taskId: null,
      windowStartedAt: now - 24 * 60 * 60_000,
      windowEndedAt: now,
      inputTokens: dailyTokenSplit.inputTokens,
      outputTokens: dailyTokenSplit.outputTokens,
      totalCostCents: dailyCostCents,
      costStatus: sharedCostStatus,
      note: sharedNote,
      models: dailyAggregate.models,
      budget: {
        limitCents: 3_000,
        spentCents: dailyCostCents,
        usageRatio: dailyCostCents / 3_000,
        exceeded: dailyCostCents > 3_000,
      },
    },
    {
      id: "monthly_cost_live",
      agentId: config.CLAWVIEW_AGENT_ID,
      granularity: "monthly",
      taskId: null,
      windowStartedAt: now - 30 * 24 * 60 * 60_000,
      windowEndedAt: now,
      inputTokens: monthlyTokenSplit.inputTokens,
      outputTokens: monthlyTokenSplit.outputTokens,
      totalCostCents: monthlyCostCents,
      costStatus: sharedCostStatus,
      note: sharedNote,
      models: monthlyAggregate.models,
      budget: {
        limitCents: 20_000,
        spentCents: monthlyCostCents,
        usageRatio: monthlyCostCents / 20_000,
        exceeded: monthlyCostCents > 20_000,
      },
    },
  ];
}

function buildAlerts(
  tasks: TaskExecutionLog[],
  memory: MemoryEntry[],
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const task = tasks[0];

  if (!task) {
    alerts.push({
      id: "alert_openclaw_missing",
      agentId: config.CLAWVIEW_AGENT_ID,
      riskLevel: "medium",
      title: "暂未发现活跃任务",
      description:
        "ClawView 已连接 OpenClaw 目录，但最近没有检测到正在运行的 transcript。",
      recommendedAction: "在 OpenClaw 中先发起一条任务，然后刷新控制台。",
      triggeredAt: Date.now(),
      open: true,
    });
  }

  if (task && task.totalCostCents > 500) {
    alerts.push({
      id: "alert_cost_high",
      agentId: config.CLAWVIEW_AGENT_ID,
      riskLevel: "high",
      title: "本任务成本较高",
      description: `当前任务已累计 ${task.totalCostCents} 分，建议检查是否需要继续使用高成本模型。`,
      recommendedAction: "确认任务是否仍需继续，或切换更便宜的模型。",
      triggeredAt: Date.now(),
      open: true,
    });
  }

  if (memory.length === 0) {
    alerts.push({
      id: "alert_memory_empty",
      agentId: config.CLAWVIEW_AGENT_ID,
      riskLevel: "low",
      title: "未读取到记忆文件",
      description: "当前 clawd 目录中没有可展示的 MEMORY.md 或 memory/*.md。",
      recommendedAction: "确认本地 clawd 目录存在，并且其中已生成记忆文件。",
      triggeredAt: Date.now(),
      open: true,
    });
  }

  return alerts;
}

function buildApprovals(tasks: TaskExecutionLog[]): ApprovalRequest[] {
  const task = tasks[0];
  const lastStep = task?.steps.at(-1);

  if (!task || lastStep?.status !== "awaiting_approval") {
    return [];
  }

  return [
    {
      id: `approval_${task.taskId}`,
      agentId: config.CLAWVIEW_AGENT_ID,
      taskId: task.taskId,
      actionLabel: lastStep.narrative,
      riskLevel: "high",
      reason: "OpenClaw transcript 中出现了等待确认的高风险步骤。",
      expiresAt: Date.now() + 10 * 60_000,
      status: "pending",
    },
  ];
}

export function readOpenClawSnapshot(): OpenClawSnapshot {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.value;
  }

  const openClawBasePath = getOpenClawBasePath();
  const memoryBasePath = getMemoryBasePath();
  const tasks = getSessionFiles(openClawBasePath)
    .slice(0, 8)
    .map((sessionFile) => parseTaskFromSession(sessionFile))
    .filter((task): task is TaskExecutionLog => task !== null);
  const memory = parseMemoryEntries(memoryBasePath);
  const status = buildStatus(tasks, openClawBasePath);
  const costs = buildCosts(tasks);
  const approvals = buildApprovals(tasks);
  const alerts = buildAlerts(tasks, memory);

  const snapshot = {
    status,
    tasks,
    costs,
    memory,
    alerts,
    approvals,
  };

  snapshotCache = {
    value: snapshot,
    expiresAt: Date.now() + 2_000,
  };

  return snapshot;
}

export function invalidateOpenClawSnapshot(): void {
  snapshotCache = undefined;
}

export function getRecentStatusCommandRequests(): StatusCommandRequest[] {
  const openClawBasePath = getOpenClawBasePath();

  return getSessionFiles(openClawBasePath)
    .slice(0, 8)
    .flatMap((sessionFile) => {
      const transcriptEvents = readJsonLines(sessionFile.filePath);

      return transcriptEvents
        .filter((event) => getEventRole(event) === "user")
        .map((event) => ({
          event,
          text: getTranscriptContent(event).trim(),
        }))
        .filter(({ text }) => text === "/status" || text.startsWith("/status "))
        .map(({ event }) => ({
          sessionId: sessionFile.sessionId,
          eventId:
            event.id ??
            `${sessionFile.sessionId}_${normalizeTimestamp(event.timestamp, sessionFile.updatedAt)}`,
          channel: sessionFile.replyChannel,
          target: sessionFile.replyTarget,
          timestamp: normalizeTimestamp(
            event.timestamp ?? event.message?.timestamp,
            sessionFile.updatedAt,
          ),
        }));
    })
    .sort((left, right) => right.timestamp - left.timestamp);
}
