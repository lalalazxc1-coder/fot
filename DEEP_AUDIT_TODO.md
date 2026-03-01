# TODO по результатам deep audit

Дата: 2026-02-28

## P0 / High

- [x] Санитизировать ошибку экспорта planning
  - Файл: `backend/routers/planning.py:393`
  - Что сделать: убрать `str(e)` из API-ответа, оставить общий текст; детали только в логах.
  - Критерий готовности: endpoint возвращает безопасный `detail`, traceback отсутствует в клиентском ответе.

- [x] Санитизировать ошибки HH sync в market
  - Файл: `backend/routers/market.py:185`
  - Что сделать: не отдавать `resp.text`; добавить маппинг статусов (429/5xx/прочие) на безопасные сообщения.
  - Критерий готовности: внешний body/диагностика не попадают в API-ответ.

- [x] Выровнять RBAC для read-endpoints positions/scenarios
  - Файлы: `backend/routers/positions.py`, `backend/routers/scenarios.py`
  - Что сделать: добавить явные permission checks для чтения (`view_positions`, `view_scenarios` или agreed policy).
  - Критерий готовности: пользователи без прав получают 403; регрессий для admin нет.

## P1 / Medium

- [x] Добавить CSRF-защиту для cookie-auth
  - Файлы: `backend/routers/auth.py`, mutating routers, `frontend/src/lib/api.ts`
  - Что сделать: реализовать CSRF token (double-submit/synchronizer), обязательная проверка на state-changing запросах.
  - Критерий готовности: mutating endpoints отклоняют запрос без валидного CSRF токена.

- [x] Удалить/архивировать дублирующий salary router
  - Файлы: `backend/routers/salary.py`, `backend/routers/salary_config.py`
  - Что сделать: оставить один источник истины, убрать дублирование логики.
  - Критерий готовности: в кодовой базе один активный модуль salary-config.

- [x] Скрыть stack trace в production ErrorBoundary
  - Файл: `frontend/src/main.tsx`
  - Что сделать: показывать stack/details только в dev (`import.meta.env.DEV`).
  - Критерий готовности: в production UI отображается только безопасное сообщение об ошибке.

- [x] Убрать SAWarning по циклическим FK в тестах
  - Файлы: `backend/database/models.py`, `backend/tests/conftest.py`
  - Что сделать: применить `use_alter=True`/корректную стратегию очистки схемы в тестах.
  - Критерий готовности: `pytest` без текущего SAWarning о drop order.

## P2 / Tech debt

- [x] Снизить количество `any` на фронтенде
  - Файлы: в первую очередь `frontend/src/components/` и `frontend/src/pages/RequestsPage.tsx`
  - Что сделать: поэтапная типизация (requests -> payroll -> market).
  - Критерий готовности: уменьшить количество `any` минимум на 50% в следующем цикле.
  - Прогресс: типизированы analytics/admin/market/salary UI-модули, `any` убран из рабочих TS/TSX файлов (остались только упоминания в комментариях/тексте).

- [x] Убрать broad `except Exception` с `pass`
  - Файлы: `backend/routers/salary_config.py`, смежные модули
  - Что сделать: сузить типы исключений и добавить структурированное логирование.
  - Критерий готовности: нет silent-fail блоков в критических путях.
  - Прогресс: `except ...: pass` для broad/silent путей убран; добавлено логирование в auth/logout и безопасная обработка ошибок login.

- [x] Актуализировать security headers
  - Файл: `backend/main.py`
  - Что сделать: убрать legacy `X-XSS-Protection`, подготовить CSP-политику.
  - Критерий готовности: заголовки соответствуют современным практикам.
