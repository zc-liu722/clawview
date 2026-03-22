import type { PropsWithChildren } from "react";

import { useRealtime } from "@/hooks/use-realtime";

export function RealtimeProvider({ children }: PropsWithChildren) {
  useRealtime();
  return children;
}
