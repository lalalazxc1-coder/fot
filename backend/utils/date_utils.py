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
    formats = [
        "%Y-%m-%dT%H:%M:%S.%f%z",  # ISO с timezone
        "%Y-%m-%dT%H:%M:%S%z",      # ISO с timezone (без µs)
        "%Y-%m-%dT%H:%M:%S.%f",     # ISO без timezone
        "%Y-%m-%dT%H:%M:%S",        # ISO без timezone (без µs)
        "%d.%m.%Y %H:%M",           # Старый формат проекта
        "%d.%m.%Y",                  # Дата без времени
        "%Y-%m-%d",                  # ISO дата
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None
