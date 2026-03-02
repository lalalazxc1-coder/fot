"""
FIX #M4: Централизованные утилиты для работы с датами.
Единый формат для всех новых записей — ISO 8601 UTC isoformat().
Существующие данные не трогаем (обратная совместимость).
"""
from datetime import datetime, timezone


def now_iso() -> str:
    """
    Возвращает текущую дату/время в UTC ISO 8601 формате.
    Пример: '2026-02-25T09:54:00.123456+00:00'
    
    Используй этот формат для ВСЕХ новых записей дат в БД.
    Это гарантирует корректную сортировку (лексикографическую = хронологическую).
    """
    return datetime.now(timezone.utc).isoformat()


def now_display() -> str:
    """
    Дата/время в читаемом формате для отображения пользователю.
    Используется в AuditLog.timestamp для совместимости с существующим frontend.
    Пример: '25.02.2026 09:54'
    """
    return datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M")


def parse_date_flexible(date_str: str | None) -> datetime | None:
    """
    Парсит дату из любого формата, использованного в проекте.
    Поддерживает: ISO 8601, 'DD.MM.YYYY HH:MM', 'YYYY-MM-DD'.
    Возвращает None если строка пустая или не парсится.
    """
    if not date_str:
        return None

    value = date_str.strip()
    if not value:
        return None

    iso_candidate = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(iso_candidate)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass

    formats = [
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    return None


def to_utc_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt

    return parse_date_flexible(value)


def to_iso_utc(value: str | datetime | None) -> str | None:
    dt = to_utc_datetime(value)
    return dt.isoformat() if dt else None
