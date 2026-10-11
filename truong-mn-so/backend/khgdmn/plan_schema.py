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
