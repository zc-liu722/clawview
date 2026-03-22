import type { RiskLevel } from "@clawview/shared";

type AlertFilter = "all" | RiskLevel;

interface AlertFilterChipsProps {
  activeFilter: AlertFilter;
  onFilterChange: (filter: AlertFilter) => void;
}

const FILTERS: Array<{ value: AlertFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Warning" },
  { value: "low", label: "Info" },
];

export function AlertFilterChips({
  activeFilter,
  onFilterChange,
}: AlertFilterChipsProps) {
  return (
    <div className="filter-chips">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          className={`filter-chip ${activeFilter === filter.value ? "is-active" : ""}`}
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
