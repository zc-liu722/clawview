import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  accent?: ReactNode;
}

export function MetricCard({ label, value, helper, accent }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        {accent}
      </div>
      <strong className="metric-card-value">{value}</strong>
      <p className="metric-card-helper">{helper}</p>
    </article>
  );
}
