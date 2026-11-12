# Design

## Existing extension points
Use the existing document preview registry and keyed document body slots for a lazily loaded Monaco renderer inside the file-preview plugin. Retain existing file resource addresses, sidebar navigator, docking, fullscreen and nontext renderers. Do not patch the app root or import another feature plugin's runtime components.

## Editor ownership
Keep editing state in a registration-owned store keyed by Session and tab/file identity, not module-level singleton state. Retain drafts independently of mounted Monaco instances. Dispose models, subscriptions, workers and listeners with their owning lifetime. Use existing tab lifecycle and close mechanisms; if they cannot guard dirty closure, add a narrow owner-supported close guard rather than silently losing drafts. Monaco is a browser development dependency bundled lazily, with local assets/workers and license disclosure; no CDN dependency.

## Reads and writes
Read complete bounded bytes through workspaceFiles, decode UTF-8 with explicit BOM/line-ending preservation, reject binary/NUL data. Verify the source version remains stable across loading before treating it as a save base. Add workspaceFiles.writeText(session, path, text, expectedVersion, signal), generated as a Session-id Remote call. Resolve the real Session sandbox policy and workspace containment, and delegate conditional replacement to fs.writeText replaceIfVersion. Never use an unconditional overwrite or read-only header scope as mutation authority. Reuse configured byte caps. Review the existing draft implementation and typed failures before integration.

Return committed version and byte length only after provider confirmation. Stale versions retain the draft. Ambiguous provider errors stop dependent saves and show unknown outcome until the file is reread. Read-only/outside-workspace previews remain viewable but cannot be saved. File observations invalidate clean loads, never replace dirty drafts.

## Git
Reuse @deepseek-ai/dsh-experimental-forge-bundle through profile composition. It already provides Branch, Uncommitted, Unstaged and Staged scopes and comparison UI. Do not add experimental dependencies to release packages. Its enable operation already returned applied; still verify the actual capability rather than infer rendered success.

## Delivery and verification
Protect pre-existing modified files with targeted edits and review the final task-owned diff. Resolve pnpm's store mismatch using the existing store, not a full reinstall. The current application runs dsh web without the dev:web watcher; bundle rebuilding and refresh are required, and Host API changes may require coordinated restart of the existing app. Do not start another server. Tests use focused workspace-files cases and editor/component assembly cases, then applicable GUI and keyless Web replay checks. Run build:artifacts followed by build:check after the final changes. Inspect desktop/constrained layouts and light/dark UI if browser control is available; otherwise clearly report missing visual evidence.
