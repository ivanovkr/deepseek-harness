# 在网络代理后面运行 DSH

[English](network-proxy.md) | 中文

DSH 会将模型调用、web 搜索、页面抓取和基于 HTTP 的 MCP 服务器请求，经由已保存的 profile 代理或启动时读取的标准代理环境变量发出。有几条路径出于设计或运行时限制保持直连，见“哪些保持直连”一节。

## 让 DSH 连接代理

在 Windows 上打开**设置 → Models → 网络代理 → 配置代理**，输入 HTTP(S) 代理地址并点击**继续**。DSH 会先测试能否通过代理访问 DeepSeek API，再保存设置；任何 HTTP 响应（包括 `401`）都表示代理已连通。设置保存在 profile 中，后续启动也会应用于模型提供方及其他共享出站 HTTP 客户端。在 Models 设置中选择**使用环境设置**即可移除该配置并恢复环境路由。

也可以将以下变量写入 `$DSH_HOME/.env`（未设置 `DSH_HOME` 时默认为 `%USERPROFILE%\\.dsh\\.env`），从而为每个 DSH profile 配置代理：

```dotenv
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
```

profile 中保存的代理优先于 DSH 共享 HTTP 传输使用的环境代理。若要仅通过环境路由配置 DSH，请在启动前设置 `HTTP_PROXY` 和 `HTTPS_PROXY`；环境变量也可供其他命令行程序使用。项目自己的 `.env` 不能设置代理变量：它随 `git clone` 一起到来，DSH 宁可拒绝启动，也不让一个仓库决定你的流量去向。

需要凭据的代理把凭据写在 URL 里：`http://user:password@proxy.example:8080`。DSH 将已保存的 URL 作为机密，不会将其返回给浏览器或在诊断中打印。环境变量中的凭据会被子进程继承；如果不希望 DSH 运行的命令看到代理 URL，请使用 profile 设置。

## 为什么 Windows 系统代理设置可能对 CMD 无效

Windows 提供了多种代理机制，应用并不都会使用同一种。浏览器和一些原生应用会遵循 Windows 用户代理设置；许多命令行工具（包括 DSH）则读取 `HTTP_PROXY` 和 `HTTPS_PROXY`。因此，代理软件中的**系统代理**开关可能让浏览器可用，却让 CMD 程序仍然直连。

无需在每个 CMD 窗口里设置变量即可让 DSH 使用代理：只需在 **设置 → Models → 网络代理**中配置一次。其他命令行工具可使用代理软件的 HTTP 代理配置或 TUN 模式。DSH 目前不会自动发现 Windows 系统代理。

## 指定哪些目标保持直连

`NO_PROXY` 列出需要直连的主机：

```cmd
set "NO_PROXY=internal.example.com,.corp.example.com,registry.local"
```

一个条目写的是主机名，它连同其下所有子域名一起匹配：`NO_PROXY=example.com` 也会让 `api.example.com` 直连。前缀 `.` 或 `*.` 可以写，含义相同。条目可带 `:port`，`*` 则放行全部。

**CIDR 网段不生效。** 操作系统的绕过列表常含 `10.0.0.0/8` 或 `192.168.0.0/16` 这类条目；把它们复制进 `NO_PROXY` 不会有任何效果。请改用主机名或域名后缀。

不需要列出 `localhost` 或 `127.0.0.1`。DSH 始终绕过 loopback，否则它自己的 Web UI 与本地服务器都会经由代理并形成回环。

## 值得知道的限制

**不支持 SOCKS 代理。** `socks5://` 形式的值会在启动时被报告并跳过，指定它的那个 scheme 转为直连——把 `HTTPS_PROXY=socks5://…` 与一个可用的 `HTTP_PROXY` 一起设置时，`https:` 会保持直连，而不会去借用 HTTP 代理。请把变量指向代理软件的 HTTP 端口——多数软件两者都提供，且 HTTP 端口通常就在相邻的端口号上。

**只设 `ALL_PROXY` 也够用。** DSH 会用它为两种协议兜底，尽管 Node 与 curl 在这一点上并不一致。显式设置 `HTTPS_PROXY` 仍然更清楚。

**做 TLS 拦截的企业代理需要它的证书。** 如果代理已经可达但请求仍报证书错误，请在启动前把 Node 指向你所在组织的 CA 包：

```cmd
set "NODE_EXTRA_CA_CERTS=C:\certs\corporate-ca.pem"
```

Node 只在进程启动时读取该变量，所以要在运行 `dsh` 之前设置。

**DSH 替你运行的工具遵循同一个代理。** bash 工具里的命令、`git`、`gh`，以及作为子进程启动的 MCP 服务器都会继承这些变量。Node 子程序使用自己安装的运行时：Node 22.21+ 和 Node 24+ 遵循这些变量；更旧的运行时会直连。如果你的某个代理变量是 DSH 拒绝的值——比如 SOCKS URL——基于 Node 的工具同样直连而不是起不来，`curl` 与 `git` 则仍会读取那个值。

**代理 URL 里的密码同样会到达这些工具。** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` 就是一个普通环境变量，因此 DSH 运行的每一条命令——包括模型编写的那些——都能读到它，而打印环境的命令会把密码写进被保留的输出。这与该变量在你 shell 里对其他一切程序的行为一致。若这一点重要，请为代理提供一个无需凭据的入口，或改用 URL 之外的方式认证。

## 哪些保持直连

并非 DSH 发出的每个请求都会走代理：

- **本机上的一切。** loopback 始终直连：`localhost`、整个 `127.0.0.0/8` 段、`::1` 与 `0.0.0.0`。代理无法有意义地访问一个只在本地监听的服务。
- **模型编写的代码。** Workflow worker 与 Node ptc-runtime 进程不接收代理配置，因此模型脚本读不到可能携带密码的代理 URL。直接请求必须自行配置所需代理，并继续受到执行沙箱的约束。
- **使用情况遥测。** OTLP 导出器用的是 Node 自带的 HTTP 客户端，而不是代理所配置的那个，因此遥测直连；在禁止直连出网的环境里它只会失败。DSH 的任何功能都不依赖它。设 `DSH_TELEMETRY_MODE=DISABLED` 可完全关闭。
- **`web_fetch` 访问字面量私网地址。** 形如 `http://10.0.0.5/` 的 URL 会被拒绝而非交给代理，与未配置代理时得到的拒绝相同。

## 验证是否生效

在 Models 设置中保存代理后，发送一次模型请求并查看代理软件的连接日志。设置对话框会在保存前测试到 DeepSeek API 的代理路由。若使用环境路由，请在设置变量后新开 CMD 窗口，并确认变量已载入：

```cmd
set | findstr /i proxy
dsh --profile headless "fetch https://example.com and tell me the page title"
```
