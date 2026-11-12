# Project editor and Git tracking

## Goal
Integrate VS Code's Monaco editor into the existing Web GUI's project-file workflow and enable the existing Forge Git changes UI. Preserve the current conversation, file navigator, docking, previews, and unrelated uncommitted work.

## Scope
- Monaco editing for UTF-8 source/text files in existing right-sidebar file tabs, with explicit save and Ctrl/Cmd+S.
- Session-authorized, bounded, version-checked save of existing workspace files.
- Reuse the optional Forge bundle for branch, staged, unstaged, and uncommitted comparisons rather than duplicate Git operations.
- Localized controls, retained drafts, visible loading/error/conflict states, focused tests, documentation, build and live verification where tooling permits.

## Non-goals
A full VS Code application, VS Code extensions, new language-server integration, file creation/deletion/rename, staging/committing/pushing, and replacement servers.

## Current state and approval
Research found existing file navigation and extensible document rendering. Forge was already enabled during this session and reported application: applied. A delegated draft writeText API and tests already exist but are not verified. Further implementation and integration wait for approval of these documents; existing drafts will be reviewed against these requirements, not assumed correct. Monaco installation failed with PNPM_UNEXPECTED_STORE and must be resolved without reinstalling or discarding unrelated workspace changes.
