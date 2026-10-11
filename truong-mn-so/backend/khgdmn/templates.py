"""Quản lý mẫu DOCX — chuyển từ electron/template-manager.cjs (phần danh sách, nhập, mặc định, sao lưu).

Khác bản Node: tệp mẫu và sổ đăng ký lưu trong CSDL (kh_template_files, kh_app_state) thay vì thư mục /data.
Phần dựng tài liệu từ mẫu (renderCustom) sẽ chuyển cùng nhóm xuất Word.
"""
from __future__ import annotations

import base64
import io
import re
import uuid
import zipfile

from sqlalchemy import text

from .errors import AppError
from .plan_schema import PLAN_TYPES, normalize_plan_type
from .repository import Repository, iso

BUILT_INS = [{"id": f"builtin-{key}", "name": f"{name} - mẫu chuẩn", "type": key, "builtIn": True} for key, name in PLAN_TYPES.items()]
REGISTRY_KEY = "templateRegistry"
_PARAGRAPH_RE = re.compile(r"<w:p\b[\s\S]*?</w:p>")
_TEXT_RE = re.compile(r"<w:t\b[^>]*>([\s\S]*?)</w:t>")
_SAFE_FILENAME_RE = re.compile(r"^custom-[a-f0-9-]+\.docx$", re.IGNORECASE)


def paragraph_text(paragraph_xml: str = "") -> str:
    joined = "".join(_TEXT_RE.findall(paragraph_xml))
    return joined.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"').replace("&apos;", "'")


class TemplateManager:
    def __init__(self, repository: Repository):
        self.repository = repository

    def read_registry(self) -> dict:
        registry = self.repository.get_json(REGISTRY_KEY, None) or {}
        return {"custom": registry.get("custom") or [], "defaultByType": registry.get("defaultByType") or {}}

    def write_registry(self, registry: dict) -> None:
        self.repository.set_json(REGISTRY_KEY, registry)

    def list(self) -> dict:
        registry = self.read_registry()
        return {"templates": [*BUILT_INS, *({**item, "builtIn": False} for item in registry["custom"])], "defaultByType": registry["defaultByType"]}

    def import_template(self, filename: str, source: bytes, metadata: dict | None = None) -> dict:
        metadata = metadata or {}
        if not str(filename).lower().endswith(".docx"):
            raise AppError("Mẫu tùy chỉnh phải là tệp DOCX.")
        try:
            with zipfile.ZipFile(io.BytesIO(source)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise AppError("Mẫu DOCX không có nội dung Word hợp lệ.")
                xml = archive.read("word/document.xml").decode("utf-8")
        except zipfile.BadZipFile as error:
            raise AppError("Tệp mẫu DOCX bị lỗi hoặc không đúng định dạng.") from error
        if not any(paragraph_text(match).strip() == "{{PLAN_TABLE}}" for match in _PARAGRAPH_RE.findall(xml)):
            raise AppError("Mẫu DOCX cần có biến {{PLAN_TABLE}} trong một dòng riêng.")
        template_type = normalize_plan_type(metadata.get("type"))
        template_id = f"custom-{uuid.uuid4()}"
        stored_name = f"{template_id}.docx"
        now = iso()
        with self.repository.engine.begin() as conn:
            conn.execute(text("INSERT INTO kh_template_files(filename,data,created_at) VALUES(:f,:d,:now)"), {"f": stored_name, "d": source, "now": now})
        registry = self.read_registry()
        display_name = str(metadata.get("name") or "").strip() or re.sub(r"\.docx$", "", str(filename), flags=re.IGNORECASE)
        registry["custom"].append({"id": template_id, "type": template_type, "name": display_name, "filename": stored_name, "createdAt": now})
        self.write_registry(registry)
        return self.list()

    def set_default(self, type_value, template_id) -> dict:
        template_type = normalize_plan_type(type_value)
        registry = self.read_registry()
        if not any(item["id"] == template_id and item["type"] == template_type for item in [*BUILT_INS, *registry["custom"]]):
            raise AppError("Mẫu mặc định không hợp lệ.")
        registry["defaultByType"][template_type] = template_id
        self.write_registry(registry)
        return self.list()

    def resolve(self, template_id, plan: dict) -> dict | None:
        template_type = normalize_plan_type(plan.get("level"))
        registry = self.read_registry()
        selected = template_id or registry["defaultByType"].get(template_type) or f"builtin-{template_type}"
        return next((item for item in registry["custom"] if item["id"] == selected and item["type"] == template_type), None)

    def file_bytes(self, filename: str) -> bytes:
        row = self.repository._one("SELECT data FROM kh_template_files WHERE filename=:f", f=filename)
        if not row:
            raise AppError("Không tìm thấy tệp mẫu DOCX.")
        return bytes(row["data"])

    def backup_payload(self) -> dict:
        registry = self.read_registry()
        return {
            "version": 1, "exportedAt": iso(), "registry": registry,
            "files": {item["filename"]: base64.b64encode(self.file_bytes(item["filename"])).decode() for item in registry["custom"]},
        }

    def restore_payload(self, payload: dict) -> dict:
        if not isinstance(payload, dict) or payload.get("version") != 1 or not payload.get("registry") or not isinstance(payload.get("files"), dict):
            raise AppError("Bản sao lưu mẫu không hợp lệ.")
        rows = []
        for item in payload["registry"].get("custom") or []:
            filename = str(item.get("filename") or "")
            if not _SAFE_FILENAME_RE.match(filename):
                raise AppError("Tên tệp mẫu trong bản sao lưu không an toàn.")
            data = payload["files"].get(filename)
            if not isinstance(data, str):
                raise AppError("Bản sao lưu thiếu dữ liệu mẫu DOCX.")
            rows.append({"f": filename, "d": base64.b64decode(data), "now": iso()})
        with self.repository.engine.begin() as conn:
            for row in rows:
                conn.execute(text("DELETE FROM kh_template_files WHERE filename=:f"), row)
                conn.execute(text("INSERT INTO kh_template_files(filename,data,created_at) VALUES(:f,:d,:now)"), row)
        self.write_registry(payload["registry"])
        return self.list()
