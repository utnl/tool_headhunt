from fastapi import APIRouter
# Import từ folder 'endpoints' (số nhiều)
from app.api.v1.endpoints import cv, upload, html_to_pdf

api_router = APIRouter()

# Đăng ký router của CV vào đây
api_router.include_router(cv.router, prefix="/cv", tags=["CV Redactor"])
api_router.include_router(upload.router, prefix="/upload", tags=["Upload"])
api_router.include_router(html_to_pdf.router, prefix="/html-to-pdf", tags=["HTML to PDF"])