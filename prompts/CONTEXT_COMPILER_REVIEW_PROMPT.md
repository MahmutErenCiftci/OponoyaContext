# Context Compiler Review Prompt

Review changes to the Context Compiler.

Verify:
- precedence is project > recipe > profile > global
- mode semantics did not change accidentally
- provenance is preserved
- deterministic ordering is stable
- disabled resources are not treated as active
- AI_DECIDE can have no resource
- compatibility warnings never mutate input decisions
- exporters preserve semantics
- hash/version behavior is deterministic
- golden fixtures cover new behavior

Return concrete failing cases before style feedback.
