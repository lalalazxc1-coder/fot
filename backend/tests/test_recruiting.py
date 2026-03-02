def _vacancy_payload(org_structure):
    return {
        "title": "Backend Python Engineer",
        "department_id": org_structure["department"].id,
        "location": "Almaty",
        "planned_count": 2,
        "status": "Draft",
        "priority": "Medium",
    }


def test_recruiting_vacancy_crud(client, auth_headers, org_structure):
    create_resp = client.post("/api/vacancies", headers=auth_headers, json=_vacancy_payload(org_structure))
    assert create_resp.status_code == 200
    vacancy = create_resp.json()
    vacancy_id = vacancy["id"]
    assert vacancy["status"] == "Draft"

    list_resp = client.get("/api/vacancies", headers=auth_headers)
    assert list_resp.status_code == 200
    assert any(v["id"] == vacancy_id for v in list_resp.json())

    update_resp = client.put(
        f"/api/vacancies/{vacancy_id}",
        headers=auth_headers,
        json={"title": "Senior Backend Python Engineer", "planned_count": 3},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Senior Backend Python Engineer"
    assert update_resp.json()["planned_count"] == 3

    delete_resp = client.delete(f"/api/vacancies/{vacancy_id}", headers=auth_headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["status"] == "deleted"


def test_recruiting_candidate_crud(client, auth_headers, org_structure):
    vacancy_resp = client.post("/api/vacancies", headers=auth_headers, json=_vacancy_payload(org_structure))
    vacancy_id = vacancy_resp.json()["id"]

    create_candidate_resp = client.post(
        "/api/candidates",
        headers=auth_headers,
        json={"vacancy_id": vacancy_id, "first_name": "Amina", "last_name": "Sadykova", "stage": "New"},
    )
    assert create_candidate_resp.status_code == 200
    candidate = create_candidate_resp.json()
    candidate_id = candidate["id"]

    list_candidates_resp = client.get(f"/api/candidates?vacancy_id={vacancy_id}", headers=auth_headers)
    assert list_candidates_resp.status_code == 200
    assert any(c["id"] == candidate_id for c in list_candidates_resp.json())

    update_candidate_resp = client.put(
        f"/api/candidates/{candidate_id}",
        headers=auth_headers,
        json={"first_name": "Amina", "last_name": "Sadykova", "stage": "Interview"},
    )
    assert update_candidate_resp.status_code == 200
    assert update_candidate_resp.json()["stage"] == "Interview"

    delete_candidate_resp = client.delete(f"/api/candidates/{candidate_id}", headers=auth_headers)
    assert delete_candidate_resp.status_code == 200
    assert delete_candidate_resp.json()["status"] == "deleted"


def test_recruiting_system_comment_on_vacancy_status_change(client, auth_headers, org_structure, admin_user):
    vacancy_resp = client.post("/api/vacancies", headers=auth_headers, json=_vacancy_payload(org_structure))
    vacancy_id = vacancy_resp.json()["id"]

    status_resp = client.patch(
        f"/api/vacancies/{vacancy_id}/status",
        headers=auth_headers,
        json={"status": "Open"},
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "Open"

    comments_resp = client.get(
        f"/api/comments?target_type=vacancy&target_id={vacancy_id}",
        headers=auth_headers,
    )
    assert comments_resp.status_code == 200
    comments = comments_resp.json()
    assert len(comments) == 1
    assert comments[0]["is_system"] is True
    assert comments[0]["content"] == f"Система: Статус вакансии изменен на 'Open' (Автор: {admin_user.full_name})"


def test_recruiting_system_comment_on_candidate_stage_change(client, auth_headers, org_structure, admin_user):
    vacancy_resp = client.post("/api/vacancies", headers=auth_headers, json=_vacancy_payload(org_structure))
    vacancy_id = vacancy_resp.json()["id"]
    candidate_resp = client.post(
        "/api/candidates",
        headers=auth_headers,
        json={"vacancy_id": vacancy_id, "first_name": "Ali", "last_name": "Kaliyev", "stage": "New"},
    )
    candidate_id = candidate_resp.json()["id"]

    stage_resp = client.patch(
        f"/api/candidates/{candidate_id}/stage",
        headers=auth_headers,
        json={"stage": "Offer"},
    )
    assert stage_resp.status_code == 200
    assert stage_resp.json()["stage"] == "Offer"

    comments_resp = client.get(
        f"/api/comments?target_type=candidate&target_id={candidate_id}",
        headers=auth_headers,
    )
    assert comments_resp.status_code == 200
    comments = comments_resp.json()
    assert len(comments) == 1
    assert comments[0]["is_system"] is True
    assert comments[0]["content"] == f"Система: Этап кандидата изменен на 'Offer' (Автор: {admin_user.full_name})"


def test_recruiting_manual_comment_and_target_validation(client, auth_headers, org_structure):
    vacancy_resp = client.post("/api/vacancies", headers=auth_headers, json=_vacancy_payload(org_structure))
    vacancy_id = vacancy_resp.json()["id"]

    create_comment_resp = client.post(
        "/api/comments",
        headers=auth_headers,
        json={"target_type": "vacancy", "target_id": vacancy_id, "content": "Провести интервью на неделе"},
    )
    assert create_comment_resp.status_code == 200
    body = create_comment_resp.json()
    assert body["is_system"] is False
    assert body["target_type"] == "vacancy"

    not_found_resp = client.post(
        "/api/comments",
        headers=auth_headers,
        json={"target_type": "vacancy", "target_id": 99999, "content": "test"},
    )
    assert not_found_resp.status_code == 404


def test_recruiting_requires_permissions(client, viewer_headers, org_structure):
    resp = client.post("/api/vacancies", headers=viewer_headers, json=_vacancy_payload(org_structure))
    assert resp.status_code == 403
