import type {
  AgentStatus,
  AlertEvent,
  ApprovalRequest,
  ClawEvent,
  CostSnapshot,
  MemoryEntry,
  TaskExecutionLog,
} from "@clawview/shared";

const now = Date.now();

export const mockStatus: AgentStatus = {
  agentId: "agent_01",
  agentName: "OpenClaw 主助理",
  status: "tool_calling",
  statusText: "正在读取 CRM 并整理跟进建议",
  statusSince: now - 90_000,
  lastHeartbeat: now - 5_000,
  gatewayConnected: true,
  activeTaskId: "task_20260316_01",
  connectedChannels: [
    { type: "feishu", name: "飞书", connected: true },
    { type: "telegram", name: "Telegram", connected: true },
  ],
};

export const mockTasks: TaskExecutionLog[] = [
  {
    taskId: "task_20260316_01",
    sessionId: "session_live_01",
    agentId: "agent_01",
    userPromptSummary: "整理今天的客户线索并生成跟进建议",
    status: "running",
    totalTokens: 8420,
    totalCostCents: 186,
    primaryModel: "gpt-4.1",
    startedAt: now - 8 * 60_000,
    completedAt: null,
    sourceChannel: "feishu",
    steps: [
      {
        id: "step_1",
        order: 1,
        status: "completed",
        narrative: "已读取 CRM 里最近 20 条销售线索",
        rawEventType: "tool_call:crm_lookup",
        toolName: "crm_lookup",
        modelName: "gpt-4.1-mini",
        tokensUsed: 1280,
        costCents: 18,
        startedAt: now - 8 * 60_000,
        completedAt: now - 7 * 60_000,
        durationMs: 31_000,
        errorMessage: null,
      },
      {
        id: "step_2",
        order: 2,
        status: "completed",
        narrative: "已搜索目标公司的近期公开动态",
        rawEventType: "tool_call:web_search",
        toolName: "web_search",
        modelName: "gpt-4.1",
        tokensUsed: 2540,
        costCents: 66,
        startedAt: now - 7 * 60_000,
        completedAt: now - 4 * 60_000,
        durationMs: 142_000,
        errorMessage: null,
      },
      {
        id: "step_3",
        order: 3,
        status: "running",
        narrative: "正在为每个客户生成跟进建议和下一步话术",
        rawEventType: "model:generation",
        toolName: null,
        modelName: "gpt-4.1",
        tokensUsed: 4600,
        costCents: 102,
        startedAt: now - 4 * 60_000,
        completedAt: null,
        durationMs: null,
        errorMessage: null,
      },
    ],
  },
];

export const mockCosts: CostSnapshot[] = [
  {
    id: "cost_task_01",
    agentId: "agent_01",
    granularity: "task",
    taskId: "task_20260316_01",
    windowStartedAt: now - 8 * 60_000,
    windowEndedAt: now,
    inputTokens: 5020,
    outputTokens: 3400,
    totalCostCents: 186,
    costStatus: "available",
    note: null,
    models: [
      {
        modelId: "gpt-4.1",
        modelDisplayName: "GPT-4.1",
        inputTokens: 3400,
        outputTokens: 2700,
        costCents: 142,
        callCount: 4,
      },
      {
        modelId: "gpt-4.1-mini",
        modelDisplayName: "GPT-4.1 mini",
        inputTokens: 1620,
        outputTokens: 700,
        costCents: 44,
        callCount: 3,
      },
    ],
    budget: {
      limitCents: 500,
      spentCents: 186,
      usageRatio: 0.372,
      exceeded: false,
    },
  },
  {
    id: "cost_daily_01",
    agentId: "agent_01",
    granularity: "daily",
    taskId: null,
    windowStartedAt: now - 12 * 60 * 60_000,
    windowEndedAt: now,
    inputTokens: 18_420,
    outputTokens: 11_004,
    totalCostCents: 532,
    costStatus: "available",
    note: null,
    models: [
      {
        modelId: "gpt-4.1",
        modelDisplayName: "GPT-4.1",
        inputTokens: 10_600,
        outputTokens: 7_500,
        costCents: 402,
        callCount: 11,
      },
      {
        modelId: "gpt-4.1-mini",
        modelDisplayName: "GPT-4.1 mini",
        inputTokens: 7_820,
        outputTokens: 3_504,
        costCents: 130,
        callCount: 13,
      },
    ],
    budget: {
      limitCents: 1000,
      spentCents: 532,
      usageRatio: 0.532,
      exceeded: false,
    },
  },
  {
    id: "cost_monthly_01",
    agentId: "agent_01",
    granularity: "monthly",
    taskId: null,
    windowStartedAt: now - 10 * 24 * 60 * 60_000,
    windowEndedAt: now,
    inputTokens: 168_420,
    outputTokens: 111_004,
    totalCostCents: 4_832,
    costStatus: "available",
    note: null,
    models: [
      {
        modelId: "gpt-4.1",
        modelDisplayName: "GPT-4.1",
        inputTokens: 108_600,
        outputTokens: 77_500,
        costCents: 3_642,
        callCount: 90,
      },
      {
        modelId: "gpt-4.1-mini",
        modelDisplayName: "GPT-4.1 mini",
        inputTokens: 59_820,
        outputTokens: 33_504,
        costCents: 1_190,
        callCount: 102,
      },
    ],
    budget: {
      limitCents: 6_000,
      spentCents: 4_832,
      usageRatio: 0.805,
      exceeded: false,
    },
  },
];

