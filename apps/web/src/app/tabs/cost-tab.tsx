import type { CostSnapshot } from "@clawview/shared";

import { CostPanel } from "@/features/cost/components/cost-panel";

interface CostTabProps {
  costs: CostSnapshot[];
}

export function CostTab({ costs }: CostTabProps) {
  return <CostPanel costs={costs} />;
}
