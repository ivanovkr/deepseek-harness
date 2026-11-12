---
description: "准备、验证和审阅 OpenSpec 变更，但不改变工具权限。"
kind: "package-reference"
---

# @deepseek-ai/dsh-openspec

[English](README.md) | 中文

## 概述

准备和验证 OpenSpec 变更，并向用户展示实际文档以供审阅。审阅记录用户决定，但不会授予或限制项目工具。普通聊天继续使用现有工具和权限。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用此包

[基础包](../../bundle/base/cordis.patch.yml)和[独立最小 SDK 包](../../bundle/sdk-minimal/cordis.patch.yml)挂载此 Host 插件。它不是可选安装包。运行时依赖将官方 OpenSpec 固定为 `2.0.0`；调用不会安装软件包或查找全局可执行文件。

使用 `openspec` 的 `init`、`new`、`instructions`、`write`、`status`、`validate` 和 `review` 操作。初始化创建元数据，不安装项目内的智能体集成。准备操作遵循当前沙箱策略。写入仅接受所选变更中的提案、设计、任务和功能规格文档。审阅要求全部四类文档及官方严格验证成功，然后通过已配置的用户问答渠道展示有界的文档内容。审阅结果仅记录用户决定，不会改变工具权限。

所有资源限制字段均为必填；部署值位于包配置行中：

| 字段 | 含义 |
|---|---|
| `timeoutMs` | CLI 截止时间 |
| `maxOutputBytes` | CLI 输出合计字节上限 |
| `graceMs` | 托管进程终止宽限期 |
| `maxArtifactBytes` | 完整审阅文档的字节上限 |
| `maxArtifactFiles` | 审阅文件及遍历目录上限 |

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节</summary>

[工具](src/index.ts)负责有界准备及用户审阅。[文档读取器](src/artifacts.ts)验证所选变更，并限制审阅文档的大小。[CLI 适配器](src/cli.ts)通过托管子进程和当前沙箱策略运行固定版本的可执行文件。遥测和更新检查已禁用。CLI 失败不会回滚已写入的文件。

</details>

<a id="model-experience"></a>
## 模型体验

### OpenSpec 工具

#### 模型看到什么

`openspec` 定义提供结构化准备、审阅和验证操作。审阅结果不会改变可用工具。

#### Token 影响

继承全局注册表的位置始终提供该工具模式。文档和输出限制约束单个结果，不约束完整会话历史。

#### KV Cache 影响

工具定义在审阅决定变化时保持稳定。结果会追加，不会重写先前消息。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

OpenSpec 审阅是规划交互，不是执行策略。

- 随包提供的本地运行时要求共享的本地文件系统；不支持的执行环境会显式失败。
- 缺少用户问答渠道时无法进行审阅，但不会改变工具权限。
- 当前沙箱策略仍会约束 OpenSpec 子进程和文件写入。
- 结构验证不保证实现正确。应单独报告实际行为测试。

<a id="dev-note"></a>
### 开发备注

无。
