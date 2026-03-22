import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/ui/tab-bar";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { TAB_BAR_HEIGHT_PX } from "@/lib/constants";
import { useConnectionStore } from "@/stores/connection.store";
import {
  type NavigationTab,
  useNavigationStore,
} from "@/stores/navigation.store";
import { useToastStore } from "@/stores/toast.store";

import { AlertsTab } from "./tabs/alerts-tab";
import { CostTab } from "./tabs/cost-tab";
import { LiveTab } from "./tabs/live-tab";
import { MemoryTab } from "./tabs/memory-tab";
import { TasksTab } from "./tabs/tasks-tab";

const TAB_COPY: Record<
  NavigationTab,
  {
    label: string;
    eyebrow: string;
    description: string;
  }
> = {
  live: {
    label: "实况总览",
    eyebrow: "Realtime Console",
    description: "聚焦当前 Agent 状态、执行脉络与关键成本，适合横屏监控与竖屏快速扫读。",
  },
  tasks: {
    label: "任务追踪",
    eyebrow: "Execution Feed",
    description: "集中浏览任务历史、执行结果和成本，快速切换故障、进行中与已完成记录。",
  },
  cost: {
    label: "成本治理",
    eyebrow: "Spend Intelligence",
    description: "将预算、水位和模型成本放进统一视图，减少高频监控时的认知切换。",
  },
  memory: {
    label: "记忆管理",
    eyebrow: "Memory Ledger",
    description: "查看长期记忆条目、搜索上下文线索，并在移动端保持轻量阅读体验。",
  },
  alerts: {
    label: "告警中心",
    eyebrow: "Risk & Approval",
    description: "将告警、审批和风险信号归拢到同一工作面，适合桌面端持续盯盘。",
  },
};

function ToastViewport() {
  const items = useToastStore((state) => state.items);
  return (
    <output className="toast-stack" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast-card">
          {item.title}
        </div>
      ))}
    </output>
  );
}

function ConnectionBanner() {
  const connectionStatus = useConnectionStore((state) => state.status);

  if (connectionStatus !== "disconnected") {
    return null;
  }

  return <div className="connection-banner">实时连接已断开，正在尝试重连…</div>;
}

function DashboardStateBanner({
  isFetching,
  hasError,
  onRetry,
}: {
  isFetching: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  if (hasError) {
    return (
      <div className="dashboard-state-banner dashboard-state-banner-error">
        <div>
          <strong>同步失败</strong>
          <p>最近一次刷新没有成功，当前展示的是上一次可用数据。</p>
        </div>
        <Button tone="secondary" onClick={onRetry}>
          重新加载
        </Button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="dashboard-state-banner dashboard-state-banner-loading">
        <strong>正在同步最新数据...</strong>
      </div>
    );
  }

  return (
    <div className="dashboard-state-banner dashboard-state-banner-success">
      <strong>控制台已同步</strong>
    </div>
  );
}

export function TabShell() {
  const activeTab = useNavigationStore((state) => state.activeTab);
  const setActiveTab = useNavigationStore((state) => state.setActiveTab);
  const dashboardQuery = useDashboardQuery();

  const badges = useMemo(() => {
    const data = dashboardQuery.data;

    if (!data) {
      return {};
    }

    return {
      live: {
        dot: Boolean(data.tasks.some((task) => task.status === "running")),
      },
      tasks: {
        count: data.tasks.filter((task) => task.status === "running").length,
      },
      memory: {
        count: data.memory.length,
      },
      alerts: {
        count:
          data.alerts.filter((alert) => alert.open).length +
          data.approvals.filter((approval) => approval.status === "pending")
            .length,
        tone: data.alerts.some((alert) => alert.riskLevel === "critical")
          ? "danger"
          : "warn",
      },
    } satisfies Partial<
      Record<
        NavigationTab,
        { count?: number; dot?: boolean; tone?: "default" | "danger" | "warn" }
      >
    >;
  }, [dashboardQuery.data]);

  if (dashboardQuery.isLoading) {
    return (
      <div className="empty-state">
        <div className="state-card state-card-loading">
          <strong>正在连接 ClawView 控制台...</strong>
          <p>首次加载任务、记忆和告警数据，请稍候。</p>
        </div>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="empty-state">
        <div className="state-card state-card-error">
          <strong>控制台加载失败</strong>
          <p>请确认服务端已启动，并检查接口是否可以访问。</p>
          <Button tone="secondary" onClick={() => dashboardQuery.refetch()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const { status, tasks, costs, memory, alerts, approvals } =
    dashboardQuery.data;
  const activeCopy = TAB_COPY[activeTab];
  const runningCount = tasks.filter((task) => task.status === "running").length;
  const criticalCount = alerts.filter(
    (alert) => alert.riskLevel === "critical" && alert.open,
  ).length;
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending",
  ).length;

  const renderActiveTab = () => {
    if (activeTab === "live") {
      return (
        <LiveTab
          status={status}
          tasks={tasks}
          costs={costs}
          approvals={approvals}
          onNavigate={setActiveTab}
        />
      );
    }

    if (activeTab === "tasks") {
      return <TasksTab tasks={tasks} />;
    }

    if (activeTab === "cost") {
      return <CostTab costs={costs} />;
    }

    if (activeTab === "memory") {
      return <MemoryTab memory={memory} />;
    }

    return <AlertsTab alerts={alerts} approvals={approvals} />;
  };

  return (
    <>
      <ConnectionBanner />
      <DashboardStateBanner
        isFetching={dashboardQuery.isFetching}
        hasError={dashboardQuery.isError}
        onRetry={() => dashboardQuery.refetch()}
      />
      <div className="dashboard-shell" style={{ paddingBottom: TAB_BAR_HEIGHT_PX }}>
        <section className="dashboard-hero panel">
          <div className="dashboard-hero-copy">
            <p className="page-kicker">{activeCopy.eyebrow}</p>
            <h1 className="dashboard-title">{activeCopy.label}</h1>
            <p className="dashboard-subtitle">{activeCopy.description}</p>
            <div className="dashboard-hero-status">
              <span className="dashboard-hero-status-label">当前状态</span>
              <strong>{status.statusText}</strong>
            </div>
          </div>
          <div className="dashboard-hero-metrics">
            <article className="hero-metric-card">
              <span className="hero-metric-label">进行中任务</span>
              <strong>{runningCount}</strong>
              <span className="hero-metric-helper">
                {status.activeTaskId ? "当前有活跃执行" : "当前无活跃执行"}
              </span>
            </article>
            <article className="hero-metric-card">
              <span className="hero-metric-label">待处理风险</span>
              <strong>{criticalCount + pendingApprovals}</strong>
              <span className="hero-metric-helper">
                {criticalCount} 个高危告警 · {pendingApprovals} 个待审批
              </span>
            </article>
          </div>
        </section>

        <div className="dashboard-layout">
          <aside className="dashboard-sidebar">
            <div className="dashboard-sidebar-card">
              <div className="dashboard-sidebar-brand">
                <span className="dashboard-sidebar-mark" aria-hidden="true">
                  CV
                </span>
                <div>
                  <p className="panel-eyebrow">ClawView</p>
                  <strong>Agent Console</strong>
                </div>
              </div>
              <TabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                badges={badges}
              />
            </div>
          </aside>

          <section className="tab-shell dashboard-main">{renderActiveTab()}</section>
        </div>
      </div>
      <ToastViewport />
    </>
  );
}
