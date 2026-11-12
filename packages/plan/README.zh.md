---
description: "OpenSpec 规划与计划模式协作的包映射。"
kind: "package-group"
---

# plan/：plan 协作状态

[English](README.md) | 中文

## 概述

`plan/` 组提供 OpenSpec 规划和可选的计划模式协作。OpenSpec 会展示变更文档供用户审阅，但不会改变工具权限。计划模式另行提供部署指引和经审阅的退出流程；这两种模式都不会改变沙箱权限。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

两个包分别提供 OpenSpec 规划和可选的计划模式协作。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`openspec/`](openspec/README.zh.md) | 准备并验证官方 OpenSpec 变更，记录用户审阅但不控制项目工具 | — |
| [`plan-mode/`](plan-mode/README.zh.md) | 提供计划模式：`/plan` 进入和离开，部署写入的指令在规划期间引导 agent，`exit_plan_mode` 把完成的计划呈交你评审 | `ctx.planMode` |

-----

<a id="related-documentation"></a>
## 相关文档

先从子系统参考了解共享词汇，再阅读设计说明了解决策。

- [计划模式子系统参考](../../docs/subsystems/plan.zh.md)——计划模式如何工作、其配置与退出工具的行为。
- [plan 专用协作状态](plan-mode/README.zh.md)——计划模式背后的设计决策。

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
