import os
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from playwright.sync_api import sync_playwright
from pathlib import Path

router = APIRouter()

# Thread pool for running sync Playwright
executor = ThreadPoolExecutor(max_workers=2)

def cleanup_file(path: str):
    """Deletes the temporary file after response."""
    if os.path.exists(path):
        try:
            os.remove(path)
        except:
            pass

def _convert_html_to_pdf_sync(html_path: str, pdf_path: str):
    """
    Synchronous function that runs Playwright to convert HTML to PDF.
    This runs in a separate thread.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(device_scale_factor=2)
        page = context.new_page()

        # Load the local HTML file
        file_url = Path(html_path).as_uri()
        print(f"Navigating to: {file_url}")  # Debug log

        page.goto(file_url, wait_until="networkidle")

        # Calculate content dimensions
        dimensions = page.evaluate("""() => {
            const body = document.body;
            return {
                width: body.scrollWidth,
                height: document.documentElement.scrollHeight
            }
        }""")

        width = dimensions['width']
        height = dimensions['height'] + 50  # Add some padding

        print(f"PDF dimensions: {width}x{height}")

        # Print PDF
        page.pdf(
            path=pdf_path,
            width=f"{width}px",
            height=f"{height}px",
            print_background=True,
            margin={
                "top": "0px",
                "right": "0px",
                "bottom": "0px",
                "left": "0px"
            }
        )
        browser.close()

    return pdf_path


@router.post("/convert")
async def convert_html_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Receives an HTML file, converts it to an infinite-scroll PDF using Playwright,
    and returns the PDF file.
    """
    if not file.filename.endswith(".html") and not file.filename.endswith(".htm"):
        raise HTTPException(status_code=400, detail="Only HTML files are allowed")

    # Create temporary files for input HTML and output PDF
    temp_filename = str(uuid.uuid4())
    temp_html_path = os.path.join(tempfile.gettempdir(), f"{temp_filename}.html")
    temp_pdf_path = os.path.join(tempfile.gettempdir(), f"{temp_filename}.pdf")

    try:
        # Save uploaded HTML to temp file
        content = await file.read()
        with open(temp_html_path, "wb") as f:
            f.write(content)

        # Run Playwright conversion in a separate thread
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            _convert_html_to_pdf_sync,
            temp_html_path,
            temp_pdf_path
        )

        # Check if PDF generated
        if not os.path.exists(temp_pdf_path):
            raise HTTPException(status_code=500, detail="Failed to generate PDF")

        # Determine output filename
        original_name = file.filename.rsplit('.', 1)[0]
        output_filename = f"{original_name}_infinite.pdf"

        # Register cleanup tasks
        background_tasks.add_task(cleanup_file, temp_html_path)
        background_tasks.add_task(cleanup_file, temp_pdf_path)

        return FileResponse(
            path=temp_pdf_path,
            filename=output_filename,
            media_type='application/pdf'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()

        # Cleanup on error
        cleanup_file(temp_html_path)
        cleanup_file(temp_pdf_path)

        error_detail = str(e) or "Unknown error occurred"
        raise HTTPException(status_code=500, detail=error_detail)
