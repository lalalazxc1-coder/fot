# 🚀 FOT Manager — Система Управления Фондом Оплаты Труда

<div align="center">

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![React](https://img.shields.io/badge/react-18.2-61dafb.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Tests](https://img.shields.io/badge/tests-53%20passing-success.svg)

**Современная ERP-система для управления персоналом и расчета зарплат**  
*Специально адаптирована под законодательство Республики Казахстан*

[📚 Документация](#документация) • [🎯 Возможности](#возможности) • [🚀 Быстрый старт](#быстрый-старт) • [🏗️ Архитектура](#архитектура) • [📊 Демо](#демо)

</div>

---

## 📖 О проекте

**FOT Manager** — это полнофункциональная система управления фондом оплаты труда, которая автоматизирует расчет зарплат, планирование бюджета, управление организационной структурой и предоставляет мощную аналитику для принятия HR-решений.

### Почему FOT Manager?

✅ **100% точность** — математически точные расчеты с использованием Decimal (без ошибок округления)  
✅ **Compliance** — полное соответствие налоговому законодательству РК (ОПВ, ВОСМС, ИПН, ОСМС, СО, СН, ОПВР)  
✅ **Современный стек** — FastAPI + React + TypeScript + PostgreSQL  
✅ **Open Source** — полный доступ к исходному коду для кастомизации  
✅ **Production-ready** — 53 unit теста, security best practices, audit trail  
✅ **Быстрое внедрение** — от установки до первого запуска за 1 день  

---

## 🎯 Возможности

### 🏢 Организационная структура
- Иерархическое дерево подразделений с визуализацией (ReactFlow)
- DAG-валидация для предотвращения циклических зависимостей
- Scope-based доступ (каждый пользователь видит только свои подразделения)

### 💰 Финансовый модуль
- **7 налогов РК:** ОПВ, ОПВР, ВОСМС, ОСМС, ИПН, СО, СН
- Реверсный расчет Net → Gross (binary search алгоритм)
- Учет 14 МРП и специальных вычетов
- Precision-first подход (Python Decimal)

### 📊 Планирование и сценарии
- Sandbox-среда для моделирования бюджета
- Сравнение альтернативных сценариев
- Массовые обновления позиций
- Commit с автоматическим backup

### 🔄 Workflow и одобрения
- Multi-step approval система
- Role-based + user-based шаги
- Контекстная аналитика для approver'ов (Before/After, Market benchmarks)
- История всех одобрений/отклонений

### 📈 Аналитика и отчетность
- **Dashboard** с ключевыми метриками ФОТ
- **Retention Risk Analysis** — кто в зоне риска увольнения
- **ESG Reporting** — Gender Pay Gap, генерационный equity
- **Top-N Analysis** — самые дорогие сотрудники, самые большие затраты
- Branch-level детализация

### ⏱️ Time Travel
- Просмотр исторического состояния на любую дату
- Snapshot-based reconstruction
- Read-only режим для безопасности

### 🔒 Безопасность
- JWT OAuth2 authentication
- RBAC (Role-Based Access Control) с granular permissions
- Rate limiting на критических endpoint'ах
- Audit trail (before/after snapshots)
- CORS policy configuration

---

## 🚀 Быстрый старт

### Требования
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (или SQLite для dev)

### Установка

#### 1. Клонирование репозитория
```bash
git clone https://github.com/yourusername/fot-manager.git
cd fot-manager
```

#### 2. Backend setup
```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

# Установить зависимости
pip install -r requirements.txt

# Настроить environment variables
cp .env.example .env
# Отредактировать .env: SECRET_KEY, DATABASE_URL, etc.

# Применить миграции
alembic upgrade head

# Инициализировать базовые данные (создать admin)
python init_db.py

# Запустить сервер
python main.py
```

Backend будет доступен на `http://localhost:8000`  
API документация: `http://localhost:8000/docs`

#### 3. Frontend setup
```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev server
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

#### 4. Первый вход
```
Email: admin
Пароль: admin (или из .env файла ADMIN_PASSWORD)
```

⚠️ **Важно:** Сразу смените пароль admin после первого входа!

---

## 🏗️ Архитектура

### Backend (Python/FastAPI)
```
backend/
├── main.py              # Entry point
├── security.py          # JWT + bcrypt
├── dependencies.py      # Auth middleware, PermissionChecker
├── schemas.py           # Pydantic validation models
├── alembic/             # Database migrations
├── database/
│   ├── database.py      # SQLAlchemy engine
│   └── models.py        # 16 ORM models
├── services/            # Business logic layer
│   ├── auth_service.py
│   ├── employee_service.py
│   └── salary_service.py
├── routers/             # 14 API routers
│   ├── auth.py
│   ├── users.py
│   ├── roles.py
│   ├── structure.py
│   ├── employees.py
│   ├── planning.py
│   ├── scenarios.py
│   ├── requests.py
│   ├── workflow.py
│   ├── analytics.py
│   ├── market.py
│   ├── salary.py
│   ├── salary_config.py
│   ├── positions.py
│   └── admin.py
└── tests/               # 53 unit tests
```

### Frontend (React/TypeScript)
```
frontend/
├── src/
│   ├── App.tsx          # Routing, Protected Routes
│   ├── main.tsx         # Entry + Error Boundary
│   ├── lib/api.ts       # Axios instance
│   ├── components/      # 35+ reusable components
│   ├── hooks/           # React Query hooks
│   ├── pages/           # Page components
│   ├── context/         # React Context (SnapshotContext)
│   └── utils/           # Helper functions
├── package.json
└── vite.config.ts
```

### Технологический стек

**Backend:**
- FastAPI — async web framework
- SQLAlchemy 2.0 — ORM
- Alembic — migrations
- Pydantic v2 — validation
- python-jose — JWT
- passlib + bcrypt — password hashing
- PostgreSQL/SQLite — database

**Frontend:**
- React 18.2 — UI framework
- TypeScript 5.2 — type safety
- React Router v7 — routing
- TanStack Query 5 — data fetching & caching
- TanStack Table 8 — advanced tables
- TailwindCSS 3.3 — styling
- Vite 5.0 — build tool
- Chart.js + Recharts — charts
- ReactFlow — org chart visualization
- react-window — virtualization

---

## 📊 API Endpoints

Система предоставляет **63+ REST API endpoints**, организованных в 14 модулей:

| Модуль | Prefix | Endpoints | Описание |
|--------|--------|-----------|----------|
| 🔐 Auth | `/api/auth` | 6 | Login, /me, change password, notifications |
| 👥 Roles | `/api/roles` | 4 | RBAC управление |
| 👤 Users | `/api/users` | 4 | CRUD пользователей |
| 🏢 Structure | `/api/structure` | 7 | Оргструктура |
| 👔 Employees | `/api/employees` | 2 | Сотрудники |
| 📊 Planning | `/api/planning` | 5 | Планирование позиций |
| 🎯 Scenarios | `/api/scenarios` | 6 | Моделирование |
| 📝 Requests | `/api/requests` | 5 | Заявки на изменения |
| 🔄 Workflow | `/api/workflow` | 4 | Approval steps |
| 📈 Analytics | `/api/analytics` | 7 | Dashboard & ESG |
| 💼 Market | `/api/market` | 5 | Рыночные данные |
| ⚙️ Salary Config | `/api/salary-config` | 4 | Настройка налогов |
| 🎯 Positions | `/api/positions` | 3 | Справочник должностей |
| 🔧 Admin | `/api/admin` | 1 | System stats |

Полная документация API: `http://localhost:8000/docs`

---

## 🧪 Тестирование

```bash
cd backend
pytest

# С покрытием
pytest --cov=. --cov-report=html

# Конкретный модуль
pytest tests/test_salary_calculation.py -v
```

**Текущее покрытие:** 53 теста проходят ✅
- Auth & Security ✅
- Salary Calculations ✅
- Structure CRUD ✅
- Planning & Scenarios ✅
- Notifications ✅

---

## 🔐 Безопасность

### Реализованные меры защиты:

✅ **Секреты в environment variables** (никаких hardcoded ключей)  
✅ **bcrypt password hashing** (cost factor 12)  
✅ **JWT токены** с настраиваемым expiration  
✅ **Rate limiting** на /api/auth/login  
✅ **RBAC + Scope-based filtering**  
✅ **Audit trail** для всех критических операций  
✅ **Input validation** через Pydantic v2  
✅ **CORS policy** через environment variables  

### Best Practices:

1. **Всегда используйте .env файл** для секретов
2. **Смените дефолтный admin пароль** сразу после установки
3. **Генерируйте SECRET_KEY** через `openssl rand -hex 32`
4. **Используйте HTTPS** в production (Nginx reverse proxy)
5. **Регулярно обновляйте зависимости** для security patches

---

## 📚 Документация

- 📄 **[PRESENTATION_SUMMARY.md](PRESENTATION_SUMMARY.md)** — краткое описание всех возможностей
- 📘 **[technical_report.md](technical_report.md)** — технический отчет для разработчиков
- 🔍 **[PROJECT_AUDIT_REPORT.md](PROJECT_AUDIT_REPORT.md)** — полный аудит кода и архитектуры
- 🎁 **[RECOMMENDATION_GUIDE.md](RECOMMENDATION_GUIDE.md)** — гайд для рекомендации проекта
- 🌐 **[project_presentation.html](project_presentation.html)** — красивая web-презентация

---

## 🎯 Roadmap

### ✅ Phase 1: Security (COMPLETED)
- [x] Environment-based configuration
- [x] Password security (bcrypt + validation)
- [x] Rate limiting
- [x] CORS policy
- [x] Code deduplication

### 🔄 Phase 2: Infrastructure (IN PROGRESS)
- [x] Alembic migrations
- [x] PostgreSQL support
- [ ] Docker / Docker Compose
- [ ] Nginx + HTTPS
- [ ] CI/CD (GitHub Actions)

### 📋 Phase 3: Stability (~1 week)
- [ ] Structured logging
- [ ] Error monitoring (Sentry)
- [ ] Refresh tokens
- [ ] Pagination for large lists
- [ ] Extended test coverage
- [ ] E2E tests (Playwright)

### 🚀 Phase 4: Optimization (~1 week)
- [ ] Redis caching
- [ ] PostgreSQL connection pooling
- [ ] Background jobs (Celery/ARQ)
- [ ] Streaming Excel exports
- [ ] Frontend code splitting

---

## 💡 Примеры использования

### Создание сценария планирования
```python
# POST /api/scenarios
{
  "name": "Plan 2026 Q1",
  "description": "Budget model for new department"
}

# POST /api/scenarios/{id}/positions
{
  "position_id": 1,
  "department_id": 5,
  "base_net": 500000,
  "kpi_net": 100000,
  "bonus_net": 50000
}

# GET /api/scenarios/{id1}/compare/{id2}
# Returns: detailed comparison with financial impact
```

### Проверка retention риска
```python
# GET /api/analytics/retention-risk
{
  "critical_employees": [
    {
      "id": 42,
      "name": "Иванов И.И.",
      "risk_score": 85,
      "stagnation_months": 18,
      "market_gap_percent": -22
    }
  ]
}
```

---

## 🤝 Contributing

Мы приветствуем контрибуции! Пожалуйста:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

См. [CONTRIBUTING.md](CONTRIBUTING.md) для деталей.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Авторы

Разработано с ❤️ для автоматизации HR и Finance процессов.

---

## 🙏 Acknowledgments

- FastAPI за отличный async framework
- React и Tanstack за потрясающие инструменты
- Сообщество Open Source за вдохновение

---

## 📞 Контакты и поддержка

- 🐛 **Bug reports:** [GitHub Issues](https://github.com/yourusername/fot-manager/issues)
- 💡 **Feature requests:** [GitHub Discussions](https://github.com/yourusername/fot-manager/discussions)
- 📧 **Email:** support@fot-manager.example.com

---

<div align="center">

**⭐ Если проект был полезен, поставьте звезду на GitHub! ⭐**

Made with ❤️ • February 2026

</div>
