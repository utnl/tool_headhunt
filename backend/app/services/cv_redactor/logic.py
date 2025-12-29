import fitz  # PyMuPDF
import re
from collections import Counter
import math

# ==========================================
# PHẦN 1: LOGIC AUTO (V14 - THE BLOB)
# ==========================================

# CẤU HÌNH
MAX_ICON_DISTANCE = 60   
MAX_ICON_SIZE = 45       
PADDING_RIGHT = 10       
PADDING_LEFT_NO_ICON = 2 

def is_color_similar(c1, c2, threshold=25):
    return math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) < threshold

def get_surgical_color_v14(page, rect, page_width):
    try:
        safe_y0 = rect.y0 + 2
        safe_y1 = rect.y1 - 2
        if safe_y1 <= safe_y0: safe_y0, safe_y1 = rect.y0, rect.y1

        sample_rect = fitz.Rect(rect.x1 + 2, safe_y0, rect.x1 + 20, safe_y1)
        if sample_rect.x1 > page_width:
             sample_rect = fitz.Rect(rect.x0 - 20, safe_y0, rect.x0 - 2, safe_y1)

        pix = page.get_pixmap(clip=sample_rect)
        if pix.width < 1 or pix.height < 1:
             pix = page.get_pixmap(clip=fitz.Rect(rect.x0, rect.y0, rect.x0 + 2, rect.y0 + 2))

        samples = pix.samples
        raw_pixels = []
        for i in range(0, len(samples), 3):
            raw_pixels.append((samples[i], samples[i+1], samples[i+2]))

        if not raw_pixels: return (1, 1, 1)

        most_common = Counter(raw_pixels).most_common(1)[0][0]
        
        clean_pixels = []
        r_sum, g_sum, b_sum = 0, 0, 0
        for p in raw_pixels:
            if is_color_similar(p, most_common, threshold=30):
                clean_pixels.append(p)
                r_sum += p[0]
                g_sum += p[1]
                b_sum += p[2]
        
        count = len(clean_pixels)
        if count == 0: return (1, 1, 1)

        return ((r_sum/count)/255, (g_sum/count)/255, (b_sum/count)/255)
    except:
        return (1, 1, 1)

def get_mask_rect_v14_the_blob(line_rect, drawings_rects, images_rects):
    scan_area = fitz.Rect(line_rect.x0 - MAX_ICON_DISTANCE, line_rect.y0 - 5, line_rect.x0, line_rect.y1 + 5)
    icon_bbox = None
    
    def update_icon_bbox(current_bbox, new_rect):
        if current_bbox is None: return new_rect
        return current_bbox | new_rect 

    for d_rect in drawings_rects:
        if d_rect.width > MAX_ICON_SIZE or d_rect.height > MAX_ICON_SIZE: continue
        if scan_area.intersects(d_rect):
            icon_bbox = update_icon_bbox(icon_bbox, d_rect)
    
    for i_rect in images_rects:
        if i_rect.width > MAX_ICON_SIZE or i_rect.height > MAX_ICON_SIZE: continue
        if scan_area.intersects(i_rect):
             icon_bbox = update_icon_bbox(icon_bbox, i_rect)

    if icon_bbox is not None:
        combined_rect = line_rect | icon_bbox
        return fitz.Rect(combined_rect.x0 - 3, combined_rect.y0 - 2, line_rect.x1 + PADDING_RIGHT, combined_rect.y1 + 2)
    else:
        return fitz.Rect(line_rect.x0 - PADDING_LEFT_NO_ICON, line_rect.y0 - 1, line_rect.x1 + PADDING_RIGHT, line_rect.y1 + 1)

def process_cv(input_bytes):
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    EMAIL_REGEX = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    PHONE_REGEX = r'(?:\(?\+?84\)?|0(?:\d{1,2})?)\s*[\.\-\s]?\d(?:\s*[\.\-\s]?\d){7,11}'
    URL_KW = ["linkedin.com", "facebook.com", "fb.com", "bit.ly", "tinyurl.com", "github.com"]

    for page_num, page in enumerate(doc):
        if page_num > 0: break 
        page_width = page.rect.width
        drawings_rects = [path["rect"] for path in page.get_drawings()]
        images_rects = [fitz.Rect(img["bbox"]) for img in page.get_image_info()]
        blocks = page.get_text("dict")["blocks"]

        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    line_text = "".join([s["text"] for s in l["spans"]])
                    line_rect = fitz.Rect(l["bbox"])
                    if (re.search(EMAIL_REGEX, line_text) or re.search(PHONE_REGEX, line_text) or any(kw in line_text.lower() for kw in URL_KW)):
                        bg_color = get_surgical_color_v14(page, line_rect, page_width)
                        mask_rect = get_mask_rect_v14_the_blob(line_rect, drawings_rects, images_rects)
                        page.add_redact_annot(mask_rect, fill=bg_color)
        
        for kw in URL_KW:
            for rect in page.search_for(kw):
                bg_color = get_surgical_color_v14(page, rect, page_width)
                mask_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 1, rect.x1 + PADDING_RIGHT, rect.y1 + 1)
                page.add_redact_annot(mask_rect, fill=bg_color)

        page.apply_redactions()
    return doc.tobytes()

# ==========================================
# PHẦN 2: LOGIC MANUAL (THỦ CÔNG) - ĐÃ THÊM LẠI
# ==========================================

def generate_pdf_preview(input_bytes):
    """Tạo ảnh Preview trang 1 cho Frontend vẽ"""
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    page = doc[0]
    # Matrix 1.5 để ảnh nét hơn
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
    return pix.tobytes("png")

def process_manual(input_bytes, boxes, color_hex, snapping=True):
    """Xử lý xóa theo tọa độ vẽ"""
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    page = doc[0]
    
    # Chuyển màu Hex -> RGB
    if color_hex.startswith('#'):
        color_hex = color_hex.lstrip('#')
    
    r = int(color_hex[0:2], 16) / 255
    g = int(color_hex[2:4], 16) / 255
    b = int(color_hex[4:6], 16) / 255
    bg_color = (r, g, b)

    pdf_width = page.rect.width
    words = page.get_text("words") if snapping else []

    for box in boxes:
        # Tính tỷ lệ scale
        fe_width = box['imageWidth']
        scale = pdf_width / fe_width
        
        x = box['x'] * scale
        y = box['y'] * scale
        w = box['w'] * scale
        h = box['h'] * scale
        
        user_rect = fitz.Rect(x, y, x + w, y + h)

        final_rect = user_rect
        # Hít chữ
        if snapping:
            intersected_words = [fitz.Rect(word[:4]) for word in words if user_rect.intersects(fitz.Rect(word[:4]))]
            if intersected_words:
                union_rect = intersected_words[0]
                for wr in intersected_words[1:]:
                    union_rect |= wr
                final_rect = fitz.Rect(union_rect.x0, union_rect.y0 - 2, union_rect.x1, union_rect.y1 + 2)

        page.add_redact_annot(final_rect, fill=bg_color)

    page.apply_redactions()
    return doc.tobytes()