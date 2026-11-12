---
kind: upgrade-guide
description: "Shipped profiles no longer require OpenSpec review before project-changing tool calls."
---

# OpenSpec review no longer gates project tools

English | [中文](guide.zh.md)

## Change

Shipped profiles still provide the OpenSpec tool for preparing, validating, and reviewing change documents. Human review records whether the user accepts a plan, but no longer blocks project-changing or unclassified tools. Existing sandbox and permission policies continue to control those tools.

## Migration

1. If a custom OpenSpec row sets the removed `section` or `readOnlyTools` fields, remove them; retain the supported resource-limit fields in that row. The [package reference](../../../../packages/plan/openspec/README.md) lists the current configuration.
2. If a profile relied on OpenSpec review to restrict tools, configure the required file-effect restrictions through [`dsh-sandbox-policy`](../../../../packages/sandbox/sandbox-policy/README.md) and the existing approval policy. OpenSpec review alone no longer provides execution enforcement.
3. Call the `openspec` tool with `operation: review` to present and record a plan decision, then run the checks required by your workflow. Confirm that your profile's sandbox and approval settings still enforce the restrictions you need.
