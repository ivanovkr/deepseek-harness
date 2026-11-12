/** Typed copy for the read-only development board. */
export const en = {
  title: 'Development', heading: 'OpenSpec changes', refresh: 'Refresh', loading: 'Loading documents…', unavailable: 'Document resources are unavailable.', failed: 'Could not read OpenSpec files. Refresh to retry.',
  missing: 'No OpenSpec changes directory in this workspace.', empty: 'No active changes.', noDocuments: 'No documents', someDocuments: 'Some documents', allDocuments: 'All document types',
  disclaimer: 'Standard-layout file inventory, not OpenSpec CLI status. Custom schemas and configuration are not interpreted.',
  proposal: 'Proposal', specs: 'Specifications', design: 'Design', tasks: 'Tasks', absent: 'No file for this document type.', select: 'Select a change to inspect its documents.',
  taskHeading: 'Task checkboxes', taskDisclaimer: 'Checkboxes record task text only, not tests or approval.', noTasks: 'No task checkboxes in this document.', checked: 'Checked', unchecked: 'Unchecked', source: 'Document source',
  copy: 'Copy', copied: 'Copied', code: 'Code', wrap: 'Wrap lines', unwrap: 'Unwrap lines', footnotes: 'Footnotes',
}
/** Keys owned by the development namespace. */
export type DevelopmentKey = keyof typeof en
type Dictionary = Record<DevelopmentKey, string>
/** Russian product copy. */
export const ru: Dictionary = {
  title: 'Разработка', heading: 'Изменения OpenSpec', refresh: 'Обновить', loading: 'Загрузка документов…', unavailable: 'Ресурсы документов недоступны.', failed: 'Не удалось прочитать файлы OpenSpec. Обновите для повторной попытки.',
  missing: 'В рабочей области нет каталога изменений OpenSpec.', empty: 'Нет активных изменений.', noDocuments: 'Нет документов', someDocuments: 'Часть документов', allDocuments: 'Все типы документов',
  disclaimer: 'Обзор файлов стандартной структуры, а не статус CLI OpenSpec. Пользовательские схемы и конфигурация не интерпретируются.',
  proposal: 'Предложение', specs: 'Спецификации', design: 'Проектирование', tasks: 'Задачи', absent: 'Нет файла этого типа документа.', select: 'Выберите изменение для просмотра документов.',
  taskHeading: 'Отметки задач', taskDisclaimer: 'Отметки отражают только текст задач, а не результаты тестов или одобрение.', noTasks: 'В документе нет отметок задач.', checked: 'Отмечено', unchecked: 'Не отмечено', source: 'Исходный документ',
  copy: 'Копировать', copied: 'Скопировано', code: 'Код', wrap: 'Переносить строки', unwrap: 'Без переноса строк', footnotes: 'Сноски',
}
/** Chinese product copy. */
export const zh: Dictionary = {
  title: '开发', heading: 'OpenSpec 变更', refresh: '刷新', loading: '正在加载文档…', unavailable: '文档资源不可用。', failed: '无法读取 OpenSpec 文件。请刷新重试。',
  missing: '此工作区没有 OpenSpec 变更目录。', empty: '没有活动变更。', noDocuments: '暂无文档', someDocuments: '部分文档', allDocuments: '所有文档类型',
  disclaimer: '标准目录结构的文件清单，并非 OpenSpec CLI 状态。不解析自定义架构和配置。',
  proposal: '提案', specs: '规范', design: '设计', tasks: '任务', absent: '此文档类型没有文件。', select: '选择变更以查看文档。',
  taskHeading: '任务复选框', taskDisclaimer: '复选框仅记录任务文本，不代表测试结果或批准。', noTasks: '此文档没有任务复选框。', checked: '已勾选', unchecked: '未勾选', source: '文档原文',
  copy: '复制', copied: '已复制', code: '代码', wrap: '换行', unwrap: '不换行', footnotes: '脚注',
}
/** Japanese product copy. */
export const ja: Dictionary = {
  title: '開発', heading: 'OpenSpec の変更', refresh: '更新', loading: '文書を読み込み中…', unavailable: '文書リソースを利用できません。', failed: 'OpenSpec ファイルを読み込めません。更新して再試行してください。',
  missing: 'このワークスペースに OpenSpec の変更ディレクトリはありません。', empty: '有効な変更はありません。', noDocuments: '文書なし', someDocuments: '一部の文書', allDocuments: '全種類の文書',
  disclaimer: '標準構成のファイル一覧であり、OpenSpec CLI の状態ではありません。カスタムスキーマや設定は解釈しません。',
  proposal: '提案', specs: '仕様', design: '設計', tasks: 'タスク', absent: 'この種類の文書はありません。', select: '文書を確認する変更を選択してください。',
  taskHeading: 'タスクのチェック欄', taskDisclaimer: 'チェック欄はタスクの記録であり、テスト結果や承認ではありません。', noTasks: 'この文書にチェック欄はありません。', checked: 'チェック済み', unchecked: '未チェック', source: '文書の原文',
  copy: 'コピー', copied: 'コピー済み', code: 'コード', wrap: '折り返す', unwrap: '折り返さない', footnotes: '脚注',
}
/** Spanish product copy. */
export const es: Dictionary = {
  title: 'Desarrollo', heading: 'Cambios de OpenSpec', refresh: 'Actualizar', loading: 'Cargando documentos…', unavailable: 'Los recursos no están disponibles.', failed: 'No se pudieron leer los archivos. Actualice para reintentar.',
  missing: 'No hay directorio de cambios de OpenSpec en este espacio.', empty: 'No hay cambios activos.', noDocuments: 'Sin documentos', someDocuments: 'Algunos documentos', allDocuments: 'Todos los tipos',
  disclaimer: 'Inventario de archivos estándar, no estado del CLI de OpenSpec. No interpreta esquemas ni configuración personalizados.',
  proposal: 'Propuesta', specs: 'Especificaciones', design: 'Diseño', tasks: 'Tareas', absent: 'No hay archivo de este tipo.', select: 'Seleccione un cambio para ver sus documentos.',
  taskHeading: 'Casillas de tareas', taskDisclaimer: 'Las casillas solo registran tareas, no pruebas ni aprobación.', noTasks: 'No hay casillas en este documento.', checked: 'Marcada', unchecked: 'Sin marcar', source: 'Documento original',
  copy: 'Copiar', copied: 'Copiado', code: 'Código', wrap: 'Ajustar líneas', unwrap: 'No ajustar líneas', footnotes: 'Notas al pie',
}
/** French product copy. */
export const fr: Dictionary = {
  title: 'Développement', heading: 'Modifications OpenSpec', refresh: 'Actualiser', loading: 'Chargement des documents…', unavailable: 'Les ressources sont indisponibles.', failed: 'Lecture des fichiers impossible. Actualisez pour réessayer.',
  missing: 'Aucun répertoire de modifications OpenSpec dans cet espace.', empty: 'Aucune modification active.', noDocuments: 'Aucun document', someDocuments: 'Documents partiels', allDocuments: 'Tous les types',
  disclaimer: 'Inventaire des fichiers standard, pas un statut CLI OpenSpec. Les schémas et configurations personnalisés ne sont pas interprétés.',
  proposal: 'Proposition', specs: 'Spécifications', design: 'Conception', tasks: 'Tâches', absent: 'Aucun fichier de ce type.', select: 'Sélectionnez une modification pour lire ses documents.',
  taskHeading: 'Cases des tâches', taskDisclaimer: 'Les cases consignent les tâches, pas les tests ni une approbation.', noTasks: 'Aucune case dans ce document.', checked: 'Cochée', unchecked: 'Non cochée', source: 'Document source',
  copy: 'Copier', copied: 'Copié', code: 'Code', wrap: 'Retour à la ligne', unwrap: 'Sans retour à la ligne', footnotes: 'Notes de bas de page',
}
/** German product copy. */
export const de: Dictionary = {
  title: 'Entwicklung', heading: 'OpenSpec-Änderungen', refresh: 'Aktualisieren', loading: 'Dokumente werden geladen…', unavailable: 'Dokumentressourcen sind nicht verfügbar.', failed: 'Dateien konnten nicht gelesen werden. Zum Wiederholen aktualisieren.',
  missing: 'Kein OpenSpec-Änderungsverzeichnis in diesem Arbeitsbereich.', empty: 'Keine aktiven Änderungen.', noDocuments: 'Keine Dokumente', someDocuments: 'Einige Dokumente', allDocuments: 'Alle Dokumenttypen',
  disclaimer: 'Dateiübersicht im Standardformat, kein OpenSpec-CLI-Status. Eigene Schemas und Konfigurationen werden nicht ausgewertet.',
  proposal: 'Vorschlag', specs: 'Spezifikationen', design: 'Entwurf', tasks: 'Aufgaben', absent: 'Keine Datei dieses Dokumenttyps.', select: 'Änderung zur Dokumentansicht auswählen.',
  taskHeading: 'Aufgabenmarkierungen', taskDisclaimer: 'Markierungen erfassen nur Aufgabentext, keine Tests oder Freigaben.', noTasks: 'Keine Aufgabenmarkierungen in diesem Dokument.', checked: 'Markiert', unchecked: 'Nicht markiert', source: 'Quelldokument',
  copy: 'Kopieren', copied: 'Kopiert', code: 'Code', wrap: 'Zeilen umbrechen', unwrap: 'Kein Zeilenumbruch', footnotes: 'Fußnoten',
}
/** Portuguese product copy. */
export const pt: Dictionary = {
  title: 'Desenvolvimento', heading: 'Alterações do OpenSpec', refresh: 'Atualizar', loading: 'Carregando documentos…', unavailable: 'Os recursos estão indisponíveis.', failed: 'Não foi possível ler os arquivos. Atualize para tentar novamente.',
  missing: 'Não há diretório de alterações do OpenSpec neste espaço.', empty: 'Nenhuma alteração ativa.', noDocuments: 'Sem documentos', someDocuments: 'Alguns documentos', allDocuments: 'Todos os tipos',
  disclaimer: 'Inventário de arquivos padrão, não status do CLI OpenSpec. Esquemas e configurações personalizados não são interpretados.',
  proposal: 'Proposta', specs: 'Especificações', design: 'Design', tasks: 'Tarefas', absent: 'Nenhum arquivo deste tipo.', select: 'Selecione uma alteração para ver os documentos.',
  taskHeading: 'Caixas de tarefas', taskDisclaimer: 'As caixas registram apenas tarefas, não testes nem aprovação.', noTasks: 'Não há caixas neste documento.', checked: 'Marcada', unchecked: 'Desmarcada', source: 'Documento original',
  copy: 'Copiar', copied: 'Copiado', code: 'Código', wrap: 'Quebrar linhas', unwrap: 'Não quebrar linhas', footnotes: 'Notas de rodapé',
}
