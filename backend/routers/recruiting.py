from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database.database import get_db
from database.models import Candidate, Comment, OrganizationUnit, User, Vacancy
from dependencies import get_current_active_user
from schemas import (
    CandidateCreate,
    CandidateResponse,
    CandidateStageUpdate,
    CandidateUpdate,
    CommentCreate,
    CommentResponse,
    VacancyCreate,
    VacancyResponse,
    VacancyStatusUpdate,
    VacancyUpdate,
)


router = APIRouter(prefix="/api", tags=["recruiting"])


def _has_recruiting_permission(current_user: User) -> bool:
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    return bool(
        perms.get("admin_access")
        or perms.get("manage_planning")
        or perms.get("manage_offers")
    )


def _require_recruiting_permission(current_user: User) -> None:
    if not _has_recruiting_permission(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")


def _ensure_department_exists(db: Session, department_id: int) -> None:
    department = db.get(OrganizationUnit, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")


def _ensure_vacancy_exists(db: Session, vacancy_id: int) -> Vacancy:
    vacancy = db.get(Vacancy, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return vacancy


def _ensure_candidate_exists(db: Session, candidate_id: int) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


def _create_system_comment(
    db: Session,
    target_type: str,
    target_id: int,
    content: str,
    author_id: int,
) -> None:
    db.add(
        Comment(
            target_type=target_type,
            target_id=target_id,
            author_id=author_id,
            content=content,
            is_system=True,
        )
    )


def _validate_comment_target(db: Session, target_type: str, target_id: int) -> None:
    if target_type == "vacancy":
        _ensure_vacancy_exists(db, target_id)
        return
    if target_type == "candidate":
        _ensure_candidate_exists(db, target_id)
        return
    raise HTTPException(status_code=400, detail="Unsupported target_type")


@router.get("/vacancies", response_model=list[VacancyResponse])
def list_vacancies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    return db.query(Vacancy).order_by(Vacancy.id.desc()).all()


@router.post("/vacancies", response_model=VacancyResponse)
def create_vacancy(
    data: VacancyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    _ensure_department_exists(db, data.department_id)

    vacancy = Vacancy(
        title=data.title,
        department_id=data.department_id,
        location=data.location,
        planned_count=data.planned_count,
        status=data.status,
        priority=data.priority,
        creator_id=current_user.id,
    )
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.get("/vacancies/{vacancy_id}", response_model=VacancyResponse)
def get_vacancy(
    vacancy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    return _ensure_vacancy_exists(db, vacancy_id)


@router.put("/vacancies/{vacancy_id}", response_model=VacancyResponse)
def update_vacancy(
    vacancy_id: int,
    data: VacancyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    vacancy = _ensure_vacancy_exists(db, vacancy_id)

    update_data = data.model_dump(exclude_unset=True)
    if "department_id" in update_data:
        _ensure_department_exists(db, update_data["department_id"])

    if "status" in update_data and update_data["status"] != vacancy.status:
        author_name = current_user.full_name or current_user.email or f"User {current_user.id}"
        _create_system_comment(
            db=db,
            target_type="vacancy",
            target_id=vacancy.id,
            author_id=current_user.id,
            content=f"Система: Статус вакансии изменен на '{update_data['status']}' (Автор: {author_name})",
        )

    for key, value in update_data.items():
        setattr(vacancy, key, value)

    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.patch("/vacancies/{vacancy_id}/status", response_model=VacancyResponse)
def update_vacancy_status(
    vacancy_id: int,
    data: VacancyStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    vacancy = _ensure_vacancy_exists(db, vacancy_id)

    if data.status != vacancy.status:
        author_name = current_user.full_name or current_user.email or f"User {current_user.id}"
        _create_system_comment(
            db=db,
            target_type="vacancy",
            target_id=vacancy.id,
            author_id=current_user.id,
            content=f"Система: Статус вакансии изменен на '{data.status}' (Автор: {author_name})",
        )
        vacancy.status = data.status
        db.commit()
        db.refresh(vacancy)

    return vacancy


@router.delete("/vacancies/{vacancy_id}")
def delete_vacancy(
    vacancy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    vacancy = _ensure_vacancy_exists(db, vacancy_id)
    db.delete(vacancy)
    db.commit()
    return {"status": "deleted"}


@router.get("/candidates", response_model=list[CandidateResponse])
def list_candidates(
    vacancy_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    query = db.query(Candidate)
    if vacancy_id is not None:
        query = query.filter(Candidate.vacancy_id == vacancy_id)
    return query.order_by(Candidate.id.desc()).all()


@router.post("/candidates", response_model=CandidateResponse)
def create_candidate(
    data: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    _ensure_vacancy_exists(db, data.vacancy_id)

    candidate = Candidate(
        vacancy_id=data.vacancy_id,
        first_name=data.first_name,
        last_name=data.last_name,
        stage=data.stage,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    return _ensure_candidate_exists(db, candidate_id)


@router.put("/candidates/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: int,
    data: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    candidate = _ensure_candidate_exists(db, candidate_id)

    update_data = data.model_dump(exclude_unset=True)
    if "vacancy_id" in update_data:
        _ensure_vacancy_exists(db, update_data["vacancy_id"])

    if "stage" in update_data and update_data["stage"] != candidate.stage:
        author_name = current_user.full_name or current_user.email or f"User {current_user.id}"
        _create_system_comment(
            db=db,
            target_type="candidate",
            target_id=candidate.id,
            author_id=current_user.id,
            content=f"Система: Этап кандидата изменен на '{update_data['stage']}' (Автор: {author_name})",
        )

    for key, value in update_data.items():
        setattr(candidate, key, value)

    db.commit()
    db.refresh(candidate)
    return candidate


@router.patch("/candidates/{candidate_id}/stage", response_model=CandidateResponse)
def update_candidate_stage(
    candidate_id: int,
    data: CandidateStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    candidate = _ensure_candidate_exists(db, candidate_id)

    if data.stage != candidate.stage:
        author_name = current_user.full_name or current_user.email or f"User {current_user.id}"
        _create_system_comment(
            db=db,
            target_type="candidate",
            target_id=candidate.id,
            author_id=current_user.id,
            content=f"Система: Этап кандидата изменен на '{data.stage}' (Автор: {author_name})",
        )
        candidate.stage = data.stage
        db.commit()
        db.refresh(candidate)

    return candidate


@router.delete("/candidates/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    candidate = _ensure_candidate_exists(db, candidate_id)
    db.delete(candidate)
    db.commit()
    return {"status": "deleted"}


@router.get("/comments", response_model=list[CommentResponse])
def list_comments(
    target_type: str = Query(...),
    target_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    _validate_comment_target(db, target_type, target_id)

    comments = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.target_type == target_type, Comment.target_id == target_id)
        .order_by(Comment.id.asc())
        .all()
    )

    return [
        CommentResponse(
            id=comment.id,
            target_type=comment.target_type,
            target_id=comment.target_id,
            author_id=comment.author_id,
            content=comment.content,
            is_system=comment.is_system,
            created_at=comment.created_at,
            author_name=(comment.author.full_name or comment.author.email) if comment.author else None,
        )
        for comment in comments
    ]


@router.post("/comments", response_model=CommentResponse)
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    _validate_comment_target(db, data.target_type, data.target_id)

    comment = Comment(
        target_type=data.target_type,
        target_id=data.target_id,
        author_id=current_user.id,
        content=data.content,
        is_system=False,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        target_type=comment.target_type,
        target_id=comment.target_id,
        author_id=comment.author_id,
        content=comment.content,
        is_system=comment.is_system,
        created_at=comment.created_at,
        author_name=current_user.full_name or current_user.email,
    )
