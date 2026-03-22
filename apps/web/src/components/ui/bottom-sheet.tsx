import { useEffect, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

interface BottomSheetProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  className,
  children,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    const timeout = window.setTimeout(() => {
      setMounted(false);
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn("bottom-sheet-root", open && "is-open")}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="bottom-sheet-backdrop"
        aria-label="关闭详情"
        onClick={onClose}
      />
      <section
        className={cn("bottom-sheet", className)}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "详情面板"}
      >
        <div className="bottom-sheet-handle" aria-hidden="true" />
        {title ? <h2 className="bottom-sheet-title">{title}</h2> : null}
        <div className="bottom-sheet-content">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
