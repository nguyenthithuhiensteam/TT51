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
from .plan_schema import PLAN_TYPES, js_str, normalize_plan_type, parse_annual_rows, parse_theme_rows, parse_weekly_rows
from .repository import Repository, iso

BUILT_INS = [{"id": f"builtin-{key}", "name": f"{name} - mẫu chuẩn", "type": key, "builtIn": True} for key, name in PLAN_TYPES.items()]
REGISTRY_KEY = "templateRegistry"
_PARAGRAPH_RE = re.compile(r"<w:p\b[\s\S]*?</w:p>")
_TEXT_RE = re.compile(r"<w:t\b[^>]*>([\s\S]*?)</w:t>")
_SAFE_FILENAME_RE = re.compile(r"^custom-[a-f0-9-]+\.docx$", re.IGNORECASE)


def paragraph_text(paragraph_xml: str = "") -> str:
    joined = "".join(_TEXT_RE.findall(paragraph_xml))
    return joined.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"').replace("&apos;", "'")


def xml_escape(value="") -> str:
    return js_str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def _text_paragraph(value="", bold=False) -> str:
    properties = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f'<w:p><w:r>{properties}<w:t xml:space="preserve">{xml_escape(value)}</w:t></w:r></w:p>'


def _table_row(values, widths, header=False) -> str:
    cells = "".join(f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>{_text_paragraph(value, header)}</w:tc>'
                    for value, width in zip(values, widths))
    return f"<w:tr>{'<w:trPr><w:tblHeader/></w:trPr>' if header else ''}{cells}</w:tr>"


def plan_table_xml(plan: dict) -> str:
    plan_type = normalize_plan_type(plan.get("level"))
    if plan_type == "annual":
        widths = [520, 1120, 1800, 2400, 2400, 2440]
        header = ["STT", "Thời gian", "Chủ đề", "Mục tiêu", "Nội dung", "Hoạt động"]
        rows = [[i + 1, r["period"], r["theme"], r["objective"], r["content"], r["activity"]] for i, r in enumerate(parse_annual_rows(plan))]
    elif plan_type == "theme":
        widths = [560, 3360, 3240, 3240]
        header = ["STT", "Mục tiêu", "Nội dung", "Hoạt động"]
        rows = [[i + 1, f"{r['domain']}\n{r['objective']}", r["content"], r["activity"]] for i, r in enumerate(parse_theme_rows(plan))]
    elif plan_type == "weekly":
        widths = [1600, 1848, 1848, 1848, 1848, 1848]
        header = ["Nội dung hoạt động", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu"]
        rows = [[r["activity"], r["monday"], r["tuesday"], r["wednesday"], r["thursday"], r["friday"]] for r in parse_weekly_rows(plan)]
    else:
        widths = [5000, 5000]
        header = ["Hoạt động của cô", "Hoạt động của trẻ"]
        rows = [[plan.get("teacherActivities") or plan.get("activities") or "", plan.get("childActivities") or ""]]
    borders = "".join(f'<w:{side} w:val="single" w:sz="4"/>' for side in ("top", "left", "bottom", "right", "insideH", "insideV"))
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    body = _table_row(header, widths, True) + "".join(_table_row(values, widths) for values in rows)
    return f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:tblBorders>{borders}</w:tblBorders></w:tblPr><w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl>'


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

    def render_custom(self, template_id, plan: dict, school: dict) -> bytes | None:
        template = self.resolve(template_id, plan)
        if not template:
            return None
        source = self.file_bytes(template["filename"])
        with zipfile.ZipFile(io.BytesIO(source)) as archive:
            if "word/document.xml" not in archive.namelist():
                raise AppError("Mẫu DOCX không có nội dung Word hợp lệ.")
            entries = [(info, archive.read(info.filename)) for info in archive.infolist()]
        xml = next(data for info, data in entries if info.filename == "word/document.xml").decode("utf-8")
        tokens = {
            "{{SCHOOL_NAME}}": school.get("name"), "{{SCHOOL_YEAR}}": school.get("schoolYear"), "{{PLAN_TITLE}}": plan.get("title"),
            "{{PLAN_PERIOD}}": plan.get("period"), "{{PLAN_CLASS}}": plan.get("className") or plan.get("ageGroup"),
            "{{PLAN_AUTHOR}}": plan.get("author"), "{{PLAN_OBJECTIVES}}": plan.get("objectives"), "{{PLAN_ACTIVITIES}}": plan.get("activities"),
            "{{PLAN_MATERIALS}}": plan.get("materials"), "{{PLAN_ASSESSMENT}}": plan.get("assessment"),
        }
        for token, value in tokens.items():
            xml = xml.replace(token, xml_escape(value or ""))
        table_xml = plan_table_xml(plan)
        replaced = False

        def swap(match):
            nonlocal replaced
            if paragraph_text(match.group(0)).strip() != "{{PLAN_TABLE}}":
                return match.group(0)
            replaced = True
            return table_xml

        xml = _PARAGRAPH_RE.sub(swap, xml)
        if not replaced:
            raise AppError("Mẫu DOCX tùy chỉnh cần có biến {{PLAN_TABLE}} trong một dòng riêng.")
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for info, data in entries:
                archive.writestr(info.filename, xml.encode("utf-8") if info.filename == "word/document.xml" else data)
        return output.getvalue()

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
