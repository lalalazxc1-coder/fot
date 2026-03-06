from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from database.database import get_db
from database.models import Candidate, Comment, OrganizationUnit, User, Vacancy
from dependencies import get_current_active_user
from schemas import (
    CandidateCreate,
    CandidateResponse,
    CandidateStageUpdate,
    CandidateUpdate,
    CandidateNotifyRequest,
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


def _can_change_assignee(current_user: User, vacancy: Vacancy) -> bool:
    if current_user.role_rel and current_user.role_rel.permissions.get("admin_access"):
        return True
    if current_user.id == vacancy.creator_id:
        return True
    return False


def _can_work_on_vacancy(current_user: User, vacancy: Vacancy) -> bool:
    if current_user.role_rel and current_user.role_rel.permissions.get("admin_access"):
        return True
    if current_user.id == vacancy.creator_id:
        return True
    if vacancy.assignee_id:
        if current_user.id == vacancy.assignee_id:
            return True
        return False
    # If no one is assigned yet, allow any recruiter to work on it (or self-assign)
    return True


@router.get("/vacancies", response_model=list[VacancyResponse])
def list_vacancies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Vacancy)
    if not _has_recruiting_permission(current_user):
        query = query.filter(Vacancy.creator_id == current_user.id)
    return query.order_by(Vacancy.id.desc()).all()


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
        assignee_id=data.assignee_id,
        position_name=data.position_name,
        description=data.description,
        salary_from=data.salary_from,
        salary_to=data.salary_to,
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
    vacancy = _ensure_vacancy_exists(db, vacancy_id)
    if not _has_recruiting_permission(current_user) and vacancy.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return vacancy


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
    
    # Check assignee change permissions
    if "assignee_id" in update_data and update_data["assignee_id"] != vacancy.assignee_id:
        if not _can_change_assignee(current_user, vacancy):
            raise HTTPException(status_code=403, detail="Только ответственный (создатель) может назначать или менять исполнителя")

    # For other changes, must be able to work on it
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

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
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

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
    if not current_user.role_rel.permissions.get("admin_access") and current_user.id != vacancy.creator_id:
        raise HTTPException(status_code=403, detail="Только создатель может удалить заявку")

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
    vacancy = _ensure_vacancy_exists(db, data.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

    candidate = Candidate(
        vacancy_id=data.vacancy_id,
        first_name=data.first_name,
        last_name=data.last_name,
        stage=data.stage,
        phone=data.phone,
        email=data.email,
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
    vacancy = _ensure_vacancy_exists(db, candidate.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

    update_data = data.model_dump(exclude_unset=True)
    if "vacancy_id" in update_data:
        new_vacancy = _ensure_vacancy_exists(db, update_data["vacancy_id"])
        if not _can_work_on_vacancy(current_user, new_vacancy):
            raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с новой заявкой")

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
    vacancy = _ensure_vacancy_exists(db, candidate.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

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
    vacancy = _ensure_vacancy_exists(db, candidate.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

    db.delete(candidate)
    db.commit()
    return {"status": "deleted"}


@router.post("/candidates/{candidate_id}/resume")
async def upload_resume(
    candidate_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    import os, uuid, pathlib
    _require_recruiting_permission(current_user)
    candidate = _ensure_candidate_exists(db, candidate_id)
    vacancy = _ensure_vacancy_exists(db, candidate.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

    # Validate file type
    allowed_types = {"application/pdf", "application/msword",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Только PDF и Word файлы (.pdf, .doc, .docx)")

    # Save file
    upload_root = os.environ.get("UPLOADS_DIR")
    if upload_root:
        upload_dir = pathlib.Path(upload_root) / "resumes"
    else:
        upload_dir = pathlib.Path(__file__).resolve().parents[1] / "uploads" / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = pathlib.Path(file.filename).suffix
    filename = f"{candidate_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = upload_dir / filename
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)

    resume_url = f"/uploads/resumes/{filename}"
    candidate.resume_url = resume_url
    db.commit()
    db.refresh(candidate)
    return {"resume_url": resume_url}


@router.post("/candidates/{candidate_id}/notify")
def notify_customer_about_candidate(
    candidate_id: int,
    data: CandidateNotifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_recruiting_permission(current_user)
    candidate = _ensure_candidate_exists(db, candidate_id)
    vacancy = _ensure_vacancy_exists(db, candidate.vacancy_id)
    if not _can_work_on_vacancy(current_user, vacancy):
        raise HTTPException(status_code=403, detail="Только назначенный исполнитель может работать с этой заявкой")

    customer_id = vacancy.creator_id

    author_name = current_user.full_name or current_user.email or f"User {current_user.id}"
    
    # System comment on candidate for recruiter log
    _create_system_comment(
        db=db,
        target_type="candidate",
        target_id=candidate.id,
        author_id=current_user.id,
        content=f"Уведомление заказчику от {author_name}: {data.message}",
    )

    # In-app notification for customer
    from database.models import Notification
    notification_msg = f"Рекрутер {author_name} сообщает по кандидату '{candidate.first_name} {candidate.last_name}' (заявка '{vacancy.title}'): {data.message}"
    notification = Notification(
        user_id=customer_id,
        message=notification_msg,
        link=f"/job-requests?vacancy_id={vacancy.id}"
    )
    db.add(notification)
    
    # Visible comment on vacancy so customer sees it in their discussion tab
    # Not system - so it appears as a real message from the recruiter
    db.add(Comment(
        target_type="vacancy",
        target_id=vacancy.id,
        author_id=current_user.id,
        content=f"По кандидату {candidate.first_name} {candidate.last_name}: {data.message}",
        is_system=False,
    ))
    db.commit()

    return {"status": "notified"}


@router.get("/comments", response_model=list[CommentResponse])
def list_comments(
    target_type: str = Query(...),
    target_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _validate_comment_target(db, target_type, target_id)
    
    if target_type == "vacancy" and not _has_recruiting_permission(current_user):
        vacancy = _ensure_vacancy_exists(db, target_id)
        if vacancy.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif target_type == "candidate" and not _has_recruiting_permission(current_user):
        # Normal users usually shouldn't see candidate comments, but if they must,
        # we can verify if they created the corresponding vacancy.
        raise HTTPException(status_code=403, detail="Forbidden")

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
    _validate_comment_target(db, data.target_type, data.target_id)
    
    if data.target_type == "vacancy" and not _has_recruiting_permission(current_user):
        vacancy = _ensure_vacancy_exists(db, data.target_id)
        if vacancy.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif data.target_type == "candidate" and not _has_recruiting_permission(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

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
