from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.cloudinary_service import upload_cv, delete_cv

router = APIRouter()

# ---------------------------------------------------------
# API: Upload CV to Cloudinary
# ---------------------------------------------------------
@router.post("/cv")
async def upload_cv_endpoint(file: UploadFile = File(...)):
    """
    Upload a CV file to Cloudinary storage.
    
    Accepts: PDF files
    Returns: { success, url, public_id, original_name, size, created_at }
    """
    # Validate file type
    allowed_types = ["application/pdf", "application/msword", 
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Only PDF and Word documents are allowed."
        )
    
    # Read file content
    file_content = await file.read()
    
    # Check file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )
    
    # Upload to Cloudinary
    result = upload_cv(file_content, file.filename)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Upload failed"))
    
    return result


# ---------------------------------------------------------
# API: Delete CV from Cloudinary
# ---------------------------------------------------------
@router.delete("/cv/{public_id:path}")
async def delete_cv_endpoint(public_id: str):
    """
    Delete a CV file from Cloudinary storage.
    
    Args:
        public_id: The Cloudinary public_id (e.g., cvs/2026/01/filename_123456)
    """
    result = delete_cv(public_id)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Delete failed"))
    
    return {"message": "CV deleted successfully", "public_id": public_id}
