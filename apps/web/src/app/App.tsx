import { ErrorBoundary } from "./error-boundary";
import { MobileLayout } from "./layouts/mobile-layout";
import { QueryProvider } from "./providers/query-provider";
import { RealtimeProvider } from "./providers/realtime-provider";
import { TabShell } from "./tab-shell";

export function App() {
  return (
    <ErrorBoundary
      fallback={<div className="empty-state">页面发生错误，请刷新重试。</div>}
    >
      <QueryProvider>
        <RealtimeProvider>
          <MobileLayout>
            <TabShell />
          </MobileLayout>
        </RealtimeProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
