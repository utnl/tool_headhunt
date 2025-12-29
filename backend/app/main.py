from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# Import đúng đường dẫn tới router.py
from app.api.v1.router import api_router 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Kết nối router vào app chính
app.include_router(api_router, prefix="/api/v1")

# (Không cần đoạn if __name__ == "__main__" nếu chạy bằng lệnh uvicorn terminal)