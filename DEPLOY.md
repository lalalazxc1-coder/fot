# 🚀 Руководство по развертыванию

Инструкции по развертыванию FOT Manager в различных окружениях.

## 📋 Содержание

- [Development (Разработка)](#development)
- [Production (Продакшн)](#production)
- [Docker](#docker)
- [Переменные окружения](#переменные-окружения)

## Development

### Backend

```bash
cd backend

# Создайте виртуальное окружение
python -m venv venv

# Активируйте (Windows)
venv\Scripts\activate

# Установите зависимости
pip install -r requirements.txt

# Скопируйте и настройте .env
copy .env.example .env
# Отредактируйте .env файл

# Инициализируйте БД
python init_db.py

# Запустите сервер
python main.py
```

### Frontend

```bash
cd frontend

# Установите зависимости
npm install

# Скопируйте и настройте .env
copy .env.example .env
# Отредактируйте .env файл

# Запустите dev сервер
npm run dev
```

## Production

### Backend (Production Ready)

1. **Создайте production .env:**

```env
SECRET_KEY=your-super-secure-random-key-generated-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DATABASE_URL=sqlite:///./fot_mvp.db  # Или PostgreSQL для production
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com
LOG_LEVEL=WARNING
```

2. **Запустите с Uvicorn (production):**

```bash
cd backend

# С несколькими workers
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Или с Gunicorn
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

3. **Настройте systemd service (Linux):**

Создайте файл `/etc/systemd/system/fot-backend.service`:

```ini
[Unit]
Description=FOT Manager Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/fot/backend
Environment="PATH=/path/to/fot/backend/venv/bin"
ExecStart=/path/to/fot/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

Активируйте:
```bash
sudo systemctl enable fot-backend
sudo systemctl start fot-backend
```

### Frontend (Production Build)

```bash
cd frontend

# Production build
npm run build

# Результат будет в dist/
```

Раздайте статичные файлы через:
- **Nginx**
- **Apache**
- **Vercel**
- **Netlify**
- Любой статичный хостинг

### Nginx конфигурация

```nginx
# Backend (API)
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/fot/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Docker

### Dockerfile для Backend

Создайте `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода
COPY . .

# Инициализация БД (опционально)
RUN python init_db.py

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile для Frontend

Создайте `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

Создайте `docker-compose.yml` в корне проекта:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=sqlite:///./fot_mvp.db
    volumes:
      - ./backend:/app
      - backend-db:/app/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  backend-db:
```

Запуск:
```bash
docker-compose up -d
```

## Переменные окружения

### Backend (.env)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `SECRET_KEY` | Секретный ключ для JWT | `openssl rand -hex 32` |
| `ALGORITHM` | Алгоритм шифрования | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни токена | `30` |
| `DATABASE_URL` | URL базы данных | `sqlite:///./fot_mvp.db` |
| `ENVIRONMENT` | Окружение | `production` |
| `ALLOWED_ORIGINS` | CORS origins | `https://yourdomain.com` |
| `LOG_LEVEL` | Уровень логирования | `WARNING` |

### Frontend (.env)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `VITE_API_URL` | URL Backend API | `https://api.yourdomain.com` |
| `VITE_ENVIRONMENT` | Окружение | `production` |

## 🔒 Безопасность Production

1. **Используйте HTTPS** (Let's Encrypt)
2. **Сильный SECRET_KEY** (минимум 32 байта)
3. **Измените пароль администратора**
4. **Настройте firewall**
5. **Регулярные бэкапы БД**
6. **Обновляйте зависимости**
7. **Ограничьте CORS** только доверенными доменами

## 📊 Мониторинг

### Логи

Backend:
```bash
tail -f /var/log/fot-backend.log
```

Nginx:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Здоровье приложения

```bash
curl http://localhost:8000/docs  # API документация
```

## 🔄 Обновление

```bash
# Остановите сервисы
sudo systemctl stop fot-backend

# Обновите код
git pull origin main

# Обновите зависимости
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Примените миграции (если есть)
# python migrate.py

# Пересоберите frontend
cd ../frontend
npm install
npm run build

# Запустите сервисы
sudo systemctl start fot-backend
sudo systemctl reload nginx
```

## 🆘 Решение проблем

### Backend не запускается

```bash
# Проверьте логи
journalctl -u fot-backend -f

# Проверьте порт
sudo netstat -tlnp | grep 8000

# Проверьте права
ls -la /path/to/fot/backend/fot_mvp.db
```

### Frontend 404 ошибки

Убедитесь, что Nginx настроен на `try_files $uri /index.html` для SPA.

---

**Нужна помощь?** Создайте [Issue](https://github.com/your-username/fot/issues)
