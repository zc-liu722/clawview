import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

interface ButtonProps
  extends PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> {
  tone?: "primary" | "secondary" | "danger";
}

export function Button({
  tone = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn("button", `button-${tone}`, className)} {...props}>
      {children}
    </button>
  );
}
