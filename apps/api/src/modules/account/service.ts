import {
  accountExportFormat,
  accountExportVersion,
  type AccountDeletionView,
  type AccountExport,
  type AccountSummary,
  type CurrentUser,
  type DeleteAccountRequest,
  type LegalConfig,
} from "@devcontext/contracts";
import type { AppConfig } from "../../config.js";
import type { AuditRepository } from "../audit/repository.js";
import type { AuthProvider } from "../auth/service.js";
import { resolveEntitlement } from "../billing/entitlements.js";
import type { SubscriptionRepository } from "../billing/repository.js";
import type { BillingRevocation, BillingService } from "../billing/service.js";
import type { PortabilityService } from "../portability/service.js";
import type { WorkspaceRepository } from "../workspace/repository.js";
import type { AccountRepository, DeletionRow } from "./repository.js";

/** Audit rows included in an account export; the trail is content-free, so size is the only bound. */
const exportAuditLimit = 5_000;

export interface AccountService {
  summary(user: CurrentUser): Promise<AccountSummary>;
  /** The portable workspace document plus account, settings, subscription state, compiled versions, exports and the audit trail. */
  exportAccount(user: CurrentUser): Promise<AccountExport>;
  /**
   * Deliberate deletion: the typed e-mail must match, the password is checked
   * first, billing is revoked next (retryable if the provider is down) and only
   * then does Better Auth delete the user, which cascades to every owned row and
   * session. The ledger row survives so a retry or a support question can be
   * answered without any personal data.
   */
  deleteAccount(user: CurrentUser, input: DeleteAccountRequest, headers: Headers, requestId: string): Promise<{ deletion: AccountDeletionView; setCookie: string[] }>;
  legal(): LegalConfig;
}

export type AccountServiceOptions = {
  repository: AccountRepository;
  auth: AuthProvider;
  billing: BillingService;
  subscriptions: SubscriptionRepository;
  portability: PortabilityService;
  workspace: WorkspaceRepository;
  audit: AuditRepository;
  config: AppConfig;
  now?: () => Date;
};

export function confirmationMismatchError() {
  return Object.assign(new Error("Deletion confirmation mismatch"), {
    statusCode: 400,
    details: [{ path: ["confirmation"], code: "confirmation_mismatch" }],
    publicMessage: "The confirmation does not match your account e-mail. Nothing was deleted.",
  });
}

export function invalidPasswordError() {
  return Object.assign(new Error("Invalid password"), {
    statusCode: 400,
    details: [{ path: ["password"], code: "invalid_password" }],
    publicMessage: "The password is not correct. Nothing was deleted.",
  });
}

/** Content-free code a blocked deletion carries (`deletionCode` on the thrown error). */
export function deletionCodeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("deletionCode" in error)) return null;
  return typeof error.deletionCode === "string" ? error.deletionCode : null;
}

export function toDeletionView(row: DeletionRow | null): AccountDeletionView {
  if (!row) return { status: "none", attempts: 0, requestedAt: null, lastAttemptAt: null, lastError: null, retryable: false };
  const completed = row.status === "completed";
  return {
    status: completed ? "completed" : "pending_external",
    attempts: row.attempts,
    requestedAt: row.requestedAt.toISOString(),
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastError: completed ? null : row.lastError,
    retryable: !completed,
  };
}

/** Builds the factual legal inputs from configuration; unset values are listed, never guessed. */
export function legalConfigFrom(config: AppConfig, billing: { id: string | null; testMode: boolean }): LegalConfig {
  const required: Array<[keyof AppConfig, string | undefined]> = [
    ["LEGAL_ENTITY_NAME", config.LEGAL_ENTITY_NAME],
    ["LEGAL_ENTITY_ADDRESS", config.LEGAL_ENTITY_ADDRESS],
    ["LEGAL_CONTACT_EMAIL", config.LEGAL_CONTACT_EMAIL],
    ["LEGAL_JURISDICTION", config.LEGAL_JURISDICTION],
    ["LEGAL_EFFECTIVE_DATE", config.LEGAL_EFFECTIVE_DATE],
    ["HOSTING_REGION", config.HOSTING_REGION],
    ["LEGAL_SUBPROCESSORS", config.LEGAL_SUBPROCESSORS],
    ["BACKUP_RETENTION_DAYS", config.BACKUP_RETENTION_DAYS === undefined ? undefined : String(config.BACKUP_RETENTION_DAYS)],
    ["BILLING_RECORDS_RETENTION_YEARS", config.BILLING_RECORDS_RETENTION_YEARS === undefined ? undefined : String(config.BILLING_RECORDS_RETENTION_YEARS)],
    ["LEGAL_APPROVED_AT", config.LEGAL_APPROVED_AT],
  ];
  const missing = required.filter(([, value]) => value === undefined || value === "").map(([key]) => key);
  return {
    productName: "DevContext",
    draft: missing.length > 0,
    approvedAt: config.LEGAL_APPROVED_AT ?? null,
    effectiveDate: config.LEGAL_EFFECTIVE_DATE ?? null,
    entity: {
      name: config.LEGAL_ENTITY_NAME ?? null,
      address: config.LEGAL_ENTITY_ADDRESS ?? null,
      contactEmail: config.LEGAL_CONTACT_EMAIL ?? null,
      jurisdiction: config.LEGAL_JURISDICTION ?? null,
    },
    processing: {
      externalAi: false,
      billingProvider: billing.id,
      billingTestMode: billing.testMode,
      hostingRegion: config.HOSTING_REGION ?? null,
      subprocessors: (config.LEGAL_SUBPROCESSORS ?? "").split(",").map((item) => item.trim()).filter((item) => item.length > 0),
    },
    retention: {
      accountDeletion: "immediate",
      billingRecordsYears: config.BILLING_RECORDS_RETENTION_YEARS ?? null,
      backupDays: config.BACKUP_RETENTION_DAYS ?? null,
    },
    missing,
  };
}

