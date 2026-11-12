## 1. Runtime and policy

- [x] 1.1 Add a dedicated OpenSpec Host plugin with an exactly pinned official runtime dependency.
- [x] 1.2 Implement bounded managed CLI execution with telemetry and self-update checks disabled.
- [x] 1.3 Implement confined preparation, artifact inspection, validation and human review.
- [x] 1.4 Enforce agent-local content-bound approval through the final tool guard.

## 2. Shipped composition

- [x] 2.1 Mount the integration in base and standalone sdk-minimal profiles.
- [ ] 2.2 Include runtime assets in package and release dependency closure.
- [x] 2.3 Preserve existing sandbox, permission and read-only constraints.

## 3. Verification and documentation

- [x] 3.1 Add policy and CLI behavior tests, including denial, stale evidence and cancellation.
- [ ] 3.2 Add real Loader composition and model-visible snapshot coverage.
- [ ] 3.3 Document configuration, limitations and migration in paired documentation.
- [ ] 3.4 Review the final diff and run relevant tests, build artifacts and build check.
