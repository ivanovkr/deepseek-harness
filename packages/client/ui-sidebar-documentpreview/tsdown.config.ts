import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { Rolldown, type UserConfig } from 'tsdown'
import { clientBundle } from '../tsdown.client.ts'

const bundle = clientBundle(import.meta.dirname, ['lib/types/index.js'], {
  clientBanner: fileName => fileName.endsWith('client.pdf.js') ? pdfLicenseBanner()
    : fileName.endsWith('client.excel.js') ? excelLicenseBanner()
      : fileName.endsWith('client.runtime.js') ? monacoLicenseBanner() : undefined,
})
const require = createRequire(import.meta.url)
const workerSpecifier = 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
const workerModule = '\0dsh-pdf-worker.mjs'

/** Retain Monaco's license alongside its lazily bundled editor and Worker. */
function monacoLicenseBanner(): string {
  const root = dirname(require.resolve('monaco-editor/package.json'))
  return ['//! Bundled Monaco editor license', ...readFileSync(join(root, 'LICENSE'), 'utf8').trimEnd().split('\n').map(line => `// ${line}`)].join('\n')
}

/** FortuneSheet omits its repository license from the npm payload. */
function excelLicenseBanner(): string {
  const fortune = readFileSync(join(import.meta.dirname, 'licenses/FortuneSheet.txt'), 'utf8')
  const excel = readFileSync(join(dirname(require.resolve('exceljs/package.json')), 'LICENSE'), 'utf8')
  const xml = readFileSync(join(dirname(dirname(require.resolve('fast-xml-parser'))), 'LICENSE'), 'utf8')
  const csv = readFileSync(join(dirname(require.resolve('papaparse/package.json')), 'LICENSE'), 'utf8')
  const zip = readFileSync(join(dirname(require.resolve('fflate/package.json')), 'LICENSE'), 'utf8')
  const xlsRoot = dirname(require.resolve('xlsx'))
  const xls = readdirSync(xlsRoot).filter(name => /^(LICENSE|NOTICE)(\.|$)/u.test(name)).sort()
    .map(name => readFileSync(join(xlsRoot, name), 'utf8')).join('\n')
  return ['//! Bundled spreadsheet license notices', ...`${fortune}\n${excel}\n${xml}\n${csv}\n${zip}\n${xls}`.trimEnd().split('\n').map(line => `// ${line}`)].join('\n')
}

/** License files for PDF.js and the data embedded beside its runtime. */
function pdfLicenseFiles(root: string): string[] {
  return ['LICENSE', ...['cmaps', 'standard_fonts', 'wasm'].flatMap(directory =>
    readdirSync(join(root, directory)).filter(name => name.startsWith('LICENSE')).sort()
      .map(name => `${directory}/${name}`),
  )]
}

/** Keep every bundled PDF.js license visible in the published client artifact. */
function pdfLicenseBanner(): string {
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  const notice = pdfLicenseFiles(root).map(name =>
    `${name}\n\n${readFileSync(join(root, name), 'utf8').trimEnd()}`,
  ).join('\n\n')
  return ['//! Bundled PDF.js license notices', ...notice.split('\n').map(line => `// ${line}`)].join('\n')
}

/** Keep font mappings and image decoders in the same artifact as their PDF.js runtime. */
function pdfAssets(): string {
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  return JSON.stringify(Object.fromEntries([
    ['cMapUrl', 'cmaps'], ['standardFontDataUrl', 'standard_fonts'], ['wasmUrl', 'wasm'],
  ].map(([kind, directory]) => [kind, Object.fromEntries(
    readdirSync(join(root, directory!)).filter(name => !name.startsWith('LICENSE')).sort()
      .map(name => [name, readFileSync(join(root, directory!, name)).toString('base64')]),
  )])))
}

/** The dynamic client factory has no module URL from which to resolve a Worker file. */
const pdfWorker: NonNullable<UserConfig['plugins']> = [{
  name: 'dsh-pdf-worker-source',
  resolveId(source) {
    return source === workerSpecifier ? workerModule : null
  },
  load(id) {
    if (id !== workerModule) return null
    const path = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
    this.addWatchFile(path)
    return `export default ${JSON.stringify(readFileSync(path, 'utf8'))};`
  },
}]

