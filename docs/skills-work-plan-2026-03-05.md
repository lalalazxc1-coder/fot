# План применения навыков из CATALOG для проекта FOT

Дата: 2026-03-05  
Источник: `docs/CATALOG.md` + текущее состояние проекта (`backend`, `frontend`, `docker-compose.yml`) + аудит `docs/hr-payroll-hub-full-audit-2026-03-04.md`.

## 1) Цель документа

Собрать в одном месте:
- приоритетный список навыков, которые реально полезны именно для этого проекта;
- где и зачем их применять;
- рабочий план на 2 недели, чтобы закрыть риски и улучшить качество кода.

## 2) Контекст проекта (кратко)

- Backend: FastAPI + SQLAlchemy + Pydantic + Alembic, PostgreSQL, Redis.
- Frontend: React + TypeScript + React Query + Tailwind.
- Инфраструктура: Docker Compose + Caddy.
- Ключевые зоны риска по аудиту: secrets, SSRF в интеграциях, границы доступа, auth lifecycle.

## 3) Приоритетный список навыков

### P0 - применять сразу (безопасность и стабильность)

1. `api-security-best-practices`  
   Зачем: закрыть риски по auth/authorization/input validation/rate limiting.

2. `api-security-testing`  
   Зачем: проверить, что защита реально работает, а не только "есть в коде".

3. `auth-implementation-patterns`  
   Зачем: усилить refresh-token lifecycle (rotation/reuse detection/session family).

4. `backend-security-coder`  
   Зачем: привести backend-обработку ошибок, секретов и интеграций к безопасному стандарту.

5. `fastapi-pro`  
   Зачем: привести API-слой к устойчивым FastAPI практикам (dependencies, async, error handling).

### P1 - высокий приоритет (качество платформы)

6. `python-fastapi-development`  
   Зачем: стандартизация backend-структуры, сервисного слоя, схем и зависимостей.

7. `fastapi-router-py`  
   Зачем: единый стиль роутеров и ответов во всех модулях `backend/routers`.

8. `postgres-best-practices`  
   Зачем: улучшить схему, индексы и запросы под реальную нагрузку.

9. `postgresql-optimization`  
   Зачем: улучшить latency и устойчивость БД, убрать узкие места.

10. `database-migrations-sql-migrations`  
    Зачем: безопасные миграции без простоя и с rollback-планом.

11. `testing-qa`  
    Зачем: системно покрыть backend/frontend и регрессы после security-правок.

12. `python-testing-patterns`  
    Зачем: усилить pytest-стратегию, фикстуры, негативные и security-кейсы.

13. `javascript-testing-patterns`  
    Зачем: улучшить frontend unit/integration тесты (Jest/RTL).

### P2 - средний приоритет (поддерживаемость и delivery)

14. `react-patterns`  
    Зачем: улучшить структуру компонентов и разделение ответственности.

15. `react-state-management`  
    Зачем: стандартизировать работу с серверным/локальным состоянием.

16. `typescript-pro`  
    Зачем: усилить типобезопасность, уменьшить runtime-баги на фронте.

17. `api-documenter`  
    Зачем: поддерживаемая документация API для команды и интеграций.

18. `openapi-spec-generation`  
    Зачем: единая OpenAPI-спецификация как контракт.

19. `docker-expert`  
    Зачем: оптимизация контейнеров, безопасность runtime, reproducible builds.

20. `deployment-pipeline-design`  
    Зачем: предсказуемый CI/CD, quality gates, безопасные релизы.

## 4) Где применять в текущем коде

- `backend/main.py`  
  Применить: security middleware hardening, CSP tightening, proxy/rate-limit review.

- `backend/routers/auth.py`  
  Применить: refresh token rotation/reuse detection, session family revocation, auth audit trails.

- `backend/routers/integrations/settings.py`  
  Применить: SSRF guard (allowlist + private CIDR block), sanitize error output, timeout/retry policy.

- `backend/routers/integrations/onec.py`  
  Применить: исправление импорта (убрать `created_at` из `Employee(...)`), контроль доступа к чувствительным полям.

- `backend/routers/integrations/hh.py`  
  Применить: унификация timeout/retry/circuit-breaker паттернов.

