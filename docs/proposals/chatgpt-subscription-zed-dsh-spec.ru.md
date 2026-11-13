---
description: "Техническое задание на поддержку ChatGPT sign-in и Codex в DSH с разделением подписки, OAuth-маршрута моделей и нативной аутентификации Codex."
kind: "proposal"
---

# ТЗ: ChatGPT subscription и Codex в DSH

Русский

## Summary

DSH позволяет настраивать доступ к сервисам моделей и Codex через независимые механизмы авторизации и биллинга. Это предложение определяет требования к использованию ChatGPT subscription для маршрута `openai-codex`, нативной авторизации Codex app-server и отдельного OpenAI API key. Оно помогает не смешивать эти способы и не передавать учётные данные между независимыми runtime. Возможность зависит от подключённых компонентов и настроек профиля.

## Table of Contents

- [Цель и границы](#цель-и-границы)
- [Термины и сценарии](#термины-и-сценарии)
- [Исследованные подходы Zed и OpenAI](#исследованные-подходы-zed-и-openai)
- [Текущее основание в DSH](#текущее-основание-в-dsh)
- [Требования](#требования)
- [Безопасность и отказные сценарии](#безопасность-и-отказные-сценарии)
- [Этапы](#этапы)
- [Критерии приёмки](#критерии-приёмки)
- [Не входит в объём](#не-входит-в-объём)
- [Источники](#источники)

## Цель и границы

Цель — дать пользователю предсказуемый способ использовать доступ к Codex по ChatGPT-подписке в тех сценариях, которые поддерживают текущие библиотеки и аккаунт, не смешивая этот доступ с OpenAI API billing и не обходя действующие sandbox, approval и credential controls DSH.

Покрываются два самостоятельных продукта. Первый — использование моделей Codex через pi-ai provider `openai-codex`, авторизуемый ChatGPT account flow и существующий credential store. Второй — запуск Codex app-server как внешнего subagent; здесь Codex runtime сам использует свою нативную конфигурацию и authentication. Задача не предполагает автоматически переносить grant из DSH vault в Codex CLI или наоборот.

Стандартный pi-ai provider `openai`, авторизуемый API key и оплачиваемый по правилам OpenAI API, остаётся отдельным маршрутом. Выбор ChatGPT sign-in не должен менять этот маршрут, его ключи, endpoint или расчёты затрат. Возможность доступа по конкретному плану, лимиты, доступные модели и workspace policy определяет OpenAI и аккаунт пользователя, а не DSH.

## Термины и сценарии

| Сценарий | Runtime и credential owner | Billing / доступ | DSH ответственность |
|---|---|---|---|
| `openai-codex` через pi-ai | DSH authorization flow + DSH credential store; pi-ai выполняет provider OAuth/refresh | ChatGPT account subscription/workspace условия OpenAI | Показать вход, безопасно сохранить grant, активировать маршрут и диагностировать состояние без раскрытия grant |
| Codex subagent | Codex app-server и его native auth/config в выбранном `HOME`/`CODEX_HOME` | Выбранный внутри Codex способ auth: ChatGPT либо API key, если runtime/окружение это поддерживают | Запустить процесс в заданной среде, сохранить границы разрешений и явно описать, где пользователь настраивает Codex |
| `openai` через API | DSH credential ref/environment + pi-ai OpenAI API route | OpenAI API organization billing и политики | Настроить API key стандартным способом; не использовать ChatGPT account grant |

Поддержка ChatGPT authentication в ACP/CLI зависит от версии Codex, адаптера и среды. Документация Zed подтверждает ownership Codex, но не гарантирует, что конкретная версия DSH либо конкретный ACP host имеет тот же login UX. OpenAI CLI/IDE auth-storage сведения нельзя автоматически переносить на ACP.

## Исследованные подходы Zed и OpenAI

Zed описывает ChatGPT Subscription как отдельный LLM provider для встроенных AI-функций Zed: вход через ChatGPT, без требования OpenAI API key. Это не авторизация Codex External Agent или Terminal Thread. Для Codex как ACP External Agent Zed указывает, что authentication и billing принадлежат Codex; заданный для встроенного Zed Agent OpenAI API key не настраивает внешний процесс. Codex CLI в Terminal Thread также сохраняет собственные auth, настройки и ограничения. Zed рекомендует менять Codex sign-in его native login/logout способом.

OpenAI описывает ChatGPT sign-in для Codex CLI и IDE как браузерный flow, при котором браузер возвращает credentials Codex; для CLI/IDE документировано совместное использование локального credential cache и автоматическое обновление токенов во время использования. Эти сведения относятся к описанным CLI/IDE поверхностям. Для Zed ACP детали хранения, refresh и кросс-сессионного logout напрямую не подтверждены; их следует считать поведением Codex runtime только после проверки выбранной версии.

Для Codex OpenAI различает ChatGPT sign-in с правилами ChatGPT workspace и API-key sign-in с правилами OpenAI API organization. Эти режимы различаются billing и data-handling policy. Нельзя рекламировать ChatGPT подписку как API-кредит, выводить устойчивые лимиты/цены из документации, которая меняется, или считать, что членство в подписке гарантирует доступ к любой модели/возможности.

Ссылки: [Zed: Existing subscriptions](https://zed.dev/docs/ai/use-an-existing-subscription.md), [Zed: External Agents](https://zed.dev/docs/ai/external-agents.md), [Zed: Terminal Threads](https://zed.dev/docs/ai/terminal-threads.md), [Zed: LLM providers](https://zed.dev/docs/ai/llm-providers.md), [Zed: API access](https://zed.dev/docs/ai/use-api-access.md), [OpenAI: Codex authentication](https://learn.chatgpt.com/docs/auth.md), [ACP: Authentication](https://agentclientprotocol.com/protocol/v1/authentication.md).

## Текущее основание в DSH

В текущем `llm-pi-ai` различаются каталог `openai` для обычного OpenAI API и `openai-codex` для Codex/ChatGPT OAuth backend. Установленная версия pi-ai, зафиксированная в текущем workspace, содержит provider `openai-codex` и OAuth с refresh; это факт о vendored dependency tree, а не гарантия на все будущие версии. `llm-pi-ai` уже регистрирует authorization flow для поддерживаемых catalog login methods, а DSH credential seam может хранить opaque grant и сериализовать обновления через `modifyRecord`.

Ограничение pi-ai login, из-за которого DSH не предлагает ChatGPT OAuth для provider id `openai`, относится к этому API provider и необходимому ему stable installation UUID. Оно не доказывает, что OAuth отсутствует у отдельного `openai-codex` provider. В текущем интерфейсе Models имеется отдельный ChatGPT sign-in для ключа `llm-pi-ai/openai-codex` и отдельное действие включения Codex models; перед изменением нужно сверить эту реализацию, её тесты и включение её UI в целевые profile compositions.

Нативный `subagent-codex` запускает новый Codex app-server process, один ephemeral thread и один turn. Плагин не inject-ит DSH credential service и не импортирует grant в Codex. Он запускает процесс через subprocess seam с его разрешённым окружением; нативные Codex config/auth остаются в контексте `cwd`, `HOME` и `CODEX_HOME`. Общий subprocess launcher очищает из унаследованного окружения имена переменных с `KEY`, `PASSWORD`, `SECRET`, `TOKEN` и `DSH_`, но сохраняет базовую среду вроде `HOME`; явно сконфигурированная среда дочернего процесса накладывается поверх очистки. Поэтому наличие ChatGPT OAuth grant в DSH не означает входа в subagent Codex.

Подробные контракты: [pi-ai adapter](../../packages/llm/llm-pi-ai/README.md), [Models UI](../../packages/client/ui-settings-models/README.md), [Codex subagent](../../packages/subagent/subagent-codex/README.md), [credentials](../../packages/credentials/credentials/README.md), [authorization](../../packages/credentials/authorization/README.md), [local credential store](../../packages/credentials/credentials-local/README.md).

## Требования

### Поведение продукта

1. Сохранить три маршрута и объяснять их при настройке: `openai-codex` с ChatGPT sign-in; `openai` с OpenAI API key; Codex subagent с авторизацией, принадлежащей Codex runtime.

2. Для `openai-codex` показывать состояния: не настроен, не авторизован, авторизация выполняется, авторизован, ошибка/требуется повторный вход. Отдельно отображать активность маршрута и выбранную модель; вход сам по себе не должен молча менять модель текущего чата.

3. Вход и выход для маршрута моделей выполнять только через authorization API DSH и `llm-pi-ai/openai-codex`. Удаление grant из локального хранилища не называть отзывом токена у OpenAI, если фактический upstream revoke не реализован.

4. Не создавать передачу ChatGPT grant между DSH Models, Codex subagent, Codex CLI, Zed или иными процессами. Для subagent предоставить понятную инструкцию, как настроить native Codex auth в эффективном `HOME`/`CODEX_HOME`, не читая и не копируя auth-файлы.

5. Не добавлять credential type или режим `ChatGPT` к стандартному provider `openai`. Существующий API key и расходы OpenAI API остаются независимыми.

6. Сохранять существующую схему enablement `openai-codex` и пользовательский выбор моделей; изменение состава профиля не должно навязывать Codex тем профилям, которые его не включают.

### Совместимость ACP и subagent

7. При подключении авторизации через ACP проверять `authMethods` и использовать только объявленный агентом способ. `terminal` login поддерживать лишь при наличии клиентской способности `auth.terminal` и UX, безопасно отображающего нужное взаимодействие.

8. Logout вызывать только при объявленной агентом способности `auth.logout`. Отсутствие метода означает «DSH не может запросить logout через ACP», а не подтверждение сохранённой или отозванной авторизации.

9. Не утверждать, что logout завершает авторизацию уже активных сессий: ACP контракт этого не определяет. После logout новые сессии могут требовать повторной аутентификации; сессии, уже открытые агентом, должны сохранять поведение, определяемое самим агентом.

10. Поддерживаемые auth methods и поведение проверить на выбранных версиях Codex runtime/adapter. В частности, вести матрицу версии, метода ChatGPT/API key/device code, поведения refresh, хранения, logout и влияния logout на активный процесс; неизвестное помечать как не подтверждённое.

### Безопасность учётных данных и процессов

11. Хранить pi-ai grant только через DSH credential store; не записывать secret, authorization code, refresh token или полные upstream payload в логи, UI-диагностику, settings, session transcript, telemetry или completion.

12. Передавать секрет процессу только если это предусмотрено документированной нативной процедурой Codex и явной настройкой пользователя. Не извлекать auth из браузерных storage, системного хранилища или credential-файлов Codex.

13. При запуске Codex проверить фактические `cwd`, `HOME`, `CODEX_HOME`, унаследованные переменные после scrub и явно заданные пользователем переменные. Не расширять allowlist среды в обход общих subprocess controls.

14. Авторизация не должна изменять filesystem/network/command sandbox, approval prompts, MCP tools или доступ к секретам. Каждый runtime продолжает применять собственную policy.

15. Ошибки различать на отмену пользователем, сеть/timeout, недоступность метода, отказ авторизации, истёкшую/отозванную учётную запись и ошибку конфигурации, если библиотека позволяет определить категорию. Не показывать сырой ответ поставщика.

### Документация и поддержка

16. Указывать, что доступ, тариф, лимиты, модели и workspace policy определяет OpenAI и конкретная подписка; не фиксировать быстро меняющиеся цены и квоты.

17. В описании Models пояснить, что ChatGPT sign-in обслуживает маршрут `openai-codex`, а API key нужен маршруту `openai`; включение маршрута — отдельный шаг, и Models sign-in не настраивает Codex subagent.

18. Профильные README должны точно отражать наличие компонента и маршрута; не заявлять глобальную поддержку функции на основании существования кода в необязательном пакете.

## Безопасность и отказные сценарии

Если OAuth отменён или завершился ошибкой, оставить прежние настройки и grant без повреждения, показать безопасное диагностическое сообщение и разрешить повторить операцию. Повторный login не должен создавать параллельные несогласованные записи; обновление токена сериализуется credential store.

Если локальный grant удалён, следующий запрос должен перейти в понятное состояние повторной авторизации. Это локальное удаление не доказывает upstream revoke и не завершает автоматически процессы Codex. Переключение API route и subscription route не должно переносить данные или цену вызовов между ними.

Если ACP агент не объявляет подходящий auth method или logout capability, UI не должен имитировать поддержку. Если Codex runtime меняет формат или location auth, DSH не должен самостоятельно разбирать его внутренние файлы; восстановление выполняется средствами самого Codex.

## Этапы

1. **Документация и профильная инвентаризация.** Зафиксировать, какие bundle/profile подключают Models sign-in и `openai-codex`; исправить формулировки, которые смешивают `openai` и `openai-codex`.
2. **Стабилизация текущего Models маршрута.** Проверить OAuth start/answer/cancel/status, refresh, sign-out, включение маршрута, выбор модели и безопасные диагностические ошибки тестами реальной композиции профиля.
3. **Изоляция native Codex auth.** Проверить запуск процесса и scrubbed environment, документировать эффективные `HOME`/`CODEX_HOME` и предоставить инструкции native login без обмена DSH grant.
4. **ACP auth UX — только при пользовательской потребности.** Инвентаризировать реальные auth methods установленного adapter. Реализовывать terminal login/logout только если конкретный runtime рекламирует capability и можно безопасно отобразить interaction; иначе явно ограничить поддержку.
5. **Поддержка версий.** Добавить совместимые тестовые матрицы для обновлений pi-ai и Codex adapter/runtime; при изменении протокола auth фиксировать проверенные факты до изменения пользовательских обещаний.

## Критерии приёмки

- Пользователь может отличить ChatGPT subscription для `openai-codex` от API key и OpenAI API billing для `openai`.
- Вход/выход через Models применяется только к DSH grant соответствующего provider; опционально подключённый Codex subagent не получает этот grant.
- В профиле без соответствующего Models/UI/provider нет обещания, что ChatGPT sign-in доступен.
- Нативный subagent запускается с ожидаемыми `cwd`, `HOME`, `CODEX_HOME`; scrub проверен вместе с явно заданной средой, не допускающей непредусмотренную утечку секретов.
- OAuth секреты, коды и полный upstream response не появляются в UI, application logs, persisted settings, Session transcript или completion notices.
- ChatGPT sign-in не меняет sandbox и approval policy.
- Вход и выход ACP доступны только по возможностям конкретного агента; интерфейс и тесты не утверждают неподтверждённое влияние выхода на активные сессии.
- Документация не фиксирует текущие цены/лимиты и не гарантирует поддержку любого плана или ACP runtime.

## Не входит в объём

- Подмена ChatGPT OAuth самодельным API, копирование токенов из браузера или извлечение их из Codex auth-файлов.
- Единый credential broker, который автоматически делится ChatGPT credentials между DSH pi-ai, Codex CLI/app-server, Zed и другими приложениями.
- Гарантированный доступ по любому ChatGPT плану, статические квоты, цены или обещание эквивалентности Codex Cloud.
- Переработка OpenAI API provider `openai` в subscription route.
- Изменение sandbox, approval, сетевых, файловых или командных полномочий в связи с типом аккаунта.

## Источники

- [Zed: Use an existing subscription](https://zed.dev/docs/ai/use-an-existing-subscription.md) — ChatGPT provider и отличие от API access.
- [Zed: External Agents](https://zed.dev/docs/ai/external-agents.md#codex-cli) — владение auth/billing Codex и внешняя интеграция.
- [Zed: Terminal Threads](https://zed.dev/docs/ai/terminal-threads.md) — владение auth/config нативным CLI.
- [Zed: LLM providers](https://zed.dev/docs/ai/llm-providers.md) и [API access](https://zed.dev/docs/ai/use-api-access.md) — разделение subscription и API billing.
- [OpenAI: Authentication](https://learn.chatgpt.com/docs/auth.md) — способы входа Codex и различия ChatGPT/API.
- [ACP: Authentication](https://agentclientprotocol.com/protocol/v1/authentication.md) — negotiation, terminal login и optional logout capability.
- DSH: [Models UI](../../packages/client/ui-settings-models/README.md), [pi-ai adapter](../../packages/llm/llm-pi-ai/README.md), [Codex subagent](../../packages/subagent/subagent-codex/README.md), [credential service](../../packages/credentials/credentials/README.md), [authorization service](../../packages/credentials/authorization/README.md), [local credential store](../../packages/credentials/credentials-local/README.md).

## Dev Note

Эта спецификация описывает направление изменений и не является обещанием поддержки ChatGPT sign-in для каждого профиля или Codex runtime.
