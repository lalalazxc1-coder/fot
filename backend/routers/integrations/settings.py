import logging
from requests import RequestException
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List, Optional, cast
from pydantic import BaseModel, ConfigDict, Field
from database.models import IntegrationSettings
from dependencies import get_db, require_admin
from utils.date_utils import now_iso, to_utc_datetime
from utils.outbound_http import request_with_retry
from utils.secret_store import decrypt_secret, encrypt_secret, is_secret_encrypted
from utils.security.url_guard import UnsafeOutboundUrlError, validate_outbound_base_url

router = APIRouter(prefix="/api/integrations", tags=["integrations"])
logger = logging.getLogger("fot.integrations")


def _sanitize_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _touch_updated_at(setting_row: Any) -> None:
    now = now_iso()
    setting_row.updated_at = now
    setting_row.updated_at_dt = to_utc_datetime(now)


def _ensure_setting_secrets_encrypted(setting_row: Any) -> bool:
    changed = False

    raw_api_key = _sanitize_secret(setting_row.api_key)
    if raw_api_key != setting_row.api_key:
        setting_row.api_key = raw_api_key
        changed = True
    if raw_api_key and not is_secret_encrypted(raw_api_key):
        setting_row.api_key = encrypt_secret(raw_api_key)
        changed = True

    raw_client_secret = _sanitize_secret(setting_row.client_secret)
    if raw_client_secret != setting_row.client_secret:
        setting_row.client_secret = raw_client_secret
        changed = True
    if raw_client_secret and not is_secret_encrypted(raw_client_secret):
        setting_row.client_secret = encrypt_secret(raw_client_secret)
        changed = True

    return changed


def _hh_test_error_message(status_code: int) -> str:
    if status_code in {400, 401, 403}:
        return "Не удалось авторизоваться в HH. Проверьте Client ID и Client Secret."
    if status_code == 429:
        return "HH временно ограничил количество запросов. Попробуйте позже."
    if status_code >= 500:
        return "Сервис HH временно недоступен. Попробуйте позже."
    return "Не удалось проверить подключение к HH."


def _ai_test_error_message(status_code: int) -> str:
    if status_code in {400, 401, 403}:
        return "Не удалось авторизоваться у AI-провайдера. Проверьте API ключ и Base URL."
    if status_code == 429:
        return "Превышен лимит запросов к AI-провайдеру. Попробуйте позже."
    if status_code >= 500:
        return "AI-провайдер временно недоступен. Попробуйте позже."
    return "Не удалось проверить подключение к AI-провайдеру."


def _ai_analyze_error_message(status_code: int) -> str:
    if status_code in {400, 401, 403}:
        return "Не удалось выполнить запрос к AI-провайдеру. Проверьте настройки интеграции."
    if status_code == 429:
        return "Превышен лимит запросов к AI-провайдеру. Попробуйте позже."
    return "AI-провайдер временно недоступен. Попробуйте позже."