- `backend/database/models.py`  
  Применить: заменить mutable JSON defaults (`{}`/`[]`) на callable defaults (`dict`/`list`).

- `frontend/src/lib/api.ts`  
  Применить: единая стратегия обработки auth/session ошибок, унификация retry для API.

- `frontend/src/App.tsx`  
  Применить: выравнивание access boundary логики и route guards.

- `docker-compose.yml`  
  Применить: убрать опасные дефолты секретов, усилить production переменные окружения.

## 5) План работ на 2 недели

### Неделя 1 - закрытие P0

День 1:
- Убрать небезопасные fallback-значения секретов в `docker-compose.yml`.
- Ввести обязательные переменные `SECRET_KEY` и `SECRETS_ENCRYPTION_KEY`.

День 2:
- Добавить SSRF-защиту для интеграций (валидация URL + блок private/loopback/link-local).

День 3:
- Санитизировать ошибки интеграций (без `str(e)` клиенту).
- Унифицировать timeout/retry в исходящих HTTP вызовах.

День 4:
- Усилить auth lifecycle: refresh rotation + reuse detection + session family revoke.

День 5:
- Добавить/обновить security и integration тесты для изменений недели.
- Прогон `npm run validate`, фиксация регрессий.

### Неделя 2 - стабилизация и поддерживаемость

День 6:
- Нормализация backend роутеров и response моделей по FastAPI-паттернам.

День 7:
- Привести frontend state/data flow к единым паттернам React + TS.

День 8:
- Подготовить миграции по моделям/индексам и улучшить DB-производительность.

День 9:
- Сгенерировать и зафиксировать OpenAPI/документацию API.

День 10:
- Улучшить Docker/CI пайплайн и провести финальную проверку качества.

## 5.1) Журнал выполнения (обновляется по ходу работ)

### 2026-03-05 — этап День 1-4 (выполнено)

- День 1 (secrets):
  - В `docker-compose.yml` удалены небезопасные fallback-значения для `SECRET_KEY`.
  - Добавлена обязательная переменная `SECRETS_ENCRYPTION_KEY` для backend-сервиса.
  - В `backend/security.py` включен fail-fast в production при отсутствии `SECRET_KEY`.
  - В `backend/utils/secret_store.py` включен fail-fast в production при отсутствии `SECRETS_ENCRYPTION_KEY`.
  - В `backend/.env.example` добавлен `SECRETS_ENCRYPTION_KEY`.

- День 2 (SSRF):
  - Добавлен валидатор исходящих URL `backend/utils/security/url_guard.py`.
  - Реализованы проверки схемы, блокировка localhost/private/loopback/link-local/reserved диапазонов.
  - Добавлена поддержка allowlist через env (`INTEGRATION_URL_ALLOWLIST*`).
  - Подключена валидация Base URL в `backend/routers/integrations/settings.py` и `backend/routers/integrations/onec.py`.

- День 3 (sanitize errors + timeout/retry):
  - Убраны клиентские ответы с внутренними исключениями в интеграциях 1C.
  - Добавлен общий helper `backend/utils/outbound_http.py` для retry/backoff.
  - Унифицированы timeout/retry в `backend/routers/integrations/settings.py`, `backend/routers/integrations/hh.py`, `backend/routers/market.py`, `backend/services/onec_service.py`.

- День 4 (auth lifecycle hardening):
  - Реализована refresh token rotation с `sid` (session family) и `jti`.
  - Добавлен reuse detection: повторное использование refresh токена приводит к ревоку сессии.
  - Добавлен session family revoke при reuse и logout.
  - Для refresh-состояния добавлены Redis-хранилища и API в `backend/database/redis_client.py`.
  - Обновлен backend auth flow в `backend/routers/auth.py` и `backend/services/auth_service.py`.
  - На frontend добавлена защита от гонок refresh-запросов в `frontend/src/lib/api.ts` (single in-flight refresh).

### 2026-03-05 — этап День 5 (частично выполнено)

