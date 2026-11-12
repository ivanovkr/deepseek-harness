---
description: "Package map for OpenSpec planning and plan-mode collaboration."
kind: "package-group"
---

# plan/ — plan collaboration state

English | [中文](README.zh.md)

## Summary

The `plan/` group provides OpenSpec planning and optional plan-mode collaboration. OpenSpec presents change documents for user review but does not change tool permissions. Plan mode separately provides deployment guidance and a reviewed exit; neither mode changes sandbox permissions.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

Two packages provide OpenSpec planning and optional plan-mode collaboration.

| Package | Role | ctx key |
|---|---|---|
| [`openspec/`](openspec/README.md) | Prepares and validates official OpenSpec changes and records human review without controlling project tools | — |
| [`plan-mode/`](plan-mode/README.md) | Provides plan mode: `/plan` enters and leaves it, deployment guidance steers the agent while planning, and `exit_plan_mode` presents the finished plan for your review | `ctx.planMode` |

-----

<a id="related-documentation"></a>
## Related documentation

Start with the subsystem reference for the shared vocabulary, then read the design note for the decisions.

- [Plan mode subsystem reference](../../docs/subsystems/plan.md) — how plan mode works, its configuration, and the exit tool's behavior.
- [Plan-specific collaboration state](plan-mode/README.md) — the design decision behind plan mode.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
