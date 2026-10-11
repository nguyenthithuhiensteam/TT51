"""Phân quyền và băm mật khẩu — chuyển từ electron/security.cjs, giữ nguyên quy tắc.

Mật khẩu dùng đúng định dạng scrypt của bản Node (`scrypt$N$r$p$salt_b64$hash_b64`) để tài khoản
đã tạo trên KH GDMN cũ vẫn đăng nhập được sau khi chuyển dữ liệu.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from urllib.parse import urlparse

from .errors import AppError

ADMIN = "system_admin"
PRINCIPAL = "principal"
VICE = "vice_principal"
LEAD = "team_lead"
TEACHER = "teacher"
VIEWER = "viewer"

ROLE_LABELS = {
    ADMIN: "Quản trị hệ thống",
    PRINCIPAL: "Hiệu trưởng/người phê duyệt",
    VICE: "Phó hiệu trưởng phụ trách chuyên môn",
    LEAD: "Tổ trưởng chuyên môn",
    TEACHER: "Giáo viên",
    VIEWER: "Người xem",
}

PERMISSIONS = {
    ADMIN: ["accounts.manage", "school.configure", "backup.manage", "video.manage", "audit.view", "data.manage", "data.read", "assessment.manage", "objectives.manage", "plan.read", "plan.create", "plan.edit"],
    PRINCIPAL: ["plan.read", "plan.review", "plan.approve", "report.read", "signature.use", "document.export", "data.read", "assessment.manage", "objectives.manage"],
    VICE: ["plan.read", "plan.review", "plan.submit_approval", "plan.approve_configured", "report.read", "document.export", "data.read", "assessment.manage", "objectives.manage"],
    LEAD: ["plan.read", "plan.review", "plan.request_changes", "plan.submit_professional", "data.read", "assessment.manage", "objectives.manage"],
    TEACHER: ["plan.read", "plan.create", "plan.edit", "plan.submit_team", "review.respond", "data.read", "document.export_own", "assessment.manage", "objectives.manage"],
    VIEWER: ["plan.read_shared", "data.read_shared", "video.view"],
}

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 16384, 8, 1
_SCRYPT_MAXMEM = 64 * 1024 * 1024


def hash_password(password) -> str:
    if not isinstance(password, str) or len(password) < 8:
        raise AppError("Mật khẩu phải có ít nhất 8 ký tự.")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=64, maxmem=_SCRYPT_MAXMEM)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password, encoded: str = "") -> bool:
    try:
        name, n, r, p, salt, expected = str(encoded or "").split("$")
        if name != "scrypt":
            return False
        expected_bytes = base64.b64decode(expected)
        actual = hashlib.scrypt(str(password).encode("utf-8"), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected_bytes), maxmem=_SCRYPT_MAXMEM)
        return hmac.compare_digest(actual, expected_bytes)
    except Exception:
        return False


def permissions_for(user: dict | None) -> set[str]:
    roles = (user or {}).get("roles") or []
    permissions = {perm for role in roles for perm in PERMISSIONS.get(role, [])}
    if roles:
        permissions.add("video.view")
    return permissions


def has_permission(user, action: str) -> bool:
    return action in permissions_for(user)


def scope_allows(user: dict | None, resource: dict | None) -> bool:
    user = user or {}
    resource = resource or {}
    roles = user.get("roles") or []
    if ADMIN in roles or PRINCIPAL in roles:
        return True
    if VICE in roles:
        scope_class_ids = user.get("scopeClassIds") or []
        return ((not user.get("scopeCampus") or user.get("scopeCampus") == resource.get("campus"))
                and (not user.get("scopeTeam") or user.get("scopeTeam") == resource.get("team"))
                and (not scope_class_ids or resource.get("classId") in scope_class_ids))
    if LEAD in roles:
        return bool(user.get("team")) and user.get("team") == resource.get("team")
    if TEACHER in roles:
        return resource.get("authorTeacherId") == user.get("staffId") or resource.get("classId") in (user.get("classIds") or [])
    if VIEWER in roles:
        return resource.get("shared") is True
    return False


def authorize(user: dict | None, action: str, resource: dict | None = None) -> bool:
    resource = resource or {}
    if not user or user.get("active") is False:
        raise AppError("Tài khoản không hoạt động.")
    if not has_permission(user, action):
        raise AppError("Bạn không có quyền thực hiện thao tác này.")
    roles = user.get("roles") or []
    if action == "plan.create" and resource.get("authorTeacherId") != user.get("staffId") and ADMIN not in roles:
        raise AppError("Giáo viên chỉ được tạo kế hoạch của chính mình.")
    if action.startswith("plan.") and action != "plan.create" and not scope_allows(user, resource):
        raise AppError("Dữ liệu nằm ngoài phạm vi được phân công.")
    if action == "plan.approve" and resource.get("authorTeacherId") == user.get("staffId"):
        raise AppError("Người soạn không được tự phê duyệt kế hoạch của mình.")
    if action == "signature.use" and resource.get("ownerStaffId") and resource.get("ownerStaffId") != user.get("staffId") and PRINCIPAL not in roles:
        raise AppError("Không được sử dụng chữ ký của người khác.")
    return True


TRANSITIONS = {
    "draft": {"sent_team": "plan.submit_team"},
    "sent_team": {"changes_requested": "plan.request_changes", "sent_professional": "plan.submit_professional"},
    "changes_requested": {"draft": "plan.edit"},
    "sent_professional": {"submitted_approval": "plan.submit_approval"},
    "submitted_approval": {"approved": "plan.approve", "changes_requested": "plan.review"},
    "approved": {"draft": "plan.edit"},
}


def _int_or(value, fallback: int) -> int:
    try:
        number = int(value)
        return number if number else fallback
    except (TypeError, ValueError):
        return fallback


def transition_plan(user: dict, plan: dict, to_status: str) -> dict:
    current = plan.get("workflowStatus") or "draft"
    action = TRANSITIONS.get(current, {}).get(to_status)
    if not action:
        raise AppError("Chuyển trạng thái kế hoạch không hợp lệ.")
    authorize(user, action, plan)
    if plan.get("workflowStatus") in ("sent_team", "sent_professional", "submitted_approval") and action == "plan.edit":
        raise AppError("Bản kế hoạch đang gửi đã bị khóa.")
    version = _int_or(plan.get("version"), 1)
    if plan.get("workflowStatus") == "approved" and to_status == "draft":
        version += 1
    return {**plan, "workflowStatus": to_status, "version": version}


def safe_https_url(value: str = "") -> bool:
    try:
        url = urlparse(str(value))
        return url.scheme == "https" and bool(url.hostname)
    except ValueError:
        return False


def sanitize_audit_details(details: dict | None) -> dict:
    import re

    safe = {}
    for key, value in (details or {}).items():
        if re.search(r"pass(word)?|secret|token|hash", key, re.IGNORECASE):
            continue
        safe[key] = f"{value[:500]}…" if isinstance(value, str) and len(value) > 500 else value
    return safe


def validate_video_file(filename: str = "", size=0, mime_type: str = "video/mp4") -> dict:
    extension = str(filename).lower().endswith(".mp4")
    mime = str(mime_type).lower() == "video/mp4"
    try:
        size_number = float(size)
        valid_size = 0 < size_number <= 1024 * 1024 * 1024
    except (TypeError, ValueError):
        valid_size = False
    return {"valid": extension and mime and valid_size, "extension": extension, "mime": mime, "validSize": valid_size}
