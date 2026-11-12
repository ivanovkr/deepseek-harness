/** Locally bundled Monaco core with a plugin-owned editor worker. */
import { editor, languages, KeyMod, KeyCode, type Environment } from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js'
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js'
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js'
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js'
import workerSource from './editor.worker.ts?raw'
import codiconFont from './codicon.font.ts?raw'
import { conf as typescriptConf, language as typescriptLanguage } from 'monaco-editor/esm/vs/basic-languages/typescript/typescript.js'
import { conf as pythonConf, language as pythonLanguage } from 'monaco-editor/esm/vs/basic-languages/python/python.js'
import { conf as cssConf, language as cssLanguage } from 'monaco-editor/esm/vs/basic-languages/css/css.js'
import { conf as yamlConf, language as yamlLanguage } from 'monaco-editor/esm/vs/basic-languages/yaml/yaml.js'
import { conf as shellConf, language as shellLanguage } from 'monaco-editor/esm/vs/basic-languages/shell/shell.js'

/** Inputs for one disposable editor instance; no Host or Cordis objects enter Monaco. */
export interface EditorMountOptions {
  readonly text: string
  readonly label: string
  readonly language: string
  readonly wrap: boolean
  readonly dark: boolean
  readonly fontSize: number
  readonly changed: (text: string) => void
  readonly save: () => void
}

/** Install local workers and syntax grammars. @returns cleanup restoring any preceding Monaco environment. */
export function installEditorRuntime(): () => void {
  const registrations = [
    ['typescript', typescriptConf, typescriptLanguage], ['javascript', typescriptConf, typescriptLanguage],
    ['python', pythonConf, pythonLanguage], ['css', cssConf, cssLanguage],
    ['yaml', yamlConf, yamlLanguage], ['shellscript', shellConf, shellLanguage],
  ] as const
  const languagesCleanup = registrations.flatMap(([id, configuration, language]) => {
    languages.register({ id })
    return [languages.setLanguageConfiguration(id, configuration), languages.setMonarchTokensProvider(id, language)]
  })
  const previous = globalThis.MonacoEnvironment
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  const fontStyle = document.createElement('style')
  fontStyle.textContent = `@font-face { font-family: codicon; src: url(${codiconFont}) format('truetype'); }`
  document.head.appendChild(fontStyle)
  const workers = new Set<Worker>()
  const environment: Environment = {
    ...previous,
    getWorker: () => { const worker = new Worker(url); workers.add(worker); return worker },
  }
  globalThis.MonacoEnvironment = environment
  return () => {
    if (globalThis.MonacoEnvironment === environment) globalThis.MonacoEnvironment = previous
    for (const worker of workers) worker.terminate()
    URL.revokeObjectURL(url)
    fontStyle.remove()
    for (const registration of languagesCleanup.reverse()) registration.dispose()
  }
}

/**
 * Create one disposable source editor.
 * @param container - allocated editor region.
 * @param options - initial text and user callbacks.
 * @returns instance cleanup, releasing model and listeners.
 */
export function mountEditor(container: HTMLElement, options: EditorMountOptions): () => void {
  const instance = editor.create(container, {
    value: options.text, language: options.language, ariaLabel: options.label, theme: options.dark ? 'vs-dark' : 'vs',
    automaticLayout: true, minimap: { enabled: false }, wordWrap: options.wrap ? 'on' : 'off',
    scrollBeyondLastLine: false, contextmenu: false, links: false, fontSize: options.fontSize,
  })
  const change = instance.onDidChangeModelContent(() => {
    options.changed(instance.getValue({ preserveBOM: true, lineEnding: '\n' }))
  })
  const save = instance.addAction({ id: 'project.save', label: options.label, keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS], run: options.save })
  return () => { const model = instance.getModel(); change.dispose(); save.dispose(); instance.dispose(); model?.dispose() }
}
