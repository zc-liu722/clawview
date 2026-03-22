import type { AgentStatusCode } from "../constants/status-codes";

export interface ChannelInfo {
  /** Connected channel type for the current agent. */
  type:
    | "telegram"
    | "whatsapp"
    | "slack"
    | "discord"
    | "feishu"
    | "wechat"
    | "other";
  /** Human-friendly channel name rendered in the UI. */
  name: string;
  /** Whether the channel is currently healthy and connected. */
  connected: boolean;
}

export interface AgentStatus {
  /** Stable agent identifier shared across API responses and realtime events. */
  agentId: string;
  /** User-defined agent nickname displayed across the console. */
  agentName: string;
  /** Current lifecycle status used for UI color and severity mapping. */
  status: AgentStatusCode;
  /** Human-readable status sentence generated for non-technical users. */
  statusText: string;
  /** Timestamp of when the current status started. */
  statusSince: number;
  /** Timestamp of the latest successful heartbeat from the agent environment. */
  lastHeartbeat: number;
  /** Whether the gateway control plane is currently reachable. */
  gatewayConnected: boolean;
  /** Active task identifier, or `null` when the agent is idle. */
  activeTaskId: string | null;
  /** List of channels currently configured on this agent. */
  connectedChannels: ChannelInfo[];
}
