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
