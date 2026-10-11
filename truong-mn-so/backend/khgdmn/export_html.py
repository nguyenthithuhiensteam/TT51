"""HTML kế hoạch để in PDF — chuyển nguyên văn từ electron/export-html.cjs."""
from __future__ import annotations

import re

from .plan_schema import DEVELOPMENT_DOMAINS, WEEK_DAYS, js_str, normalize_plan_type, parse_annual_rows, parse_theme_rows, parse_weekly_rows

_SIGNATURE_IMAGE = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$")

TITLES = {
    "annual": "KẾ HOẠCH GIÁO DỤC NĂM",
    "theme": "KẾ HOẠCH GIÁO DỤC CHỦ ĐỀ",
    "weekly": "KẾ HOẠCH CHĂM SÓC GIÁO DỤC TRẺ",
    "lesson": "GIÁO ÁN HOẠT ĐỘNG GIÁO DỤC",
}


def escape_html(value="") -> str:
    return js_str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("\n", "<br>")


def _v(value) -> str:
    """Tương đương `value || ''` rồi escape."""
    return escape_html(value if value not in (None, "", 0, False) else "")


def _row(cells, tag="td") -> str:
    return "<tr>" + "".join(f"<{tag}>{escape_html(cell)}</{tag}>" for cell in cells) + "</tr>"


def _title(plan, school, plan_type) -> str:
    return f"""<header>
    <b>{escape_html(js_str(school.get('name') or 'TRƯỜNG MẦM NON').upper())}</b>
    <h1>{TITLES[plan_type]}</h1>
    <h2>{escape_html(plan.get('title') or 'Kế hoạch giáo dục')}</h2>
    <strong>Thời gian thực hiện: {escape_html(plan.get('period') or '................................')}</strong>
    <em>Lớp: {_v(plan.get('className') or plan.get('ageGroup'))} - Giáo viên: {_v(plan.get('author'))}</em>
  </header>"""


def _annual(plan) -> str:
    body = "".join(_row([i + 1, r["period"], r["theme"], r["objective"], r["content"], r["activity"]]) for i, r in enumerate(parse_annual_rows(plan)))
    return f"<table><thead>{_row(['STT', 'Thời gian', 'Chủ đề', 'Mục tiêu', 'Nội dung', 'Hoạt động'], 'th')}</thead><tbody>{body}</tbody></table>"


def _theme(plan) -> str:
    items = parse_theme_rows(plan)
    sequence = 0
    body = []
    for domain in DEVELOPMENT_DOMAINS:
        rows = [item for item in items if item["domain"] == domain]
        if not rows:
            continue
        body.append(f'<tr class="section"><td colspan="4">{escape_html(domain.upper())}</td></tr>')
        for item in rows:
            sequence += 1
            body.append(_row([sequence, item["objective"], item["content"], item["activity"]]))
    return f"<table><thead>{_row(['STT', 'Mục tiêu', 'Nội dung', 'Hoạt động'], 'th')}</thead><tbody>{''.join(body)}</tbody></table>"


def _section(plan, key, heading) -> str:
    return f"<h3>{heading}</h3><p>{escape_html(plan[key])}</p>" if plan.get(key) else ""


def _weekly(plan) -> str:
    morning = "\n".join(js_str(plan.get(k)) for k in ("weeklyWelcome", "weeklyCircleTime", "weeklyMorningExercise") if plan.get(k))
    rows = "".join(_row([r["activity"], *(r[key] for key, _ in WEEK_DAYS)]) for r in parse_weekly_rows(plan))
    return (
        _section(plan, "objectives", "MỤC TIÊU TRỌNG TÂM TRONG TUẦN")
        + (f"<h3>ĐÓN TRẺ, TRÒ CHUYỆN, THỂ DỤC SÁNG</h3><p>{escape_html(morning)}</p>" if morning else "")
        + f"<h3>HOẠT ĐỘNG HỌC</h3><table><thead>{_row(['Nội dung hoạt động', *(label for _, label in WEEK_DAYS)], 'th')}</thead><tbody>{rows}</tbody></table>"
        + _section(plan, "weeklyCornerActivities", "HOẠT ĐỘNG GÓC")
        + _section(plan, "weeklyOutdoorActivities", "HOẠT ĐỘNG NGOÀI TRỜI")
        + _section(plan, "weeklyMealSleep", "VỆ SINH, ĂN, NGỦ")
        + _section(plan, "weeklyAfternoon", "HOẠT ĐỘNG CHIỀU")
        + _section(plan, "assessment", "ĐÁNH GIÁ VÀ ĐIỀU CHỈNH SAU TUẦN")
        + _section(plan, "weeklyNotes", "GHI CHÚ VÀ ĐIỀU CHỈNH TRONG TUẦN")
    )


