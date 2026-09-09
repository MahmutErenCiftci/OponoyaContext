import type {
  CreateProfileInput,
  DecisionRecord,
  Profile,
  ProfileListQuery,
  ProfileSummary,
  SaveProjectAsProfileInput,
  UpdateProfileInput,
  UpsertProjectDecisionInput,
} from "@devcontext/contracts";
import { slugify } from "../../lib/slug.js";
import { normalizeDecisionInput, type DecisionValues } from "../decisions/service.js";

export interface ProfileRepository {
  list(ownerUserId: string, query: ProfileListQuery): Promise<{ profiles: ProfileSummary[]; total: number }>;
  findById(ownerUserId: string, profileId: string): Promise<Profile | null>;
  create(ownerUserId: string, profileId: string, slug: string, input: CreateProfileInput): Promise<Profile>;
  update(ownerUserId: string, profileId: string, input: UpdateProfileInput): Promise<Profile | null>;
  setArchived(ownerUserId: string, profileId: string, archived: boolean): Promise<Profile | null>;
  /**
   * Upserts one Profile decision in a transaction. Resources must be active and
   * owned (`resourceUnavailableError`). Returns `null` for a foreign Profile.
   */
  upsertDecision(ownerUserId: string, profileId: string, slot: string, values: DecisionValues): Promise<DecisionRecord | null>;
  /** `null` for a foreign Profile, otherwise whether a decision existed. */
  deleteDecision(ownerUserId: string, profileId: string, slot: string): Promise<boolean | null>;
  /**
   * Creates a Profile from a Project's explicit decisions in one transaction.
   * `profileId` doubles as the idempotency key: an existing id returns the
   * earlier Profile with `created: false`. `null` when the Project is foreign.
   */
  createFromProject(
    ownerUserId: string,
    projectId: string,
    profileId: string,
    slug: string,
    input: SaveProjectAsProfileInput,
  ): Promise<{ profile: Profile; created: boolean } | null>;
}

function notFoundError() {
  return Object.assign(new Error("Profile not found"), { statusCode: 404 });
}

export function slugifyProfileName(name: string) {
  return slugify(name, "profile");
}

export interface ProfileService {
  list(ownerUserId: string, query: ProfileListQuery): Promise<{ profiles: ProfileSummary[]; total: number }>;
  get(ownerUserId: string, profileId: string): Promise<Profile>;
  create(ownerUserId: string, input: CreateProfileInput): Promise<Profile>;
  update(ownerUserId: string, profileId: string, input: UpdateProfileInput): Promise<Profile>;
  archive(ownerUserId: string, profileId: string): Promise<Profile>;
  restore(ownerUserId: string, profileId: string): Promise<Profile>;
  upsertDecision(ownerUserId: string, profileId: string, slot: string, input: UpsertProjectDecisionInput): Promise<DecisionRecord>;
  removeDecision(ownerUserId: string, profileId: string, slot: string): Promise<void>;
  saveFromProject(ownerUserId: string, projectId: string, input: SaveProjectAsProfileInput, idempotencyKey?: string): Promise<{ profile: Profile; created: boolean }>;
}

/**
 * The Idempotency-Key doubles as the Profile id, so a key that already names
 * another user's Profile cannot be reused. Reported as a conflict, never as an
 * unexpected error, and without revealing who owns the id.
 */
export function idempotencyKeyConflictError() {
  return Object.assign(new Error("Idempotency key is already in use"), {
    statusCode: 409,
    details: [{ path: ["idempotency-key"], code: "idempotency_key_in_use" }],
  });
}

function projectNotFoundError() {
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

export function createProfileService(repository: ProfileRepository): ProfileService {
  return {
    async saveFromProject(ownerUserId, projectId, input, idempotencyKey) {
      const id = idempotencyKey ?? crypto.randomUUID();
      const result = await repository.createFromProject(ownerUserId, projectId, id, `${slugifyProfileName(input.name)}-${id.slice(0, 8)}`, {
        ...input,
        ...(input.description !== undefined ? { description: input.description.trim() || undefined } : {}),
      });
      if (!result) throw projectNotFoundError();
      return result;
    },
    list(ownerUserId, query) {
      return repository.list(ownerUserId, query);
    },
    async get(ownerUserId, profileId) {
      const profile = await repository.findById(ownerUserId, profileId);
      if (!profile) throw notFoundError();
      return profile;
    },
    create(ownerUserId, input) {
      const id = crypto.randomUUID();
      return repository.create(ownerUserId, id, `${slugifyProfileName(input.name)}-${id.slice(0, 8)}`, {
        ...input,
        ...(input.description !== undefined ? { description: input.description.trim() || undefined } : {}),
      });
    },
    async update(ownerUserId, profileId, input) {
      const profile = await repository.update(ownerUserId, profileId, {
        ...input,
        ...(typeof input.description === "string" ? { description: input.description.trim() || null } : {}),
      });
      if (!profile) throw notFoundError();
      return profile;
    },
    async archive(ownerUserId, profileId) {
      const profile = await repository.setArchived(ownerUserId, profileId, true);
      if (!profile) throw notFoundError();
      return profile;
    },
    async restore(ownerUserId, profileId) {
      const profile = await repository.setArchived(ownerUserId, profileId, false);
      if (!profile) throw notFoundError();
      return profile;
    },
    async upsertDecision(ownerUserId, profileId, slot, input) {
      const values = normalizeDecisionInput(input);
      const record = await repository.upsertDecision(ownerUserId, profileId, slot, values);
      if (!record) throw notFoundError();
      return record;
    },
    async removeDecision(ownerUserId, profileId, slot) {
      const result = await repository.deleteDecision(ownerUserId, profileId, slot);
      if (result === null) throw notFoundError();
    },
  };
}
