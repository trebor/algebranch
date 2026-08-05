---
name: algebranch-rules
description: Algebranch's project-specific standards — the deltas from the global rules.
version: 2.0.0
---

# Algebranch Rules

**Project deltas only.** The global standards — response protocol, plain English, the Status/Next block, syntax and formatting, constant placement, logic guardrails, error handling and types — are supplied to every agent from the human's global configuration and are deliberately not restated here. This file carries only what is true of Algebranch and not true generally.

The commit, merge, "ship it", and "publish it" protocols are owned by [AGENTS.md](AGENTS.md) and are not restated here either.

## 🚧 Architectural Guardrail

- **Pre-Flight Check:** Before generating React components, data-fetching logic, or state management code, you MUST halt and draft a component specification. Do not write implementation code until the planned approach is validated against the `architecture-reviewer` skill (the Jotai data lifecycle: Raw Data → Global State (Atoms) → Transformation (Derived Atoms) → UI Consumption (`useAtom`)).
  - **Stitch Prototyping Exception:** When iterating on UI designs (e.g. building for Stitch), you may bypass the Pre-Flight Check and immediately generate React implementation code to facilitate rapid prototyping.

## ✅ Validation Commands

The single source of truth for the gate's commands — [AGENTS.md](AGENTS.md) references this section rather than restating it.

- **Linting:** `npm run lint`
- **Type Checking:** `npm run type-check`
- **Testing:** `npm test`
- **Build:** `npm run build` (compiles `math-engine`, then `ui`)

The full pre-merge gate is lint → type-check → test → build.
