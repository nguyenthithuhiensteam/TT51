"""Kiểm tra tệp nhập/xuất — chuyển từ electron/validation.cjs."""
from __future__ import annotations

import re
import unicodedata
from pathlib import PurePath

from .errors import AppError

IMPORT_EXTENSIONS = {"word": (".docx",), "excel": (".xlsx", ".xls"), "pdf": (".pdf",)}
MAX_IMPORT_BYTES = 25 * 1024 * 1024


def _basename(filename) -> str:
    # path.basename của Node trên Windows chấp nhận cả \ và /.
    return re.split(r"[\\/]", str(filename or ""))[-1]


def extension_of(filename) -> str:
    return PurePath(_basename(filename)).suffix.lower()


def validate_import_file(filename, size, kind: str) -> dict:
    extension = extension_of(filename)
    if extension not in IMPORT_EXTENSIONS.get(kind, ()):
        raise AppError(f"Định dạng {extension or '(không có)'} không được phép cho loại nhập này.")
    try:
        size_number = float(size)
    except (TypeError, ValueError):
        size_number = 0
    if size_number <= 0:
        raise AppError("Tệp trống hoặc không đọc được.")
    if size_number > MAX_IMPORT_BYTES:
        raise AppError("Tệp vượt quá giới hạn 25 MB.")
    return {"extension": extension, "size": int(size_number)}


def safe_import_name(filename) -> str:
    base = unicodedata.normalize("NFC", _basename(filename))
    if not base or re.search(r'[<>:"/\\|?*\x00-\x1F]', base):
        raise AppError("Tên tệp không tương thích Windows.")
    return base


def safe_export_name(filename, extension: str) -> str:
    name = safe_import_name(filename)
    if extension_of(name) != extension:
        raise AppError(f"Tên tệp phải có phần mở rộng {extension}.")
    return name


def detect_personal_data(value) -> list[str]:
    text = str(value or "")
    warnings = []
    if re.search(r"(?:^|\D)(?:\+?84|0)(?:[ .-]?\d){9,10}(?:\D|$)", text):
        warnings.append("Có thể chứa số điện thoại.")
    if re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE):
        warnings.append("Có thể chứa địa chỉ email.")
    if re.search(r"(?:ngày\s*sinh|sinh\s*ngày)\s*[:：-]?\s*(?:0?[1-9]|[12]\d|3[01])[/.\-](?:0?[1-9]|1[0-2])[/.\-](?:19|20)?\d{2}", text, re.IGNORECASE):
        warnings.append("Có thể chứa ngày sinh.")
    return warnings
