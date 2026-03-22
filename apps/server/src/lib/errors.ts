export abstract class ClawViewError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
}

export class NotFoundError extends ClawViewError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
}

export class ValidationError extends ClawViewError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 400;
}

export class UnauthorizedError extends ClawViewError {
  readonly code = "UNAUTHORIZED";
  readonly httpStatus = 401;
}

export class AdapterError extends ClawViewError {
  readonly code = "ADAPTER_ERROR";
  readonly httpStatus = 502;
}
