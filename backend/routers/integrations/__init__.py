from fastapi import APIRouter
from .settings import router as settings_router
from .hh import router as hh_router
from .onec import router as onec_router

router = APIRouter()
router.include_router(settings_router)  # settings already has /api/integrations
router.include_router(onec_router, prefix="/api/integrations/onec") 
router.include_router(hh_router) # assuming hh behaves like settings or handle it accordingly
