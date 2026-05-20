from fastapi import APIRouter

from app.api.billing import router as billing_router
from app.api.labels import router as labels_router

api_router = APIRouter()
api_router.include_router(labels_router, prefix="/labels", tags=["labels"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])
