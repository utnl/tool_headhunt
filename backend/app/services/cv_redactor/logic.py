import fitz  # PyMuPDF
import re
from collections import Counter
import math

# ==========================================
# CẤU HÌNH
# ==========================================
MAX_ICON_DISTANCE = 60   
MAX_ICON_SIZE = 45       
PADDING_RIGHT = 10       
PADDING_LEFT_NO_ICON = 2 

def is_color_similar(c1, c2, threshold=25):
    return math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) < threshold

# ==========================================
# PHẦN 1: LOGIC MÀU (RIGHT-SIDE SNIPER)
# ==========================================
def get_stable_color(page, rect, page_width):
    """
    Lấy mẫu màu ở khoảng trống ngay sau đuôi dòng chữ.
    Đây là vùng an toàn nhất, ít bị nhiễu bởi icon hay lề trái.
    """
    try:
        # Vùng lấy mẫu: Bắt đầu từ đuôi chữ (x1) ra xa 20px.
        # Chiều cao: Co lại 2px mỗi chiều để nằm lọt thỏm trong dòng
        safe_y0 = rect.y0 + 2
        safe_y1 = rect.y1 - 2
        if safe_y1 <= safe_y0: safe_y0, safe_y1 = rect.y0, rect.y1

        # Tạo vùng mẫu bên phải
        sample_rect = fitz.Rect(rect.x1 + 2, safe_y0, rect.x1 + 25, safe_y1)
        
        # Nếu tràn lề phải -> Lấy bên trái (Fallback)
        if sample_rect.x1 > page_width:
             sample_rect = fitz.Rect(rect.x0 - 25, safe_y0, rect.x0 - 2, safe_y1)

        pix = page.get_pixmap(clip=sample_rect)
        
        # Fallback: Nếu lỗi, lấy 1 chấm nhỏ ngay góc trên-trái của dòng chữ
        if pix.width < 1 or pix.height < 1:
             pix = page.get_pixmap(clip=fitz.Rect(rect.x0, rect.y0, rect.x0 + 2, rect.y0 + 2))

        samples = pix.samples
        raw_pixels = []
        
        for i in range(0, len(samples), 3):
            raw_pixels.append((samples[i], samples[i+1], samples[i+2]))

        if not raw_pixels: return (1, 1, 1)

        # 1. Tìm màu phổ biến nhất
        most_common = Counter(raw_pixels).most_common(1)[0][0]
        
        # 2. Lọc nhiễu & Tính trung bình các màu tương đồng
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

# ==========================================
# PHẦN 2: LOGIC VÙNG CHE (THE BLOB)
# ==========================================
def get_mask_rect_stable(line_rect, drawings_rects, images_rects):
    """
    Nếu có icon -> Hợp nhất vùng.
    Nếu không -> Chỉ che chữ (An toàn).
    """
    scan_area = fitz.Rect(line_rect.x0 - MAX_ICON_DISTANCE, line_rect.y0 - 5, line_rect.x0, line_rect.y1 + 5)
    icon_bbox = None
    
    def update_icon_bbox(current_bbox, new_rect):
        if current_bbox is None: return new_rect
        return current_bbox | new_rect 

    # Quét Vector
    for d_rect in drawings_rects:
        if d_rect.width > MAX_ICON_SIZE or d_rect.height > MAX_ICON_SIZE: continue
        if scan_area.intersects(d_rect):
            icon_bbox = update_icon_bbox(icon_bbox, d_rect)
    
    # Quét Ảnh
    for i_rect in images_rects:
        if i_rect.width > MAX_ICON_SIZE or i_rect.height > MAX_ICON_SIZE: continue
        if scan_area.intersects(i_rect):
             icon_bbox = update_icon_bbox(icon_bbox, i_rect)

    if icon_bbox is not None:
        # TRƯỜNG HỢP CÓ ICON: Hợp nhất và mở rộng nhẹ
        combined_rect = line_rect | icon_bbox
        return fitz.Rect(
            combined_rect.x0 - 2, 
            combined_rect.y0 - 2, 
            line_rect.x1 + PADDING_RIGHT, 
            combined_rect.y1 + 2
        )
    else:
        # TRƯỜNG HỢP KHÔNG CÓ ICON: Chỉ che chữ, padding dọc nhỏ (1px)
        return fitz.Rect(
            line_rect.x0 - PADDING_LEFT_NO_ICON, 
            line_rect.y0 - 1,
            line_rect.x1 + PADDING_RIGHT,
            line_rect.y1 + 1
        )

# ==========================================
# PHẦN 3: HÀM XỬ LÝ CHÍNH
# ==========================================
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
                    
                    if (re.search(EMAIL_REGEX, line_text) or 
                        re.search(PHONE_REGEX, line_text) or 
                        any(kw in line_text.lower() for kw in URL_KW)):
                        
                        bg_color = get_stable_color(page, line_rect, page_width)
                        mask_rect = get_mask_rect_stable(line_rect, drawings_rects, images_rects)
                        
                        page.add_redact_annot(mask_rect, fill=bg_color)
        
        for kw in URL_KW:
            for rect in page.search_for(kw):
                bg_color = get_stable_color(page, rect, page_width)
                mask_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 1, rect.x1 + PADDING_RIGHT, rect.y1 + 1)
                page.add_redact_annot(mask_rect, fill=bg_color)

        page.apply_redactions()
    
    return doc.tobytes()

