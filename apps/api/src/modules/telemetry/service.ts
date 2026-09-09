import type { AuditEntityType } from "@devcontext/contracts";
import { summarizeError } from "../../lib/redact.js";
import type { AuditMetadata, AuditRepository } from "../audit/repository.js";

/**
 * Product analytics events from docs/15_ANALYTICS_METRICS.md that the current
 * feature set can emit. Discover, recipes and AI events arrive with their
 * handoffs. Events are structured log lines (`category: "analytics"`) so any
 * log shipper can forward them; no third-party SDK receives user data.
 */
export const analyticsEventNames = [
  "signup_completed",
  "resource_created",
  "resource_preference_set",
  "profile_created",
  "project_created",
  "decision_changed",
  "context_compiled",
  "context_exported",
] as const;
export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type TelemetryContext = { actorUserId: string; requestId: string };

export type TelemetryEvent = {
  /** Audit action, `<entity>.<verb>` (for example `project.cloned`). */
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  /** Identifiers, enum values, slot keys and counts only. */
  metadata?: AuditMetadata;
  analytics?: AnalyticsEventName;
};

export type TelemetryLogger = {
  info(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export interface Telemetry {
  /** Records the audit row and emits the analytics line. Never throws: a failed audit write is logged, not surfaced. */
  record(context: TelemetryContext, event: TelemetryEvent): Promise<void>;
}

export function createTelemetry(audit: AuditRepository, logger: TelemetryLogger): Telemetry {
  return {
    async record(context, event) {
      const metadata = event.metadata ?? {};
      if (event.analytics) {
        logger.info({
          category: "analytics",
          event: event.analytics,
          userId: context.actorUserId,
          requestId: context.requestId,
          properties: metadata,
        }, event.analytics);
      }
      try {
        await audit.record({
          actorUserId: context.actorUserId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          metadata,
          requestId: context.requestId,
        });
      } catch (error) {
        logger.error({ category: "audit", action: event.action, requestId: context.requestId, error: summarizeError(error) }, "Audit record failed");
      }
    },
  };
}
