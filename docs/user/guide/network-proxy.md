# Run DSH behind a network proxy

English | [中文](network-proxy.zh.md)

DSH routes model calls, web search, page fetches, and HTTP-based MCP servers through its saved profile proxy or the standard proxy environment variables read at launch. A few paths stay direct by design or runtime limit; see the section on what stays direct.

## Connect DSH to your proxy

On Windows, open **Settings → Models → Network proxy → Configure proxy**, enter your proxy's HTTP(S) address, and choose **Continue**. DSH tests that it can reach the DeepSeek API before saving; an HTTP response, including `401`, means the proxy connection works. This setting is stored in your profile and applies to model providers and other shared outbound HTTP clients on future launches too. Choose **Use environment settings** in Models settings to remove it and return to environment routing.

You can also configure the proxy for every DSH profile by putting these variables in `$DSH_HOME/.env` (`%USERPROFILE%\.dsh\.env` is the default when `DSH_HOME` is not set):

```dotenv
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
```

The profile-level proxy setting takes precedence for DSH's shared HTTP transport. To configure DSH through environment routing instead, set `HTTP_PROXY` and `HTTPS_PROXY` in your shell before launching; environment variables remain useful for other command-line programs. A project's own `.env` cannot set proxy variables: it arrives with `git clone`, and DSH refuses to start rather than let a repository decide where your traffic goes.

A proxy that needs credentials takes them in the URL: `http://user:password@proxy.example:8080`. DSH stores the configured URL as a secret and never returns it to the browser or prints it in diagnostics. Environment-based credentials are inherited by child processes, so use the profile setting when you do not want the proxy URL exposed to commands DSH runs.

## Why Windows system proxy settings may not work for CMD

Windows exposes several proxy mechanisms, and applications do not all use the same one. Browsers and some native apps follow the Windows user proxy settings. Many command-line tools, including DSH, read `HTTP_PROXY` and `HTTPS_PROXY` instead. A proxy application's **System proxy** switch may therefore make the browser work while CMD programs still connect directly.

You do not need to set variables in each CMD window for DSH: configure its profile once in **Settings → Models → Network proxy**. For other command-line tools, use your proxy application's HTTP proxy setting or TUN mode. DSH does not currently discover the Windows system proxy automatically.

## Choose what stays direct

`NO_PROXY` lists hosts to reach directly:

```cmd
set "NO_PROXY=internal.example.com,.corp.example.com,registry.local"
```

An entry names a host and matches it together with every subdomain under it: `NO_PROXY=example.com` also sends `api.example.com` direct. A leading `.` or `*.` is accepted and means the same thing. An entry may carry a `:port`, and `*` bypasses everything.

**CIDR ranges do not work.** An operating system bypass list often contains entries like `10.0.0.0/8` or `192.168.0.0/16`; copying those into `NO_PROXY` has no effect. Use host names or domain suffixes instead.

You do not need to list `localhost` or `127.0.0.1`. DSH always bypasses loopback, because its own Web UI and local servers would otherwise route through the proxy and loop.

## Limits worth knowing

**SOCKS proxies are not supported.** A `socks5://` value is reported at startup and skipped, and DSH connects directly for the scheme that named it — setting `HTTPS_PROXY=socks5://…` alongside a usable `HTTP_PROXY` leaves `https:` direct rather than borrowing the HTTP proxy. Point the variables at your proxy application's HTTP port instead — most expose both, and the HTTP one is usually a neighbouring port number.

**`ALL_PROXY` alone is enough.** DSH falls back to it for both schemes, even though Node and curl differ on this. Setting `HTTPS_PROXY` explicitly is still clearer.

**A TLS-intercepting corporate proxy needs its certificate.** If requests fail with a certificate error once the proxy is reachable, point Node at your organisation's CA bundle before launching:

```cmd
set "NODE_EXTRA_CA_CERTS=C:\certs\corporate-ca.pem"
```

Node reads that variable only at process start, so set it before running `dsh`.

**Tools DSH runs for you follow the same proxy.** Commands in the bash tool, `git`, `gh`, and MCP servers started as child processes all inherit these variables. A child Node program uses its own installed runtime: Node 22.21+ and Node 24+ honor these variables; an older runtime connects directly. If one of your proxy variables holds a value DSH rejected — a SOCKS URL, say — Node-based tools also connect directly rather than fail to start, while `curl` and `git` still read that value.

**A password in the proxy URL reaches those tools too.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` is a normal environment variable, so every command DSH runs — including the ones the model writes — can read it, and a command that prints its environment puts the password in output that is kept. This is how the variable already behaves for everything else in your shell. If that matters, give the proxy a credential-free entry point, or authenticate it some other way than in the URL.

## What stays direct

Not every request DSH makes goes through the proxy:

- **Anything on this machine.** Loopback is always direct: `localhost`, the whole `127.0.0.0/8` range, `::1`, and `0.0.0.0`. A proxy cannot usefully reach a service that only listens locally.
- **Code the model writes.** Workflow workers and Node ptc-runtime processes receive no proxy settings, so model-authored scripts cannot read a proxy URL that may carry a password. Direct requests must configure any required proxy themselves and remain subject to the execution sandbox.
- **Usage telemetry.** The OTLP exporter uses Node's own HTTP client rather than the one a proxy configures, so telemetry connects directly and simply fails where direct egress is blocked. Nothing you do in DSH depends on it. Set `DSH_TELEMETRY_MODE=DISABLED` to turn it off entirely.
- **`web_fetch` to a literal private address.** A URL naming an address like `http://10.0.0.5/` is refused rather than handed to the proxy, the same refusal it gets with no proxy configured.

## Check that it worked

After saving the proxy in Models settings, send a model request and check your proxy application's connection log. The setup dialog also tests the route to the DeepSeek API before saving. For environment routing, start a new CMD window after setting the variables, then confirm they are present:

```cmd
set | findstr /i proxy
dsh --profile headless "fetch https://example.com and tell me the page title"
```
