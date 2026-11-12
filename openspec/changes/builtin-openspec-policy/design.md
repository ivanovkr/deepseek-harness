## Context

DSH composes standard profiles from dsh-base, except sdk-minimal which owns a standalone composition. The tool registry supplies a monotonic execution guard shared by native and nested PTC calls. OpenSpec supplies specification templates and validation but does not enforce DSH operations.

## Goals / Non-Goals

**Goals:** Ship the real pinned OpenSpec runtime; permit discussion and bounded planning; require human review before protected tools run; reject stale approvals and delegated bypasses; preserve sandbox restrictions.

**Non-Goals:** Prevent a trusted administrator from replacing profile composition; infer whether arbitrary shell commands are read-only; prove implementation correctness through structural OpenSpec validation; authorize unattended writes without a human answerer.

## Decisions

- Add a dedicated Host plugin in packages/plan/openspec, mounted globally in base and sdk-minimal. No agent-loop changes are required.
- Resolve the packaged upstream CLI, not a PATH command or runtime download. Disable telemetry and self-update checks. Use managed subprocess execution with explicit output and deadline limits.
- Expose one structured OpenSpec tool with bounded operations and validated change/artifact names. Preparation writes are confined to OpenSpec metadata and use existing filesystem/sandbox policy.
- Require proposal.md, design.md, tasks.md and at least one specs/*/spec.md before review, plus successful official strict validation. Present actual artifact contents to the human review channel rather than a model-authored summary.
- Bind a volatile approval to the exact agent, canonical root, change identifier, and digest of the reviewed artifacts. Checkbox completion does not change the approved task plan. Restart and turn completion discard approval.
- Keep read-only tool names explicit in deployment configuration. Unknown and opaque execution tools fail closed before approval. Nested PTC capability calls pass the same guard.
- PTC programs retain direct Node filesystem access, so nested-call guards alone are insufficient. Add a generic typed read-only execution constraint to the program-tool owner. OpenSpec requests that constraint until approval; the executor clamps the final program policy after escalation decisions and before runtime resolution. A runtime without confinement fails closed. A constrained call uses no retained writable environment.
- Recheck artifact identity synchronously in the final execution guard and when deciding PTC confinement. Reject symlinks in change paths and enforce total artifact count and byte limits.

## Risks / Trade-offs

- Blocking opaque shell before review limits analysis to filesystem/search tools and confined PTC. This is intentional: command text classification is not confinement.
- Human review channels vary by carrier. Missing channels fail closed, including unattended SDK/ACP/headless sessions.
- Trusted plugins and external processes are not sandboxed by a tool guard. Approval controls DSH-dispatched tool operations, not arbitrary host software.
- Persistent processes admitted after approval may outlive a tool call. They remain subject to their existing lifecycle and sandbox guarantees; artifact revision revokes future dispatch, not already running work.
- Read-only file confinement does not restrict network effects. The policy guarantees pre-approval project-file protection through supported execution paths, not isolation of all external systems.

## Migration Plan

Document the new default and require existing automation to supply a human review channel or remain read-only. Preserve administrator-controlled Cordis composition and all existing sandbox and permission checks.

## Open Questions

None for the approved first version. Remote execution worlds must fail explicitly if the packaged local OpenSpec runtime cannot operate on the selected filesystem.
