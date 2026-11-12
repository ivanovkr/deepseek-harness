---
description: "面向工作区用户与插件维护者的只读 OpenSpec 变更清单和文档详情。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-development

[English](README.md) | 中文

## 摘要

`@deepseek-ai/dsh-client-ui-development` 添加 **开发** Conversation 标签页（俄语为 **Разработка**）。它通过现有 workspace-files Remote API 读取所选 Session 的工作区，不执行 OpenSpec 命令，也不修改文件。

## 目录

- [阅读变更](#reading-changes)
- [限制与失败](#limits-and-failures)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发说明](#dev-note)

<a id="reading-changes"></a>
## 阅读变更

看板根据文档类型是否存在，将 `openspec/changes` 下的活动目录分为无文档、部分文档和全部四类文档。排除 `archive`。数量反映文件存在情况，而非流程完成、实现就绪、测试结果或批准。

选择变更后，可选择提案、规范、设计或任务。详情列出具体路径并渲染所选 Markdown 文件。规范来自 `specs/<capability>/spec.md`。任务复选框是只读的原文标记；已勾选/总数不构成验证依据。

**刷新** 重新读取此 Session 的活动看板和文档资源。选择状态仅保留在视图中。变更目录不存在与目录存在但为空分别显示不同消息。

<a id="limits-and-failures"></a>
## 限制与失败

客户端配置支持 `maxChanges`（默认 100；范围 1–2000）、`maxSpecFiles`（100；每个变更 1–2000 个能力目录）、`maxDocumentBytes`（524288；1–8388608 个 UTF-8 字节）以及 `maxDocumentPages`（10；1–100）。Host 的目录清单和读取限制同样适用。

目录清单截断、超出预算、文件版本不一致、资源路径无效及 Remote 失败均显示错误，而不是部分成功。刷新使用现有地址重试失败资源。失败资源隐藏其上次成功内容。取消会停止后续调用并移除资源的刷新监听器。

<a id="model-experience"></a>
## 模型体验

此插件不添加面向模型的工具、提示词、Session 事件或投影。其状态来自当前工作区文件，而非重建的 OpenSpec CLI 状态。标签页没有写入、归档、批准或执行操作。

#### KV Cache 影响

无。视图不添加提示词 token，不改变模型请求前缀或 KV 缓存复用。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

仅支持标准 OpenSpec 目录结构。不解析自定义架构、配置的存储位置、依赖图、跳过规范或批准策略。全部四类文档存在并不代表变更完成。遵循 workspace-files 的权限和符号链接行为，而不是实现 CLI 的文件策略。

变更需要手动刷新，不安装递归文件系统监听器。文档仅在选中时获取，但共享资源注册表在资源源仍活动时负责保留内容。看板发现与所选文档的刷新并非原子工作区快照。Markdown 原文得以保留；补充任务列表识别围栏代码块以外的 Markdown 项目符号或编号复选框，而非所有 Markdown 扩展。

<a id="dev-note"></a>
## 开发说明

客户端入口通过所属插槽环将 `conversation.view` 注册为 `development`，顺序为 30。词典和 `development-board` / `development-document` 提供者均为插件作用域内可撤销的贡献。组件接收 `useResource`、本地化文案及窄范围刷新回调，不通过 effect 获取数据。Host 入口无运行时行为。

定向测试覆盖发现、分页、字节与版本限制、取消、失败后刷新、原文任务解析、文档详情、失败可见性、本地化和注册清理。Web 组合与已发布客户端包检查由集成应用负责。
