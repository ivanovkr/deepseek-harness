---
kind: upgrade-guide
description: "ВСЦМ Harness Web 组合默认禁用账号登录与账号通知。"
---

# Web 组合禁用账号登录

[English](guide.md) | 中文

## 变更

Web bundle 原先挂载账号入口、浏览器登录与账号通知。ВСЦМ Harness 组合禁用 `ui-settings-account` 和 `ui-account-notifications`，包括使用此 bundle 的 Desktop 组合。侧边栏使用普通设置入口，模型引导直接打开 API 密钥编辑器，不再提供账号登录步骤。已有凭据与 Session 数据保持存储。

## 迁移

1. 打开设置 → 模型，为使用的提供方配置 API 密钥。提供方名称与凭据引用保持不变。
2. 如需在自定义部署中保留账号登录，在该 profile 的 `cordis.patch.yml` 中将 `ui-settings-account` 和 `ui-account-notifications` 的 `disabled` 均设为 `false`。
3. 重启现有应用并刷新页面。在默认组合中，确认设置仍可访问且没有账号登录入口。
