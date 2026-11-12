## Why

DSH must ship OpenSpec and require explicit human review of a specification and implementation plan before an agent changes a project. Prompt-only instructions do not enforce that requirement.

## What Changes

- Ship an exactly pinned official OpenSpec runtime in every standard DSH profile.
- Add a built-in OpenSpec tool for project setup, change preparation, instructions, validation, and human review.
- Deny mutation-capable and unknown tools until the calling agent has approval for the current change artifacts.
- Permit reading and discussion without an approved change. Deny opaque shell, terminal, delegated execution, and external tools before approval.
- Invalidate approval after specification or plan edits, directory changes, a new human task, turn completion, or agent restart.

## Capabilities

### New Capabilities
- `mandatory-openspec`: Built-in specification preparation and explicit approval before project mutation.

### Modified Capabilities

## Impact

All shipped profiles, including standalone sdk-minimal, acquire a mandatory task policy. Unattended sessions without a human review channel remain read-only. Administrators still control Cordis composition; this is not isolation from trusted plugin code or a malicious host operator.
