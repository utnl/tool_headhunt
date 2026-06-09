import os
import tempfile
import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from playwright.async_api import async_playwright, Browser
from pathlib import Path

# Biến toàn cục để giữ Browser instance
browser: Browser = None
playwright_instance = None

# Quản lý vòng đời ứng dụng (Khởi động browser 1 lần duy nhất)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global browser, playwright_instance
    playwright_instance = await async_playwright().start()
    # Khởi động browser ở chế độ headless
    browser = await playwright_instance.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-setuid-sandbox"] # Cần thiết cho Docker/Linux
    )
    yield
    # Dọn dẹp khi tắt app
    await browser.close()
    await playwright_instance.stop()

app = FastAPI(lifespan=lifespan)
router = APIRouter()

def cleanup_file(path: str):
    """Xóa file tạm sau khi response xong."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"Error removing file {path}: {e}")

@router.post("/convert")
async def convert_html_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    if not file.filename.endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Only HTML files are allowed")

    # Tạo tên file tạm
    temp_id = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    temp_html_path = os.path.join(temp_dir, f"{temp_id}.html")
    temp_pdf_path = os.path.join(temp_dir, f"{temp_id}.pdf")

    try:
        # 1. Lưu file HTML
        content = await file.read()
        # Mẹo: Thêm thẻ base để fix lỗi asset nếu cần, hoặc filter nội dung độc hại ở đây
        with open(temp_html_path, "wb") as f:
            f.write(content)

        file_url = Path(temp_html_path).as_uri()

        # 2. Sử dụng Browser đã khởi tạo sẵn (Nhanh hơn rất nhiều)
        # Tạo context mới cho mỗi request để đảm bảo cách ly session/cookies
        context = await browser.new_context(device_scale_factor=2)
        page = await context.new_page()

        try:
            # 3. Render HTML
            await page.goto(file_url, wait_until="networkidle")

            # Tính toán chiều cao
            dimensions = await page.evaluate("""() => {
                return {
                    width: document.body.scrollWidth,
                    height: document.documentElement.scrollHeight
                }
            }""")
            
            width = dimensions['width']
            height = dimensions['height'] + 50

            # In PDF
            await page.pdf(
                path=temp_pdf_path,
                width=f"{width}px",
                height=f"{height}px",
                print_background=True,
                margin={"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"}
            )
        finally:
            # Đóng page để giải phóng RAM ngay lập tức
            await page.close()
            await context.close()

        if not os.path.exists(temp_pdf_path):
            raise HTTPException(status_code=500, detail="Failed to generate PDF")

        output_filename = f"{Path(file.filename).stem}_infinite.pdf"

        # Cleanup tasks
        background_tasks.add_task(cleanup_file, temp_html_path)
        background_tasks.add_task(cleanup_file, temp_pdf_path)

        return FileResponse(
            path=temp_pdf_path,
            filename=output_filename,
            media_type='application/pdf'
        )

    except Exception as e:
        # Dọn dẹp nếu lỗi xảy ra
        cleanup_file(temp_html_path)
        cleanup_file(temp_pdf_path)
        # Log lỗi chi tiết ra console
        print(f"Error converting PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(router)