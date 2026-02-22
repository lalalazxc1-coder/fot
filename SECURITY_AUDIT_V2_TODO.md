# 🔒 Security Audit v2 — TODO List
> Дата: 2026-02-22 (второй проход)  
> Статус: ✅ Все исправлено

---

## 🟠 HIGH — Безопасность

- [x] **A1** — `GET /planning/{id}/history` без аутентификации
  - Файл: `backend/routers/planning.py:241`
  - ✅ Добавлен `current_user: User = Depends(get_current_active_user)`

- [x] **A2** — Cache без thread safety в аналитике
  - Файл: `backend/routers/analytics.py:33-48`
  - ✅ Добавлен `threading.Lock()`, операции кэша защищены `with _cache_lock`

- [x] **A3** — Clear Cache без admin_access
  - Файл: `backend/routers/analytics.py:446`
  - ✅ Добавлен `dependencies=[Depends(require_admin)]`

- [x] **A4** — Нет валидации пароля при создании User (admin)
  - Файл: `backend/routers/users.py:49`
  - ✅ Добавлен `AuthService._validate_password_strength(u.password)`

- [x] **A5** — Нет валидации пароля при обновлении User (admin)
  - Файл: `backend/routers/users.py:82`
  - ✅ Аналогично A4

---

## 🟡 MEDIUM — Производительность & Надёжность

- [x] **B1** — N+1 в analytics/branch-comparison и cost-distribution
  - Файл: `backend/routers/analytics.py`
  - ✅ Создан `services/org_unit_service.py` с `build_children_map()` — 1 SQL вместо ~100

- [x] **B2** — N+1 в analytics/turnover
  - Файл: `backend/routers/analytics.py:650`
  - ✅ Bulk-fetch plan_map и fact_map — 2 SQL вместо ~100

- [x] **B3** — `print()` вместо `logging` в роутерах
  - Файл: `backend/routers/planning.py`
  - ✅ `logger = logging.getLogger("fot.planning")`, 3× `print` → `logger.info/exception`

- [x] **B4** — Кэш аналитики не инвалидируется при изменении данных
  - Файл: `backend/routers/analytics.py`
  - ✅ `invalidate_analytics_cache()` + version counter для авто-инвалидации

---

## 🟢 LOW — Качество кода

- [x] **C1** — `optimize_db.py` без environment guard
  - ✅ `if env == "production": sys.exit(1)`

- [x] **C2** — Неправильный импорт `get_current_active_user`
  - Файл: `backend/routers/planning.py:9`
  - ✅ Импорт из `dependencies` вместо `routers.auth`

- [x] **C3** — Дублирование рекурсии потомков OrgUnit
  - ✅ Создан `services/org_unit_service.py` с `build_children_map()`, `get_all_descendant_ids()`, `get_unit_with_descendants()`
  - ✅ `analytics.py` использует shared-функции (2 места)

---

## 📊 Финальный Прогресс

| Статус | Кол-во |
|--------|--------|
| ✅ Исправлено | **13 / 13** |

---

## � Изменённые файлы

| Файл | Фиксы |
|------|--------|
| `backend/routers/planning.py` | A1, B3, C2 |
| `backend/routers/analytics.py` | A2, A3, B1, B2, B4 |
| `backend/routers/users.py` | A4, A5 |
| `backend/optimize_db.py` | C1 |
| `backend/services/org_unit_service.py` | B1, C3 (новый файл) |
