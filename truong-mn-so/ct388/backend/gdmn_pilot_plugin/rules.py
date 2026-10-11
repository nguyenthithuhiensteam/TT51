\
import re
from typing import Dict, List
from .schemas import SourceRef

NON_OBSERVABLE = [
    "hiểu", "nắm được", "nhận thức tốt", "có ý thức tốt", "phát triển tốt"
]

def validate_source_locked(original: SourceRef, returned: SourceRef) -> List[str]:
    warnings = []
    for field in (
        "competency_id", "competency",
        "requirement_id", "requirement",
        "indicator_id", "indicator",
    ):
        if getattr(original, field) != getattr(returned, field):
            warnings.append(f"Dữ liệu nguồn bị thay đổi ở trường '{field}'.")
    return warnings

def observable_goal(goal: str) -> bool:
    low = goal.lower()
    if any(x in low for x in NON_OBSERVABLE):
        return False
    observable_markers = [
        "chỉ", "chọn", "gọi tên", "nói", "kể", "mô tả", "thực hiện",
        "thử", "phân loại", "so sánh", "trao đổi", "phối hợp",
        "giải thích", "lựa chọn", "điều chỉnh", "tạo", "vận động",
        "quan sát", "dự đoán", "sắp xếp", "nhận biết"
    ]
    return any(x in low for x in observable_markers)

def five_rights(source: SourceRef, goals: List[str]) -> Dict[str, bool]:
    joined = " ".join(goals).lower()
    return {
        "dung_nguon": bool(source.competency_id and source.requirement_id and source.indicator_id),
        "dung_ban_chat": len(source.indicator.strip()) > 0,
        "dung_phat_trien": len(goals) >= 1 and len(set(g.strip() for g in goals if g.strip())) == len([g for g in goals if g.strip()]),
        "dung_tre": all(observable_goal(g) for g in goals if g.strip()),
        "dung_dich": len(joined) > 0,
    }

def review_text(text: str) -> List[dict]:
    low = text.lower()
    issues = []

    def add(c, s, d, f):
        issues.append({"criterion": c, "status": s, "detail": d, "fix": f})

    if re.search(r"yccđ\s*3.?4|yccđ\s*4.?5|yccđ\s*5.?6", low):
        add("Không tạo YCCĐ mới", "can_sua",
            "Phát hiện cách gọi YCCĐ theo từng độ tuổi.",
            "Đổi thành Mục tiêu 3–4 / 4–5 / 5–6 tuổi nếu đây là sản phẩm phân giải.")
    else:
        add("Không tạo YCCĐ mới", "dat", "Không phát hiện hệ YCCĐ mới theo tuổi.", "Giữ nguyên.")

    if any(x in low for x in NON_OBSERVABLE):
        add("Mục tiêu quan sát được", "can_sua",
            "Có động từ khó quan sát trực tiếp.",
            "Đổi sang hành động quan sát được: chọn, nói, kể, thực hiện, thử, so sánh, phối hợp...")
    else:
        add("Mục tiêu quan sát được", "dat", "Không phát hiện cụm diễn đạt mơ hồ phổ biến.", "Giữ nguyên.")

    if "trẻ làm gì" in low or "trẻ " in low:
        add("Lấy trẻ làm trung tâm", "dat", "Có dấu hiệu tập trung vào hành động của trẻ.", "Giữ nguyên.")
    else:
        add("Lấy trẻ làm trung tâm", "thieu_du_lieu",
            "Chưa thấy rõ hành động/trải nghiệm của trẻ.",
            "Bổ sung cột hoặc mô tả 'Trẻ làm gì?'.")
    return issues
