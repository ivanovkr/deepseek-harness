---
description: "ВСЦМ Harness sidebar and home branding."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-official

English | [中文](README.zh.md)

## Summary

This package displays ВСЦМ Harness artwork on the blank home and in the sidebar of an `official` client build. Other profiles retain the sidebar shell fallback. Home stays clear without a click-triggered background animation. Branding adds no model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web and Desktop compositions mount this plugin for the home mark; an `official` client build also registers the sidebar mark and name.

### Choosing the profile

`DSH_CLIENT_BUILD_PROFILE` gates sidebar artwork: `official` uses the supplied mark and locale-owned product name; other values retain the shell fallback and its build-version badge. The home mark uses the supplied artwork in every profile.

### Home feedback

Home displays the supplied static mark beside its headline. This plugin registers no decorative frame layer, canvas, click handler, or animation.

### Replacing the brand

A deployment with its own identity replaces this package with another package occupying `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`. Artwork identity is not configurable.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The sidebar occupants install as one declaration-aware registration set through nested `ctx.slots.inject()` calls. The independent home mark waits for its own slot declaration. Registrations withdraw when their declaration or plugin disappears. The browser half is [`src/client/index.ts`](src/client/index.ts); the node half is an empty Loader seat. The browser title is selected by `DSH_CLIENT_TITLE`, with a locale-owned fallback.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the brand surface is not enough. They move from the slots this package occupies to the shell that renders them.

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark` in the hero.
- [Web client architecture](../../../docs/subsystems/web-client.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define how brand presentation is supplied. They are current package constraints, not a brand-design comparison or a task backlog.

- **One occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **Static artwork** — the supplied SVG is rendered as a decorative image.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
