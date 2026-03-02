# Глубокий аудит проекта (Backend + Frontend + Infra)

Дата первичного аудита: 2026-03-01
Обновление статуса: 2026-03-02

## Что проверено

- Статический аудит backend (auth, RBAC, workflow, scenarios, salary-config, analytics, integrations).
- Статический аудит frontend (auth flow, API client, admin pages, публичные офферы).
- Инфраструктура (Docker, Caddy, Nginx, env-конфиги, CORS, proxy).
- Миграции Alembic (цепочка ревизий, консистентность).
- Валидация качества через запуск:
  - `backend`: `pytest` -> **75 passed**
  - `frontend`: `npm run build` -> **успешно** (есть warning про deprecated CJS API Vite)

## Краткий вывод

Проект в рабочем состоянии (тесты и сборка проходят).

На 2026-03-02 закрыты все задачи P0 и часть задач P1/P2: исправлены критичные пробелы RBAC, закрыт публичный read-доступ к salary config, устранено доверие к `X-Forwarded-For` без trust boundary, переведена retention-логика на `last_raise_date`, убран per-item `commit()` в `_notify`, добавлены enum/allowlist ограничения.

## Найденные проблемы

### CRITICAL

1. **Отсутствие проверки прав на изменение сценариев ФОТ**
   - Риск: любой аутентифицированный пользователь может менять/коммитить сценарии.
   - Затронуто: `backend/routers/scenarios.py` (create/delete/apply-change/commit).

2. **Публичный доступ к чтению salary config и его истории**
   - Риск: утечка чувствительных финансовых параметров и истории изменений.
   - Затронуто: `backend/routers/salary_config.py` (`GET /`, `GET /history` без `require_admin`).

### HIGH

1. **Доверие к `X-Forwarded-For` без жесткого trust boundary**
   - Риск: обход/манипуляция rate-limit по IP.
   - Затронуто: `backend/main.py`, запуск uvicorn с `--forwarded-allow-ips '*'`.

2. **Непоследовательное хранение/фильтрация дат (string formats)**
   - Риск: неверные time-travel/аналитические отчеты, неконсистентные фильтры.
   - Затронуто: `requests`, `analytics`, модели с полями даты-строки.

3. **`last_raise_date` добавлен, но не используется как основной источник в retention-логике**
   - Риск: искажение оценки стагнации по сотрудникам.
   - Затронуто: `backend/routers/analytics.py`, `backend/services/employee_service.py`.

### MEDIUM

1. **`_notify()` делает `commit()` на каждое уведомление**
   - Риск: деградация производительности, потеря атомарности операции.
   - Затронуто: `backend/routers/requests.py`.

2. **Свободная строка статуса заявки без enum-ограничений**
   - Риск: невалидные состояния в workflow.
   - Затронуто: `backend/schemas.py`, `backend/routers/requests.py`.

3. **`mass_update_scenario` не ограничивает список доступных полей для изменения**
   - Риск: неконтролируемые 500/ошибки бизнес-логики.
   - Затронуто: `backend/routers/scenarios.py`.

4. **Секреты интеграций хранятся в БД без шифрования на уровне приложения**
   - Риск: компрометация ключей при утечке БД.
   - Затронуто: `backend/database/models.py`, `backend/routers/integrations/settings.py`.

### LOW / Tech Debt

1. Пустые/шумные ревизии в Alembic, несогласованность метаданных ревизий.
2. Отсутствуют frontend unit/integration тесты.
3. Несоответствие правил пароля frontend/backend.
4. Потенциально хрупкие динамические Tailwind-классы в логах.

## Сильные стороны

- Cookie-based auth + CSRF защита реализованы.
- Добавлены security headers.
- Redis blacklist токенов сделан в fail-closed режиме.
- Базовое тестовое покрытие backend хорошее (64 passing).
- Frontend production build стабильно проходит.

---

## TODO List (приоритетный план)

### P0 (срочно, блокеры релиза)

- [x] Закрыть все write-endpoints `scenarios` проверкой прав (`admin_access`/`manage_planning`/`view_scenarios` по политике).
- [x] Добавить `require_admin` (или эквивалент) на `GET /api/salary-config/` и `GET /api/salary-config/history`.
- [x] Добавить backend тесты на отрицательные кейсы RBAC для `scenarios` и `salary-config`.

### P1 (безопасность и корректность данных)

- [x] Ограничить доверенные прокси для `X-Forwarded-For` (убрать `'*'`, задать whitelist).
- [ ] Перевести ключевые date/time поля с `str` на `DateTime` (+ миграции + безопасная обратная совместимость).
- [x] Переключить retention-логику на `last_raise_date`, а не `created_at`.
- [ ] Нормализовать формат дат в API (ISO 8601 везде).

### P2 (надежность и производительность)

- [x] Переделать `_notify` на batched insert + единый `commit` в рамках операции.
- [x] Ввести enum/валидацию для `SalaryRequestUpdate.status`.
- [x] Добавить allowlist полей в `mass_update_scenario`.
- [ ] Добавить индексы под тяжелые аналитические запросы (после `EXPLAIN`).

### P3 (качество и техдолг)

- [ ] Почистить Alembic-историю: удалить/пометить пустые ревизии, выровнять `down_revision`/docstring.
- [ ] Добавить frontend smoke/integration тесты для auth/critical flows.
- [ ] Синхронизировать политику паролей frontend и backend.
- [ ] Проверить динамические Tailwind-классы и зафиксировать safelist при необходимости.

## Критерии приемки (Definition of Done)

- [x] Все P0 задачи закрыты.
- [x] Добавлены автотесты на новые ограничения доступа.
- [x] `pytest` зеленый, `npm run build` зеленый.
- [x] Нет незащищенных write-endpoints для финансовых сущностей.
- [ ] Документированы изменения в `CHANGELOG`/релиз-нотах.
