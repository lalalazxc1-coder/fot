# FOT — Изменения после аудита и инструкции по запуску

> Дата: 2026-03-05 | Ветка: `master`

---

## 📋 Что было исправлено

| # | Проблема | Файлы |
|---|----------|-------|
| 1 | Циклический импорт `from main import _get_client_ip` | `utils/network.py` *(новый)*, `main.py`, `routers/auth.py` |
| 2 | Нет healthcheck для backend в Docker | `docker-compose.yml`, `main.py` |
| 3 | Один `SECRET_KEY` для access и refresh токенов | `security.py`, `routers/auth.py`, `docker-compose.yml` |
| 4 | `ALGORITHM` не валидировался (можно было передать `none`) | `security.py` |
| 5 | Конфликт дефолта `REFRESH_TOKEN_EXPIRE_DAYS` (30 vs 7) | `security.py` |
| 6 | Тесты frontend не запускались в CI | `.github/workflows/ci.yml` |
| 7 | Два тест-раннера (Jest + Vitest) одновременно | `frontend/package.json` |
| 8 | `pytest` отсутствовал в зависимостях | `backend/requirements-dev.txt` *(новый)*, `requirements.txt` |

---

## 💻 Первый запуск на ПК (локально)

### 1. Клонировать и установить зависимости

```bash
git pull origin master

# Frontend
npm install
npm --prefix frontend install

# Backend
cd backend
pip install -r requirements-dev.txt
cd ..
```

### 2. Создать `.env` для backend

Скопировать шаблон:
```bash
cp backend/.env.example backend/.env
```

Открыть `backend/.env` и заполнить секретные ключи.  
Сгенерировать три независимых ключа:
```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('REFRESH_SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('SECRETS_ENCRYPTION_KEY=' + secrets.token_hex(32))"
```

Минимальный `.env` для локальной разработки:
```env
SECRET_KEY=<сюда вставить первый ключ>
REFRESH_SECRET_KEY=<сюда вставить второй ключ>
SECRETS_ENCRYPTION_KEY=<сюда вставить третий ключ>

DATABASE_URL=sqlite:///./fot.db
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
TRUSTED_PROXY_IPS=127.0.0.1,::1
FORWARDED_ALLOW_IPS=127.0.0.1
LOG_LEVEL=INFO
```

### 3. Инициализировать базу данных

```bash
cd backend
python -m alembic upgrade head
python init_db.py        # создаёт первого admin пользователя
cd ..
```

### 4. Запустить

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend
npm --prefix frontend run dev
```

Открыть: **http://localhost:5173**  
Swagger API: **http://localhost:8000/docs**

### 5. Запустить тесты локально

```bash
# Backend тесты
cd backend
python -m pytest tests/ -v

# Frontend тесты
npm --prefix frontend test -- --watchAll=false
```

---

## 🚀 Деплой на сервер

### 1. Обновить `.env` на сервере

> ⚠️ **Обязательно** — добавить новую переменную `REFRESH_SECRET_KEY` в `.env` на сервере.  
> Без неё `docker compose up` завершится с ошибкой (переменная помечена как обязательная).

```bash
# На сервере — перейти в папку проекта
cd /path/to/fot

# Сгенерировать новый ключ
python3 -c "import secrets; print(secrets.token_hex(32))"

# Добавить в .env
echo "REFRESH_SECRET_KEY=<сгенерированный ключ>" >> .env
```

Проверить что в `.env` есть все три обязательных ключа:
```bash
grep -E "^(SECRET_KEY|REFRESH_SECRET_KEY|SECRETS_ENCRYPTION_KEY)=" .env
```

Вывод должен показать все три строки с непустыми значениями.

### 2. Получить последние изменения

```bash
git pull origin master
```

### 3. Пересобрать и запустить контейнеры

```bash
docker compose pull          # обновить базовые образы (опционально)
docker compose build         # пересобрать backend и frontend
docker compose up -d         # поднять все сервисы в фоне
```

### 4. Проверить что всё запустилось

```bash
# Статус контейнеров (все должны быть healthy или running)
docker compose ps

# Логи backend (ждать строку "Application startup complete")
docker compose logs -f backend --tail=50

# Проверить healthcheck вручную
curl -s http://localhost:8000/health
# Ожидаемый ответ: {"status":"ok"}
```

### 5. Выполнить миграции (если есть новые)

```bash
docker compose exec backend alembic upgrade head
```

### 6. Откатить в случае проблем

```bash
docker compose down
git checkout HEAD~1          # вернуться к предыдущему коммиту
docker compose build
docker compose up -d
```

---

## ⚠️ Важное о `REFRESH_SECRET_KEY`

После добавления нового ключа все **существующие refresh-токены** станут недействительными.  
Это означает, что при следующем визите пользователи будут **автоматически разлогинены** и должны будут войти заново — это нормальное и ожидаемое поведение при ротации ключей.

Access-токены (15 минут жизни) истекут естественным образом.

---

## 🔑 Переменные окружения — справочник

| Переменная | Обязательна | Описание |
|---|---|---|
| `SECRET_KEY` | ✅ Всегда | Подписывает access JWT токены |
| `REFRESH_SECRET_KEY` | ✅ Всегда | Подписывает refresh JWT токены (добавлено в аудите) |
| `SECRETS_ENCRYPTION_KEY` | ✅ В production | Шифрует секреты интеграций |
| `DATABASE_URL` | — | По умолчанию SQLite. Для prod: `postgresql://...` |
| `REDIS_URL` | — | По умолчанию `redis://localhost:6379/0` |
| `ALLOWED_ORIGINS` | ✅ В production | CORS список доменов через запятую |
| `TRUSTED_PROXY_IPS` | ✅ В production | IP доверенных прокси (Caddy/Nginx) |
| `FORWARDED_ALLOW_IPS` | ✅ В production | Для Uvicorn — те же IP что и TRUSTED_PROXY_IPS |
| `ENVIRONMENT` | — | `development` или `production` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | По умолчанию `7` дней |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | По умолчанию `15` минут |
| `RATE_LIMIT_MAX` | — | Макс. попыток входа за 5 мин (по умолч. `10`) |
