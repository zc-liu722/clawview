import type { AgentStatus } from "@clawview/shared";

import { MetricCard } from "@/components/composed/metric-card";
import { StatusBadge } from "@/components/composed/status-badge";
import { Panel } from "@/components/ui/panel";
import { formatRelativeTime } from "@/lib/format";
import { useConnectionStore } from "@/stores/connection.store";

interface StatusPanelProps {
  status: AgentStatus;
}

export function StatusPanel({ status }: StatusPanelProps) {
  const connectionStatus = useConnectionStore((state) => state.status);

  return (
    <Panel
      title={status.agentName}
      eyebrow="状态灯"
      action={<StatusBadge status={status.status} />}
    >
      <p className="hero-text">{status.statusText}</p>
      <div className="metric-grid">
        <MetricCard
          label="实时连接"
          value={connectionStatus}
          helper="SSE 推送自动重连"
        />
        <MetricCard
          label="最近心跳"
          value={formatRelativeTime(status.lastHeartbeat)}
          helper={status.gatewayConnected ? "Gateway 正常" : "Gateway 异常"}
        />
        <MetricCard
          label="活跃任务"
          value={status.activeTaskId ? "运行中" : "空闲"}
          helper={`${status.connectedChannels.length} 个渠道已接入`}
        />
      </div>
      <div className="channel-row">
        {status.connectedChannels.map((channel) => (
          <span
            key={channel.type}
            className={`channel-chip ${channel.connected ? "is-up" : "is-down"}`}
          >
            {channel.name}
          </span>
        ))}
      </div>
    </Panel>
  );
}
