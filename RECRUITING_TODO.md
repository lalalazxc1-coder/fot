# План разработки модуля «Рекрутинг»

Данный план описывает шаги по интеграции модуля "Рекрутинг" (Hiring Plan & Pipeline) в текущую архитектуру проекта FOT (FastAPI + SQLAlchemy).

## Чек-лист задач
- [ ] Create Database Models (`Vacancy`, `Candidate`, `Comment`)
- [ ] Generate and apply Alembic migration for the new tables
- [ ] Create Pydantic schemas for the Recruiting models
- [ ] Create FastAPI routes for Vacancies (CRUD + Status updates)
- [ ] Create FastAPI routes for Candidates (CRUD + Stage transitions)
- [ ] Create FastAPI routes for Comments (Polymorphic: target_type, target_id)
- [ ] Implement system-generated comments for status changes
- [ ] Register new router in `main.py`

## Описание архитектуры

### 1. Database Models (`backend/database/models.py`)
Добавление новых моделей:
- `Vacancy`: `title`, `department_id` (FK `organization_units.id`), `location`, `planned_count`, `status` (по умолчанию `Draft`), `priority` (по умолчанию `Medium`), `creator_id` (FK `users.id`), `created_at`.
- `Candidate`: `vacancy_id` (FK `vacancies.id`), `first_name`, `last_name`, `stage` (по умолчанию `New`), `created_at`.
- `Comment`: `target_type` (String, например "vacancy" или "candidate"), `target_id` (Integer), `author_id` (FK `users.id`), `content` (String), `is_system` (Boolean, default=False), `created_at`. 
*Используется полиморфный подход (Вариант А) для универсальности комментариев во всей системе.*

### 2. Pydantic Schemas (`backend/schemas.py`)
- `VacancyCreate`, `VacancyUpdate`, `VacancyResponse`
- `CandidateCreate`, `CandidateUpdate`, `CandidateResponse`
- `CommentCreate`, `CommentResponse`

### 3. API Routers (`backend/routers/recruiting.py`)
- Реализация CRUD для `Vacancy` (включая изменение статуса).
- Реализация CRUD для `Candidate` (включая изменение этапа).
- Эндпоинты (Универсальные):
  - `GET /api/comments` (с обязательными query-параметрами `target_type` и `target_id`)
  - `POST /api/comments` (с `target_type` и `target_id` в теле запроса)
- Бизнес-логика для отслеживания изменения статусов `Vacancy` и этапов `Candidate`. Если статус (или этап) меняется, система **автоматически** создает объект `Comment` с текстом вида `"Система: Статус вакансии изменен на 'Открыта' (Автор: {user_name})"`.

### 4. Database Migrations
- Генерация миграции Alembic: `alembic revision --autogenerate -m "Add recruiting module"`.
- Применение миграции к БД.
