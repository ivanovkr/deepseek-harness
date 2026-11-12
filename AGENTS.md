# AGENTS.md

DeepSeek Harness is an all-plugin Cordis agent harness. Read [docs/architecture.md](docs/architecture.md) before changing `packages/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

- Client TypeScript references must target compiler-face leaf configs when a dependency has split Host and Client programs. Resolve generated Remote type-only imports through `tsconfig.base.json` source paths (for example, `@deepseek-ai/dsh-api-workspace-files/remote` maps to `packages/api/workspace-files/src/typert.remote-client.ts`); do not rely on emitted `lib/` declarations during source-plane checks.

## Pre-stable APIs and released Session data

Public APIs are pre-stable; update every consumer. Follow [version/status](docs/session-format-status.md) and [type acknowledgements](docs/cookbook/reviewing-persistence-type-changes.md). [Adjacent migration](.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md) may add a version-named successor but never move, overwrite, or delete committed generations; predecessors imply neither fallback nor downgrade support. SQLite uses monotonic `SCHEMA_VERSION`.

Acknowledge [declared persistence-type changes](docs/cookbook/reviewing-persistence-type-changes.md).

Record each externally perceptible breaking change immediately in an [upgrade guide](.agents/skills/dsh-create-upgrade-guide/SKILL.md).

**Application launch.** Only `dsh` profiles launch supported Node apps; package bins, demos, and public SDK argv escapes are forbidden ([rule](docs/architecture.md#application-launch)).

## Repository layout

```
vendor/      Vendored Cordis (vendor/README.md)
packages/    @deepseek-ai/dsh-<pkg> workspaces at packages/<group>/<pkg>/
  core/                 agent/session API
  api/                  remote BFF
  typert/               type graphs
  llm/                  model providers
  shell/                command execution
  subprocess/           child-process management
  ssh/                  SSH execution providers
  terminal/             persistent terminals
  ptc-runtime/          PTC execution
  sandbox/              process confinement
  deliverables/         turn deliverables
  fs/                   filesystem access
  lsp/                  language servers
  skill/                skill loading
  web/                  search/fetch tools
  computer-use/         computer interaction
  browser-use/           browser interaction
  compaction/           context compaction
  context/              request context
  subagent/             delegated agents
  team/                 shared task coordination
  jobs/                 background jobs
  bundle/               profile bundles
  workflow/             workflow execution
  todo/                 todo_write tool
  plan/                  logged planning
  goal/                  goal tracking
  schedule/              scheduled follow-ups
  preset/                agent composition
  guard/                 loop/tool guards
  extensions/            runtime self-modification
  session/               durable sessions
  session-query/         browsing/search/export
  attachment/            binary attachments
  spill/                 output spill
  storage/               non-session storage
  workspace/             workspace entities
  feedback/               human feedback
  identity/               anonymous identity
  settings/               settings
  credentials/            authorization
  acp/                    automation-only ACP
  interaction/            human interaction
  boot/                   application boot
  sdk/                    JSON-RPC SDK
  host/                   GUI host
  client/                 GUI client
  mcp/                    external tools
  experimental/           evaluated capabilities without a product-support commitment
  test-support/           test infrastructure
  util/                   zero-dependency utilities
python/      Python SDK/runtime
native/      @deepseek-ai/node-addon-system source
benchmarks/  performance gates
.agents/     agent workflows and notes
docs/        documentation
scripts/     gates and generators
website/     VitePress documentation projection
```

Package groups: [packages/README.md](packages/README.md). [Experimental status](packages/experimental/README.md#status) is independent of optional delivery; nonexperimental packages need product use or an explicit [classification](scripts/product-package-policy.ts).

## Commands

```sh
pnpm install            # pnpm workspaces, node >=24.9
pnpm run clean           # remove build outputs and safe residue from deleted packages
pnpm run test           # unit tests
pnpm run test:coverage  # CI coverage gate: per-file 100% on packages/*/*/src
pnpm run test:e2e       # real-API tests; self-skip without DEEPSEEK_API_KEY
pnpm run test:expected  # owner-local process expectations
pnpm run test:snapshot  # keyless recorded-session replay through shipped profiles; filter: -t <name>
pnpm run test:snapshot:record  # re-record expected outputs (needs key)
pnpm run typecheck
pnpm run lint
pnpm run duplication    # cross-file TypeScript clone detection
pnpm run build          # build:artifacts + build:check, concurrently
pnpm run build:artifacts # artifacts: tsc emits lib/types, tsdown bundles runtime, Web
pnpm run build:check    # typecheck aggregate tests/scripts against current build:artifacts output
pnpm run hygiene        # publint + workspace/package/dependency checks + NodeNext consumer check
pnpm run check:windows-wine  # ONLY when diagnosing a known Windows failure (needs wine); CI owns this signal
pnpm run doc-sync       # documentation gates (scripts/run-gates.ts)
pnpm run test:docs      # quick documentation checks (no build; doc-quick aggregate)
pnpm run website:build  # VitePress build (doubles as dead-link check)
pnpm dsh --profile headless "task"  # run one task from source (needs DEEPSEEK_API_KEY)
pnpm run demo:ptc -- "task"  # headless PTC mode run (needs key)
pnpm run dev:web | dev:desktop  # build:artifacts, then launch; Web also rebuilds client bundles on edits. start:web | start:desktop skip the build
make web|dev-web|desktop|dev-desktop|build  # the same commands; ARGS='--no-open' forwards options
```

### Host sandbox failures

If a required `gh`, `pnpm`, build, test, or generator command fails because the sandbox blocks credentials, network, IPC, watching, or nested `sandbox-exec`, retry unchanged with the narrowest host escalation. Require sandbox evidence; never bypass test failures or the product sandbox.

## Secrets / .env

Windows packaging/signing: [required reading](apps/desktop/windows-signing/README.md).

Real-API tests/demos read `DEEPSEEK_API_KEY`, optional `DEEPSEEK_BASE_URL`, and root `.env`. cordis.yml allows `!!js` (never `!js`) under plugin `config` and entry `disabled`; other metadata stays literal, so conditional composition also uses overlays ([primer](docs/cordis-primer.md#loader-configuration)). Never commit credentials. CI e2e skips without a key; [testing.md](docs/testing.md) owns key policy.

## Conventions

- Packages use `@deepseek-ai/dsh-<pkg>`; vendor is [rescoped](docs/rescope.md) and `private: true`. Harness packages declare `@deepseek-ai/cordis` in `peerDependencies`/`devDependencies`. Workspace dependency sections use DSH `workspace:*`, vendor/native `workspace:~` ([rules](.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
- Everything is ESM. Follow the repository's launch, dependency, and contribution rules in this file and the linked architecture docs.
- **Source plane vs artifact plane, never mixed.** Static gates and tests resolve workspace imports through tsconfig `paths` to `src` and pass on a clean tree; gates consuming built `lib/` declare that dependency ([layout](docs/development.md#typescript-project-layout)).
- **Keep compiler faces explicit.** A package with both Host and Client programs exposes face-specific leaf configs and a solution-only root; repo-wide programs seed a face config, never the root solution ([layout](docs/development.md#typescript-project-layout)).

[Full repository conventions and defensive patterns are maintained in the root AGENTS.md of the upstream checkout.]
