---
description: "Read-only OpenSpec change inventory and document detail for workspace users and plugin maintainers."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-development

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-client-ui-development` adds the **Development** Conversation tab (**Разработка** in Russian). It reads the selected Session's workspace through the existing workspace-files Remote API. It does not execute OpenSpec commands or modify files.

## Contents

- [Reading changes](#reading-changes)
- [Limits and failures](#limits-and-failures)
- [Model experience](#model-experience)
- [Known limitations and deferred work](#known-limitations-and-deferred-work)
- [Dev note](#dev-note)

## Reading changes

The board groups active directories under `openspec/changes` by document-type presence: none, some, or all four types. `archive` is excluded. Counts reflect files, not workflow completion, implementation readiness, test results, or approval.

Select a change, then Proposal, Specifications, Design, or Tasks. The detail lists concrete paths and renders the selected Markdown file. Specifications come from `specs/<capability>/spec.md`. Task checkboxes are read-only source annotations; the checked/total count is not verification evidence.

**Refresh** re-reads active board and document resources for the Session. Selection remains local to the view. An absent changes directory and an existing empty directory have distinct messages.

## Limits and failures

Client configuration accepts `maxChanges` (default 100; range 1–2000), `maxSpecFiles` (100; 1–2000 capability directories per change), `maxDocumentBytes` (524288; 1–8388608 UTF-8 bytes), and `maxDocumentPages` (10; 1–100). Host listing and read budgets also apply.

Truncated listings, exceeded budgets, inconsistent file versions, invalid resource paths, and Remote failures produce visible errors instead of partial success. Refresh retries a failed resource at its existing address. A failed resource hides its last successful content. Cancellation stops further calls and removes the resource's refresh listener.

## Model Experience

This plugin adds no model-facing tool, prompt, Session event, or projection. Its state comes from current workspace files, not a reconstructed OpenSpec CLI state. The tab has no write, archive, approve, or execute action.

#### KV Cache effect

None. The view adds no prompt tokens and does not change the model request prefix or KV-cache reuse.

## Known Limitations and Deferred Work

Only the standard OpenSpec layout is supported. Custom schemas, configured stores, dependency graphs, skipped specs, and approval policies are not interpreted. Presence of all four document types does not mean the change is finished. Workspace-file permissions and symlink behavior apply; this is not the CLI's file-policy implementation.

Changes are refreshed manually; no recursive filesystem watcher is installed. Documents are fetched only when selected, but the shared resource registry owns retention while its sources remain active. Refreshing board discovery and a selected document is not an atomic workspace snapshot. Markdown source is preserved; the supplementary task list recognizes Markdown bullet or numbered checkboxes outside fenced blocks, not every Markdown extension.

## Dev Note

The client entry registers `conversation.view` as `development`, order 30, through the owning slot ring. Dictionaries and the `development-board` / `development-document` providers are plugin-scoped reversible contributions. Components receive `useResource`, localized copy, and a narrow refresh callback; no effect performs fetching. The Host entry is inert.

Focused tests cover discovery, paging, byte/version limits, cancellation, refresh after failure, source task parsing, document detail, failure visibility, localization, and registration disposal. Web composition and published client bundle checks belong to the integrating application.
