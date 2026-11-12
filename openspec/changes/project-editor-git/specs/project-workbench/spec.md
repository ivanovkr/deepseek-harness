# Project workbench

## ADDED Requirements

### Requirement: Integrated editor
The Web GUI MUST offer Monaco for supported UTF-8 source/text files using existing file tabs and navigator. Binary, image, PDF, and Office previews MUST remain available. The product MUST not imply full VS Code extension compatibility.

#### Scenario: Open and save
- GIVEN an existing writable text file in the selected Session workspace
- WHEN the user edits and chooses Save or Ctrl/Cmd+S
- THEN the exact intended text is saved using the version loaded by the editor and the saved state is shown only after confirmation.

### Requirement: Safe mutations
Saving MUST use the selected Session's actual sandbox policy and a provider-supported conditional replacement. It MUST reject paths outside the workspace, unsupported targets, read-only policy, invalid text, and oversized payloads. Limits MUST reuse existing configuration or be explicit validated configuration.

#### Scenario: External change
- GIVEN a file changed externally after loading
- WHEN the user saves the older draft
- THEN saving fails without overwriting the newer version, the draft remains available, and the user sees a conflict and a safe recovery action.

#### Scenario: Unknown save outcome
- WHEN the provider cannot establish whether publication succeeded
- THEN the UI states uncertainty and requires rereading before another save; it MUST NOT claim rollback or successful save.

### Requirement: Draft retention
Unsaved edits MUST survive ordinary tab hiding and layout changes. Switching files, reload, close, or unload MUST not silently discard edits. File watcher invalidation MUST not overwrite an unsaved draft. Text encoding, BOM, and line endings MUST be preserved or unsupported cases MUST be refused explicitly.

#### Scenario: Hide dirty tab
- WHEN an edited tab is hidden and shown again
- THEN its unsaved text and source version remain available.

### Requirement: Git tracking reuse
The existing Forge bundle MUST supply local changes scopes and diff in the current profile without new Git mutation commands. Clean repositories, non-repositories, missing Git, and permission failures MUST show an appropriate existing state rather than a fabricated empty success.

#### Scenario: Inspect local changes
- WHEN the user opens Forge for a repository with local edits
- THEN its existing uncommitted, unstaged, and staged scopes and diffs are available without changing the index or refs.

### Requirement: Accessible localized UI
New product copy MUST use typed locale dictionaries including Russian and English. Controls MUST remain usable with keyboard and in constrained layouts; loading, saving, errors, and conflicts MUST be visible.

#### Scenario: Save failure in Russian
- WHEN the Russian-language user encounters a save conflict
- THEN a localized visible report and safe recovery action remain accessible without losing the draft.

### Requirement: Verification
Focused API and component tests MUST cover save, stale versions, policy denial, invalid paths, draft retention, and failure reporting. Assembly/snapshot coverage MUST reflect visible changes. Build artifacts and build checks MUST be run and actual results reported. Existing GUI at http://127.0.0.1:3080 MUST be used for verification where available; unavailable browser inspection MUST be explicitly disclosed.

#### Scenario: Handoff
- WHEN implementation is handed off
- THEN executed checks and their outcomes, existing-URL verification, and any unverified visual states are explicitly reported.
