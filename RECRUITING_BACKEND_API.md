# Backend по модулю Recruiting (для фронтенда)

## Что реализовано

- Добавлены модели и таблицы `vacancies`, `candidates`, `comments` в `backend/database/models.py`.
- Добавлена миграция: `backend/alembic/versions/5a5da97554a7_add_recruiting_module.py`.
- Добавлены Pydantic-схемы в `backend/schemas.py`:
  - `VacancyCreate`, `VacancyUpdate`, `VacancyStatusUpdate`, `VacancyResponse`
  - `CandidateCreate`, `CandidateUpdate`, `CandidateStageUpdate`, `CandidateResponse`
  - `CommentCreate`, `CommentResponse`
- Реализован роутер `backend/routers/recruiting.py`.
- Роутер подключен в `backend/main.py`.
- Покрыто тестами в `backend/tests/test_recruiting.py`.

## API эндпоинты

Все эндпоинты идут с префиксом `/api`.

### Vacancies

- `GET /vacancies` — список вакансий.
- `POST /vacancies` — создание вакансии.
- `GET /vacancies/{vacancy_id}` — получить вакансию по id.
- `PUT /vacancies/{vacancy_id}` — обновить вакансию.
- `PATCH /vacancies/{vacancy_id}/status` — обновить только статус вакансии.
- `DELETE /vacancies/{vacancy_id}` — удалить вакансию (ответ: `{"status": "deleted"}`).

### Candidates

- `GET /candidates?vacancy_id=<id>` — список кандидатов (фильтр по вакансии опционален).
- `POST /candidates` — создание кандидата.
- `GET /candidates/{candidate_id}` — получить кандидата по id.
- `PUT /candidates/{candidate_id}` — обновить кандидата.
- `PATCH /candidates/{candidate_id}/stage` — обновить только этап кандидата.
- `DELETE /candidates/{candidate_id}` — удалить кандидата (ответ: `{"status": "deleted"}`).

### Comments

- `GET /comments?target_type=vacancy|candidate&target_id=<id>` — список комментариев по сущности.
- `POST /comments` — создать комментарий.

## Контракт данных

### VacancyResponse

- `id: number`
- `title: string`
- `department_id: number`
- `location: string | null`
- `planned_count: number`
- `status: string`
- `priority: string`
- `creator_id: number`
- `created_at: string`

### CandidateResponse

- `id: number`
- `vacancy_id: number`
- `first_name: string`
- `last_name: string`
- `stage: string`
- `created_at: string`

### CommentResponse

- `id: number`
- `target_type: "vacancy" | "candidate"`
- `target_id: number`
- `author_id: number`
- `content: string`
- `is_system: boolean`
- `created_at: string`
- `author_name: string | null`

## Валидации (важно для фронта)

- `department_id`, `vacancy_id`, `target_id` > 0.
- `planned_count` >= 1.
- `title` до 255 символов.
- `location` до 255 символов.
- `status`, `priority`, `stage` до 100 символов.
- `first_name`, `last_name` до 200 символов.
- `comment.content` от 1 до 5000 символов.
- `target_type` только `vacancy` или `candidate`.

## Бизнес-правила

- Доступ к recruiting-эндпоинтам только для пользователей с правами:
  - `admin_access` или `manage_planning` или `manage_offers`.
  - Иначе возвращается `403 Forbidden`.
- При изменении `vacancy.status` автоматически создается системный комментарий (`is_system = true`).
- При изменении `candidate.stage` автоматически создается системный комментарий (`is_system = true`).
- Комментарий к несуществующей цели (`target_type` + `target_id`) возвращает `404`.
- Неподдерживаемый `target_type` возвращает `400`.

## Сортировка списков

- `GET /vacancies` и `GET /candidates`: сортировка по `id desc` (новые сверху).
- `GET /comments`: сортировка по `id asc` (старые сверху).

## Результаты проверки

- Тесты модуля recruiting: `6 passed`.
- Полный backend suite: `98 passed`.
