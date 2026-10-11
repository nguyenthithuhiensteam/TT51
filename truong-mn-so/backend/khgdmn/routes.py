"""API của KH GDMN — cùng đường dẫn và hình dạng dữ liệu với server/index.mjs (bản Node)."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Request

from .db import data_dir
from .errors import AppError
from .repository import Repository, dumps, iso, s
from .security import ADMIN, authorize, safe_https_url
from .templates import TemplateManager

router = APIRouter()
_repository: Repository | None = None
_templates: TemplateManager | None = None
_frontend_dir: Path | None = None


def configure(repository: Repository, frontend_dir: Path) -> None:
    global _repository, _templates, _frontend_dir
    _repository = repository
    _templates = TemplateManager(repository)
    _frontend_dir = frontend_dir


def repo() -> Repository:
    if _repository is None:
        raise RuntimeError("Repository chưa được khởi tạo.")
    return _repository


def templates() -> TemplateManager:
    if _templates is None:
        raise RuntimeError("TemplateManager chưa được khởi tạo.")
    return _templates


async def body(request: Request) -> dict:
    raw = await request.body()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except ValueError as error:
        raise AppError("Dữ liệu gửi lên không phải JSON hợp lệ.") from error
    return data if isinstance(data, dict) else {}


def token_from(request: Request) -> str:
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header[:7].lower() == "bearer " else header.strip()
    return token or str(request.query_params.get("token", ""))


def current_user(request: Request) -> dict:
    config = repo().get_json("systemConfig", {"idleMinutes": 30}) or {}
    try:
        idle = float(config.get("idleMinutes") or 30)
    except (TypeError, ValueError):
        idle = 30
    return repo().session(token_from(request), idle or 30)


# ---- Công khai (không cần đăng nhập) ----
@router.get("/api/data/index")
def data_index():
    return json.loads((_frontend_dir / "data" / "program-index.json").read_text(encoding="utf-8"))


@router.get("/api/branding/public")
def branding():
    return repo().get_public_branding()


@router.get("/api/auth/status")
def auth_status():
    return {"hasUsers": repo().has_users()}


@router.post("/api/auth/setup-first-admin")
async def setup_first_admin(request: Request):
    return repo().create_first_admin(await body(request))


@router.post("/api/auth/request-account")
async def request_account(request: Request):
    return repo().request_account(await body(request))


@router.post("/api/auth/login")
async def login(request: Request):
    data = await body(request)
    return repo().login(data.get("username"), data.get("password"))


# ---- Xác thực ----
@router.post("/api/auth/logout")
def logout(request: Request):
    repo().logout(token_from(request))
    return {"ok": True}


@router.post("/api/auth/change-password")
async def change_password(request: Request):
    data = await body(request)
    repo().change_password(current_user(request), data.get("currentPassword"), data.get("newPassword"))
    return {"ok": True}


# ---- Tài khoản ----
@router.get("/api/accounts")
def list_accounts(request: Request):
    return repo().list_users(current_user(request))


@router.post("/api/accounts")
async def create_account(request: Request):
    return repo().create_user(current_user(request), await body(request))


@router.post("/api/accounts/import")
async def import_accounts(request: Request):
    return repo().import_users(current_user(request), (await body(request)).get("rows"))


@router.post("/api/accounts/{user_id}/lock")
async def lock_account(user_id: str, request: Request):
    repo().lock_user(current_user(request), user_id, bool((await body(request)).get("locked")))
    return {"ok": True}


@router.post("/api/accounts/{user_id}/reset-password")
async def reset_account_password(user_id: str, request: Request):
    repo().reset_password(current_user(request), user_id, (await body(request)).get("tempPassword"))
    return {"ok": True}


@router.get("/api/accounts/requests")
def list_account_requests(request: Request):
    return repo().list_account_requests(current_user(request))


@router.post("/api/accounts/requests/{request_id}/approve")
def approve_account_request(request_id: str, request: Request):
    return repo().approve_account_request(current_user(request), request_id)


@router.post("/api/accounts/requests/{request_id}/reject")
async def reject_account_request(request_id: str, request: Request):
    return repo().reject_account_request(current_user(request), request_id, (await body(request)).get("reason"))


# ---- Hồ sơ trẻ, đánh giá, mục tiêu ----
@router.get("/api/children")
def list_children(request: Request):
    return repo().list_children(current_user(request))


@router.post("/api/children")
async def upsert_child(request: Request):
    return repo().upsert_child(current_user(request), await body(request))


@router.post("/api/children/{child_id}/deactivate")
def deactivate_child(child_id: str, request: Request):
    return repo().deactivate_child(current_user(request), child_id)


@router.get("/api/assessments")
def list_assessments(request: Request):
    return repo().list_child_assessments(current_user(request), request.query_params.get("childId", ""))


@router.post("/api/assessments")
async def upsert_assessment(request: Request):
    return repo().upsert_child_assessment(current_user(request), await body(request))


@router.post("/api/assessments/{assessment_id}/delete")
def delete_assessment(assessment_id: str, request: Request):
    return repo().delete_child_assessment(current_user(request), assessment_id)


@router.get("/api/objectives")
def list_objectives(request: Request):
    return repo().list_objectives(current_user(request), request.query_params.get("ageGroup", ""))


@router.post("/api/objectives")
async def upsert_objective(request: Request):
    return repo().upsert_objective(current_user(request), await body(request))


@router.post("/api/objectives/{objective_id}/deactivate")
def deactivate_objective(objective_id: str, request: Request):
    return repo().deactivate_objective(current_user(request), objective_id)


# ---- Kho dữ liệu / kế hoạch ----
@router.post("/api/repository/bootstrap")
async def bootstrap(request: Request):
    current_user(request)
    return repo().bootstrap_legacy((await body(request)).get("legacy"))


@router.get("/api/repository/state")
def get_state(request: Request):
    return repo().get_state(current_user(request))


@router.post("/api/repository/state")
async def save_state(request: Request):
    user = current_user(request)
    payload = await body(request)
    config = repo().get_json("systemConfig", {}) or {}
    if config.get("repositoryMode") == "lan":
        raise AppError("Chưa kết nối máy chủ LAN; dữ liệu không được ghi để tránh xung đột.")
    old = repo().get_json("workspace", {}) or {}
    workspace = payload.get("workspace") or {}
    for plan in workspace.get("plans") or []:
        previous = next((item for item in (old.get("plans") or []) if item.get("id") == plan.get("id")), None)
        if not previous:
            authorize(user, "plan.create", plan)
        elif previous != plan:
            authorize(user, "plan.edit", plan)
            if (previous.get("workflowStatus") or "draft") not in ("draft", "changes_requested"):
                raise AppError("Bản kế hoạch đang gửi đã bị khóa.")
    if ADMIN not in (user.get("roles") or []):
        for key in ("schoolProfile", "classes", "staff", "signatures", "customRecords", "edits", "sourceDocuments"):
            if key in old:
                workspace[key] = old[key]
            else:
                workspace.pop(key, None)
        payload["workspace"] = workspace
    return repo().save_state(user, payload)


@router.post("/api/plans/{plan_id}/transition")
async def transition(plan_id: str, request: Request):
    return repo().transition(current_user(request), plan_id, (await body(request)).get("toStatus"))


@router.post("/api/repository/config")
async def update_config(request: Request):
    repo().update_config(current_user(request), await body(request))
    return {"ok": True}


@router.get("/api/repository/audit")
def audit(request: Request):
    return repo().audit_rows(current_user(request), request.query_params.get("limit") or 500)


@router.get("/api/repository/backup")
def backup(request: Request):
    return repo().create_backup(current_user(request))


@router.post("/api/repository/restore")
async def restore(request: Request):
    repo().restore_backup(current_user(request), await body(request))
    return True


# ---- Mẫu DOCX ----
@router.get("/api/templates")
def list_templates(request: Request):
    current_user(request)
    return templates().list()


@router.post("/api/templates/import")
async def import_template(request: Request):
    user = current_user(request)
    authorize(user, "data.manage")
    form = await request.form()
    upload = form.get("file")
    if upload is None or isinstance(upload, str):
        return {"canceled": True, **templates().list()}
    metadata = {key: value for key, value in form.items() if key != "file" and isinstance(value, str)}
    result = templates().import_template(upload.filename or "", await upload.read(), metadata)
    repo().audit(user["id"], "template.import", "template", "custom")
    return {"canceled": False, **result}


@router.post("/api/templates/default")
async def set_default_template(request: Request):
    user = current_user(request)
    authorize(user, "data.manage")
    data = await body(request)
    result = templates().set_default(data.get("type"), data.get("templateId"))
    repo().audit(user["id"], "template.default", "template", data.get("templateId"))
    return result


@router.get("/api/templates/backup")
def backup_templates(request: Request):
    user = current_user(request)
    authorize(user, "data.manage")
    repo().audit(user["id"], "template.backup", "template", "all")
    return templates().backup_payload()


@router.post("/api/templates/restore")
async def restore_templates(request: Request):
    user = current_user(request)
    authorize(user, "data.manage")
    result = templates().restore_payload(await body(request))
    repo().audit(user["id"], "template.restore", "template", "all")
    return {"canceled": False, **result}


# ---- Video (liên kết trực tuyến; nhập và phát MP4 ngoại tuyến sẽ chuyển sau) ----
@router.get("/api/videos")
def list_videos(request: Request):
    user = current_user(request)
    authorize(user, "video.view")
    roles = user.get("roles") or []
    is_admin = ADMIN in roles
    rows = repo()._all("SELECT * FROM kh_videos WHERE enabled=1 OR :admin=1 ORDER BY sort_order,title", admin=1 if is_admin else 0)
    videos = [{**row, "audience": json.loads(row["audience_json"]), "canManage": is_admin} for row in rows]
    return [v for v in videos if is_admin or not v["audience"] or any(role in roles for role in v["audience"])]


@router.post("/api/videos")
async def save_video(request: Request):
    user = current_user(request)
    authorize(user, "video.manage")
    video = await body(request)
    if video.get("sourceType") == "online" and not safe_https_url(video.get("url") or ""):
        raise AppError("Video trực tuyến chỉ chấp nhận URL HTTPS an toàn.")
    video_id = video.get("id") or f"video-{uuid.uuid4()}"
    try:
        sort_order = int(video.get("sortOrder") or 0)
    except (TypeError, ValueError):
        sort_order = 0
    repo()._exec(
        "INSERT INTO kh_videos(id,title,description,category,audience_json,thumbnail,source_type,url,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by,used_count) "
        "VALUES(:id,:title,:description,:category,:audience,:thumbnail,:source_type,:url,:local_path,:duration,:sort_order,:enabled,:context_key,:now,:by,0) "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,audience_json=excluded.audience_json,"
        "thumbnail=excluded.thumbnail,source_type=excluded.source_type,url=excluded.url,duration=excluded.duration,sort_order=excluded.sort_order,"
        "enabled=excluded.enabled,context_key=excluded.context_key,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
        id=video_id, title=s(video.get("title")), description=video.get("description") or "", category=video.get("category") or "Bắt đầu sử dụng",
        audience=dumps(video.get("audience") or []), thumbnail=video.get("thumbnail") or "", source_type=video.get("sourceType") or "online",
        url=video.get("url") or "", local_path=video.get("localPath") or None, duration=video.get("duration") or "", sort_order=sort_order,
        enabled=0 if video.get("enabled") is False else 1, context_key=video.get("contextKey") or "", now=iso(), by=user["id"],
    )
    repo().audit(user["id"], "video.update" if video.get("id") else "video.create", "video", video_id)
    return {"id": video_id}


@router.post("/api/videos/{video_id}/open-online")
def open_online_video(video_id: str, request: Request):
    user = current_user(request)
    authorize(user, "video.view")
    video = repo()._one("SELECT * FROM kh_videos WHERE id=:id AND enabled=1", id=video_id)
    if not video or video["source_type"] != "online" or not safe_https_url(video["url"] or ""):
        raise AppError("Liên kết video không hợp lệ.")
    repo()._exec("UPDATE kh_videos SET used_count=used_count+1 WHERE id=:id", id=video_id)
    repo().audit(user["id"], "video.open", "video", video_id)
    return {"url": video["url"]}


@router.delete("/api/videos/{video_id}")
def delete_video(video_id: str, request: Request):
    user = current_user(request)
    authorize(user, "video.manage")
    video = repo()._one("SELECT * FROM kh_videos WHERE id=:id", id=video_id)
    if not video:
        raise AppError("Không tìm thấy video.")
    if video["used_count"] > 0 and video["source_type"] == "online":
        raise AppError("Không thể xóa liên kết đã được sử dụng; hãy tắt liên kết.")
    if video["local_path"]:
        root = (data_dir() / "video-library").resolve()
        file = (root / video["local_path"]).resolve()
        if file.parent == root or root in file.parents:
            file.unlink(missing_ok=True)
    repo()._exec("DELETE FROM kh_videos WHERE id=:id", id=video_id)
    repo().audit(user["id"], "video.delete", "video", video_id)
    return True


# ---- AI (tạm thời: chỉ đọc cấu hình; lưu cấu hình và gọi AI sẽ chuyển ở bước sau) ----
@router.get("/api/ai/config")
def ai_config(request: Request):
    current_user(request)
    return {"provider": "", "model": "", "baseUrl": "", "timeoutMs": 60000, "retries": 1, "keyMode": "none",
            "maskedKey": "", "consentAccepted": False, "lastTest": None}
