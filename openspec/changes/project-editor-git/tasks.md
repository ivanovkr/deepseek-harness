# Tasks

- [x] Review existing draft workspaceFiles.writeText changes and tests; correct Session policy, containment, conditional save, limits and typed failure behavior.
- [x] Resolve Monaco dependency installation using the existing pnpm store; integrate lazy local editor assets and licensing.
- [x] Register the editor in existing document/file UI with typed localized controls, save shortcut, explicit state and supported text types.
- [x] Retain drafts and source metadata across tab hiding/layout changes; prevent silent loss on reload, close and unload; preserve BOM and line endings.
- [x] Add focused API tests for success/conflict/denial/containment/cancellation/unknown outcome and component tests for save/draft/conflict/error behavior.
- [x] Update affected README pairs and generated Remote artifacts through owning generators, preserving unrelated changes.
- [x] Verify Forge's enabled local changes scopes and actual existing GUI integration without new Git mutations.
- [ ] Run remaining repository GUI/keyless Web replay checks and `build:check` after the latest artifacts. Focused checks: 43 tests pass; focused lint passes; Client aggregate typecheck and Client bundle pass. The prior Host aggregate typecheck failed because `scripts/gen-tool-catalog.ts` cannot resolve the unrelated `@deepseek-ai/dsh-openspec` workspace package.
- [ ] Inspect the rendered existing URL. The current Web dist predates this feature (bundle does not contain the localized editor copy), and retries to rebuild fail at Vite config loading with sandbox `spawn EPERM`; existing URL responds 401 authentication-required. UI render is unavailable in current tools; Host API may need a coordinated restart to load the new save method.
- [x] Validate this OpenSpec change and report only checks actually executed.
