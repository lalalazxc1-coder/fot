from fastapi import APIRouter
from .settings import router as settings_router
from .hh import router as hh_router

router = APIRouter()
router.include_router(settings_router)
router.include_router(hh_router)
