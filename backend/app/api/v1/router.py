from fastapi import APIRouter
# Import từ folder 'endpoints' (số nhiều)
from app.api.v1.endpoints import cv 

api_router = APIRouter()

# Đăng ký router của CV vào đây
api_router.include_router(cv.router, prefix="/cv", tags=["CV Redactor"])