# ==========================================
# PHẦN 4: CÁC HÀM MANUAL (KHÔNG ĐƯỢC XÓA)
# ==========================================

def get_pdf_info(input_bytes):
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    return {"total_pages": len(doc)}

def generate_pdf_preview(input_bytes, page_num=0):
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    if page_num < 0 or page_num >= len(doc): return None
    page = doc[page_num]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Giữ độ nét cao
    return pix.tobytes("png")

# def process_manual(input_bytes, boxes, color_hex, snapping=True):
#     """
#     LOGIC MANUAL CUỐI CÙNG: TRUYỀN THẲNG MÃ HEX.
#     Backend nhận màu Hex từ Frontend và truyền trực tiếp vào PyMuPDF
#     để tránh mọi sai lệch chuyển đổi màu.
#     """
#     doc = fitz.open(stream=input_bytes, filetype="pdf")
    
#     # 1. NHẬN MÀU HEX TRỰC TIẾP
#     # PyMuPDF có thể nhận màu Hex dạng #RRGGBB
#     # Không cần chuyển sang RGB (r, g, b) nữa
#     user_fill_color_hex = color_hex 

#     for box in boxes:
#         page_idx = box.get('pageIndex', 0)
#         if page_idx >= len(doc): continue
#         page = doc[page_idx]
#         pdf_width = page.rect.width
        
#         # Tính toán tọa độ
#         fe_width = box['imageWidth']
#         scale = pdf_width / fe_width
        
#         x = box['x'] * scale
#         y = box['y'] * scale
#         w = box['w'] * scale
#         h = box['h'] * scale
#         user_rect = fitz.Rect(x, y, x + w, y + h)
#         final_rect = user_rect

#         # Snapping (Vẫn giữ)
#         if snapping:
#             words = page.get_text("words")
#             intersected_words = [fitz.Rect(word[:4]) for word in words if user_rect.intersects(fitz.Rect(word[:4]))]
#             if intersected_words:
#                 union_rect = intersected_words[0]
#                 for wr in intersected_words[1:]: union_rect |= wr
#                 final_rect = fitz.Rect(union_rect.x0, union_rect.y0 - 2, union_rect.x1, union_rect.y1 + 2)

#         # 2. TÔ MÀU: TRUYỀN THẲNG MÃ HEX VÀO FILL
#         # PyMuPDF chấp nhận cả (R,G,B) hoặc (R,G,B,A) hoặc mã Hex String
#         page.add_redact_annot(final_rect, fill=user_fill_color_hex) # <--- DÙNG THẲNG MÃ HEX

#     for page in doc: page.apply_redactions()
#     return doc.tobytes()

def process_manual(input_bytes, boxes, color_hex, snapping=True):
    """
    LOGIC MANUAL FINAL: CHUYỂN ĐỔI HEX -> RGB TUPLE.
    Khắc phục lỗi ra màu trắng do thư viện không hiểu mã Hex.
    """
    doc = fitz.open(stream=input_bytes, filetype="pdf")
    
    # 1. CHUYỂN ĐỔI MÀU (QUAN TRỌNG NHẤT)
    # Từ Hex "#31302E" -> RGB (49, 48, 46) -> Tuple (0.19, 0.18, 0.18)
    if color_hex.startswith('#'): 
        color_hex = color_hex.lstrip('#')
    
    try:
        r = int(color_hex[0:2], 16) / 255
        g = int(color_hex[2:4], 16) / 255
        b = int(color_hex[4:6], 16) / 255
        user_fill_color = (r, g, b) # Đây là định dạng PyMuPDF cần
    except:
        user_fill_color = (1, 1, 1) # Fallback nếu lỗi hex

    for box in boxes:
        page_idx = box.get('pageIndex', 0)
        if page_idx >= len(doc): continue
        page = doc[page_idx]
        pdf_width = page.rect.width
        
        # Tính toán tọa độ
        fe_width = box['imageWidth']
        scale = pdf_width / fe_width
        
        x = box['x'] * scale
        y = box['y'] * scale
        w = box['w'] * scale
        h = box['h'] * scale
        user_rect = fitz.Rect(x, y, x + w, y + h)
        final_rect = user_rect

        # Snapping (Hít chữ)
        if snapping:
            words = page.get_text("words")
            intersected_words = [fitz.Rect(word[:4]) for word in words if user_rect.intersects(fitz.Rect(word[:4]))]
            if intersected_words:
                union_rect = intersected_words[0]
                for wr in intersected_words[1:]: union_rect |= wr
                final_rect = fitz.Rect(union_rect.x0, union_rect.y0 - 2, union_rect.x1, union_rect.y1 + 2)

        # 2. TÔ MÀU (Dùng tuple đã chuyển đổi)
        page.add_redact_annot(final_rect, fill=user_fill_color)

    for page in doc: page.apply_redactions()
    return doc.tobytes()