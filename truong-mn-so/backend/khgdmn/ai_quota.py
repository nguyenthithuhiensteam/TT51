"""Quyền dùng AI và hạn mức lượt mỗi ngày cho từng giáo viên (khóa AI dùng chung của quản trị).

- Chính sách lưu ở kh_app_state["aiPolicy"]: {"dailyLimit": N (0 = không giới hạn), "defaultEnabled": bool,
  "users": {userId: bool}} — không cần đổi cấu trúc bảng kh_users đang có trên Postgres.
- Lượt dùng đếm theo ngày giờ Việt Nam trong bảng kh_ai_usage. Quản trị luôn được dùng và không bị giới hạn.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from .errors import AppError
from .repository import Repository
from .security import ADMIN

POLICY_KEY = "aiPolicy"
DEFAULT_POLICY = {"dailyLimit": 10, "defaultEnabled": True, "users": {}}
VN_TZ = timezone(timedelta(hours=7))


def today() -> str:
    return datetime.now(VN_TZ).strftime("%Y-%m-%d")


class AIQuota:
    def __init__(self, repository: Repository):
        self.repository = repository

    def policy(self) -> dict:
        stored = self.repository.get_json(POLICY_KEY, None) or {}
        return {**DEFAULT_POLICY, **stored, "users": dict(stored.get("users") or {})}

    def save_policy(self, actor: dict, data: dict) -> dict:
        self._require_admin(actor)
        policy = self.policy()
        try:
            limit = int(data.get("dailyLimit", policy["dailyLimit"]))
        except (TypeError, ValueError) as error:
            raise AppError("Số lượt AI mỗi ngày phải là số nguyên.") from error
        if not 0 <= limit <= 1000:
            raise AppError("Số lượt AI mỗi ngày phải từ 0 (không giới hạn) đến 1000.")
        policy["dailyLimit"] = limit
        if "defaultEnabled" in data:
            policy["defaultEnabled"] = bool(data["defaultEnabled"])
        self.repository.set_json(POLICY_KEY, policy)
        self.repository.audit(actor["id"], "ai.policy_save", "ai", "policy", 0, "success",
                              {"dailyLimit": limit, "defaultEnabled": policy["defaultEnabled"]})
        return self.admin_view(actor)

    def set_user_enabled(self, actor: dict, user_id: str, enabled: bool) -> dict:
        self._require_admin(actor)
        if not self.repository._one("SELECT 1 AS x FROM kh_users WHERE id=:id", id=user_id):
            raise AppError("Không tìm thấy tài khoản.")
        policy = self.policy()
        policy["users"][user_id] = bool(enabled)
        self.repository.set_json(POLICY_KEY, policy)
        self.repository.audit(actor["id"], "ai.user_enable" if enabled else "ai.user_disable", "user", user_id)
        return self.admin_view(actor)

    def used_today(self, user_id: str) -> int:
        row = self.repository._one("SELECT count FROM kh_ai_usage WHERE user_id=:u AND day=:d", u=user_id, d=today())
        return int(row["count"]) if row else 0

    def status(self, user: dict) -> dict:
        is_admin = ADMIN in (user.get("roles") or [])
        policy = self.policy()
        enabled = True if is_admin else bool(policy["users"].get(user["id"], policy["defaultEnabled"]))
        limit = 0 if is_admin else int(policy["dailyLimit"])
        used = self.used_today(user["id"])
        return {"enabled": enabled, "used": used, "limit": limit, "remaining": None if limit == 0 else max(0, limit - used)}

    def check(self, user: dict) -> None:
        state = self.status(user)
        if not state["enabled"]:
            raise AppError("Tài khoản của bạn chưa được quản trị cho phép dùng AI.")
        if state["limit"] and state["used"] >= state["limit"]:
            raise AppError(f"Bạn đã dùng hết {state['limit']} lượt AI hôm nay. Hạn mức sẽ làm mới vào 0 giờ (giờ Việt Nam).")

    def record(self, user: dict) -> None:
        day = today()
        with self.repository.engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO kh_ai_usage(user_id,day,count) VALUES(:u,:d,1) "
                "ON CONFLICT(user_id,day) DO UPDATE SET count=kh_ai_usage.count+1"
            ), {"u": user["id"], "d": day})

    def admin_view(self, actor: dict) -> dict:
        self._require_admin(actor)
        policy = self.policy()
        rows = self.repository._all("SELECT user_id, count FROM kh_ai_usage WHERE day=:d", d=today())
        return {**policy, "usageToday": {row["user_id"]: int(row["count"]) for row in rows}, "day": today()}

    @staticmethod
    def _require_admin(actor: dict) -> None:
        if ADMIN not in (actor.get("roles") or []):
            raise AppError("Bạn không có quyền thực hiện thao tác này.")
