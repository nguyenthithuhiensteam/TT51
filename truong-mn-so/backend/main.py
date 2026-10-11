"""Trường Mầm non Số — máy chủ FastAPI gộp KH GDMN và CT388.

Giai đoạn 1: phần KH GDMN (tài khoản, hồ sơ trẻ, đánh giá, mục tiêu, kho kế hoạch, nhật ký, sao lưu).
Các nhóm API còn lại (nhập/xuất tệp, mẫu, video, tài liệu, AI) và CT388 (/ct388) sẽ nối ở các bước sau.

Chạy trên máy:  uvicorn backend.main:app --port 8787   (trong thư mục truong-mn-so)
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.khgdmn import routes as khgdmn_routes
from backend.khgdmn.db import PROJECT_ROOT, make_engine
from backend.khgdmn.errors import AppError
from backend.khgdmn.repository import Repository

logger = logging.getLogger("truong-mn-so")

# Giao diện KH GDMN giữ nguyên. Tạm dùng trực tiếp thư mục của bản Node; khi đóng gói Docker sẽ chép vào.
KHGDMN_FRONTEND = Path(os.environ.get("KHGDMN_FRONTEND_DIR") or PROJECT_ROOT.parent / "ctgdmn-windows-fixed" / "src").resolve()
KHGDMN_ASSETS = Path(os.environ.get("KHGDMN_ASSETS_DIR") or KHGDMN_FRONTEND.parent / "assets").resolve()


def create_app(database_url: str | None = None, mount_ct388: bool = True) -> FastAPI:
    app = FastAPI(title="Trường Mầm non Số", version="0.1.0")

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, error: AppError):
        return JSONResponse({"error": error.message}, status_code=error.http_status)

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_request: Request, error: Exception):
        logger.exception("Lỗi không xác định")
        return JSONResponse({"error": str(error) or "Có lỗi không xác định."}, status_code=500)

    repository = Repository(make_engine(database_url))
    khgdmn_routes.configure(repository, KHGDMN_FRONTEND)
    app.state.repository = repository
    app.include_router(khgdmn_routes.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    # CT388 (thư viện chương trình 388) chạy nguyên khối dưới /ct388. Ứng dụng con được mount thì
    # Starlette không gọi sự kiện startup của nó, nên khởi tạo CSDL CT388 ở đây.
    if mount_ct388:
        from ct388.backend import main as ct388_main

        @app.on_event("startup")
        def ct388_startup():
            ct388_main.on_startup()

        @app.get("/ct388", include_in_schema=False)
        def ct388_root():
            return RedirectResponse("/ct388/")

        app.mount("/ct388", ct388_main.app, name="ct388")

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE"])
    def not_ported_yet(rest: str):
        return JSONResponse({"error": "Tính năng này đang được chuyển sang máy chủ mới, sẽ có ở bản cập nhật sau."}, status_code=501)

    if KHGDMN_ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=KHGDMN_ASSETS), name="assets")
    if KHGDMN_FRONTEND.exists():
        @app.get("/", include_in_schema=False)
        def index():
            return FileResponse(KHGDMN_FRONTEND / "index.html")

        app.mount("/", StaticFiles(directory=KHGDMN_FRONTEND), name="khgdmn")
    return app


app = create_app()
