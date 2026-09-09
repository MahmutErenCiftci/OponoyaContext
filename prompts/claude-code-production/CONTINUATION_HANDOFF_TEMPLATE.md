# Claude Code Continuation Template

Paste this at the start of a new Claude Code session after
`00_SESSION_BOOTSTRAP.md`, replacing angle-bracket placeholders.

```text
Continue DevContext OS from the last verified handoff.

Last completed report: <docs/NN_REPORT.md>
Assigned next prompt: <prompts/claude-code-production/NN_PROMPT.md>

First:
1. Read the bootstrap prompt, execution plan, last report and assigned prompt.
2. Inspect the current filesystem and migrations; do not trust this summary over code.
3. Run a targeted baseline check before editing.
4. State the existing implementation, files likely to change, data impact and ADR need.

Implement only the assigned vertical slice. Preserve unrelated/partial work.
Do not mark it complete until its acceptance criteria and full verification gate pass.
Create the required implementation report and update the durable execution plan.

Known external blockers or owner decisions:
- <none, or list exact blocker without secrets>
```

If context is lost mid-handoff, Claude must inspect current changes and the latest
test output before resuming. It must not restart, delete migrations or overwrite
working code merely because the previous conversation is unavailable.
