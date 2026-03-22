import pino from "pino";

export const logger = pino({
  name: "clawview-server",
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
});
