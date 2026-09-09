import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { ApiErrorCode } from "@devcontext/contracts";
import { summarizeError } from "./lib/redact.js";

type ErrorDetail = { path: string[]; code: string };

function envelope(code: ApiErrorCode, message: string, requestId: string, details?: ErrorDetail[]) {
  return { error: { code, message, requestId, ...(details ? { details } : {}) } };
}

/**
 * Domain errors may attach machine-readable `details`. Only field paths and
 * codes are forwarded; input values never are.
 */
function detailsOf(error: unknown): ErrorDetail[] | undefined {
  if (typeof error !== "object" || error === null || !("details" in error) || !Array.isArray(error.details)) return undefined;
  const details = error.details.filter((item): item is ErrorDetail =>
    typeof item === "object" && item !== null && "path" in item && "code" in item
      && Array.isArray(item.path) && item.path.every((segment: unknown) => typeof segment === "string")
      && typeof item.code === "string",
  );
  return details.length > 0 ? details : undefined;
}

/** Domain errors may opt into a specific user-facing message; it must never carry input values. */
function publicMessageOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("publicMessage" in error)) return null;
  return typeof error.publicMessage === "string" ? error.publicMessage : null;
}

export function registerErrorHandlers(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(envelope("NOT_FOUND", "Route not found", request.id)),
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send(envelope(
        "VALIDATION_ERROR",
        "Request is invalid",
        request.id,
        error.issues.map((issue) => ({ path: issue.path.map(String), code: issue.code })),
      ));
    }
    const status = typeof error === "object" && error !== null && "statusCode" in error
      && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (status >= 400 && status < 500) {
      const known: Record<number, [ApiErrorCode, string]> = {
        400: ["VALIDATION_ERROR", "Request is invalid"],
        401: ["UNAUTHORIZED", "Authentication required"],
        403: ["FORBIDDEN", "Access denied"],
        404: ["NOT_FOUND", "Resource not found"],
        409: ["CONFLICT", "Request conflicts with existing data"],
        413: ["PAYLOAD_TOO_LARGE", "Request body is too large"],
        415: ["UNSUPPORTED_MEDIA_TYPE", "Content type is not supported"],
        429: ["RATE_LIMITED", "Too many requests"],
      };
      const [code, message] = known[status] ?? ["BAD_REQUEST", "Request could not be accepted"];
      return reply.code(status).send(envelope(code, publicMessageOf(error) ?? message, request.id, detailsOf(error)));
    }
    // Exception messages may contain SQL, request bodies or credentials, so the
    // structured summary carries the error class, driver code, constraint and
    // stack frames. The redacted message is added only at debug level.
    const summary = summarizeError(error);
    const { message, ...safe } = summary;
    request.log.error({
      requestId: request.id,
      category: "unexpected_error",
      error: request.log.level === "debug" || request.log.level === "trace" ? { ...safe, message } : safe,
    }, "Request failed");
    // The reporter receives the same content-free summary; it never throws or delays the response.
    if (app.hasDecorator("reporter")) {
      void app.reporter.report(summary, { category: "unexpected_error", requestId: request.id, route: request.routeOptions.url ?? null, statusCode: 500 });
    }
    return reply.code(500).send(envelope("INTERNAL_ERROR", "An unexpected error occurred", request.id));
  });
}