/** Embed a self-contained browser parser without giving it a loader-module dependency. */
const excelWorker: NonNullable<UserConfig['plugins']> = [{
  name: 'dsh-excel-worker-source',
  resolveId(source) {
    if (source === './worker.ts?raw') return '\0dsh-excel-worker-source'
    if (source === './editor.worker.ts?raw') return '\0dsh-editor-worker-source'
    if (source === './codicon.font.ts?raw') return '\0dsh-editor-icon-font'
    return null
  },
  async load(id) {
    if (id === '\0dsh-editor-icon-font') {
      const font = require.resolve('monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.ttf')
      this.addWatchFile(font)
      return `export default ${JSON.stringify(`data:font/ttf;base64,${readFileSync(font).toString('base64')}`)};`
    }
    if (id !== '\0dsh-excel-worker-source' && id !== '\0dsh-editor-worker-source') return null
    const parent = this
    const worker = await Rolldown.rolldown({
      input: id === '\0dsh-editor-worker-source'
        ? require.resolve('monaco-editor/esm/vs/editor/editor.worker.js')
        : join(import.meta.dirname, 'src/client/excel/worker.ts'), platform: 'browser',
      resolve: { mainFields: ['browser', 'module', 'main'], aliasFields: [['browser']] },
      transform: { define: { 'process.env.NODE_ENV': JSON.stringify('production') } },
      plugins: [{
        name: 'dsh-excel-worker-dependencies',
        async resolveId(source, importer) {
          // The outer build's license analysis must also see imports embedded in Worker text.
          if (importer?.startsWith(join(import.meta.dirname, 'src')) && !source.startsWith('.')) await parent.resolve(source, importer)
          return null
        },
      }],
    })
    try {
      const result = await worker.generate({ format: 'iife', minify: true })
      const chunk = result.output[0]
      if (chunk?.type !== 'chunk') throw new Error('Excel parser did not emit a JavaScript chunk')
      for (const path of Object.keys(chunk.modules)) this.addWatchFile(path)
      return `export default ${JSON.stringify(chunk.code)};`
    } finally { await worker.close() }
  },
}]

/** Keep Monaco's compiler helpers inside its lazy factory, never in a shared sibling chunk. */
const editorBoundary: NonNullable<UserConfig['plugins']> = [{
  name: 'dsh-document-editor-chunk',
  resolveId(source, importer) {
    if (importer?.replaceAll('\\', '/').endsWith('/client/editor/index.ts')
      || importer?.replaceAll('\\', '/').endsWith('/client/editor/index.js')) {
      if (source === './runtime.ts' || source === './runtime.js') return { id: './client.runtime.js', external: true }
    }
    return null
  },
}]

export default (options: Parameters<typeof bundle>[0]): UserConfig[] => {
  const configs = bundle(options)
  const runtimeBase = bundle(options).find(config => config.name?.endsWith('/client') === true)
  const result: UserConfig[] = configs.map(config => config.name?.endsWith('/client') === true ? {
    ...config,
    inputOptions: {
      ...config.inputOptions,
      resolve: { ...config.inputOptions?.resolve, mainFields: ['browser', 'module', 'main'], aliasFields: [['browser']] },
    },
    plugins: [config.plugins, pdfWorker, excelWorker, editorBoundary],
    define: { ...config.define, __DSH_PDFJS_ASSETS__: pdfAssets() },
  } : config)
  if (runtimeBase !== undefined) result.push({
    ...runtimeBase, name: `${runtimeBase.name}/editor`,
    entry: options.env?.DSH_BUILD_FACE === 'client' ? 'lib/types/client/editor/runtime.js' : 'src/client/editor/runtime.ts',
    plugins: [runtimeBase.plugins, excelWorker],
    outputOptions: {
      ...runtimeBase.outputOptions, entryFileNames: 'client.runtime.js', codeSplitting: false,
      banner: 'window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview", chunk: "client.runtime.js", factory: (require) => {',
    },
  })
  return result
}
