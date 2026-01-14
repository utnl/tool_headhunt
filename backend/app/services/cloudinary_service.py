import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_cv(file_bytes: bytes, filename: str) -> dict:
    """
    Upload CV file to Cloudinary
    
    Args:
        file_bytes: The file content as bytes
        filename: Original filename
        
    Returns:
        dict with url, public_id, original_name
    """
    # Generate unique folder path by date
    date_folder = datetime.now().strftime("%Y/%m")
    
    # Remove extension for public_id
    name_without_ext = os.path.splitext(filename)[0]
    
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=f"cvs/{date_folder}",
            public_id=f"{name_without_ext}_{datetime.now().strftime('%H%M%S')}",
            resource_type="raw",  # For PDF files
            format="pdf"
        )
        
        return {
            "success": True,
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "original_name": filename,
            "size": result.get("bytes", 0),
            "created_at": result.get("created_at")
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def delete_cv(public_id: str) -> dict:
    """
    Delete CV file from Cloudinary
    
    Args:
        public_id: The Cloudinary public_id of the file
        
    Returns:
        dict with success status
    """
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="raw")
        return {
            "success": result.get("result") == "ok",
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
