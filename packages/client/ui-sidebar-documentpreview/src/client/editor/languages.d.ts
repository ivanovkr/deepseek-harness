/** Monaco ships typed editor APIs but untyped Monarch grammar modules. */
declare module 'monaco-editor/esm/vs/basic-languages/*' {
  import type { languages } from 'monaco-editor'
  export const conf: languages.LanguageConfiguration
  export const language: languages.IMonarchLanguage
}