export function createAccountService(options: AccountServiceOptions): AccountService {
  const { repository, auth, billing, subscriptions, portability, workspace, audit, config } = options;
  const now = options.now ?? (() => new Date());

  return {
    async summary(user) {
      const [createdAt, stored, record, deletion] = await Promise.all([
        repository.createdAt(user.id),
        repository.counts(user.id),
        subscriptions.find(user.id),
        repository.deletion(user.id),
      ]);
      const entitlement = resolveEntitlement(record, now());
      return {
        user,
        createdAt: (createdAt ?? now()).toISOString(),
        stored,
        integrations: {
          billing: {
            provider: record?.provider ?? billing.provider.id,
            configured: billing.provider.configured,
            testMode: billing.provider.testMode,
            plan: entitlement.plan,
            status: record?.status ?? "none",
            linked: Boolean(record?.providerCustomerId),
          },
          external: [],
        },
        processing: { externalAi: false, importedContentStoredAsData: true },
        deletion: toDeletionView(deletion),
      };
    },

    async exportAccount(user) {
      const [document, settings, record, versions, exportRows, auditRows, createdAt] = await Promise.all([
        portability.exportWorkspace(user.id),
        workspace.settings(user.id),
        subscriptions.find(user.id),
        repository.contextVersions(user.id),
        repository.exports(user.id),
        audit.list(user.id, { limit: exportAuditLimit }),
        repository.createdAt(user.id),
      ]);
      const entitlement = resolveEntitlement(record, now());
      return {
        format: accountExportFormat,
        version: accountExportVersion,
        exportedAt: now().toISOString(),
        account: { id: user.id, email: user.email, name: user.name, createdAt: (createdAt ?? now()).toISOString() },
        settings: {
          onboardingState: settings.onboardingState,
          onboardingChoice: settings.onboardingChoice,
          sampleVersion: settings.sampleVersion,
          sampleInstalledAt: settings.sampleInstalledAt,
        },
        subscription: {
          plan: entitlement.plan,
          status: record?.status ?? "none",
          provider: record?.provider ?? null,
          currentPeriodEnd: record?.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
        },
        workspace: document,
        contextVersions: versions.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
        exports: exportRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
        auditEvents: auditRows,
      };
    },

    async deleteAccount(user, input, headers, requestId) {
      if (input.confirmation.trim().toLowerCase() !== user.email.trim().toLowerCase()) throw confirmationMismatchError();
      if (!(await auth.verifyPassword(headers, input.password))) throw invalidPasswordError();
      await repository.beginAttempt(user.id, requestId);

      let revocation: BillingRevocation;
      try {
        revocation = await billing.revokeForDeletion(user.id);
      } catch (error) {
        await repository.markExternalPending(user.id, deletionCodeOf(error) ?? "billing_provider_unavailable");
        throw error;
      }

      // Better Auth checks the password again, deletes the user (cascades purge every owned row) and every session.
      const { setCookie } = await auth.deleteUser(headers, input.password);
      const row = await repository.markCompleted(user.id, {
        provider: revocation.provider,
        customerId: revocation.customerId,
        subscriptionId: revocation.subscriptionId,
        plan: revocation.plan,
        status: revocation.status,
        revokedAt: revocation.customerId ? now() : null,
      });
      return { deletion: toDeletionView(row), setCookie };
    },

    legal() {
      return legalConfigFrom(config, billing.provider);
    },
  };
}
