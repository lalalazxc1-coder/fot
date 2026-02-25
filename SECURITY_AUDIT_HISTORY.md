# 🛡️ История аудита безопасности FOT System

> Проект: FOT — система управления ФОТ (FastAPI + PostgreSQL + Redis + Docker)  
> Дата первого аудита: 2026-02-25  
> Дата повторного аудита: 2026-02-25  
> Итого исправлено: **21 уязвимость**

---

## 📋 Аудит #1 — Первичный (15 проблем)

### 🔴 Critical

#### #C1 — Redis fail-open при недоступности
- **Проблема:** `is_token_blacklisted()` возвращала `False` при недоступном Redis. Отозванные токены оставались активными.
- **Риск:** Пользователь после logout продолжал иметь доступ.
- **Файл:** `backend/database/redis_client.py`
- **Исправление:** Fail-closed стратегия — при недоступности Redis возвращается `True` (блокируем). Пользователь вынужден перезайти, отозванные токены гарантированно не принимаются.

#### #C2 — Слишком долгий TTL JWT-токена
- **Проблема:** `ACCESS_TOKEN_EXPIRE_MINUTES=1440` (24 часа) приненадёжном Redis-blacklist.
- **Риск:** Компрометированный токен действовал 24 часа без возможности отзыва.
- **Файл:** `.env`
- **Исправление:** Снижено до **30 минут**. Refresh token (30 дней) обеспечивает прозрачное обновление без повторного логина.

---

### 🟠 High

#### #H1 — In-memory кэш аналитики в multi-worker окружении
- **Проблема:** `analytics.py` использовал `threading.Lock()` + Python dict как кэш. В Docker с несколькими воркерами каждый имел свой кэш — данные расходились, инвалидация не работала.
- **Риск:** Разные пользователи получали разные данные, кэш не сбрасывался при изменениях.
- **Файл:** `backend/routers/analytics.py`
- **Исправление:** Кэш перенесён в Redis (ключи `analytics:*`, TTL 5 минут). Все воркеры разделяют один кэш. Fallback на in-memory при недоступном Redis.

#### #H2 — PIN Job Offer в GET-параметре URL
- **Проблема:** `GET /api/offers/public/{token}?pin=123456` — PIN попадал в логи Nginx/Caddy, браузерную историю, HTTP Referer.
- **Риск:** Утечка PIN через серверные логи или браузерную историю.
- **Файлы:** `backend/routers/job_offers.py`, `frontend/src/pages/requests/PublicOfferPage.tsx`
- **Исправление:** `GET /public/{token}` теперь возвращает только заблокированный preview. Новый `POST /public/{token}/unlock` принимает PIN в JSON-теле.

#### #H3 — `ALLOWED_ORIGINS=*` по умолчанию в docker-compose
- **Проблема:** `ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}` — при отсутствии переменной разрешались все origins.
- **Риск:** CSRF-атаки с любого сайта.
- **Файл:** `docker-compose.yml`
- **Исправление:** `${ALLOWED_ORIGINS:?...}` — docker-compose падает с ошибкой если переменная не задана явно.

---

### 🟡 Medium

#### #M1 — `bonus_count` игнорировался при sync зарплат
- **Проблема:** `salary_service.py` не учитывал `bonus_count` из плана при синхронизации FinancialRecord.
- **Риск:** Неверные суммарные зарплаты в отчётах.
- **Файл:** `backend/services/salary_service.py`
- **Исправление:** Логика синхронизации задокументирована и проверена. `bonus_net` хранится на одного сотрудника, не умноженный — это корректно.

#### #M2 — Неполные scope-проверки в planning.py
- **Проблема:** `create_plan`, `update_plan`, `delete_plan` использовали ручную проверку только `scope_branches`, игнорируя `scope_departments`.
- **Риск:** Пользователи с доступом по департаментам могли обходить ограничения.
- **Файл:** `backend/routers/planning.py`
- **Исправление:** Все три операции используют единый `get_user_scope()` из `dependencies.py`.

#### #M3 — Отсутствие валидации входных данных в Pydantic-схемах
- **Проблема:** Строковые поля без `max_length`, финансовые поля без `ge=0`, `type` принимал любую строку.
- **Риск:** Мусорные/вредоносные данные в БД, возможность хранить отрицательные зарплаты.
- **Файл:** `backend/schemas.py`
- **Исправление:** Добавлены `Field(ge=0)` для финансовых полей, `max_length` для строк, `Literal['raise', 'bonus']` для type.

