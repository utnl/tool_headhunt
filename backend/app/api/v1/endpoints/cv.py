import json
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response
# Import đủ 3 hàm từ logic.py
from app.services.cv_redactor.logic import process_cv, generate_pdf_preview, process_manual

router = APIRouter()

# API 1: Auto Redact
@router.post("/redact")
def redact_cv_endpoint(file: UploadFile = File(...)):
    # ... code xử lý auto ...
    file_content = file.file.read()
    processed_bytes = process_cv(file_content)
    safe_filename = quote(f"redacted_{file.filename}")
    return Response(content=processed_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={safe_filename}"})

# API 2: Preview Image (Đây là cái bạn đang thiếu/bị lỗi)
@router.post("/preview")
def preview_cv_endpoint(file: UploadFile = File(...)):
    try:
        file.file.seek(0)
        file_content = file.file.read()
        img_bytes = generate_pdf_preview(file_content)
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        print(f"Preview Error: {e}")
        return {"error": str(e)}

# API 3: Manual Redact
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
        boxes_list = json.loads(boxes)
        # Chuyển string 'true'/'false' thành boolean
        is_snapping = snapping.lower() == 'true'
        
        processed_bytes = process_manual(file_content, boxes_list, color, is_snapping)
        
        safe_filename = quote(f"manual_redacted_{file.filename}")
        return Response(content=processed_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={safe_filename}"})
    except Exception as e:
        print(f"Manual Error: {e}")
        return {"error": str(e)}