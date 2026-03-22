import type { PropsWithChildren } from "react";

export function MobileLayout({ children }: PropsWithChildren) {
  return (
    <div className="page-shell">
      <div className="page-noise" />
      <div className="page-gradient" />
      <main className="page-content page-content-with-tabbar">
        <div className="app-frame">{children}</div>
      </main>
    </div>
  );
}
