---
kind: upgrade-guide
description: "The ВСЦМ Harness Web composition disables account sign-in and account notifications by default."
---

# Account sign-in is disabled in the Web composition

English | [中文](guide.zh.md)

## Change

The Web bundle previously mounted the account launcher, browser sign-in, and account notifications. The ВСЦМ Harness composition disables `ui-settings-account` and `ui-account-notifications`, including for Desktop compositions using this bundle. The sidebar uses the ordinary Settings launcher, and model onboarding opens the API-key editor without an account sign-in step. Existing credentials and Session data remain stored.

## Migration

1. Open Settings → Models and configure an API key for the provider you use. Provider names and credential references are unchanged.
2. To retain account sign-in in a custom deployment, set `disabled: false` on both `ui-settings-account` and `ui-account-notifications` in that profile's `cordis.patch.yml`.
3. Restart the existing application and refresh its page. In the default composition, confirm that Settings remains available and that no account sign-in entry appears.