class IntegrationSettingsUpdate(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_active: bool
    additional_params: Optional[dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")


class IntegrationSettingsResponse(BaseModel):
    id: int
    service_name: str
    is_active: bool
    has_api_key: bool
    has_client_secret: bool
    client_id: Optional[str] = None
    updated_at: str

    model_config = ConfigDict(extra="forbid")


class TestConnectionRequest(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    base_url: Optional[str] = Field(None, max_length=512)

    model_config = ConfigDict(extra="forbid")


class TestConnectionResponse(BaseModel):
    success: bool
    message: str

    model_config = ConfigDict(extra="forbid")


class AnalyzeRequest(BaseModel):
    candidate_data: dict[str, Any]
    job_description: Optional[str] = Field(None, max_length=10000)

    model_config = ConfigDict(extra="forbid")


class AnalyzeResponse(BaseModel):
    analysis: str
    match_score: int

    model_config = ConfigDict(extra="forbid")

@router.get("/settings", response_model=List[IntegrationSettingsResponse])
def get_integration_settings(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    """Get all integration settings (masked)"""
    # Check if admin (optional, for now open to active users or restrict to admin)
    
    settings = db.query(IntegrationSettings).all()
    response = []
    
    # Ensure default entries exist if not found (lazy init)
    services = ['hh', 'openai', 'onec']
    existing_services = [s.service_name for s in settings]
    
    for service in services:
        if service not in existing_services:
            new_setting = IntegrationSettings(service_name=service)
            db.add(new_setting)
            db.commit()
            db.refresh(new_setting)
            settings.append(new_setting)

    has_migrations = False
    for s in settings:
        s_row = cast(Any, s)
        if _ensure_setting_secrets_encrypted(s_row):
            _touch_updated_at(s_row)
            has_migrations = True

    if has_migrations:
        db.commit()
        for s in settings:
            db.refresh(s)
            
    for s in settings:
        s_row = cast(Any, s)
        s_api_key = decrypt_secret(s_row.api_key)
        s_client_secret = decrypt_secret(s_row.client_secret)
        response.append({
            "id": s.id,
            "service_name": s.service_name,
            "is_active": s.is_active,
            "has_api_key": bool(s_api_key),
            "has_client_secret": bool(s_client_secret),
            "client_id": s_row.client_id,
            "updated_at": s.updated_at
        })
        
    return response

@router.post("/settings", response_model=IntegrationSettingsResponse)
def update_integration_settings(
    data: IntegrationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Update settings for a service"""
    # In real app: Add permission check!
    
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == data.service_name).first()
    if setting is None:
        setting = IntegrationSettings(service_name=data.service_name)
        db.add(setting)
    setting_row = cast(Any, setting)
    
    # Update fields only if provided (to allow partial updates without re-sending secrets)
    if data.api_key is not None: # Allow clearing if empty string passed? Or explicit null? treating non-None as update
        setting_row.api_key = encrypt_secret(data.api_key)
    if data.client_id is not None:
        setting_row.client_id = str(data.client_id).strip() or None
    if data.client_secret is not None:
        setting_row.client_secret = encrypt_secret(data.client_secret)

    _ensure_setting_secrets_encrypted(setting_row)

    normalized_params = data.additional_params if isinstance(data.additional_params, dict) else {}
    if "base_url" in normalized_params and normalized_params.get("base_url") is None:
        normalized_params.pop("base_url", None)

    if "base_url" in normalized_params:
        try:
            normalized_params["base_url"] = validate_outbound_base_url(
                str(normalized_params.get("base_url") or ""),
                data.service_name,
            )
        except UnsafeOutboundUrlError as exc:
            raise HTTPException(status_code=400, detail=f"Некорректный Base URL: {exc}")
        
    setting_row.is_active = data.is_active
    if data.additional_params is not None:
        setting_row.additional_params = normalized_params

    _touch_updated_at(setting_row)
        
    db.commit()
    db.refresh(setting)
    
    return {
        "id": setting.id,
        "service_name": setting.service_name,
        "is_active": setting.is_active,
        "has_api_key": bool(setting_row.api_key),
        "has_client_secret": bool(setting_row.client_secret),
        "client_id": setting_row.client_id,
        "updated_at": setting.updated_at
    }

@router.post("/test-connection", response_model=TestConnectionResponse)
def test_connection(
    data: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == data.service_name).first()
    if setting is None:
        setting = IntegrationSettings(service_name=data.service_name)
    setting_row = cast(Any, setting)

    if _ensure_setting_secrets_encrypted(setting_row):
        _touch_updated_at(setting_row)
        if getattr(setting_row, "id", None) is not None:
            db.commit()
            db.refresh(setting)

    # Use provided keys if available, else fallback to DB
    client_id_raw = data.client_id if data.client_id is not None else setting_row.client_id
    client_secret_raw = data.client_secret if data.client_secret is not None else decrypt_secret(setting_row.client_secret)
    api_key_raw = data.api_key if data.api_key is not None else decrypt_secret(setting_row.api_key)
    client_id = str(client_id_raw).strip() if client_id_raw else None
    client_secret = str(client_secret_raw).strip() if client_secret_raw else None
    api_key = str(api_key_raw).strip() if api_key_raw else None

    if data.service_name == 'hh':
        if not client_id or not client_secret:
             return {"success": False, "message": "Client ID and Client Secret are required"}
        
        # Test HH connection by trying to get an access token (client credentials flow)
        try:
            token_url = "https://hh.ru/oauth/token"
            payload = {
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret
            }
            # HH requires User-Agent
            headers = {"User-Agent": "FOT-Manager/1.0 (test@example.com)"}

            resp = request_with_retry(
                "POST",
                token_url,
                data=payload,
                headers=headers,
                timeout=5,
                retries=2,
                backoff_seconds=0.15,
            )

            if resp.status_code == 200:
                 return {"success": True, "message": "Connection successful! Token received."}

            logger.warning("HH test connection failed with status %s", resp.status_code)
            return {"success": False, "message": _hh_test_error_message(resp.status_code)}

        except RequestException:
            logger.exception("HH test connection request failed")
            return {"success": False, "message": "Не удалось подключиться к HH. Попробуйте позже."}

    elif data.service_name == 'openai':
        if not api_key:
             return {"success": False, "message": "API Key is required"}
        
        # Determine base URL: Priority: Request param > DB param > default OpenAI
        setting_params = setting_row.additional_params if isinstance(setting_row.additional_params, dict) else {}
        raw_base_url = data.base_url or (setting_params or {}).get('base_url') or "https://api.openai.com/v1"
        try:
            base_url = validate_outbound_base_url(str(raw_base_url), data.service_name)
        except UnsafeOutboundUrlError as exc:
            return {"success": False, "message": f"Некорректный Base URL: {exc}"}
        
        try:
            # Simple models list call
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            # Use /models for testing general connectivity
            test_url = f"{base_url}/models"
            resp = request_with_retry(
                "GET",
                test_url,
                headers=headers,
                timeout=10,
                retries=2,
                backoff_seconds=0.2,
            )

            if resp.status_code == 200:
                provider = "DeepSeek" if "deepseek" in base_url.lower() else ("OpenRouter" if "openrouter" in base_url.lower() else "AI")
                return {"success": True, "message": f"Соединение с {provider} успешно установлено!"}

            logger.warning("AI test connection failed with status %s", resp.status_code)
            return {"success": False, "message": _ai_test_error_message(resp.status_code)}

        except RequestException:
            logger.exception("AI test connection request failed")
            return {"success": False, "message": "Не удалось подключиться к AI-провайдеру. Попробуйте позже."}

    elif data.service_name == 'onec':
        # Default base_url from request or DB
        setting_params = setting_row.additional_params if isinstance(setting_row.additional_params, dict) else {}
        base_url = data.base_url or (setting_params or {}).get('base_url')
        
        if not base_url:
            return {"success": False, "message": "Base URL is required (e.g. http://192.168.1.10/mybase)"}

        try:
            base_url = validate_outbound_base_url(str(base_url), data.service_name)
        except UnsafeOutboundUrlError as exc:
            return {"success": False, "message": f"Некорректный Base URL: {exc}"}
        
        from services.onec_service import OneCService
        service = OneCService(base_url, client_id, client_secret)
        
        try:
            if service.test_connection():
                return {"success": True, "message": "Соединение с 1С успешно установлено!"}
            else:
                return {"success": False, "message": "Не удалось получить данные из 1С. Проверьте URL и учетные данные."}
        except Exception:
            logger.exception("1C test connection failed")
            return {"success": False, "message": "Не удалось подключиться к 1С. Проверьте URL и учетные данные."}

    return {"success": False, "message": "Unknown service"}

@router.post("/ai-analyze", response_model=AnalyzeResponse)
def ai_analyze(
    data: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin) # Keep it simple? Or change back to get_current_active_user if managers need it!
):
    """Real AI Analysis using configured provider"""
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == 'openai').first()
    if setting is None:
        raise HTTPException(status_code=400, detail="AI Integration not configured")

    setting_row = cast(Any, setting)
    if _ensure_setting_secrets_encrypted(setting_row):
        _touch_updated_at(setting_row)
        db.commit()
        db.refresh(setting)

    api_key = str(decrypt_secret(setting_row.api_key) or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="AI Integration not configured")

    setting_params = setting_row.additional_params if isinstance(setting_row.additional_params, dict) else {}
    try:
        base_url = validate_outbound_base_url(
            str((setting_params or {}).get('base_url') or "https://api.openai.com/v1"),
            "openai",
        )
    except UnsafeOutboundUrlError:
        raise HTTPException(status_code=400, detail="Некорректный Base URL AI-интеграции.")

    prompt = f"""
    Проанализируй кандидата для вакансии.
    Кандидат: {data.candidate_data}
    
    Требования: {data.job_description or "Соответствие общим техническим требованиям"}
    
    Дай краткий профессиональный вывод (2-3 предложения) и оценку соответствия от 0 до 100.
    Ответ верни СТРОГО в формате JSON:
    {{"analysis": "текст вывода", "match_score": 85}}
    """

    try:
        payload = {
            "model": "gpt-3.5-turbo" if "openai" in base_url else "deepseek-chat", # Default fallback
            "messages": [
                {"role": "system", "content": "Ты профессиональный HR-ассистент."},
                {"role": "user", "content": prompt}
            ]
        }

        # response_format only supported by some
        if "openai" in base_url.lower() or "deepseek" in base_url.lower():
             payload["response_format"] = { "type": "json_object" }

        # Adjust for OpenRouter/DeepSeek default models
        if "openrouter" in base_url.lower():
            payload["model"] = "openai/gpt-3.5-turbo"
        elif "deepseek" in base_url.lower():
            payload["model"] = "deepseek-chat"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        try:
            resp = request_with_retry(
                "POST",
                f"{base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=30,
                retries=2,
                backoff_seconds=0.2,
            )
        except RequestException:
            logger.exception("AI analyze request failed")
            raise HTTPException(status_code=502, detail="AI-провайдер временно недоступен. Попробуйте позже.")

        if resp.status_code != 200:
            logger.warning("AI analyze failed with status %s", resp.status_code)
            raise HTTPException(
                status_code=429 if resp.status_code == 429 else 502,
                detail=_ai_analyze_error_message(resp.status_code),
            )

        result = resp.json()
        content = result['choices'][0]['message']['content']

        import json
        try:
            # Clean possible markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            ai_data = json.loads(content)
            return AnalyzeResponse(**ai_data)
        except Exception:
            logger.info("AI analyze returned non-JSON payload; using fallback response")
            return AnalyzeResponse(analysis=content, match_score=70)

    except HTTPException:
        raise
    except Exception:
        logger.exception("AI analyze failed unexpectedly")
        raise HTTPException(status_code=500, detail="Не удалось выполнить анализ кандидата. Попробуйте позже.")
