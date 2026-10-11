"""Danh mục lĩnh vực phát triển — chuyển từ phần đầu electron/plan-schema.cjs."""
import re

PLAN_TYPES = {
    "annual": "Kế hoạch giáo dục năm",
    "theme": "Kế hoạch chủ đề/tháng",
    "weekly": "Kế hoạch giáo dục tuần",
    "lesson": "Giáo án/hoạt động giáo dục ngày",
}

DEVELOPMENT_DOMAINS = (
    "Giáo dục phát triển thể chất",
    "Giáo dục phát triển tình cảm và kỹ năng xã hội",
    "Giáo dục phát triển ngôn ngữ",
    "Giáo dục phát triển nhận thức",
    "Giáo dục phát triển thẩm mỹ",
)

# Nhóm nhà trẻ (18-36 tháng) dùng khung 4 lĩnh vực (gộp TCXH và thẩm mỹ), khác mẫu giáo (5 lĩnh vực).
NHA_TRE_DOMAINS = (
    "Giáo dục phát triển thể chất",
    "Giáo dục phát triển nhận thức",
    "Giáo dục phát triển ngôn ngữ",
    "Giáo dục phát triển tình cảm, kỹ năng xã hội và thẩm mỹ",
)

# Riêng mẫu giáo lớn (5-6 tuổi) có thêm lĩnh vực "Tiếp cận với việc học", chỉ dùng cho ngân hàng mục tiêu.
MAU_GIAO_LON_EXTRA_DOMAIN = "Giáo dục phát triển tiếp cận với việc học"


def is_nha_tre_age_group(age_group: str = "") -> bool:
    return bool(re.search(r"tháng", str(age_group), re.IGNORECASE))


def is_mau_giao_lon_age_group(age_group: str = "") -> bool:
    return bool(re.search(r"5.{0,2}6.*tuổi", str(age_group), re.IGNORECASE))


WEEK_DAYS = (
    ("monday", "Thứ hai"),
    ("tuesday", "Thứ ba"),
    ("wednesday", "Thứ tư"),
    ("thursday", "Thứ năm"),
    ("friday", "Thứ sáu"),
)


def js_str(value) -> str:
    """String(value) của JS cho các giá trị hay gặp trong kế hoạch (None → '')."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def split_lines(value="") -> list[str]:
    return [line.strip() for line in re.split(r"\r?\n", js_str(value)) if line.strip()]


def parse_pipe_rows(value, keys) -> list[dict]:
    rows = []
    for line in split_lines(value):
        parts = [part.strip() for part in line.split("|")]
        rows.append({key: (parts[index] if index < len(parts) else "") or "" for index, key in enumerate(keys)})
    return rows


def parse_theme_rows(plan: dict) -> list[dict]:
    fields = (("themePhysical", DEVELOPMENT_DOMAINS[0]), ("themeSocial", DEVELOPMENT_DOMAINS[1]), ("themeLanguage", DEVELOPMENT_DOMAINS[2]),
              ("themeCognitive", DEVELOPMENT_DOMAINS[3]), ("themeAesthetic", DEVELOPMENT_DOMAINS[4]))
    rows = []
    for field, domain in fields:
        for index, row in enumerate(parse_pipe_rows(plan.get(field), ("objective", "content", "activity"))):
            rows.append({"domain": domain, "index": index + 1, **row})
    if not rows and (plan.get("objectives") or plan.get("activities")):
        rows.append({"domain": DEVELOPMENT_DOMAINS[0], "index": 1, "objective": plan.get("objectives") or "",
                     "content": plan.get("content") or "", "activity": plan.get("activities") or ""})
    return rows


def parse_annual_rows(plan: dict) -> list[dict]:
    rows = parse_pipe_rows(plan.get("annualRows"), ("period", "theme", "objective", "content", "activity"))
    if not rows and (plan.get("objectives") or plan.get("activities")):
        rows.append({"period": plan.get("period") or "", "theme": plan.get("title") or "", "objective": plan.get("objectives") or "",
                     "content": plan.get("content") or "", "activity": plan.get("activities") or ""})
    return rows


def parse_weekly_rows(plan: dict) -> list[dict]:
    rows = parse_pipe_rows(plan.get("weeklyRows"), ("activity", "monday", "tuesday", "wednesday", "thursday", "friday"))
    if not rows and (plan.get("activities") or plan.get("objectives")):
        rows.append({"activity": "Hoạt động học", "monday": plan.get("activities") or plan.get("objectives") or "",
                     "tuesday": "", "wednesday": "", "thursday": "", "friday": ""})
    return rows


_ROW_KEYS = ("category", "period", "theme", "objective", "content", "activity", "monday", "tuesday", "wednesday",
             "thursday", "friday", "teacherActivity", "childActivity")
GENERIC_ROW_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {key: {"type": "string"} for key in _ROW_KEYS}, "required": list(_ROW_KEYS),
}
_PLAN_FIELDS = ("title", "context", "objectives", "activities", "materials", "differentiation", "assessment", "family")
PLAN_RESPONSE_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {**{key: {"type": "string"} for key in _PLAN_FIELDS}, "templateRows": {"type": "array", "items": GENERIC_ROW_SCHEMA}},
    "required": [*_PLAN_FIELDS, "templateRows"],
}
_LESSON_FIELDS = ("lessonTitle", "lessonDomain", "lessonObjectives", "lessonPreparation", "activity1Teacher", "activity1Child",
                  "activity2Teacher", "activity2Child", "activity3Teacher", "activity3Child", "dailyEvaluation")
LESSON_RESPONSE_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {key: {"type": "string"} for key in _LESSON_FIELDS}, "required": list(_LESSON_FIELDS),
}


def validate_lesson_response(value):
    from .errors import AppError

    if not isinstance(value, dict):
        raise AppError("AI không trả về một đối tượng JSON hợp lệ.")
    for field in _LESSON_FIELDS:
        if not isinstance(value.get(field), str):
            raise AppError(f'Trường AI "{field}" không hợp lệ.')
    return value


def validate_plan_response(value):
    from .errors import AppError

    if not isinstance(value, dict):
        raise AppError("AI không trả về một đối tượng JSON hợp lệ.")
    for field in _PLAN_FIELDS:
        if not isinstance(value.get(field), str):
            raise AppError(f'Trường AI "{field}" không hợp lệ.')
    if not isinstance(value.get("templateRows"), list):
        raise AppError("Danh sách dòng biểu mẫu do AI trả về không hợp lệ.")
    for row in value["templateRows"]:
        if not isinstance(row, dict):
            raise AppError("Một dòng biểu mẫu AI không hợp lệ.")
        for key in _ROW_KEYS:
            if not isinstance(row.get(key), str):
                raise AppError(f'Trường dòng AI "{key}" không hợp lệ.')
    return value


def normalize_plan_type(level="") -> str:
    value = str(level or "").strip().lower()
    if value in PLAN_TYPES:
        return value
    if "năm" in value:
        return "annual"
    if "tháng" in value or "chủ đề" in value:
        return "theme"
    if "tuần" in value:
        return "weekly"
    return "lesson"


def domains_for_age_group(age_group: str = "") -> tuple[str, ...]:
    if is_nha_tre_age_group(age_group):
        return NHA_TRE_DOMAINS
    if is_mau_giao_lon_age_group(age_group):
        return (*DEVELOPMENT_DOMAINS, MAU_GIAO_LON_EXTRA_DOMAIN)
    return DEVELOPMENT_DOMAINS
