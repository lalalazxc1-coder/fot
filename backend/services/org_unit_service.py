"""
FIX C3: Shared organizational unit utilities.
Provides reusable functions for hierarchy traversal, avoiding N+1 queries.
"""
from sqlalchemy.orm import Session
from database.models import OrganizationUnit
from typing import Dict, List, Set, Optional


def build_children_map(db: Session) -> Dict[int, List[int]]:
    """
    Pre-fetch ALL org units and build a parent->children map in memory.
    Call this ONCE per request, then use get_all_descendant_ids.
    """
    rows = db.query(OrganizationUnit.id, OrganizationUnit.parent_id).all()
    children_map: Dict[int, List[int]] = {}
    for uid, pid in rows:
        if pid is not None:
            if pid not in children_map:
                children_map[pid] = []
            children_map[pid].append(uid)
    return children_map


def get_all_descendant_ids(unit_id: int, children_map: Dict[int, List[int]]) -> Set[int]:
    """
    Get all descendant IDs for a given unit, using pre-built children_map.
    O(n) total across all calls, no SQL queries.
    """
    descendants = set()
    to_process = list(children_map.get(unit_id, []))
    while to_process:
        current = to_process.pop()
        if current not in descendants:
            descendants.add(current)
            to_process.extend(children_map.get(current, []))
    return descendants


def get_unit_with_descendants(unit_id: int, children_map: Dict[int, List[int]]) -> List[int]:
    """
    Returns [unit_id] + all descendant IDs.
    Convenience wrapper for get_all_descendant_ids.
    """
    return [unit_id] + list(get_all_descendant_ids(unit_id, children_map))
