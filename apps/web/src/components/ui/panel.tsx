import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PanelProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function Panel({
  title,
  eyebrow,
  action,
  className,
  children,
}: PanelProps) {
  return (
    <section className={cn("panel", className)}>
      <div className="panel-header">
        <div>
          {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
          <h2 className="panel-title">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
