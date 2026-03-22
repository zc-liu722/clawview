import { cn } from "@/lib/cn";
import type { NavigationTab } from "@/stores/navigation.store";

interface TabBadge {
  count?: number;
  dot?: boolean;
  tone?: "default" | "danger" | "warn";
}

interface TabBarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  badges?: Partial<Record<NavigationTab, TabBadge>>;
}

const TAB_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  icon: string;
}> = [
  { id: "live", label: "实况", icon: "●" },
  { id: "tasks", label: "任务", icon: "▤" },
  { id: "cost", label: "费用", icon: "¥" },
  { id: "memory", label: "记忆", icon: "◌" },
  { id: "alerts", label: "警告", icon: "!" },
];

export function TabBar({ activeTab, onTabChange, badges }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="主导航">
      {TAB_ITEMS.map((item) => {
        const badge = badges?.[item.id];
        const count = badge?.count ?? 0;
        const showBadge = Boolean(badge?.dot || count > 0);

        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "tab-bar-item",
              activeTab === item.id && "is-active",
              badge?.tone ? `tab-bar-item-${badge.tone}` : undefined,
            )}
            onClick={() => onTabChange(item.id)}
          >
            <span className="tab-bar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="tab-bar-label">{item.label}</span>
            <span className="tab-bar-badge-slot" aria-hidden={!showBadge}>
              {showBadge ? (
                <span
                  className={cn(
                    "tab-bar-badge",
                    badge?.dot && "is-dot",
                    badge?.tone ? `tab-bar-badge-${badge.tone}` : undefined,
                  )}
                >
                  {badge?.dot ? "" : count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
