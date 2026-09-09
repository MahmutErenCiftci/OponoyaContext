# UI Implementation Prompt

Build the requested DevContext OS screen using the existing project design system and component library.

## Product UX rules

- This is a professional developer tool.
- Information density can be medium-high, but hierarchy must remain clear.
- Avoid excessive cards, gradients and decorative dashboards.
- Project Wizard should use progressive disclosure.
- Decision mode controls must be consistent everywhere.
- `AI_DECIDE` should feel like a deliberate delegation, not an error or empty state.
- Show source/provenance on inherited decisions.
- Never silently change a decision due to compatibility warnings.

## Accessibility

- keyboard navigation
- visible focus
- semantic labels
- error messages associated with fields
- sufficient contrast
- do not encode decision state by color alone

## Responsive

Desktop is primary but core Library/Project actions should work on tablet/mobile.
