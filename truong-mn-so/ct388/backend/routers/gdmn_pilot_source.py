"""Cầu nối dữ liệu thật (yccd/competencies/milestones) sang đúng khuôn
SourceRef mà gdmn_pilot_plugin yêu cầu (competency/requirement/indicator +
id ổn định). Theo đúng mục 5 của INSTALL.md: không cho người dùng hoặc AI tự
tạo ID nguồn — mọi SourceRef trả về đây đều lấy thẳng từ DB hiện có."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from ct388.backend import db

router = APIRouter(prefix="/api/gdmn-pilot-source", tags=["GDMN Pilot Assistant"])

# AgeGroup của plugin (3-12m/12-24m/24-36m/3-4y/4-5y/5-6y) khác code age_groups
# thật trong DB (12-24th/24-36th/MGB/MGN/MGL). "3-12m" (nhà trẻ dưới 12 tháng)
# app hiện không có dữ liệu nên không đưa vào danh sách lựa chọn.
AGE_MAP: dict[str, str] = {
    "12-24m": "12-24th",
    "24-36m": "24-36th",
    "3-4y": "MGB",
    "4-5y": "MGN",
    "5-6y": "MGL",
}


@router.get("/age-groups")
def age_groups_for_plugin() -> list[dict[str, str]]:
    return [{"plugin_age": k, "db_code": v} for k, v in AGE_MAP.items()]


@router.get("/yccd-options")
def yccd_options(age_group: str | None = Query(default=None)) -> list[dict[str, Any]]:
    """Danh sách YCCĐ thật để chọn làm nguồn phân giải, kèm tên năng lực/lĩnh vực."""
    sql = """
        SELECT y.id AS yccd_id, y.code AS yccd_code, y.content AS yccd_content,
               c.id AS competency_id, c.code AS competency_code, c.name AS competency_name,
               d.name AS domain_name, ag.code AS age_code
        FROM yccd y
        LEFT JOIN competencies c ON c.id = y.competency_id
        LEFT JOIN domains d ON d.id = COALESCE(y.domain_id, c.domain_id)
        LEFT JOIN age_groups ag ON ag.id = y.age_group_id
        WHERE 1=1
    """
    params: dict[str, Any] = {}
    if age_group:
        db_code = AGE_MAP.get(age_group, age_group)
        sql += " AND (ag.code = :code OR y.age_group_id IS NULL)"
        params["code"] = db_code
    sql += " ORDER BY y.code"
    with db.get_connection() as conn:
        rows = db.rows_as_dicts(conn.execute(text(sql), params))
    return rows


@router.get("/build")
def build_source_ref(yccd_id: int = Query(...), age_group: str = Query(...)) -> dict[str, Any]:
    """Dựng SourceRef (competency/requirement/indicator) từ dữ liệu thật cho 1
    YCCĐ + 1 độ tuổi cụ thể. `indicator` = mốc phát triển (milestone) khớp mã
    YCCĐ này ở đúng độ tuổi, nếu có; nếu chưa có dữ liệu mốc riêng cho độ tuổi
    này thì dùng lại nội dung YCCĐ (không bịa thêm) và báo rõ trong `note`."""
    db_code = AGE_MAP.get(age_group)
    if not db_code:
        raise HTTPException(status_code=400, detail=f"Độ tuổi không hợp lệ: {age_group}")
    with db.get_connection() as conn:
        yccd_row = conn.execute(
            text(
                """
                SELECT y.id, y.code, y.content, c.id AS competency_id, c.code AS competency_code,
                       c.name AS competency_name
                FROM yccd y
                LEFT JOIN competencies c ON c.id = y.competency_id
                WHERE y.id = :yccd_id
                """
            ),
            {"yccd_id": yccd_id},
        ).mappings().fetchone()
        if not yccd_row:
            raise HTTPException(status_code=404, detail="Không tìm thấy YCCĐ.")
        milestone_row = conn.execute(
            text(
                """
                SELECT m.id, m.description
                FROM milestones m
                JOIN age_groups ag ON ag.id = m.age_group_id
                WHERE ag.code = :age_code AND m.title LIKE :code_prefix
                ORDER BY m.id LIMIT 1
                """
            ),
            {"age_code": db_code, "code_prefix": f"{yccd_row['code']} - %"},
        ).mappings().fetchone()

    note = None
    if milestone_row:
        indicator_id = f"milestone-{milestone_row['id']}"
        indicator = milestone_row["description"]
    else:
        indicator_id = yccd_row["code"]
        indicator = yccd_row["content"]
        note = (
            "Chưa có dữ liệu mốc phát triển (chỉ số) riêng cho YCCĐ này ở độ tuổi đã chọn — "
            "đang dùng lại nội dung YCCĐ làm chỉ số tạm thời."
        )

    competency_id = yccd_row["competency_code"] or (
        f"comp-{yccd_row['competency_id']}" if yccd_row["competency_id"] else "unknown"
    )
    competency = yccd_row["competency_name"] or "(chưa gắn năng lực)"

    result = {
        "competency_id": competency_id,
        "competency": competency,
        "requirement_id": yccd_row["code"],
        "requirement": yccd_row["content"],
        "indicator_id": indicator_id,
        "indicator": indicator,
    }
    if note:
        result["_note"] = note
    return result
