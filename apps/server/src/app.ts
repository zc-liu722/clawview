import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./lib/config";
import { errorHandler } from "./middleware/error-handler.middleware";
import { requestLogger } from "./middleware/request-logger.middleware";
import { alertsRoute } from "./routes/alerts.route";
import { approvalRoute } from "./routes/approval.route";
import { costRoute } from "./routes/cost.route";
import { dashboardRoute } from "./routes/dashboard.route";
import { healthRoute } from "./routes/health.route";
import { memoryRoute } from "./routes/memory.route";
import { realtimeRoute } from "./routes/realtime.route";

export const app = new Hono();

function resolveWebDistDir(): string | null {
  const candidates = [
    resolve(process.cwd(), "apps/web/dist"),
    resolve(import.meta.dirname, "../../web/dist"),
    resolve(import.meta.dirname, "../../../../web/dist"),
  ];

  return candidates.find((candidate) => existsSync(resolve(candidate, "index.html"))) ?? null;
}

const staticContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveStaticAsset(pathname: string): Promise<Response | null> {
  const webDistDir = resolveWebDistDir();
  if (!webDistDir) {
    return null;
  }

  const cleanPath = pathname.replace(/^\/+/, "");
  const assetPath = resolve(webDistDir, cleanPath);

  if (!assetPath.startsWith(webDistDir) || !existsSync(assetPath)) {
    return null;
  }

  const content = await readFile(assetPath);
  const contentType =
    staticContentTypes[extname(assetPath)] ?? "application/octet-stream";

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
    },
  });
}

async function serveAppShell(): Promise<Response | null> {
  const webDistDir = resolveWebDistDir();
  if (!webDistDir) {
    return null;
  }

  const indexPath = resolve(webDistDir, "index.html");

  if (!existsSync(indexPath)) {
    return null;
  }

  const content = await readFile(indexPath);

  return new Response(content, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

app.use("*", cors({ origin: config.CLAWVIEW_ALLOWED_ORIGIN }));
app.use("*", requestLogger);
app.use("*", errorHandler);

app.route("/api/v1/health", healthRoute);
app.route("/api/v1/dashboard", dashboardRoute);
app.route("/api/v1/costs", costRoute);
app.route("/api/v1/memory-entries", memoryRoute);
app.route("/api/v1/approvals", approvalRoute);
app.route("/api/v1/alerts", alertsRoute);
app.route("/api/v1/realtime", realtimeRoute);

app.get("*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const acceptHeader = c.req.header("accept") ?? "";
  const isNavigationRequest =
    pathname === "/" || acceptHeader.includes("text/html");

  if (pathname.startsWith("/api/")) {
    return c.notFound();
  }

  if (pathname !== "/") {
    const staticResponse = await serveStaticAsset(pathname);
    if (staticResponse) {
      return staticResponse;
    }

    if (pathname.includes(".")) {
      return c.notFound();
    }
  }

  if (isNavigationRequest) {
    const appShell = await serveAppShell();
    if (appShell) {
      return appShell;
    }
  }

  return c.text(
    "ClawView web build is missing. Run `corepack pnpm --filter @clawview/web build` first.",
    503,
  );
});
