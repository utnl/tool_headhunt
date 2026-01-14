from fastapi import APIRouter
# Import từ folder 'endpoints' (số nhiều)
from app.api.v1.endpoints import cv, upload

api_router = APIRouter()

# Đăng ký router của CV vào đây
api_router.include_router(cv.router, prefix="/cv", tags=["CV Redactor"])
api_router.include_router(upload.router, prefix="/upload", tags=["Upload"])