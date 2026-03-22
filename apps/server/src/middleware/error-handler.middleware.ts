import type { Context, MiddlewareHandler, Next } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

import { ClawViewError } from "../lib/errors";
import { logger } from "../lib/logger";

export const errorHandler: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ClawViewError) {
      c.status(error.httpStatus as StatusCode);
      return c.json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (error instanceof ZodError) {
      c.status(400);
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "请求参数不合法，请检查后重试。",
        },
      });
    }

    logger.error({ error }, "Unhandled request failure");
    c.status(500);
    return c.json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "服务器暂时无法处理这个请求，请稍后再试。",
      },
    });
  }
};
