import type { AiProvider, DecisionCandidate, DecisionProposalRequest } from "./provider.js";

const fakeModel = "fake-deterministic";

function eligible(request: DecisionProposalRequest) {
  const excluded = new Set(request.constraints.excluded.map((item) => item.trim().toLowerCase()));
  const allowed = new Set(request.constraints.allowed.map((item) => item.trim().toLowerCase()));
  const candidates = [...request.candidates]
    .filter((candidate) => !excluded.has(candidate.name.toLowerCase()))
    .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.id < b.id ? -1 : 1));
  if (allowed.size === 0) return candidates;
  const preferred = candidates.filter((candidate) => allowed.has(candidate.name.toLowerCase()));
  return [...preferred, ...candidates.filter((candidate) => !allowed.has(candidate.name.toLowerCase()))];
}

function reason(candidate: DecisionCandidate, language: DecisionProposalRequest["language"]) {
  return language === "tr" ? `${candidate.name} de kısıtlara uyuyor.` : `${candidate.name} also satisfies the constraints.`;
}

/**
 * Deterministic development/test provider: no network, no model. It picks the
 * first candidate that is not excluded (allowed options first, then by name),
 * so journeys and tests can exercise request → review → accept end to end.
 * Refused in production by the configuration.
 */
export function createFakeAiProvider(): AiProvider {
  return {
    id: "fake",
    model: fakeModel,
    async proposeDecision(request) {
      const [choice, ...rest] = eligible(request);
      const tr = request.language === "tr";
      return {
        model: fakeModel,
        usage: { inputTokens: 0, outputTokens: 0 },
        output: {
          resourceId: choice?.id ?? null,
          rationale: choice
            ? (tr ? `Test sağlayıcısı: ${choice.name}, kısıtlara uyan ilk Kütüphane kaynağı.` : `Test provider: ${choice.name} is the first Library resource that satisfies the constraints.`)
            : (tr ? "Test sağlayıcısı: kısıtlara uyan bir Kütüphane kaynağı bulunamadı." : "Test provider: no Library resource satisfies the constraints."),
          alternatives: rest.slice(0, 2).map((candidate) => ({ resourceId: candidate.id, reason: reason(candidate, request.language) })),
          risks: [tr ? "Bu öneri deterministik test sağlayıcısından gelir; gerçek bir değerlendirme değildir." : "This proposal comes from the deterministic test provider, not a real assessment."],
          confidence: "low",
        },
      };
    },
  };
}
