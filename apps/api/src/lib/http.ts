import type { FastifyRequest } from "fastify";
import { idempotencyKeySchema } from "@devcontext/contracts";

/**
 * Small helpers shared by route handlers. Handlers stay thin: they parse
 * input, call one service and record telemetry; these helpers keep the
 * repeated session and error plumbing identical everywhere.
 */

export type ErrorDetail = { path: string[]; code: string };

/**
 * Error understood by the central handler (`errors.ts`): the status picks the
 * envelope code, `details` carries machine-readable codes and `publicMessage`
 * replaces the generic text. Neither may contain user input.
 */
export function httpError(statusCode: number, message: string, options: { details?: ErrorDetail[]; publicMessage?: string } = {}) {
  return Object.assign(new Error(message), {
    statusCode,
    ...(options.details ? { details: options.details } : {}),
    ...(options.publicMessage ? { publicMessage: options.publicMessage } : {}),
  });
}

export function authenticationError() {
  return httpError(401, "Authentication required");
}

export function notFoundError(message = "Resource not found") {
  return httpError(404, message);
}

/** The signed-in user's id; `app.authenticate` must run first. */
export function ownerId(request: Pick<FastifyRequest, "currentUser">): string {
  if (!request.currentUser) throw authenticationError();
  return request.currentUser.id;
}

/** Telemetry context for the signed-in user and this request. */
export function actor(request: Pick<FastifyRequest, "currentUser" | "id">) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

const idempotencyHeaderSchema = idempotencyKeySchema.optional();

/** Optional `Idempotency-Key` header (UUID); an invalid value is a validation error. */
export function idempotencyKey(headers: Record<string, string | string[] | undefined>) {
  const raw = headers["idempotency-key"];
  return idempotencyHeaderSchema.parse(Array.isArray(raw) ? raw[0] : raw);
}
