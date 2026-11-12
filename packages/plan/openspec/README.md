---
description: "Prepare, validate, and review OpenSpec changes without changing tool permissions."
kind: "package-reference"
---

# @deepseek-ai/dsh-openspec

English | [中文](README.zh.md)

## Summary

Prepare and validate OpenSpec changes, and present their actual documents for human review. Review records a user decision but does not grant or restrict project tools. Ordinary chat uses its existing tools and permissions.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use-this-package"></a>
## Use this package

The [base bundle](../../bundle/base/cordis.patch.yml) and [standalone minimal SDK bundle](../../bundle/sdk-minimal/cordis.patch.yml) mount this Host plugin. It is not an optional installable bundle. Its runtime dependency pins official OpenSpec to `2.0.0`; calls do not install packages or resolve a global executable.

Use `openspec` operations `init`, `new`, `instructions`, `write`, `status`, `validate`, and `review`. Initialization creates metadata without installing project-local agent integrations. Preparation respects the active sandbox policy. Writes accept only proposal, design, tasks, and capability specification documents within the selected change. Review requires all four document categories and successful official strict validation, then presents the bounded document contents through the configured human question channel. Its result records the review decision only; it never changes tool permissions.

All resource-limit fields are required; deployment values live in the bundle rows:

| Field | Meaning |
|---|---|
| `timeoutMs` | CLI deadline |
| `maxOutputBytes` | Combined CLI output byte limit |
| `graceMs` | Managed process termination grace |
| `maxArtifactBytes` | Complete reviewed-document byte limit |
| `maxArtifactFiles` | Reviewed file and traversed-directory limits |

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals</summary>

The [tool](src/index.ts) owns bounded preparation and human review. The [artifact reader](src/artifacts.ts) verifies the selected change and bounds the documents presented for review. The [CLI adapter](src/cli.ts) runs the pinned executable through managed subprocesses under the active sandbox policy. Telemetry and update checks are disabled. CLI failures do not roll back files already written.

</details>

<a id="model-experience"></a>
## Model Experience

### OpenSpec tool

#### What the model sees

The `openspec` definition exposes structured preparation, review, and validation operations. Its review result does not alter the available tools.

#### Token effect

The schema is always available where the global registry is inherited. Artifact and output limits bound individual results, not total session history.

#### KV Cache effect

The tool definition is stable across review decisions. Results append rather than rewriting earlier messages.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

OpenSpec review is a planning interaction, not an execution policy.

- The packaged local runtime requires a shared local filesystem; unsupported execution worlds fail explicitly.
- A missing human question channel makes review unavailable but does not alter tool permissions.
- The active sandbox policy still governs OpenSpec subprocesses and file writes.
- Structural validation does not establish implementation correctness. Report actual behavior tests separately.

<a id="dev-note"></a>
### Dev Note

None.
