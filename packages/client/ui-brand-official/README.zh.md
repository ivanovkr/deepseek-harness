---
description: "ВСЦМ Harness 侧栏与首页品牌。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-official

[English](README.md) | 中文

## 概述

本包在空白首页显示 ВСЦМ Harness 图形，并在 `official` 客户端构建中显示侧栏品牌。其他 profile 保留侧栏外壳回退。首页保持留白，不提供点击触发的背景动画。品牌呈现不增加模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Web 与 Desktop 组合挂载本插件以显示首页标志；`official` 客户端构建还会注册侧栏标志和名称。

### 选择 profile

`DSH_CLIENT_BUILD_PROFILE` 控制侧栏图形：`official` 使用提供的标志和词典中的产品名称；其他值保留外壳回退及构建版本徽标。所有 profile 的首页标志都使用提供的图形。

### 首页反馈

首页在标题旁显示提供的静态标志。本插件不注册装饰 frame 层、Canvas、点击处理器或动画。

### 替换品牌

自有身份的部署用另一个包替换本包，占据 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark`。品牌图形身份不可配置。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

侧栏填充通过嵌套的 `ctx.slots.inject()` 调用作为一组声明感知的注册安装。独立的首页标志等待自己的 slot 声明。声明或插件消失时注册撤回。浏览器半部是 [`src/client/index.ts`](src/client/index.ts)；node 半部是空的 Loader 席位。浏览器标题由 `DSH_CLIENT_TITLE` 选择，并使用词典中的回退值。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当品牌面不够用时阅读以下页面。它们从本包占据的 slot 进入渲染这些 slot 的外壳。

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark`。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了品牌呈现的供给方式。它们是当前包约束，不是品牌设计对比或任务积压。

- **只有一组填充**——替代呈现属于占据相同 slot 的另一个 Cordis 包。
- **静态图形**——提供的 SVG 作为装饰图像渲染。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建时选择标题文本，而非通过 UI slot。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