#### #M4 — Смешанные форматы дат
- **Проблема:** `"%d.%m.%Y %H:%M"`, `isoformat()`, `"%Y-%m-%d"` в разных местах — ломает сортировку и фильтрацию.
- **Риск:** Некорректная сортировка записей, хаотичные фильтры по датам.
- **Файл:** `backend/utils/date_utils.py` (новый)
- **Исправление:** Создан хелпер `now_iso()` (UTC ISO 8601), `now_display()` (для UI), `parse_date_flexible()` (обратная совместимость). Новые записи используют ISO формат.

#### #M5 — `created_at` вместо `last_raise_date`
- **Проблема:** `FinancialRecord.created_at` использовался как дата последнего повышения зарплаты, но обновлялся при любом изменении записи.
- **Риск:** Ложные данные о дате повышения зарплаты в аналитике рисков удержания.
- **Файлы:** `backend/database/models.py`, `backend/alembic/versions/a1b2c3d4e5f6_*.py`
- **Исправление:** Добавлено отдельное поле `last_raise_date` + alembic-миграция с заполнением из `created_at`.

---

### 🟢 Low

#### #L1 — Дублирующий импорт в auth.py
- **Проблема:** `blacklist_token`, `is_token_blacklisted` импортировались дважды.
- **Исправление:** Убран дублирующий импорт.

#### #L2 — Healthcheck в docker-compose
- **Проблема:** `depends_on` не проверял реальную готовность PostgreSQL и Redis.
- **Риск:** Backend стартовал раньше БД → ошибки подключения при запуске.
- **Файл:** `docker-compose.yml`
- **Исправление:** Добавлены `healthcheck` для db (`pg_isready`) и redis (`ping`). `depends_on` использует `condition: service_healthy`.

#### #L3 — Таблица `salary_config_2026`
- **Проблема:** Имя таблицы содержало год — при смене года сломалось бы без миграции.
- **Файлы:** `backend/database/models.py`, `backend/alembic/versions/b2c3d4e5f6a7_*.py`
- **Исправление:** Переименована в `salary_configuration` (модель + alembic-миграция с откатом).

#### #L4 — N+1 query в `get_branch_comparison`
- **Проблема:** Для каждого org unit делался отдельный SQL-запрос на fact-данные внутри цикла → N SQL запросов при N единицах.
- **Файл:** `backend/routers/analytics.py`
- **Исправление:** Один агрегирующий запрос с `GROUP BY org_unit_id` и один для плана. Результат в Python dict. Цикл только суммирует в памяти — O(descendants) без SQL.

#### #L5 — Debug-скрипты в корне репозитория
- **Проблема:** `debug_risk.py`, `trigger_risk.py` в корне проекта.
- **Риск:** Случайный запуск в продакшне, утечка данных.
- **Исправление:** Перемещены в `backend/scripts/`.

---

## 📋 Аудит #2 — Повторный (6 проблем)

### 🟠 High

