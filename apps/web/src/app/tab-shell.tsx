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

  return (
    <>
      <ConnectionBanner />
      <DashboardStateBanner
        isFetching={dashboardQuery.isFetching}
        hasError={dashboardQuery.isError}
        onRetry={() => dashboardQuery.refetch()}
      />
      <div className="tab-shell" style={{ paddingBottom: TAB_BAR_HEIGHT_PX }}>
        {activeTab === "live" ? (
          <LiveTab
            status={status}
            tasks={tasks}
            costs={costs}
            approvals={approvals}
            onNavigate={setActiveTab}
          />
        ) : null}
        {activeTab === "tasks" ? <TasksTab tasks={tasks} /> : null}
        {activeTab === "cost" ? <CostTab costs={costs} /> : null}
        {activeTab === "memory" ? <MemoryTab memory={memory} /> : null}
        {activeTab === "alerts" ? (
          <AlertsTab alerts={alerts} approvals={approvals} />
        ) : null}
      </div>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={badges}
      />
      <ToastViewport />
    </>
  );
}
