# Sử dụng Python nhẹ nhất
FROM python:3.10-slim

# Cài đặt thư viện hệ thống cần thiết cho PyMuPDF và Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxrender1 \
    libxext6 \
    # Playwright dependencies cho Chromium
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy file requirements trước để tận dụng cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cài đặt Playwright browser (Chromium only để nhẹ hơn)
RUN playwright install chromium

# Copy toàn bộ code vào
COPY . .

# Chạy server (Lưu ý host 0.0.0.0 để Docker hiểu)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]