- Обновлены/добавлены security тесты:
  - `backend/tests/test_audit_hardening.py` (secrets в production, SSRF проверки, sanitize checks).
  - `backend/tests/test_auth.py` (refresh rotation, reuse detection, revoke on logout).
  - `backend/tests/test_market.py` адаптирован под новый retry helper.

- Локальные прогоны:
  - `python -m pytest backend/tests/test_auth.py -q` → `13 passed`.
  - `python -m pytest backend/tests/test_audit_hardening.py backend/tests/test_market.py backend/tests/test_admin.py -q` → `31 passed`.

### 2026-03-05 — этап День 5 (завершено)

- Добавлены/обновлены тесты auth lifecycle:
  - `backend/tests/test_auth.py`: проверка refresh rotation (`sid` сохраняется, `jti` ротируется),
    reuse detection и ревок сессии после logout.

- Финальные прогоны в рамках Day 5:
  - `python -m pytest backend/tests/test_auth.py backend/tests/test_csrf.py backend/tests/test_audit_hardening.py backend/tests/test_market.py -q` → `46 passed`.
  - `npm run validate` → frontend build OK, backend `111 passed`.

### 2026-03-05 — этап День 6 (выполнено)

- Нормализованы response-модели и типизация в auth/integrations/market зонах:
  - `backend/schemas.py`: добавлены `CurrentUserResponse`, `NotificationItemResponse`,
    `StatusResponse/LogoutResponse` и typed модели интеграций (`IntegrationSettings*`, `TestConnection*`, `Analyze*`).
  - `backend/routers/auth.py`: добавлены `response_model` для `/me`, `/refresh`, `/logout`,
    `/change-password`, `/notifications*`.
  - `backend/routers/integrations/onec.py`: строгие pydantic модели запроса/ответа для import.
  - `backend/routers/integrations/hh.py`: валидация query-параметров через `Query(...)`.
  - `backend/routers/market.py`: добавлена явная response-модель для списка/создания market data,
    с корректным формированием `points` в ответе create.

- Верификация после Day 6:
  - `python -m pytest backend/tests/test_audit_hardening.py backend/tests/test_market.py -q` → `29 passed`.
  - `python -m pytest backend/tests/test_auth.py backend/tests/test_csrf.py -q` → `17 passed`.
  - `npm run validate` → frontend build OK, backend `111 passed`.

### 2026-03-05 — этап День 7 (частично выполнено)

- Нормализован frontend data flow в аналитике через единый слой React Query:
  - `frontend/src/hooks/useAnalytics.ts`:
    - добавлены типизированные hooks `useRetentionRisk`, `useEsgMetrics`, `useTurnoverAnalytics`, `useAnalyticsEmployees`;
    - введены единые `analyticsQueryKeys` для предсказуемого кеширования и инвалидации;
    - унифицирована нормализация массивов API-ответов (`extractArrayData`) для summary/branch/top/cost.

- Убраны прямые API-вызовы из аналитических компонентов (перенос в hooks):
  - `frontend/src/components/analytics/RetentionDashboard.tsx`;
  - `frontend/src/components/analytics/ESGReport.tsx`;
  - `frontend/src/components/analytics/StaffingGapsView.tsx`;
  - `frontend/src/components/analytics/AnalyticsEmployeeListModal.tsx`.

- Верификация Day 7 (промежуточная):
  - `npm --prefix frontend run lint` → OK.
  - `npm --prefix frontend run build` → OK.
  - `npm --prefix frontend run test -- --runInBand src/pages/AnalyticsPage.test.tsx src/App.test.tsx` → `2 passed`.

- Унифицированы frontend access boundary проверки:
  - `frontend/src/types/index.ts`:
    - введены `PermissionKey`, `UserPermissions`, `hasPermission`, `hasAnyPermission`.
  - `frontend/src/App.tsx`:
    - route guards переведены на единый permission-helper API.
  - `frontend/src/components/DashboardLayout.tsx`:
    - навигационные/админ проверки прав переведены на единый permission-helper API.

### 2026-03-05 — этап День 7 (завершено)

- Day 7 завершен:
  - frontend state/data flow в аналитике нормализован через React Query hooks;
  - access boundary логика унифицирована для route guards и навигации;
  - типизация прав доступа централизована.

