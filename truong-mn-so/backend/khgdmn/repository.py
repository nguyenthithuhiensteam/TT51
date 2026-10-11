"""Kho dữ liệu KH GDMN — chuyển 1-1 từ electron/repository.cjs sang SQLAlchemy (SQLite hoặc Postgres).

Giữ nguyên thông báo lỗi, quy tắc phân quyền và hình dạng dữ liệu trả về (camelCase) để giao diện
src/app.js không phải sửa.
"""
from __future__ import annotations

import json
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from . import security
from .db import metadata
from .errors import AppError
from .plan_schema import DEVELOPMENT_DOMAINS, domains_for_age_group
from .security import ADMIN, LEAD, PRINCIPAL, TEACHER, VICE, VIEWER, authorize, hash_password, scope_allows, verify_password

ASSESSMENT_LEVELS = ("Đạt", "Chưa đạt", "Cần hỗ trợ thêm")
USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,40}$")
SEED_OBJECTIVES = Path(__file__).with_name("objectives_seed.json")


def iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def s(value) -> str:
    """Tương đương String(value||'').trim() của bản Node."""
    return str(value).strip() if value not in (None, "", 0, False) or isinstance(value, (list, dict)) else ""


def js_or_none(value):
    """Tương đương `value||null`: chuỗi rỗng/0/false/undefined → None; mảng và object rỗng vẫn giữ."""
    if isinstance(value, (list, dict)):
        return value
    return value if value not in (None, "", 0) else None


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


