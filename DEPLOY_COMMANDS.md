# 🚀 Инструкция по обновлению продакшн-сервера (Docker)

> Дата изменений: 2026-02-25  
> Все команды выполнять **на сервере** по SSH

---

## ⚠️ Перед началом

1. Убедитесь что есть **свежий бэкап БД**:
```bash
docker exec fot_db pg_dump -U fot_admin fot_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. Перейдите в директорию проекта:
```bash
cd /path/to/your/fot-project
```

---

## 1. Загрузка изменений из Git

```bash
git pull origin main
```

---

## 2. Проверка .env перед деплоем

```bash
# Убедитесь что ALLOWED_ORIGINS задан (теперь обязателен — без него docker-compose упадёт)
grep ALLOWED_ORIGINS .env
# Должно быть что-то вроде:
# ALLOWED_ORIGINS=https://your-domain.com

# ACCESS_TOKEN_EXPIRE_MINUTES теперь 30 минут (было 1440)
grep ACCESS_TOKEN_EXPIRE_MINUTES .env
```

> **Важно:** Если `ALLOWED_ORIGINS` не задан в `.env`, добавьте:
> ```bash
> echo "ALLOWED_ORIGINS=https://your-domain.com" >> .env
> ```

---

## 3. Пересборка Docker-образов

```bash
# Пересобрать backend и frontend с новым кодом
docker compose build --no-cache backend frontend
```

---

## 4. Применение миграций БД

> **⚠️ Критически важно:** Сначала мигрируем БД, потом поднимаем новые контейнеры.  
> Новые миграции переименовывают таблицу `salary_config_2026` → `salary_configuration`.

```bash
# Запустить только БД и Redis (без backend)
docker compose up -d db redis

# Подождать запуска PostgreSQL
sleep 10

# Выполнить миграции (запускаем временный контейнер с новым кодом)
docker compose run --rm backend python -m alembic upgrade head
```

**Что делают миграции:**
- `a1b2c3d4e5f6` — добавляет колонку `last_raise_date` в `financial_records`
- `b2c3d4e5f6a7` — переименовывает `salary_config_2026` → `salary_configuration`

---

## 5. Сброс Redis-кэша аналитики

```bash
# Сбросить кэш аналитики (теперь в Redis, не в памяти)
docker exec fot_redis redis-cli KEYS "analytics:*" | xargs -r docker exec -i fot_redis redis-cli DEL

# Или через API (если backend уже запущен):
# curl -X POST https://your-domain.com/api/analytics/clear-cache \
#   -H "Authorization: Bearer <admin_token>"
```

---

## 6. Перезапуск всех сервисов

```bash
# Полный перезапуск с новыми образами
docker compose down
docker compose up -d
```

---

## 7. Проверка работоспособности

```bash
# Проверить статус контейнеров (все должны быть healthy или running)
docker compose ps

# Проверить логи backend (не должно быть ошибок)
docker compose logs backend --tail=50

# Проверить подключение к Redis
docker compose logs backend | grep -i redis

# Проверить что миграции применились
docker compose run --rm backend python -m alembic current
```

---

## 8. Проверка API (smoke test)

```bash
# Проверить health endpoint
curl -f https://your-domain.com/health || echo "FAILED!"

# Проверить логин
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_admin_password"}'
```

---

## 🔄 Что изменилось (для понимания)

| Изменение | Описание |
|-----------|----------|
| `ACCESS_TOKEN_EXPIRE_MINUTES=30` | Токены теперь живут 30 мин вместо 24 ч. Пользователи могут чаще видеть повторный логин, но это безопаснее. |
| Redis fail-closed | Если Redis упадёт, пользователи будут выйдены из системы до восстановления Redis. Это предотвращает использование отозванных токенов. |
| Кэш аналитики в Redis | После перезапуска кэш в Redis будет пустым — первые запросы к аналитике будут медленнее (пересчитываются), затем кэшируются на 5 мин. |
| PIN Job Offer через POST | Если есть кастомный фронтенд — нужно обновить логику (теперь `/unlock` вместо GET `?pin=`). В данном проекте уже обновлено. |
| salary_configuration | Таблица переименована. Если есть прямые SQL-запросы к `salary_config_2026` — нужно обновить. |
| ALLOWED_ORIGINS обязателен | Без явного указания docker-compose не запустится. |

---

## 🚨 Откат в случае проблем

```bash
# Откатить последние 2 миграции (b2c3d4e5f6a7 и a1b2c3d4e5f6)  
docker compose run --rm backend python -m alembic downgrade -2

# Откатить к конкретной ревизии (до наших изменений)
docker compose run --rm backend python -m alembic downgrade 5ce6bc3e920b

# Восстановить из бэкапа БД (крайний случай)
docker exec -i fot_db psql -U fot_admin fot_db < backup_YYYYMMDD_HHMMSS.sql

# Вернуть старый код
git stash  # или git checkout <old_commit>
docker compose build backend
docker compose up -d
```
