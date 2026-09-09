# Copy This Into Claude Code First

Continue the existing DevContext OS repository from its current verified state.
Do not scaffold a replacement project and do not attempt all roadmap versions in
one session.

First read completely, in this order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/README.md`
4. `docs/30_PRODUCTION_EXECUTION_PLAN.md`
5. `prompts/claude-code-production/README.md`
6. `prompts/claude-code-production/00_SESSION_BOOTSTRAP.md`
7. `prompts/claude-code-production/01_CURRENT_STATE_AUDIT.md`

Then execute only the current-state audit. Inspect the real filesystem and
migrations instead of trusting historical `MANIFEST.json`. Preserve the partial
Handoff 4 Project schema/migration work and do not implement Project features in
the audit.

Run every verification command required by the audit, fix only regressions in
already completed Foundation/Auth/Resource Library slices, and create
`docs/31_CURRENT_STATE_AUDIT.md` with evidence. Stop after that report and tell me
the exact next prompt path. Never mark a handoff complete without its acceptance
criteria and tests.
