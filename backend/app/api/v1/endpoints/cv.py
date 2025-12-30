import json
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response
# Import các hàm logic từ file logic.py
from app.services.cv_redactor.logic import process_cv, generate_pdf_preview, process_manual, get_pdf_info

# 👇 DÒNG QUAN TRỌNG BỊ THIẾU CỦA BẠN ĐÂY
router = APIRouter() 

# ---------------------------------------------------------
# API 1: Auto Redact (Chế độ tự động)
# ---------------------------------------------------------
@router.post("/redact")
def redact_cv_endpoint(file: UploadFile = File(...)):
    try:
        # Đọc file
        file_content = file.file.read()
        
        # Gọi logic xử lý tự động (V25)
        processed_bytes = process_cv(file_content)
        
        # Mã hóa tên file để tránh lỗi tiếng Việt
        safe_filename = quote(f"redacted_{file.filename}")
        
        return Response(
            content=processed_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
        )
    except Exception as e:
        print(f"Auto Redact Error: {e}")
        return {"error": str(e)}

# ---------------------------------------------------------
# API 2: Get Info (Lấy số trang)
# ---------------------------------------------------------
@router.post("/info")
def get_pdf_info_endpoint(file: UploadFile = File(...)):
    try:
        file.file.seek(0)
        content = file.file.read()
        info = get_pdf_info(content)
        return info # Trả về {"total_pages": ...}
    except Exception as e:
        return {"error": str(e)}

# ---------------------------------------------------------
# API 3: Preview (Tạo ảnh xem trước cho Manual Mode)
# ---------------------------------------------------------
@router.post("/preview")
def preview_cv_endpoint(
    file: UploadFile = File(...), 
    page: str = Form("0")
):
    try:
        file.file.seek(0)
        file_content = file.file.read()
        
        # Chuyển page từ string sang int
        page_num = int(page)
        
        img_bytes = generate_pdf_preview(file_content, page_num)
        
        if img_bytes is None:
            return {"error": "Page number out of range"}
            
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        return {"error": str(e)}

# ---------------------------------------------------------
# API 4: Manual Redact (Xử lý xóa thủ công)
# ---------------------------------------------------------
@router.post("/redact-manual")
def redact_manual_endpoint(
    file: UploadFile = File(...),
    boxes: str = Form(...),
    color: str = Form(...),
    snapping: str = Form(...) 
):
    try:
        file.file.seek(0)
        file_content = file.file.read()
        
        # Parse dữ liệu từ Frontend
        boxes_list = json.loads(boxes)
        is_snapping = snapping.lower() == 'true'
        
        # Gọi logic xử lý thủ công
        processed_bytes = process_manual(file_content, boxes_list, color, is_snapping)
        
        safe_filename = quote(f"manual_redacted_{file.filename}")
        
        return Response(
            content=processed_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
        )
    except Exception as e:
        print(f"Manual Error: {e}")
        return {"error": str(e)}