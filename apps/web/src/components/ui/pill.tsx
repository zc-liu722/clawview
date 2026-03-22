import type { PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

interface PillProps extends PropsWithChildren {
  tone?: "neutral" | "good" | "warn" | "danger";
}

export function Pill({ tone = "neutral", children }: PillProps) {
  return <span className={cn("pill", `pill-${tone}`)}>{children}</span>;
}