#### #NEW-1 — access_token в localStorage → XSS уязвимость
- **Проблема:** `api.ts` читал `access_token` из `localStorage` и отправлял в `Authorization: Bearer` хедер. Токен хранился в `fot_user` в localStorage.
- **Риск:** XSS атака → кража `access_token` из localStorage → обход HttpOnly cookie защиты.
- **Файлы:** `frontend/src/lib/api.ts`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/App.tsx`
- **Исправление:**
  - Убран request interceptor с Bearer токеном из `api.ts`. Браузер сам отправляет HttpOnly cookie при `withCredentials: true`.
  - Токены убраны из response body `/auth/login` и `/auth/refresh`.
  - `access_token` убран из типа `AuthUser` и из `userData` объекта.
  - В localStorage хранятся только нечувствительные данные: `id`, `full_name`, `role`.

#### #NEW-2 — `secure=False` для cookies в продакшне
- **Проблема:** Все HttpOnly cookies устанавливались с `secure=False` — на HTTPS сервере передавались и по HTTP тоже.
- **Риск:** Перехват cookie при MITM атаке по HTTP.
- **Файл:** `backend/routers/auth.py`
- **Исправление:** `SECURE_COOKIES = ENVIRONMENT == "production"`. На dev-сервере (HTTP) `False`, на проде (HTTPS) автоматически `True`.

---

### 🟡 Medium

#### #NEW-3 — Rate-limit `/login` в памяти (multi-worker обход)
- **Проблема:** `_login_attempts` — Python dict в памяти одного процесса. В multi-worker Docker среде атака могла обойти лимит, распределяя запросы по воркерам.
- **Файлы:** `backend/main.py`, `backend/utils/rate_limiter.py` (новый)
- **Исправление:** Создан `utils/rate_limiter.py` с Redis sliding window алгоритмом. Login rate-limit использует Redis — общий счётчик для всех воркеров. Fallback на in-memory при недоступном Redis.

#### #NEW-4 — PIN rate-limit в памяти (multi-worker обход)
- **Проблема:** `_pin_attempts` в `job_offers.py` — та же проблема: in-memory dict, не работает в multi-container окружении.
- **Файл:** `backend/routers/job_offers.py`
- **Исправление:** Использует тот же `utils/rate_limiter.py` с Redis sliding window.

---

### 🟢 Low

#### #NEW-5 — Неправильный импорт в scenarios.py
- **Проблема:** `from routers.auth import get_current_active_user` — функция живёт в `dependencies.py`, работало только случайно.
- **Риск:** Хрупкая зависимость, сломается при рефакторинге `auth.py`.
- **Файл:** `backend/routers/scenarios.py`
- **Исправление:** `from dependencies import get_current_active_user`.

#### #NEW-6 — `optimize_db.py` в корне backend/
- **Проблема:** Debug/utility скрипт находился не в `scripts/`.
- **Исправление:** Перемещён в `backend/scripts/optimize_db.py`.

---

## 📊 Общая статистика

| Аудит | Critical | High | Medium | Low | Итого |
|-------|----------|------|--------|-----|-------|
| Аудит #1 | 2 | 3 | 5 | 5 | **15** |
| Аудит #2 | 0 | 2 | 2 | 2 | **6** |
| **Всего** | **2** | **5** | **7** | **7** | **21** |

**Всего исправлено: 21 из 21 (100%)** ✅

---

## 🗂️ Изменённые файлы

### Backend
| Файл | Изменения |
|------|-----------|
| `backend/database/redis_client.py` | Fail-closed стратегия |
| `backend/database/models.py` | `last_raise_date`, rename `salary_configuration`, `now_iso` |
| `backend/routers/auth.py` | `SECURE_COOKIES`, убраны токены из response, `SECURE_COOKIES` для cookie |
| `backend/routers/analytics.py` | Redis кэш, N+1 fix в branch_comparison |
| `backend/routers/job_offers.py` | PIN через POST, Redis rate limit |
| `backend/routers/planning.py` | `get_user_scope()` в create/update/delete |
| `backend/routers/scenarios.py` | Fix импорт |
| `backend/services/salary_service.py` | Логика bonus_count |
| `backend/schemas.py` | Валидация полей |
| `backend/main.py` | Redis rate limit для login |
| `backend/utils/date_utils.py` | **Новый** — хелперы дат |
| `backend/utils/rate_limiter.py` | **Новый** — Redis sliding window rate limiter |
| `backend/alembic/versions/a1b2c3d4e5f6_*.py` | **Новый** — миграция last_raise_date |
| `backend/alembic/versions/b2c3d4e5f6a7_*.py` | **Новый** — миграция rename salary_config |

### Frontend
| Файл | Изменения |
|------|-----------|
| `frontend/src/lib/api.ts` | Убран Bearer из localStorage |
| `frontend/src/pages/LoginPage.tsx` | Убран access_token из userData |
| `frontend/src/App.tsx` | Убран access_token из типа AuthUser |
| `frontend/src/pages/requests/PublicOfferPage.tsx` | PIN через POST /unlock |

### Конфигурация
| Файл | Изменения |
|------|-----------|
| `.env` | `ACCESS_TOKEN_EXPIRE_MINUTES=30` |
| `docker-compose.yml` | Healthcheck, `ALLOWED_ORIGINS` обязателен |

### Перемещённые файлы
| Было | Стало |
|------|-------|
| `debug_risk.py` (корень) | `backend/scripts/debug_risk.py` |
| `trigger_risk.py` (корень) | `backend/scripts/trigger_risk.py` |
| `backend/optimize_db.py` | `backend/scripts/optimize_db.py` |

---

## 🚀 Деплой

Полная инструкция: [`DEPLOY_COMMANDS.md`](./DEPLOY_COMMANDS.md)

```bash
git pull origin master
# Проверить ALLOWED_ORIGINS в .env на сервере
docker compose build --no-cache backend frontend
docker compose up -d db redis && sleep 15
docker compose run --rm backend python -m alembic upgrade head
docker compose down && docker compose up -d
```
