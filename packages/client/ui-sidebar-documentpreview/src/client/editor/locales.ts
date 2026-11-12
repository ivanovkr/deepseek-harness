/** Locale-owned editor controls and actionable save failures. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** English editor dictionary and key source. */
export const en = {
  title: 'Editor', loading: 'Loading editor…', save: 'Save', saving: 'Saving…', saved: 'Saved',
  dirty: 'Unsaved changes — drafts remain available when you reopen this file.',
  reload: 'Discard draft and reload', confirmDiscard: 'Discard your unsaved edits and reload this file?',
  failed: 'Could not read or save this file. Copy any edits before reloading; check access and try again.',
  unsupported: 'Editing requires a complete UTF-8 text file with consistent LF or CRLF line endings.',
  conflict: 'The file changed on disk. Your draft is retained. Copy your edits before discarding and reloading.',
  unknown: 'The save outcome is unknown. Your draft is retained. Copy your edits, then reload to check the file before saving again.',
  denied: 'Saving is not allowed by this Session’s policy or file permissions. Your draft is retained.',
  retry: 'Retry loading', editorLabel: 'Project file editor',
}
/** Editor copy keys. */
export type EditorKey = keyof typeof en
/** Russian editor copy. */
export const ru: Record<EditorKey, string> = {
  title: 'Редактор', loading: 'Загрузка редактора…', save: 'Сохранить', saving: 'Сохранение…', saved: 'Сохранено',
  dirty: 'Есть несохранённые изменения — черновик останется доступен при повторном открытии файла.',
  reload: 'Отбросить черновик и перечитать', confirmDiscard: 'Отбросить несохранённые изменения и перечитать файл?',
  failed: 'Не удалось прочитать или сохранить файл. Скопируйте правки перед перечитыванием. Проверьте доступ и повторите попытку.',
  unsupported: 'Для редактирования нужен полный текстовый файл UTF-8 с единообразными переводами строк LF или CRLF.',
  conflict: 'Файл изменён на диске. Черновик сохранён. Скопируйте свои правки перед сбросом и перечитыванием.',
  unknown: 'Результат сохранения неизвестен. Черновик сохранён. Скопируйте правки и перечитайте файл перед следующим сохранением.',
  denied: 'Политика сеанса или права файла запрещают сохранение. Черновик сохранён.',
  retry: 'Повторить загрузку', editorLabel: 'Редактор файла проекта',
}
/** Chinese editor copy. */
export const zh: Record<EditorKey, string> = {
  title: '编辑器', loading: '正在加载编辑器…', save: '保存', saving: '正在保存…', saved: '已保存',
  dirty: '有未保存的更改；重新打开此文件时仍可恢复草稿。',
  reload: '放弃草稿并重新加载', confirmDiscard: '放弃未保存的编辑并重新加载此文件？',
  failed: '无法读取或保存文件。请在重新加载前复制编辑内容，并检查访问权限后重试。',
  unsupported: '编辑需要完整的 UTF-8 文本文件，且换行符必须统一为 LF 或 CRLF。',
  conflict: '磁盘上的文件已更改。草稿已保留。放弃并重新加载前请复制您的编辑。',
  unknown: '保存结果未知。草稿已保留。请复制编辑内容，然后重新加载以确认文件内容后再保存。',
  denied: '此会话的策略或文件权限不允许保存。草稿已保留。', retry: '重试加载', editorLabel: '项目文件编辑器',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { sidebarEditor: EditorKey }
}
