"""Kết nối CSDL cho phần KH GDMN.

- Có DATABASE_URL (Render/Postgres) → dùng Postgres chung với CT388.
- Không có → SQLite tại $CTGDMN_DATA_DIR/truong-mn-so.sqlite (chạy trên máy).

Bảng mang tiền tố `kh_` vì CT388 đã có các bảng `users`, `children`, `audit_log`, `assessments`.
"""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import Column, Index, Integer, LargeBinary, MetaData, String, Table, Text, create_engine, event
from sqlalchemy.engine import Engine

PROJECT_ROOT = Path(__file__).resolve().parents[2]

metadata = MetaData()

app_state = Table(
    "kh_app_state", metadata,
    Column("key", String, primary_key=True),
    Column("value_json", Text, nullable=False),
    Column("updated_at", String, nullable=False),
)

users = Table(
    "kh_users", metadata,
    Column("id", String, primary_key=True),
    Column("username", String, nullable=False, unique=True),
    Column("full_name", String, nullable=False),
    Column("staff_id", String),
    Column("title", String),
    Column("team", String),
    Column("class_ids_json", Text, nullable=False),
    Column("roles_json", Text, nullable=False),
    Column("scope_json", Text, nullable=False),
    Column("active", Integer, nullable=False, default=1),
    Column("password_hash", String, nullable=False),
    Column("must_change_password", Integer, nullable=False, default=1),
    Column("created_at", String, nullable=False),
    Column("last_login_at", String),
    Column("created_by", String),
)

audit_log = Table(
    "kh_audit_log", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", String),
    Column("created_at", String, nullable=False),
    Column("action", String, nullable=False),
    Column("target_type", String),
    Column("target_id", String),
    Column("version", Integer),
    Column("result", String, nullable=False),
    Column("details_json", Text, nullable=False),
)

videos = Table(
    "kh_videos", metadata,
    Column("id", String, primary_key=True),
    Column("title", String, nullable=False),
    Column("description", Text),
    Column("category", String, nullable=False),
    Column("audience_json", Text, nullable=False),
    Column("thumbnail", Text),
    Column("source_type", String, nullable=False),
    Column("url", Text),
    Column("local_path", Text),
    Column("duration", String),
    Column("sort_order", Integer, nullable=False, default=0),
    Column("enabled", Integer, nullable=False, default=1),
    Column("context_key", String),
    Column("updated_at", String, nullable=False),
    Column("updated_by", String),
    Column("used_count", Integer, nullable=False, default=0),
)

account_requests = Table(
    "kh_account_requests", metadata,
    Column("id", String, primary_key=True),
    Column("full_name", String, nullable=False),
    Column("username", String, nullable=False),
    Column("password_hash", String, nullable=False),
    Column("title", String),
    Column("team", String),
    Column("status", String, nullable=False, default="pending"),
    Column("created_at", String, nullable=False),
    Column("decided_at", String),
    Column("decided_by", String),
    Column("reject_reason", Text),
)

children = Table(
    "kh_children", metadata,
    Column("id", String, primary_key=True),
    Column("owner_id", String, nullable=False),
    Column("full_name", String, nullable=False),
    Column("student_code", String),
    Column("class_label", String),
    Column("birth_year", String),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
    Index("idx_kh_children_owner", "owner_id"),
)

child_assessments = Table(
    "kh_child_assessments", metadata,
    Column("id", String, primary_key=True),
    Column("owner_id", String, nullable=False),
    Column("child_id", String, nullable=False),
    Column("plan_id", String),
    Column("domain", String, nullable=False),
    Column("period", String),
    Column("level", String, nullable=False),
    Column("observation", Text),
    Column("evidence", Text),
    Column("adjustment", Text),
    Column("created_at", String, nullable=False),
    Column("created_by", String),
    Index("idx_kh_child_assessments_owner", "owner_id"),
    Index("idx_kh_child_assessments_child", "child_id"),
)

objectives = Table(
    "kh_objectives", metadata,
    Column("id", String, primary_key=True),
    Column("owner_id", String, nullable=False),
    Column("age_group", String, nullable=False),
    Column("code", String, nullable=False),
    Column("domain", String, nullable=False),
    Column("description", Text, nullable=False),
    Column("content", Text),
    Column("applies_to", Text),
    Column("scope", String, nullable=False, default="custom"),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
    Index("idx_kh_objectives_owner", "owner_id", "age_group"),
    Index("idx_kh_objectives_owner_code", "owner_id", "age_group", "code", unique=True),
)


# Mẫu DOCX tùy chỉnh: bản Node lưu thành tệp trong /data (mất khi Render deploy lại nếu không có ổ đĩa);
# ở đây lưu thẳng vào CSDL để còn nguyên sau mỗi lần deploy.
template_files = Table(
    "kh_template_files", metadata,
    Column("filename", String, primary_key=True),
    Column("data", LargeBinary, nullable=False),
    Column("created_at", String, nullable=False),
)


# Số lượt dùng AI của mỗi tài khoản theo ngày (giờ Việt Nam).
ai_usage = Table(
    "kh_ai_usage", metadata,
    Column("user_id", String, primary_key=True),
    Column("day", String, primary_key=True),
    Column("count", Integer, nullable=False, default=0),
)

# PDF nguồn do người dùng thêm (bản Node lưu ở /data/program-documents-added).
added_documents = Table(
    "kh_added_documents", metadata,
    Column("filename", String, primary_key=True),
    Column("data", LargeBinary, nullable=False),
    Column("size", Integer, nullable=False),
    Column("created_at", String, nullable=False),
)


def data_dir() -> Path:
    path = Path(os.environ.get("CTGDMN_DATA_DIR") or PROJECT_ROOT / "data").resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def normalize_url(url: str) -> str:
    """Render/Heroku đưa `postgres://...`; SQLAlchemy cần chỉ rõ driver psycopg (v3)."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    return normalize_url(url) if url else f"sqlite:///{data_dir() / 'truong-mn-so.sqlite'}"


def make_engine(url: str | None = None) -> Engine:
    url = normalize_url(url) if url else database_url()
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False}, future=True)

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    return create_engine(url, pool_pre_ping=True, future=True)