export const mockMemory: MemoryEntry[] = [
  {
    id: "memory_01",
    summary: "你偏好在早上 9 点前收到销售日报摘要",
    content:
      "你偏好在早上 9 点前收到销售日报摘要\n\n发送格式保持 3 条重点 + 1 条风险提醒。",
    rawContent:
      "你偏好在早上 9 点前收到销售日报摘要\n\n发送格式保持 3 条重点 + 1 条风险提醒。\n",
    sourceLabel: "飞书对话 / 2026-03-11",
    lastUsedAt: now - 3 * 60_000,
    updatedAt: now - 3 * 24 * 60 * 60_000,
    expiresAt: null,
    active: true,
  },
  {
    id: "memory_02",
    summary: "A 类客户需要优先给出明确的下一步行动建议",
    content:
      "A 类客户需要优先给出明确的下一步行动建议\n\n避免只给背景分析，不要漏掉负责人和下一步时间点。",
    rawContent:
      "A 类客户需要优先给出明确的下一步行动建议\n\n避免只给背景分析，不要漏掉负责人和下一步时间点。\n",
    sourceLabel: "CRM 导入规则",
    lastUsedAt: now - 30 * 60_000,
    updatedAt: now - 5 * 24 * 60 * 60_000,
    expiresAt: now + 2 * 24 * 60 * 60_000,
    active: true,
  },
];

export const mockAlerts: AlertEvent[] = [
  {
    id: "alert_01",
    agentId: "agent_01",
    riskLevel: "medium",
    title: "今日成本接近预算上限",
    description:
      "今日预算已使用 53.2%，如果继续批量生成跟进建议，可能在晚高峰前触发预警。",
    recommendedAction: "将低优先级任务切换到更便宜的模型。",
    triggeredAt: now - 4 * 60_000,
    open: true,
  },
  {
    id: "alert_02",
    agentId: "agent_01",
    riskLevel: "high",
    title: "检测到外发消息审批",
    description: "系统准备向 12 位客户发送跟进消息，需要你确认批量发送动作。",
    recommendedAction: "检查模板内容并决定是否继续。",
    triggeredAt: now - 60_000,
    open: true,
  },
];

export const mockApprovals: ApprovalRequest[] = [
  {
    id: "approval_01",
    agentId: "agent_01",
    taskId: "task_20260316_01",
    actionLabel: "向 12 位客户发送跟进消息",
    riskLevel: "high",
    reason: "批量外发消息属于高风险动作，需要人工二次确认。",
    expiresAt: now + 12 * 60_000,
    status: "pending",
  },
];

export function getDashboardSnapshot(): {
  status: AgentStatus;
  tasks: TaskExecutionLog[];
  costs: CostSnapshot[];
  memory: MemoryEntry[];
  alerts: AlertEvent[];
  approvals: ApprovalRequest[];
} {
  return {
    status: mockStatus,
    tasks: mockTasks,
    costs: mockCosts,
    memory: mockMemory,
    alerts: mockAlerts,
    approvals: mockApprovals,
  };
}

let eventCounter = 0;

export function createMockTickEvent(): ClawEvent {
  eventCounter += 1;
  const costDelta = 4 * eventCounter;
  const task = mockTasks[0];
  const updatedTask: TaskExecutionLog = {
    ...task,
    totalTokens: task.totalTokens + 180,
    totalCostCents: task.totalCostCents + costDelta,
    steps: task.steps.map((step) =>
      step.order === 3
        ? {
            ...step,
            tokensUsed: step.tokensUsed + 180,
            costCents: step.costCents + costDelta,
          }
        : step,
    ),
  };
  mockTasks[0] = updatedTask;
  mockStatus.statusText = `正在整理跟进建议，已完成 ${Math.min(88, 52 + eventCounter * 4)}%`;
  mockStatus.lastHeartbeat = Date.now();
  mockCosts[0] = {
    ...mockCosts[0],
    totalCostCents: updatedTask.totalCostCents,
    inputTokens: mockCosts[0].inputTokens + 120,
    outputTokens: mockCosts[0].outputTokens + 60,
    budget: {
      ...mockCosts[0].budget,
      spentCents: updatedTask.totalCostCents,
      usageRatio: updatedTask.totalCostCents / mockCosts[0].budget.limitCents,
    },
  };

  return {
    id: `evt_${eventCounter}`,
    type: "step_update",
    timestamp: Date.now(),
    agentId: "agent_01",
    source: "cli_bridge",
    payload: updatedTask,
  };
}
