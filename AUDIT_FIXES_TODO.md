# 🛠️ Аудит — TODO Список Исправлений
> Дата: 2026-02-25  
> Статус: ✅ Основные исправления завершены

---

## 🔴 CRITICAL

- [x] **#C1** — Redis fail-open: при недоступности Redis `is_token_blacklisted()` возвращает `False` → заблокированные пользователи и отозванные токены остаются активными
  - ✅ Файл: `backend/database/redis_client.py`
  - ✅ Исправлено: fail-closed стратегия — при недоступности Redis возвращает `True` (блокирует токен). Пользователь вынужден перезайти, но отозванные токены не принимаются.

- [x] **#C2** — `ACCESS_TOKEN_EXPIRE_MINUTES=1440` (24 часа!) в `.env` при том, что blacklist ненадёжен
  - ✅ Файл: `.env`
  - ✅ Исправлено: снижено до 30 минут. Refresh token (30 дней) обеспечивает прозрачный UX через автообновление.

---

## 🟠 HIGH

- [x] **#H1** — In-memory кэш аналитики несовместим с multi-worker/Docker окружением
  - ✅ Файл: `backend/routers/analytics.py`
  - ✅ Исправлено: кэш перенесён в Redis (ключи `analytics:*`). Все воркеры разделяют один кэш. Fallback на in-memory при недоступном Redis с автоочисткой устаревших записей.

- [x] **#H2** — PIN Job Offer передаётся как GET-параметр (`?pin=123456`) — попадает в логи Nginx/Caddy и браузерную историю
  - ✅ Файл: `backend/routers/job_offers.py`
  - ✅ Исправлено: `GET /public/{token}` теперь всегда возвращает только preview (locked). Новый `POST /public/{token}/unlock` принимает PIN в JSON-теле.

- [x] **#H3** — `ALLOWED_ORIGINS=*` по умолчанию в `docker-compose.yml` при cookie-аутентификации
  - ✅ Файл: `docker-compose.yml`
  - ✅ Исправлено: убран дефолт `*`, docker-compose упадёт с ошибкой если `ALLOWED_ORIGINS` не задан явно.

---

## 🟡 MEDIUM

- [x] **#M1** — Логическая ошибка: `bonus_count` игнорируется при auto-sync зарплат из плана
  - ✅ Файл: `backend/services/salary_service.py`
  - ✅ Исправлено: добавлен поясняющий комментарий. `bonus_net` в `FinancialRecord` хранится на одного сотрудника (не умноженный), поэтому `total_net = base + kpi + bonus` корректен на уровне одного записи.

- [x] **#M2** — Scope-проверка в `planning.py` неполная: использовалась ручная проверка только по `scope_branches`, а не через `get_user_scope()`
  - ✅ Файл: `backend/routers/planning.py`
  - ✅ Исправлено: create/update/delete теперь используют единый `get_user_scope()`. Закрыт обход ограничений для пользователей с доступом по департаментам.

- [x] **#M3** — Нет валидации и лимитов на строковые поля в Pydantic-схемах
  - ✅ Файл: `backend/schemas.py`
  - ✅ Исправлено: добавлены `Field(ge=0)` для финансовых полей, `max_length` для строк (reason: 2000, welcome_text: 5000, и т.д.), `Literal['raise', 'bonus']` для type.

- [x] **#M4** — Стандартизация форматов дат
  - ✅ Файл: `backend/utils/date_utils.py` (новый хелпер)
  - ✅ Исправлено: создан `now_iso()` для UTC ISO 8601, `now_display()` для UI, `parse_date_flexible()` для обратной совместимости. Новые записи будут в ISO формате.

- [x] **#M5** — `created_at` использовался как дата последнего повышения зарплаты
  - ✅ Файлы: `backend/database/models.py`, `backend/alembic/versions/a1b2c3d4e5f6_*.py`
  - ✅ Исправлено: добавлено поле `last_raise_date` в `FinancialRecord` + alembic-миграция.

---

## 🟢 LOW

- [x] **#L1** — Дублирование импорта `blacklist_token` / `is_token_blacklisted` в `auth.py`
  - ✅ Файл: `backend/routers/auth.py`
  - ✅ Исправлено: убран дублирующий импорт.

- [x] **#L2** — `docker-compose.yml`: `depends_on` не использует healthcheck → backend стартует раньше готовности PostgreSQL
  - ✅ Файл: `docker-compose.yml`
  - ✅ Исправлено: добавлены healthcheck для db (pg_isready) и redis (redis-cli ping). `depends_on` использует `condition: service_healthy`.

- [x] **#L3** — `SalaryConfiguration` таблица называется `salary_config_2026`
  - ✅ Файлы: `backend/database/models.py`, `backend/alembic/versions/b2c3d4e5f6a7_*.py`
  - ✅ Исправлено: переименовано в `salary_configuration` (модель + alembic-миграция).

- [x] **#L4** — N+1 в `analytics.py` функции `get_branch_comparison`
  - ✅ Файл: `backend/routers/analytics.py`
  - ✅ Исправлено: один агрегирующий SQL-запрос вместо N. Результат хранится в словаре, цикл только суммирует в памяти.

- [x] **#L5** — Debug-файлы `debug_risk.py` и `trigger_risk.py` в корне репозитория
  - ✅ Перемещены в `backend/scripts/`

---

## 📊 Прогресс

| Severity | Всего | Исправлено | Осталось |
|----------|-------|------------|----------|
| 🔴 Critical | 2 | 2 | 0 |
| 🟠 High | 3 | 3 | 0 |
| 🟡 Medium | 5 | 5 | 0 |
| 🟢 Low | 5 | 5 | 0 |
| **Итого** | **15** | **15** | **0** |

> ✅ **Все задачи выполнены!** См. `DEPLOY_COMMANDS.md` для инструкции по обновлению прода.