- Финальная верификация Day 7:
  - `npm run validate` → frontend build OK, backend `111 passed`.

### 2026-03-05 — этап День 8 (выполнено)

- Подготовлены улучшения DB-производительности и миграция индексов:
  - Создана миграция `backend/alembic/versions/5b59badb4550_add_db_performance_indexes.py`.
  - Добавлены целевые индексы под горячие запросы:
    - `salary_requests(status, id)`, `salary_requests(requester_id, id)`, `salary_requests(current_step_id)`;
    - `request_history(request_id, id)`, `request_history(actor_id, request_id)`;
    - `notifications(user_id, is_read, id)`;
    - `market_data(position_title, branch_id)`, `market_entries(market_id)`;
    - `login_logs(action, id)`, `audit_logs(target_entity, id)`;
    - `planning_lines(scenario_id, branch_id, department_id)`;
    - `employees(org_unit_id)`.

- Нормализованы defaults для JSON полей в ORM-моделях:
  - `backend/database/models.py`: заменены mutable defaults (`{}`/`[]`) на callable (`dict`/`list`) для `Role`, `User`, `FinancialRecord`, `IntegrationSettings`, `JobOffer`, `JobOfferTemplate`, `WelcomePageConfig`.

- Усилена тестовая проверка аналитических endpoints:
  - `backend/tests/test_analytics.py`: добавлены happy/auth кейсы для `/api/analytics/turnover` и `/api/analytics/employees`.

- Верификация после Day 8:
  - `python -m pytest backend/tests/test_analytics.py -q` → `7 passed`.
  - `python -m pytest backend/tests/test_admin.py backend/tests/test_auth.py backend/tests/test_market.py backend/tests/test_analytics.py -q` → `26 passed`.
  - `npm run validate` → frontend build OK, backend `114 passed`.

### 2026-03-05 — этап День 9 (выполнено)

- Сгенерирована и зафиксирована OpenAPI-спецификация API:
  - Обновлен файл `backend/openapi.json` из текущего FastAPI приложения (`main.app.openapi()`).
  - Спецификация отражает новые response-модели и auth/integration изменения из Day 4-8.

- Верификация Day 9:
  - `python -c "import json; from pathlib import Path; import main; Path('openapi.json').write_text(json.dumps(main.app.openapi(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')"` (в `backend`) → `openapi.json` обновлен.

### 2026-03-05 — этап День 10 (выполнено)

- Улучшен Docker/CI delivery-контур:
  - Добавлен CI workflow `.github/workflows/ci.yml` для `push` (main/master) и `pull_request`.
  - Настроены окружения `Node.js 22` и `Python 3.12` с кэшированием зависимостей (`npm`/`pip`).
  - Введен единый quality gate: запуск `npm run validate` (frontend build + backend pytest).

- Финальная верификация Day 10:
  - `npm run validate` → frontend build OK, backend `114 passed`.

### 2026-03-05 — двухнедельный план (закрыт)

- Day 1-10 выполнены.
- P0 риски из аудита закрыты реализацией и тестами.
- Подготовлены артефакты контракта и delivery: `backend/openapi.json`, `.github/workflows/ci.yml`.

## 6) Definition of Done (для этого плана)

- P0 риски из аудита закрыты или имеют документированный mitigation.
- Все критичные backend/frontend тесты зелёные (`npm run validate`).
- Нет утечек внутренних исключений во внешние API ответы.
- Для интеграций включены SSRF ограничения и таймауты.
- Auth flow поддерживает безопасный refresh lifecycle.
- Изменения задокументированы в API/технических notes.

Статус на 2026-03-05: критерии Definition of Done выполнены.

## 7) Практический порядок применения навыков

1. `api-security-best-practices`
2. `auth-implementation-patterns`
3. `backend-security-coder`
4. `api-security-testing`
5. `fastapi-pro`
6. `python-fastapi-development`
7. `database-migrations-sql-migrations`
8. `testing-qa`
9. `react-patterns`
10. `typescript-pro`
11. `api-documenter`
12. `docker-expert`

---

Этот файл используется как рабочий чеклист для ближайшего цикла стабилизации проекта.
