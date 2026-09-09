# Claude Code Production Prompt Pack

This pack advances DevContext OS from its current state to a production launch
without giving Claude Code one unsafe, context-heavy "build everything" prompt.

For the very first Claude Code session, the owner can paste
`prompts/CLAUDE_CODE_CONTINUE_PROJECT.md`; it routes Claude into this pack and the
baseline audit automatically.

## How to use

1. Start every new Claude Code session with `00_SESSION_BOOTSTRAP.md`.
2. Give Claude exactly one numbered handoff prompt at a time.
3. Do not move forward until the handoff's acceptance criteria and verification
   commands pass, or Claude records a concrete blocker.
4. Require the implementation report named by that prompt.
5. In a fresh session, provide the most recent report and use
   `CONTINUATION_HANDOFF_TEMPLATE.md` before the next numbered prompt.

Do not paste every prompt at once. One vertical slice per session keeps changes
reviewable and prevents documentation, migrations and tests from drifting.

## Version and handoff map

| Order | Roadmap version | Prompt | Outcome |
| --- | --- | --- | --- |
| 1 | V0.0–V0.1 audit | `01_CURRENT_STATE_AUDIT.md` | Verify completed foundation, auth and Library work |
| 2 | V0.1 | `02_H04_PROJECTS.md` | Project CRUD, wizard persistence, Library attachments |
| 3 | V0.1–V0.2 | `03_H05_DECISIONS.md` | DecisionControl and project/global decision behavior |
| 4 | V0.1–V0.2 | `04_H06_COMPILER_EXPORTS.md` | Persisted deterministic context and first exports |
| 5 | V0.2 | `05_H07_COMPOSER_PROFILES.md` | Full composer, profiles/presets and inheritance UX |
| 6 | V0.3 | `06_H08A_V0_3_USABILITY.md` | Search, warnings, diff, clone and onboarding |
| 7 | V0.3 | `07_H08B_V0_3_RELIABILITY.md` | Security, auditability, rate limits and recovery |
| 8 | V1.0 | `08_H09_V1_ONBOARDING_IMPORT_EXPORT.md` | Activation and safe portability |
| 9 | V1.0 | `09_H10_V1_BILLING_ENTITLEMENTS.md` | Plans, entitlements and provider-safe billing boundary |
| 10 | V1.0 | `10_H11_V1_PRIVACY_LEGAL.md` | Account export/deletion and launch disclosures |
| 11 | V1.0 | `11_H12_PRODUCTION_OPERATIONS.md` | Containers, CI/CD, monitoring, backup and runbooks |
| 12 | V1.0 | `12_H13_LAUNCH_GATE.md` | Final evidence-based go/no-go audit |

## Definition of production-ready

Production-ready means more than a successful build. The final launch gate must
have evidence for:

- a complete Library → Project → Compile → Export journey;
- authentication, authorization and cross-user isolation;
- deterministic compiler outputs and readable history;
- recoverable migrations, backup and restore drill;
- production configuration validation, HTTPS/cookie/CORS policy and rate limits;
- error monitoring and useful structured logs without secrets;
- plan enforcement and verified billing webhook behavior when paid launch is enabled;
- user data export, account deletion and integration revocation;
- accessible responsive UI and critical Playwright journeys;
- operator runbooks, rollback steps and no unresolved Critical/High security issue.

External credentials, provider accounts, DNS, legal approval and payment-provider
approval are external launch dependencies. Claude must never invent them or mark
the launch gate complete without evidence.