class Repository:
    def __init__(self, engine: Engine):
        self.engine = engine
        self.sessions: dict[str, dict] = {}
        metadata.create_all(engine)
        self.seed_builtin_resources()
        self.seed_builtin_objectives()

    # ---- tiện ích SQL ----
    def _one(self, sql: str, **params):
        with self.engine.connect() as conn:
            row = conn.execute(text(sql), params).mappings().first()
            return dict(row) if row else None

    def _all(self, sql: str, **params) -> list[dict]:
        with self.engine.connect() as conn:
            return [dict(row) for row in conn.execute(text(sql), params).mappings().all()]

    def _exec(self, sql: str, **params) -> None:
        with self.engine.begin() as conn:
            conn.execute(text(sql), params)

    # ---- dữ liệu mặc định ----
    def seed_builtin_resources(self) -> None:
        if int(self.get_json("builtinResourceVersion", 0) or 0) >= 1:
            return
        self._exec(
            "INSERT INTO kh_videos(id,title,description,category,audience_json,thumbnail,source_type,url,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by,used_count) "
            "VALUES(:id,:title,:description,:category,'[]','','online',:url,NULL,'',10,1,'',:now,'system',0) ON CONFLICT DO NOTHING",
            id="builtin-video-ctgdmn-guide",
            title="Video hướng dẫn sử dụng Trường Mầm non Số",
            description="Video hướng dẫn trực tuyến dành cho giáo viên và cán bộ quản lý khi bắt đầu sử dụng ứng dụng.",
            category="Bắt đầu sử dụng",
            url="https://www.youtube.com/watch?v=P5DgJHPLkDk",
            now=iso(),
        )
        self.set_json("builtinResourceVersion", 1)

    def seed_builtin_objectives(self) -> None:
        if int(self.get_json("builtinObjectivesVersion", 0) or 0) >= 1:
            return
        now = iso()
        items = json.loads(SEED_OBJECTIVES.read_text(encoding="utf-8"))
        rows = [
            {
                "id": re.sub(r"\s+", "-", f"objective-system-{item['ageGroup']}-{item['code']}"),
                "age_group": item["ageGroup"], "code": item["code"], "domain": item["domain"],
                "description": item["description"], "now": now,
            }
            for item in items
        ]
        with self.engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO kh_objectives(id,owner_id,age_group,code,domain,description,content,applies_to,scope,active,created_at,updated_at) "
                "VALUES(:id,'system',:age_group,:code,:domain,:description,'','','system',1,:now,:now) ON CONFLICT DO NOTHING"
            ), rows)
        self.set_json("builtinObjectivesVersion", 1)

    # ---- trạng thái chung ----
    def has_users(self) -> bool:
        return self._one("SELECT COUNT(*) AS n FROM kh_users")["n"] > 0

    def audit(self, user_id, action, target_type="", target_id="", version=0, result="success", details=None) -> None:
        try:
            version_number = int(version or 0)
        except (TypeError, ValueError):
            version_number = 0
        self._exec(
            "INSERT INTO kh_audit_log(user_id,created_at,action,target_type,target_id,version,result,details_json) VALUES(:u,:c,:a,:tt,:ti,:v,:r,:d)",
            u=user_id or None, c=iso(), a=action, tt=target_type, ti=target_id or None, v=version_number, r=result,
            d=dumps(security.sanitize_audit_details(details or {})),
        )

    def get_json(self, key: str, fallback=None):
        row = self._one("SELECT value_json FROM kh_app_state WHERE key=:key", key=key)
        return json.loads(row["value_json"]) if row else fallback

    def set_json(self, key: str, value) -> None:
        self._exec(
            "INSERT INTO kh_app_state(key,value_json,updated_at) VALUES(:key,:value,:now) "
            "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
            key=key, value=dumps(value), now=iso(),
        )

    def get_public_branding(self) -> dict:
        school = (self.get_json("workspace", {}) or {}).get("schoolProfile") or {}
        return {"schoolName": s(school.get("name")) or "Trường Mầm non Số", "schoolYear": s(school.get("schoolYear")) or "2026–2027"}

    # ---- tài khoản ----
    def create_first_admin(self, data: dict) -> dict:
        if self.has_users():
            raise AppError("Tài khoản quản trị đầu tiên đã được thiết lập.")
        return self._insert_user(None, {**data, "roles": [ADMIN], "mustChangePassword": False})

    def _insert_user(self, actor: dict | None, data: dict) -> dict:
        username = s(data.get("username")).lower()
        if not USERNAME_RE.match(username):
            raise AppError("Tên đăng nhập phải có 3–40 ký tự không dấu.")
        user = {
            "id": _new_id("user"), "username": username, "fullName": s(data.get("fullName")),
            "staffId": data.get("staffId") or "", "title": data.get("title") or "", "team": data.get("team") or "",
            "classIds": data.get("classIds") or [], "roles": data.get("roles") or [VIEWER], "scope": data.get("scope") or {},
            "active": True, "mustChangePassword": data.get("mustChangePassword") is not False,
            "createdAt": iso(), "createdBy": (actor or {}).get("id") or "",
        }
        if not user["fullName"]:
            raise AppError("Họ và tên là bắt buộc.")
        password_hash = data.get("passwordHash") or hash_password(data.get("password"))
        try:
            self._exec(
                "INSERT INTO kh_users(id,username,full_name,staff_id,title,team,class_ids_json,roles_json,scope_json,active,password_hash,must_change_password,created_at,created_by) "
                "VALUES(:id,:username,:full_name,:staff_id,:title,:team,:class_ids,:roles,:scope,1,:hash,:must,:created_at,:created_by)",
                id=user["id"], username=username, full_name=user["fullName"], staff_id=user["staffId"], title=user["title"],
                team=user["team"], class_ids=dumps(user["classIds"]), roles=dumps(user["roles"]), scope=dumps(user["scope"]),
                hash=password_hash, must=1 if user["mustChangePassword"] else 0, created_at=user["createdAt"], created_by=user["createdBy"],
            )
        except IntegrityError as error:
            raise AppError("Tên đăng nhập đã được sử dụng.") from error
        self.audit((actor or {}).get("id"), "account.create", "user", user["id"], 0, "success", {"username": username})
        return user

    def create_user(self, actor: dict, data: dict) -> dict:
        authorize(actor, "accounts.manage")
        return self._insert_user(actor, data)

    def import_users(self, actor: dict, rows) -> dict:
        authorize(actor, "accounts.manage")
        if not isinstance(rows, list) or not rows:
            raise AppError("Tệp Excel không có tài khoản hợp lệ.")
        if len(rows) > 500:
            raise AppError("Mỗi lần chỉ được nhập tối đa 500 tài khoản.")
        allowed_roles = {PRINCIPAL, VICE, LEAD, TEACHER, VIEWER}
        result = {"created": 0, "skipped": 0, "errors": []}
        for index, row in enumerate(rows):
            row = row or {}
            username = s(row.get("username")).lower()
            try:
                raw_roles = row.get("roles")
                roles = list(dict.fromkeys(r for r in (s(role) for role in raw_roles) if r)) if isinstance(raw_roles, list) else []
                if not roles or any(role not in allowed_roles for role in roles):
                    raise AppError("Vai trò không hợp lệ hoặc không được phép nhập hàng loạt.")
                if self._one("SELECT 1 AS x FROM kh_users WHERE username=:u", u=username):
                    result["skipped"] += 1
                    continue
                self._insert_user(actor, {
                    "username": username, "fullName": s(row.get("fullName"))[:120], "password": str(row.get("password") or ""),
                    "title": s(row.get("title"))[:120], "team": s(row.get("team"))[:240], "roles": roles,
                    "classIds": [], "scope": {}, "mustChangePassword": True,
                })
                result["created"] += 1
            except AppError as error:
                result["errors"].append({"row": index + 2, "username": username, "error": error.message})
        self.audit(actor["id"], "account.import", "user", "multiple", 0, "partial" if result["errors"] else "success",
                   {"created": result["created"], "skipped": result["skipped"], "errors": len(result["errors"])})
        return result

    @staticmethod
    def row_user(row: dict | None) -> dict | None:
        if not row:
            return None
        return {
            "id": row["id"], "username": row["username"], "fullName": row["full_name"], "staffId": row["staff_id"],
            "title": row["title"], "team": row["team"], "classIds": json.loads(row["class_ids_json"]),
            "roles": json.loads(row["roles_json"]), "scope": json.loads(row["scope_json"]), "active": bool(row["active"]),
            "mustChangePassword": bool(row["must_change_password"]), "createdAt": row["created_at"],
            "lastLoginAt": row["last_login_at"], "createdBy": row["created_by"],
        }

    def list_users(self, actor: dict) -> list[dict]:
        authorize(actor, "accounts.manage")
        return [self.row_user(row) for row in self._all("SELECT * FROM kh_users ORDER BY full_name")]

    def login(self, username, password) -> dict:
        name = s(username).lower()
        row = self._one("SELECT * FROM kh_users WHERE username=:u", u=name)
        if not row or not row["active"] or not verify_password(password, row["password_hash"]):
            row_id = row["id"] if row else None
            self.audit(row_id, "auth.login", "user", row_id, 0, "failed", {"username": name})
            raise AppError("Tên đăng nhập hoặc mật khẩu không đúng.")
        token = secrets.token_hex(32)
        user = self.row_user(row)
        self.sessions[token] = {"user": user, "lastActivity": time.time()}
        self._exec("UPDATE kh_users SET last_login_at=:now WHERE id=:id", now=iso(), id=row["id"])
        self.audit(row["id"], "auth.login", "user", row["id"])
        return {"token": token, "user": user}

    def session(self, token: str, idle_minutes: float = 30) -> dict:
        session = self.sessions.get(token)
        if not session:
            raise AppError("Phiên đăng nhập không hợp lệ.")
        if time.time() - session["lastActivity"] > idle_minutes * 60:
            self.sessions.pop(token, None)
            raise AppError("Phiên đăng nhập đã hết hạn do không hoạt động.")
        session["lastActivity"] = time.time()
        return session["user"]

    def logout(self, token: str) -> None:
        session = self.sessions.pop(token, None)
        if session:
            self.audit(session["user"]["id"], "auth.logout", "user", session["user"]["id"])

    def change_password(self, user: dict, current, new) -> None:
        row = self._one("SELECT password_hash FROM kh_users WHERE id=:id", id=user["id"])
        if not row or not verify_password(current, row["password_hash"]):
            raise AppError("Mật khẩu hiện tại không đúng.")
        self._exec("UPDATE kh_users SET password_hash=:h,must_change_password=0 WHERE id=:id", h=hash_password(new), id=user["id"])
        self.audit(user["id"], "account.password_change", "user", user["id"])

    def reset_password(self, actor: dict, user_id: str, temp) -> None:
        authorize(actor, "accounts.manage")
        self._exec("UPDATE kh_users SET password_hash=:h,must_change_password=1 WHERE id=:id", h=hash_password(temp), id=user_id)
        self.audit(actor["id"], "account.password_reset", "user", user_id)

    def lock_user(self, actor: dict, user_id: str, locked: bool) -> None:
        authorize(actor, "accounts.manage")
        if actor["id"] == user_id and locked:
            raise AppError("Không thể tự khóa tài khoản đang đăng nhập.")
        self._exec("UPDATE kh_users SET active=:a WHERE id=:id", a=0 if locked else 1, id=user_id)
        self.audit(actor["id"], "account.lock" if locked else "account.unlock", "user", user_id)

    def request_account(self, data: dict) -> dict:
        username = s(data.get("username")).lower()
        if not USERNAME_RE.match(username):
            raise AppError("Tên đăng nhập phải có 3–40 ký tự không dấu.")
        full_name = s(data.get("fullName"))
        if not full_name:
            raise AppError("Họ và tên là bắt buộc.")
        if self._one("SELECT 1 AS x FROM kh_users WHERE username=:u", u=username):
            raise AppError("Tên đăng nhập đã được sử dụng.")
        if self._one("SELECT 1 AS x FROM kh_account_requests WHERE username=:u AND status='pending'", u=username):
            raise AppError("Tên đăng nhập này đang có một yêu cầu chờ duyệt.")
        password_hash = hash_password(data.get("password"))
        request_id = _new_id("request")
        self._exec(
            "INSERT INTO kh_account_requests(id,full_name,username,password_hash,title,team,status,created_at) VALUES(:id,:n,:u,:h,:t,:team,'pending',:now)",
            id=request_id, n=full_name, u=username, h=password_hash, t=s(data.get("title")), team=s(data.get("team")), now=iso(),
        )
        self.audit(None, "account.request", "account_request", request_id, 0, "success", {"username": username})
        return {"ok": True}

    def list_account_requests(self, actor: dict) -> list[dict]:
        authorize(actor, "accounts.manage")
        return self._all(
            'SELECT id,full_name AS "fullName",username,title,team,status,created_at AS "createdAt" '
            "FROM kh_account_requests WHERE status='pending' ORDER BY created_at"
        )

    def approve_account_request(self, actor: dict, request_id: str) -> dict:
        authorize(actor, "accounts.manage")
        request = self._one("SELECT * FROM kh_account_requests WHERE id=:id AND status='pending'", id=request_id)
        if not request:
            raise AppError("Không tìm thấy yêu cầu đang chờ duyệt.")
        if self._one("SELECT 1 AS x FROM kh_users WHERE username=:u", u=request["username"]):
            raise AppError("Tên đăng nhập đã được người khác sử dụng, không thể duyệt yêu cầu này.")
        user = self._insert_user(actor, {
            "username": request["username"], "fullName": request["full_name"], "passwordHash": request["password_hash"],
            "title": request["title"], "team": request["team"], "roles": [TEACHER], "mustChangePassword": False,
        })
        self._exec("UPDATE kh_account_requests SET status='approved',decided_at=:now,decided_by=:by WHERE id=:id", now=iso(), by=actor["id"], id=request_id)
        self.audit(actor["id"], "account.request_approve", "account_request", request_id, 0, "success", {"username": request["username"]})
        return user

    def reject_account_request(self, actor: dict, request_id: str, reason) -> dict:
        authorize(actor, "accounts.manage")
        request = self._one("SELECT * FROM kh_account_requests WHERE id=:id AND status='pending'", id=request_id)
        if not request:
            raise AppError("Không tìm thấy yêu cầu đang chờ duyệt.")
        self._exec(
            "UPDATE kh_account_requests SET status='rejected',decided_at=:now,decided_by=:by,reject_reason=:r WHERE id=:id",
            now=iso(), by=actor["id"], r=s(reason), id=request_id,
        )
        self.audit(actor["id"], "account.request_reject", "account_request", request_id, 0, "success", {"username": request["username"]})
        return {"ok": True}

    # ---- kho kế hoạch (workspace) ----
    def bootstrap_legacy(self, legacy: dict | None) -> bool:
        legacy = legacy or {}
        workspace = self.get_json("workspace", None)
        if not workspace:
            workspace = legacy.get("workspace") or {}
            self.set_json("review", legacy.get("review") or {})
            self.set_json("systemConfig", {"repositoryMode": "local", "serverUrl": "", "idleMinutes": 30, "migratedAt": iso()})
        school_id = (workspace.get("schoolProfile") or {}).get("id") or "school-main"
        defaults = {key: [] for key in ("customRecords", "plans", "sourceDocuments", "importHistory", "importLog", "classes", "staff",
                                        "professionalReviews", "signatures", "signatureLog", "planVersions", "publicationSnapshots", "planStatusHistory")}
        workspace = {"edits": {}, **defaults, **workspace, "schemaVersion": 4}
        plan_defaults = {"version": 1, "workflowStatus": "draft", "schoolId": school_id, "classId": "", "authorTeacherId": "",
                         "collaboratingTeacherIds": [], "reviewerIds": [], "approverId": "", "signatureConfigurationIds": []}
        workspace["plans"] = [{**plan_defaults, **plan} for plan in (workspace.get("plans") or [])]
        self.set_json("workspace", workspace)
        self.audit(None, "migration.localStorage", "workspace", "main", 4, "success", {"hadWorkspace": bool(legacy.get("workspace"))})
        return True

    def get_state(self, user: dict) -> dict:
        roles = user.get("roles") or []
        authorize(user, "data.manage" if ADMIN in roles else "data.read_shared" if VIEWER in roles else "data.read")
        workspace = self.get_json("workspace", {}) or {}
        if not (ADMIN in roles or PRINCIPAL in roles):
            staff = workspace.get("staff") or []

            def visible(plan):
                author = next((person for person in staff if person.get("id") == plan.get("authorTeacherId")), None)
                return scope_allows(user, {**plan, "team": plan.get("team") or (author or {}).get("team")})

            plans = [plan for plan in (workspace.get("plans") or []) if visible(plan)]
            ids = {plan.get("id") for plan in plans}
            workspace["plans"] = plans
            workspace["planVersions"] = [p for p in (workspace.get("planVersions") or []) if p.get("id") in ids]
            workspace["professionalReviews"] = [r for r in (workspace.get("professionalReviews") or []) if r.get("planId") in ids]
            workspace["publicationSnapshots"] = [x for x in (workspace.get("publicationSnapshots") or []) if x.get("planId") in ids]
            workspace["signatures"] = [sig if sig.get("staffId") == user.get("staffId") else {**sig, "imageData": ""}
                                       for sig in (workspace.get("signatures") or [])]
        return {
            "workspace": workspace,
            "review": self.get_json("review", {}),
            "systemConfig": self.get_json("systemConfig", {"repositoryMode": "local", "idleMinutes": 30}),
        }

    def save_state(self, user: dict, payload: dict) -> bool:
        roles = user.get("roles") or []
        authorize(user, "data.manage" if ADMIN in roles else "data.read")
        old = self.get_json("workspace", {}) or {}
        new = payload.get("workspace") or {}
        if VIEWER in roles:
            raise AppError("Người xem không được sửa dữ liệu.")
        admin = ADMIN in roles
        if not admin:
            for key in ("schoolProfile", "classes", "staff", "signatures", "customRecords", "edits", "sourceDocuments"):
                if js_or_none(old.get(key)) != js_or_none(new.get(key)):
                    raise AppError("Bạn không được thay đổi cấu hình hoặc kho dữ liệu quản trị.")
        if TEACHER in roles and not any(role in roles for role in (ADMIN, PRINCIPAL, VICE, LEAD)):
            for plan in new.get("plans") or []:
                previous = next((p for p in (old.get("plans") or []) if p.get("id") == plan.get("id")), None)
                if previous != plan and plan.get("authorTeacherId") != user.get("staffId"):
                    raise AppError("Giáo viên chỉ được sửa kế hoạch của mình.")
                if previous and previous.get("workflowStatus") and previous.get("workflowStatus") not in ("draft", "changes_requested") and previous != plan:
                    raise AppError("Bản kế hoạch đang gửi đã bị khóa.")
        saved = new
        if not admin:
            saved = dict(old)
            plan_map = {plan.get("id"): plan for plan in (old.get("plans") or [])}
            for plan in new.get("plans") or []:
                plan_map[plan.get("id")] = plan
            saved["plans"] = list(plan_map.values())
            review_map = {review.get("id"): review for review in (old.get("professionalReviews") or [])}
            for review in new.get("professionalReviews") or []:
                review_map[review.get("id")] = review
            saved["professionalReviews"] = list(review_map.values())
            for key in ("planVersions", "publicationSnapshots", "signatureLog", "importHistory", "importLog"):
                if new.get(key):
                    saved[key] = new[key]
        self.set_json("workspace", saved)
        self.set_json("review", payload.get("review") or {})
        self.audit(user["id"], payload.get("action") or "data.update", payload.get("targetType") or "workspace",
                   payload.get("targetId") or "main", payload.get("version") or 0)
        return True

    def transition(self, user: dict, plan_id: str, to_status: str) -> dict:
        workspace = self.get_json("workspace", {}) or {}
        plans = workspace.get("plans") or []
        index = next((i for i, plan in enumerate(plans) if plan.get("id") == plan_id), -1)
        if index < 0:
            raise AppError("Không tìm thấy kế hoạch.")
        previous = plans[index]
        author = next((p for p in (workspace.get("staff") or []) if p.get("id") == previous.get("authorTeacherId")), None)
        changed = security.transition_plan(user, {**previous, "team": previous.get("team") or (author or {}).get("team")}, to_status)
        plans[index] = changed
        workspace["plans"] = plans
        workspace["planStatusHistory"] = [*(workspace.get("planStatusHistory") or []), {
            "id": _new_id("status"), "planId": plan_id, "planVersion": changed["version"],
            "fromStatus": previous.get("workflowStatus") or "draft", "toStatus": to_status, "actorUserId": user["id"], "createdAt": iso(),
        }]
        self.set_json("workspace", workspace)
        self.audit(user["id"], "plan.transition", "plan", plan_id, changed["version"], "success",
                   {"from": previous.get("workflowStatus") or "draft", "to": to_status})
        return changed

    def update_config(self, actor: dict, config: dict) -> None:
        authorize(actor, "school.configure")
        old = self.get_json("systemConfig", {}) or {}
        self.set_json("systemConfig", {**old, **(config or {})})
        self.audit(actor["id"], "system.configure", "config", "main")

    # ---- sao lưu ----
    def create_backup(self, actor: dict) -> dict:
        authorize(actor, "backup.manage")
        payload = {
            "format": "ctgdmn-sqlite-backup", "version": 4, "exportedAt": iso(),
            "state": {"workspace": self.get_json("workspace", {}), "review": self.get_json("review", {}), "systemConfig": self.get_json("systemConfig", {})},
            "users": self._all("SELECT * FROM kh_users"),
        }
        self.audit(actor["id"], "backup.export", "database", "main")
        return payload

    def restore_backup(self, actor: dict, payload: dict) -> bool:
        authorize(actor, "backup.manage")
        if not isinstance(payload, dict) or payload.get("format") != "ctgdmn-sqlite-backup" or not payload.get("state") or not isinstance(payload.get("users"), list):
            raise AppError("Tệp sao lưu không hợp lệ.")
        for row in payload["users"]:
            if not str(row.get("password_hash") or "").startswith("scrypt$"):
                raise AppError("Bản sao lưu chứa thông tin xác thực không hợp lệ.")
        state = payload["state"]
        now = iso()
        upsert_state = text(
            "INSERT INTO kh_app_state(key,value_json,updated_at) VALUES(:key,:value,:now) "
            "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at"
        )
        columns = ("id", "username", "full_name", "staff_id", "title", "team", "class_ids_json", "roles_json", "scope_json",
                   "active", "password_hash", "must_change_password", "created_at", "last_login_at", "created_by")
        insert_user = text(f"INSERT INTO kh_users({','.join(columns)}) VALUES({','.join(':' + c for c in columns)})")
        with self.engine.begin() as conn:
            for key in ("workspace", "review", "systemConfig"):
                conn.execute(upsert_state, {"key": key, "value": dumps(state.get(key) or {}), "now": now})
            for row in payload["users"]:
                # Tương đương INSERT OR REPLACE của SQLite: thay cả bản ghi trùng id hoặc trùng tên đăng nhập.
                conn.execute(text("DELETE FROM kh_users WHERE id=:id OR username=:username"), {"id": row.get("id"), "username": row.get("username")})
                conn.execute(insert_user, {c: row.get(c) for c in columns})
        self.audit(actor["id"], "backup.restore", "database", "main")
        return True

    def audit_rows(self, actor: dict, limit=500) -> list[dict]:
        authorize(actor, "audit.view")
        try:
            limit_number = int(limit) or 500
        except (TypeError, ValueError):
            limit_number = 500
        rows = self._all("SELECT * FROM kh_audit_log ORDER BY id DESC LIMIT :n", n=min(1000, limit_number))
        return [{**row, "details": json.loads(row["details_json"])} for row in rows]

    # ---- hồ sơ trẻ ----
    @staticmethod
    def row_child(row: dict) -> dict:
        return {"id": row["id"], "fullName": row["full_name"], "studentCode": row["student_code"], "classLabel": row["class_label"],
                "birthYear": row["birth_year"], "active": bool(row["active"]), "createdAt": row["created_at"], "updatedAt": row["updated_at"]}

    def list_children(self, actor: dict) -> list[dict]:
        authorize(actor, "assessment.manage")
        return [self.row_child(r) for r in self._all("SELECT * FROM kh_children WHERE owner_id=:o AND active=1 ORDER BY full_name", o=actor["id"])]

    def _owned_child(self, actor: dict, child_id: str, message: str) -> None:
        existing = self._one("SELECT owner_id FROM kh_children WHERE id=:id", id=child_id)
        if not existing or existing["owner_id"] != actor["id"]:
            raise AppError(message)

    def upsert_child(self, actor: dict, data: dict) -> dict:
        authorize(actor, "assessment.manage")
        full_name = s(data.get("fullName"))
        if not full_name:
            raise AppError("Họ và tên trẻ là bắt buộc.")
        fields = {"n": full_name, "c": s(data.get("studentCode")), "l": s(data.get("classLabel")), "y": s(data.get("birthYear")), "now": iso()}
        child_id = s(data.get("id"))
        if child_id:
            self._owned_child(actor, child_id, "Không tìm thấy hồ sơ trẻ hoặc bạn không có quyền sửa.")
            self._exec("UPDATE kh_children SET full_name=:n,student_code=:c,class_label=:l,birth_year=:y,updated_at=:now WHERE id=:id", id=child_id, **fields)
            self.audit(actor["id"], "child.update", "child", child_id)
            return self.row_child(self._one("SELECT * FROM kh_children WHERE id=:id", id=child_id))
        new_id = _new_id("child")
        self._exec(
            "INSERT INTO kh_children(id,owner_id,full_name,student_code,class_label,birth_year,active,created_at,updated_at) VALUES(:id,:o,:n,:c,:l,:y,1,:now,:now)",
            id=new_id, o=actor["id"], **fields,
        )
        self.audit(actor["id"], "child.create", "child", new_id)
        return self.row_child(self._one("SELECT * FROM kh_children WHERE id=:id", id=new_id))

    def deactivate_child(self, actor: dict, child_id: str) -> dict:
        authorize(actor, "assessment.manage")
        self._owned_child(actor, child_id, "Không tìm thấy hồ sơ trẻ hoặc bạn không có quyền xóa.")
        self._exec("UPDATE kh_children SET active=0,updated_at=:now WHERE id=:id", now=iso(), id=child_id)
        self.audit(actor["id"], "child.deactivate", "child", child_id)
        return {"ok": True}

    # ---- đánh giá trẻ ----
    @staticmethod
    def row_assessment(row: dict) -> dict:
        return {"id": row["id"], "childId": row["child_id"], "planId": row["plan_id"], "domain": row["domain"], "period": row["period"],
                "level": row["level"], "observation": row["observation"], "evidence": row["evidence"], "adjustment": row["adjustment"],
                "createdAt": row["created_at"], "createdBy": row["created_by"]}

    def list_child_assessments(self, actor: dict, child_id: str = "") -> list[dict]:
        authorize(actor, "assessment.manage")
        if child_id:
            self._owned_child(actor, child_id, "Không tìm thấy hồ sơ trẻ hoặc bạn không có quyền xem.")
            rows = self._all("SELECT * FROM kh_child_assessments WHERE owner_id=:o AND child_id=:c ORDER BY created_at DESC", o=actor["id"], c=child_id)
        else:
            rows = self._all("SELECT * FROM kh_child_assessments WHERE owner_id=:o ORDER BY created_at DESC", o=actor["id"])
        return [self.row_assessment(r) for r in rows]

    def upsert_child_assessment(self, actor: dict, data: dict) -> dict:
        authorize(actor, "assessment.manage")
        child_id = s(data.get("childId"))
        self._owned_child(actor, child_id, "Không tìm thấy hồ sơ trẻ hoặc bạn không có quyền ghi nhận đánh giá.")
        domain = s(data.get("domain"))
        if domain not in DEVELOPMENT_DOMAINS:
            raise AppError("Lĩnh vực phát triển không hợp lệ.")
        level = s(data.get("level"))
        if level not in ASSESSMENT_LEVELS:
            raise AppError("Mức độ đánh giá không hợp lệ.")
        fields = {"p": s(data.get("planId")) or None, "d": domain, "per": s(data.get("period")), "lv": level,
                  "obs": s(data.get("observation")), "ev": s(data.get("evidence")), "adj": s(data.get("adjustment"))}
        assessment_id = s(data.get("id"))
        if assessment_id:
            existing = self._one("SELECT owner_id FROM kh_child_assessments WHERE id=:id", id=assessment_id)
            if not existing or existing["owner_id"] != actor["id"]:
                raise AppError("Không tìm thấy bản ghi đánh giá hoặc bạn không có quyền sửa.")
            self._exec("UPDATE kh_child_assessments SET plan_id=:p,domain=:d,period=:per,level=:lv,observation=:obs,evidence=:ev,adjustment=:adj WHERE id=:id",
                       id=assessment_id, **fields)
            self.audit(actor["id"], "child.assessment_update", "child_assessment", assessment_id)
            return self.row_assessment(self._one("SELECT * FROM kh_child_assessments WHERE id=:id", id=assessment_id))
        new_id = _new_id("assessment")
        self._exec(
            "INSERT INTO kh_child_assessments(id,owner_id,child_id,plan_id,domain,period,level,observation,evidence,adjustment,created_at,created_by) "
            "VALUES(:id,:o,:c,:p,:d,:per,:lv,:obs,:ev,:adj,:now,:o)",
            id=new_id, o=actor["id"], c=child_id, now=iso(), **fields,
        )
        self.audit(actor["id"], "child.assessment_create", "child_assessment", new_id)
        return self.row_assessment(self._one("SELECT * FROM kh_child_assessments WHERE id=:id", id=new_id))

    def delete_child_assessment(self, actor: dict, assessment_id: str) -> dict:
        authorize(actor, "assessment.manage")
        existing = self._one("SELECT owner_id FROM kh_child_assessments WHERE id=:id", id=assessment_id)
        if not existing or existing["owner_id"] != actor["id"]:
            raise AppError("Không tìm thấy bản ghi đánh giá hoặc bạn không có quyền xóa.")
        self._exec("DELETE FROM kh_child_assessments WHERE id=:id", id=assessment_id)
        self.audit(actor["id"], "child.assessment_delete", "child_assessment", assessment_id)
        return {"ok": True}

    # ---- ngân hàng mục tiêu ----
    @staticmethod
    def row_objective(row: dict) -> dict:
        return {"id": row["id"], "ageGroup": row["age_group"], "code": row["code"], "domain": row["domain"], "description": row["description"],
                "content": row["content"], "appliesTo": row["applies_to"], "scope": row["scope"] or "custom", "active": bool(row["active"]),
                "createdAt": row["created_at"], "updatedAt": row["updated_at"]}

    @staticmethod
    def can_manage_system_objectives(actor: dict) -> bool:
        roles = actor.get("roles") or []
        return ADMIN in roles or PRINCIPAL in roles

    def list_objectives(self, actor: dict, age_group: str = "") -> list[dict]:
        authorize(actor, "objectives.manage")
        if age_group:
            rows = self._all(
                "SELECT * FROM kh_objectives WHERE (owner_id='system' OR owner_id=:o) AND age_group=:a AND active=1 "
                "ORDER BY (owner_id='system') DESC,domain,LENGTH(code),code", o=actor["id"], a=age_group)
        else:
            rows = self._all(
                "SELECT * FROM kh_objectives WHERE (owner_id='system' OR owner_id=:o) AND active=1 "
                "ORDER BY age_group,(owner_id='system') DESC,domain,LENGTH(code),code", o=actor["id"])
        return [self.row_objective(r) for r in rows]

    def upsert_objective(self, actor: dict, data: dict) -> dict:
        authorize(actor, "objectives.manage")
        age_group = s(data.get("ageGroup"))
        if not age_group:
            raise AppError("Nhóm độ tuổi là bắt buộc.")
        code = s(data.get("code"))
        if not code:
            raise AppError("Mã mục tiêu (MT) là bắt buộc.")
        domain = s(data.get("domain"))
        if domain not in domains_for_age_group(age_group):
            raise AppError("Lĩnh vực phát triển không hợp lệ với nhóm độ tuổi đã chọn.")
        description = s(data.get("description"))
        if not description:
            raise AppError("Nội dung mục tiêu là bắt buộc.")
        fields = {"a": age_group, "c": code, "d": domain, "desc": description, "content": s(data.get("content")), "applies": s(data.get("appliesTo")), "now": iso()}
        can_manage_system = self.can_manage_system_objectives(actor)
        wants_system = data.get("scope") == "system"
        if wants_system and not can_manage_system:
            raise AppError("Chỉ hiệu trưởng hoặc quản trị hệ thống mới sửa được ngân hàng mục tiêu dùng chung toàn trường.")
        objective_id = s(data.get("id"))
        duplicate = f"Mã {code} đã tồn tại trong nhóm tuổi này."
        if objective_id:
            existing = self._one("SELECT owner_id FROM kh_objectives WHERE id=:id", id=objective_id)
            if not existing:
                raise AppError("Không tìm thấy mục tiêu.")
            is_system_row = existing["owner_id"] == "system"
            if is_system_row and not can_manage_system:
                raise AppError("Bạn không có quyền sửa mục tiêu dùng chung toàn trường.")
            if not is_system_row and existing["owner_id"] != actor["id"]:
                raise AppError("Không tìm thấy mục tiêu hoặc bạn không có quyền sửa.")
            try:
                self._exec("UPDATE kh_objectives SET age_group=:a,code=:c,domain=:d,description=:desc,content=:content,applies_to=:applies,updated_at=:now WHERE id=:id",
                           id=objective_id, **fields)
            except IntegrityError as error:
                raise AppError(duplicate) from error
            self.audit(actor["id"], "objective.update", "objective", objective_id)
            return self.row_objective(self._one("SELECT * FROM kh_objectives WHERE id=:id", id=objective_id))
        new_id = _new_id("objective")
        try:
            self._exec(
                "INSERT INTO kh_objectives(id,owner_id,age_group,code,domain,description,content,applies_to,scope,active,created_at,updated_at) "
                "VALUES(:id,:o,:a,:c,:d,:desc,:content,:applies,:scope,1,:now,:now)",
                id=new_id, o="system" if wants_system else actor["id"], scope="system" if wants_system else "custom", **fields,
            )
        except IntegrityError as error:
            raise AppError(duplicate) from error
        self.audit(actor["id"], "objective.create", "objective", new_id)
        return self.row_objective(self._one("SELECT * FROM kh_objectives WHERE id=:id", id=new_id))

    def deactivate_objective(self, actor: dict, objective_id: str) -> dict:
        authorize(actor, "objectives.manage")
        existing = self._one("SELECT owner_id FROM kh_objectives WHERE id=:id", id=objective_id)
        if not existing:
            raise AppError("Không tìm thấy mục tiêu.")
        is_system_row = existing["owner_id"] == "system"
        if is_system_row and not self.can_manage_system_objectives(actor):
            raise AppError("Bạn không có quyền xóa mục tiêu dùng chung toàn trường.")
        if not is_system_row and existing["owner_id"] != actor["id"]:
            raise AppError("Không tìm thấy mục tiêu hoặc bạn không có quyền xóa.")
        self._exec("UPDATE kh_objectives SET active=0,updated_at=:now WHERE id=:id", now=iso(), id=objective_id)
        self.audit(actor["id"], "objective.deactivate", "objective", objective_id)
        return {"ok": True}
