from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ct388.backend import db
from ct388.backend.auth import get_current_user
from ct388.backend.gdmn_pilot_claude_adapter import ClaudeStructuredProvider
from ct388.backend.gdmn_pilot_plugin.router import build_router as build_gdmn_pilot_router
from ct388.backend.gdmn_pilot_plugin.service import GDMNPilotService
from ct388.backend.init_db import init_database
from ct388.backend.routers import (
    ai_routes,
    audit_routes,
    auth_routes,
    children,
    curriculum,
    gdmn_pilot_source,
    license_routes,
    plans,
    superadmin_routes,
)

app = FastAPI(
    title="CT388 App API",
    version="0.4.0",
    description="Backend for CT388 preschool education planning support (desktop + hosted web).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(curriculum.router)
app.include_router(license_routes.router)
app.include_router(auth_routes.router)
app.include_router(children.router)
app.include_router(ai_routes.router)
app.include_router(plans.router)
app.include_router(audit_routes.router)
app.include_router(superadmin_routes.router)
app.include_router(gdmn_pilot_source.router, dependencies=[Depends(get_current_user)])
# Gắn thủ công thay vì gọi gdmn_pilot_plugin.register() để bắt buộc đăng nhập
# (register() không biết về hệ xác thực của app — nếu để hở, endpoint gọi
# Claude API bằng key dùng chung của app sẽ bị lộ cho người chưa đăng nhập).
_gdmn_pilot_service = GDMNPilotService(ClaudeStructuredProvider())
app.include_router(build_gdmn_pilot_router(_gdmn_pilot_service), dependencies=[Depends(get_current_user)])


@app.on_event("startup")
def on_startup() -> None:
    init_database()
    _seed_core_data_if_empty()


def _seed_core_data_if_empty() -> None:
    """First boot against a fresh database (e.g. a new hosted Postgres): load the
    shared CT388 curriculum data from the bundled Excel files, if present. Safe to
    skip on later restarts since it only runs while `domains` is still empty."""
    try:
        if db.fetch_table_counts(["domains"]).get("domains", 0) > 0:
            return
        from ct388.backend.import_core_excel import MG, NT, run_import

        if MG.exists() and NT.exists():
            run_import()
    except Exception as exc:  # pragma: no cover - best-effort seeding, never blocks startup
        print(f"[startup] Bỏ qua seed dữ liệu lõi: {exc}")


# ─── Serve the static frontend (hosted web deployment) ─────────────────────
# Must stay last: routes registered above are matched first, so this catch-all
# mount only serves paths that aren't one of the /api/* routes.
_FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
if _FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
