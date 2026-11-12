---
kind: upgrade-guide
description: "内置配置不再要求先审阅 OpenSpec 才能调用修改项目的工具。"
---

# OpenSpec 审阅不再限制项目工具

[English](guide.md) | 中文

## 变更

内置配置仍提供 OpenSpec 工具，用于准备、验证和审阅变更文档。人工审阅会记录用户是否接受计划，但不再阻止修改项目或未分类的工具。现有沙箱和权限策略仍控制这些工具。

## 迁移

1. 如果自定义 OpenSpec 配置行设置了已移除的 `section` 或 `readOnlyTools` 字段，请删除这些字段；保留该行仍支持的资源限制字段。[包参考](../../../../packages/plan/openspec/README.zh.md)列出了当前配置。
2. 如果配置文件依靠 OpenSpec 审阅来限制工具，请通过 [`dsh-sandbox-policy`](../../../../packages/sandbox/sandbox-policy/README.md) 和现有审批策略配置所需的文件效果限制。OpenSpec 审阅本身不再提供执行限制。
3. 调用 `openspec` 工具并设置 `operation: review` 来展示和记录计划决定，然后运行工作流程要求的检查。确认配置文件中的沙箱和审批设置仍能执行所需限制。
