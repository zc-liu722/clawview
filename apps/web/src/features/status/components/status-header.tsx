import type { AgentStatus } from "@clawview/shared";
import { useState } from "react";

import { StatusLight } from "@/components/composed/status-light";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { formatRelativeTime } from "@/lib/format";

interface StatusHeaderProps {
  status: AgentStatus;
}

export function StatusHeader({ status }: StatusHeaderProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <section className="status-header-panel">
        <div className="status-header-top">
          <div className="status-header-primary">
            <StatusLight status={status.status} />
            <div>
              <p className="panel-eyebrow">ClawView</p>
              <h1 className="status-header-title">{status.agentName}</h1>
            </div>
          </div>
          <div className="status-header-meta">
            <span>{formatRelativeTime(status.lastHeartbeat)}</span>
            <button
              type="button"
              className="status-header-settings"
              aria-label="打开设置"
              onClick={() => setShowDetails(true)}
            >
              ⚙
            </button>
          </div>
        </div>
        <p className="status-header-copy">{status.statusText}</p>
        <div className="channel-row">
          {status.connectedChannels.map((channel) => (
            <span
              key={channel.type}
              className={`channel-chip ${channel.connected ? "is-up" : "is-down"}`}
            >
              {channel.name} {channel.connected ? "已连接" : "离线"}
            </span>
          ))}
        </div>
      </section>
      <BottomSheet
        open={showDetails}
        onClose={() => setShowDetails(false)}
        title="运行设置"
      >
        <div className="sheet-stack">
          <div className="list-card">
            <strong>{status.agentName}</strong>
            <p>当前状态：{status.status}</p>
            <p>最近心跳：{formatRelativeTime(status.lastHeartbeat)}</p>
            <p>Gateway：{status.gatewayConnected ? "已连接" : "未连接"}</p>
            <p>活跃任务：{status.activeTaskId ?? "当前空闲"}</p>
          </div>
          <div className="list-card">
            <strong>渠道状态</strong>
            {status.connectedChannels.map((channel) => (
              <p key={channel.type}>
                {channel.name}：{channel.connected ? "已连接" : "离线"}
              </p>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
