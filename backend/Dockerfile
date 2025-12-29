# Sử dụng Python nhẹ nhất
FROM python:3.10-slim

# Cài đặt thư viện hệ thống cần thiết cho PyMuPDF
# (Đôi khi cần libxrender, libxext trên linux)
RUN apt-get update && apt-get install -y \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy file requirements trước để tận dụng cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code vào
COPY . .

# Chạy server (Lưu ý host 0.0.0.0 để Docker hiểu)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]