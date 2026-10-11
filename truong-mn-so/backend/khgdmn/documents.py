"""Kho tài liệu PDF chương trình, PDF bổ sung và tài liệu hướng dẫn — chuyển từ server/index.mjs,
electron/import-pdf.cjs, guide-files.cjs và trusted-resources.cjs.

PDF đi kèm ứng dụng đọc từ thư mục (KHGDMN_DOCUMENTS_DIR); PDF người dùng thêm lưu trong CSDL.
"""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path, PurePath

from sqlalchemy import text

from .db import PROJECT_ROOT
from .errors import AppError
from .repository import Repository, iso
from .validation import safe_import_name

ADDED_PREFIX = "user-added/"
GUIDE_FILES = {"pdf": "HUONG-DAN-SU-DUNG-CTGDMN-0.6.0.pdf", "docx": "HUONG-DAN-SU-DUNG-CTGDMN-0.6.0.docx"}
TRUSTED_RESOURCES = {"preschool-teacher-assistant": "https://chatgpt.com/g/g-68456c84ef908191876388962d011561-co-giao-mam-non"}
PENDING_TTL_SECONDS = 3600
_NODE_APP = PROJECT_ROOT.parent / "ctgdmn-windows-fixed"


def documents_root() -> Path:
    return Path(os.environ.get("KHGDMN_DOCUMENTS_DIR") or _NODE_APP / "program-documents").resolve()


def guides_root() -> Path:
    return Path(os.environ.get("KHGDMN_GUIDES_DIR") or _NODE_APP / "guides").resolve()


def _inside(root: Path, candidate: Path) -> bool:
    return candidate != root and root in candidate.parents


def resolve_program_document(relative_path) -> Path:
    if not isinstance(relative_path, str) or not relative_path.strip():
        raise AppError("Đường dẫn tài liệu không hợp lệ.")
    root = documents_root()
    candidate = (root / relative_path).resolve()
    if not _inside(root, candidate):
        raise AppError("Ứng dụng đã chặn đường dẫn nằm ngoài kho tài liệu.")
    if candidate.suffix.lower() != ".pdf":
        raise AppError("Ứng dụng chỉ cho phép mở tài liệu PDF trong kho chương trình.")
    return candidate


def added_filename(relative_path) -> str | None:
    """Trả về tên tệp nếu đường dẫn thuộc kho PDF bổ sung (user-added/...), ngược lại None."""
    normalized = str(relative_path or "").replace("\\", "/")
    if not normalized.startswith(ADDED_PREFIX):
        return None
    name = normalized[len(ADDED_PREFIX):]
    if not name or "/" in name or name in (".", "..") or PurePath(name).suffix.lower() != ".pdf":
        raise AppError("Ứng dụng đã chặn đường dẫn nằm ngoài kho tài liệu.")
    return name


def resolve_guide(format_name: str) -> Path:
    filename = GUIDE_FILES.get(format_name)
    if not filename:
        raise AppError("Định dạng tài liệu hướng dẫn không hợp lệ.")
    return guides_root() / filename


def trusted_resource_url(resource_id: str) -> str:
    url = TRUSTED_RESOURCES.get(resource_id)
    if not url:
        raise AppError("Nguồn trực tuyến không nằm trong danh sách được phép.")
    return url


class AddedDocuments:
    def __init__(self, repository: Repository):
        self.repository = repository

    def read(self, filename: str) -> bytes:
        row = self.repository._one("SELECT data FROM kh_added_documents WHERE filename=:f", f=filename)
        if not row:
            raise AppError("Không tìm thấy tài liệu PDF.")
        return bytes(row["data"])

    def _unique_name(self, filename: str) -> str:
        safe = safe_import_name(filename)
        path = PurePath(safe)
        candidate, number = safe, 2
        while self.repository._one("SELECT 1 AS x FROM kh_added_documents WHERE filename=:f", f=candidate):
            candidate = f"{path.stem}-{number}{path.suffix}"
            number += 1
        return candidate

    def add(self, files: list[dict], actor="") -> list[dict]:
        imported = []
        for file in files:
            name = self._unique_name(file["name"])
            now = iso()
            with self.repository.engine.begin() as conn:
                conn.execute(text("INSERT INTO kh_added_documents(filename,data,size,created_at) VALUES(:f,:d,:s,:now)"),
                             {"f": name, "d": file["data"], "s": len(file["data"]), "now": now})
            imported.append({
                "id": f"source-{uuid.uuid4()}", "filename": name, "relativePath": f"{ADDED_PREFIX}{name}", "documentType": "PDF nguồn bổ sung",
                "pageCount": None, "importedAt": now, "importedBy": str(actor or "").strip(), "reviewStatus": "Mới nhập – cần rà soát",
                "size": len(file["data"]),
            })
        return imported

    def remove(self, filename: str) -> bool:
        with self.repository.engine.begin() as conn:
            return conn.execute(text("DELETE FROM kh_added_documents WHERE filename=:f"), {"f": filename}).rowcount > 0


class PendingImports:
    """Tệp đã chọn nhưng chưa xác nhận nhập (bản Node giữ trong Map + thư mục tạm)."""

    def __init__(self):
        self._items: dict[str, dict] = {}

    def put(self, name: str, data: bytes, kind: str) -> str:
        self._purge()
        token = str(uuid.uuid4())
        self._items[token] = {"name": name, "data": data, "size": len(data), "kind": kind, "createdAt": time.time()}
        return token

    def get(self, token) -> dict | None:
        return self._items.get(token) if isinstance(token, str) else None

    def discard(self, token) -> None:
        if isinstance(token, str):
            self._items.pop(token, None)

    def _purge(self) -> None:
        cutoff = time.time() - PENDING_TTL_SECONDS
        for token in [t for t, item in self._items.items() if item["createdAt"] < cutoff]:
            self._items.pop(token, None)
