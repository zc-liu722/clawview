import type { AlertEvent } from "@clawview/shared";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { formatRelativeTime } from "@/lib/format";
import { RISK_LABELS } from "@/lib/i18n-maps";

interface AlertCardProps {
  alert: AlertEvent;
  onAcknowledge: (alertId: string) => void;
}

export function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded((current) => !current);

  return (
    <article className={`alert-card ${expanded ? "alert-card-expanded" : ""}`}>
      <button
        type="button"
        className="alert-card-toggle"
        onClick={toggleExpanded}
      >
        <div className="list-card-top">
          <strong>{alert.title}</strong>
          <Pill
            tone={
              alert.riskLevel === "critical" || alert.riskLevel === "high"
                ? "danger"
                : "warn"
            }
          >
            {RISK_LABELS[alert.riskLevel] ?? alert.riskLevel}
          </Pill>
        </div>
        <p className="muted-text">{formatRelativeTime(alert.triggeredAt)}</p>
      </button>
      {expanded ? (
        <>
          <p>{alert.description}</p>
          <p className="muted-text">建议：{alert.recommendedAction}</p>
          {alert.open ? (
            <Button
              tone="secondary"
              className="alert-acknowledge-btn"
              onClick={(event) => {
                event.stopPropagation();
                onAcknowledge(alert.id);
              }}
            >
              标记已读
            </Button>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