def _lesson(plan) -> str:
    return f"""<h2>{escape_html(plan.get('lessonDomain') or plan.get('developmentArea') or 'LĨNH VỰC PHÁT TRIỂN')}</h2>
    <h2>{escape_html(js_str(plan.get('lessonTitle') or plan.get('title') or '').upper())}</h2>
    <h3>I. MỤC ĐÍCH - YÊU CẦU</h3><p>{_v(plan.get('lessonObjectives') or plan.get('objectives'))}</p>
    <h3>II. CHUẨN BỊ</h3><p>{_v(plan.get('lessonPreparation') or plan.get('materials'))}</p>
    <h3>III. TIẾN HÀNH HOẠT ĐỘNG</h3>
    <table><thead>{_row(['Hoạt động của cô', 'Hoạt động của trẻ'], 'th')}</thead><tbody>{_row([plan.get('teacherActivities') or plan.get('activities') or '', plan.get('childActivities') or ''])}</tbody></table>
    <h3 class="center">ĐÁNH GIÁ CUỐI NGÀY</h3><p>{escape_html(plan.get('dailyEvaluation') or plan.get('assessment') or '................................................................................................')}</p>"""


def _signatures(plan) -> str:
    signers = plan.get("signers") or []
    if not signers:
        dots = "........................................................................................................................"
        return f'<h3 class="center">NHẬN XÉT CỦA BAN GIÁM HIỆU</h3><p class="review-lines">{dots}<br><br>{dots}<br><br>{dots}</p>'
    blocks = []
    for item in signers[:3]:
        # Chỉ nhận ảnh data:image base64 (bản Node chèn nguyên chuỗi; ở đây chặn để Chromium in PDF không tải URL lạ).
        image_data = js_str(item.get("imageData"))
        valid_image = item.get("mode") == "image" and _SIGNATURE_IMAGE.match(image_data)
        image = f'<img src="{image_data}">' if valid_image else '<span class="sign-space"></span>'
        name = "" if item.get("mode") == "hand" else escape_html(item.get("name"))
        blocks.append(f"<div><b>{escape_html(item.get('displayTitle') or item.get('role'))}</b>{image}<strong>{name}</strong></div>")
    return f'<h3 class="center">XÁC NHẬN VÀ CHỮ KÝ</h3><div class="signatures">{"".join(blocks)}</div>'


def create_plan_html(plan: dict | None = None, school: dict | None = None) -> str:
    plan = plan or {}
    school = school or {}
    plan_type = normalize_plan_type(plan.get("level"))
    body = {"annual": _annual, "theme": _theme, "weekly": _weekly, "lesson": _lesson}[plan_type](plan)
    landscape = plan_type != "lesson"
    return f"""<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Trường Mầm non Số - {escape_html(plan.get('title') or 'Kế hoạch giáo dục')}</title><style>
    @page {{ size: A4 {'landscape' if landscape else 'portrait'}; margin: {'10mm' if landscape else '15mm 14mm 14mm 20mm'}; }}
    * {{ box-sizing: border-box; }} body {{ font-family: "Times New Roman", serif; font-size: {'11pt' if landscape else '13pt'}; line-height: 1.25; color: #000; }}
    header {{ text-align:center; margin-bottom: 10px; }} header b, header strong, header em {{ display:block; }} h1 {{ font-size: 17pt; margin:4px 0; }} h2 {{ font-size:15pt; text-align:center; margin:5px 0; }} h3 {{ font-size:13pt; margin:10px 0 4px; }} p {{ white-space:normal; margin:3px 0 8px; }}
    table {{ width:100%; border-collapse:collapse; table-layout:fixed; page-break-inside:auto; }} thead {{ display:table-header-group; }} tr {{ page-break-inside:avoid; }} th,td {{ border:1px solid #000; padding:5px; vertical-align:top; overflow-wrap:anywhere; }} th {{ text-align:center; vertical-align:middle; background:#eef5f4; font-weight:bold; }} .section td {{ background:#f2f2f2; font-weight:bold; }} .center {{ text-align:center; }}
    .signatures {{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; text-align:center; }} .signatures div {{ display:flex; flex-direction:column; align-items:center; }} .signatures img {{ width:120px; height:55px; object-fit:contain; }} .sign-space {{ height:70px; }} .review-lines {{ text-align:center; }}
  </style></head><body>{_title(plan, school, plan_type)}{body}{_signatures(plan)}</body></html>"""
