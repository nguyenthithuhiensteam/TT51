\
import json
from . import prompts
from .provider import AIProvider
from .rules import validate_source_locked, five_rights, review_text
from .schemas import (
    FiveBInput, FiveBOutput, YearGoalInput, YearGoalOutput,
    MonthGoalInput, MonthGoalOutput, LessonInput, LessonOutput,
    ReviewInput, ReviewOutput, ReviewIssue, TraceInput, TraceOutput,
)

def _json(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)

class GDMNPilotService:
    def __init__(self, provider: AIProvider):
        self.provider = provider

    async def decompose(self, data: FiveBInput) -> FiveBOutput:
        user = f"""DỮ LIỆU GỐC:
{_json(data.source.model_dump())}

ĐỘ TUỔI CẦN PHÂN GIẢI:
{_json(data.target_ages)}

THỰC TRẠNG TRẺ (nếu có):
{_json(data.child_context.model_dump() if data.child_context else {})}

Hãy trả về đúng cấu trúc FiveBOutput."""
        result = await self.provider.structured(
            system=prompts.FIVE_B, user=user, output_model=FiveBOutput
        )
        warnings = validate_source_locked(data.source, result.source)
        rights = five_rights(data.source, [g.goal for g in result.goals])
        result.source = data.source
        result.five_rights = rights
        result.warnings = list(dict.fromkeys(result.warnings + warnings))
        return result

    async def year_goal(self, data: YearGoalInput) -> YearGoalOutput:
        user = f"""DỮ LIỆU GỐC:
{_json(data.source.model_dump())}
ĐỘ TUỔI: {data.age}
THỰC TRẠNG TRẺ:
{_json(data.child_context.model_dump() if data.child_context else {})}
MỤC TIÊU ĐỀ XUẤT (nếu người dùng đã nhập):
{data.proposed_goal or ""}

Hãy tạo/chuẩn hóa MỤC TIÊU NĂM, không tạo YCCĐ mới."""
        result = await self.provider.structured(
            system=prompts.FIVE_B, user=user, output_model=YearGoalOutput
        )
        result.source = data.source
        result.trace_ok = True
        return result

    async def month_goal(self, data: MonthGoalInput) -> MonthGoalOutput:
        user = f"""DỮ LIỆU GỐC:
{_json(data.source.model_dump())}
MỤC TIÊU NĂM:
{data.year_goal}
THÁNG/CHỦ ĐỀ/DỰ ÁN:
{data.month_or_theme}
THỰC TRẠNG TRẺ:
{_json(data.child_context.model_dump())}
MỤC TIÊU ĐỀ XUẤT:
{data.proposed_goal or ""}

Thực hiện CHỌN → SOI TRẺ → CỤ THỂ HÓA → GẮN CƠ HỘI → ĐIỀU CHỈNH."""
        result = await self.provider.structured(
            system=prompts.MONTH, user=user, output_model=MonthGoalOutput
        )
        result.source = data.source
        result.year_goal = data.year_goal
        result.month_or_theme = data.month_or_theme
        return result

    async def lesson(self, data: LessonInput) -> LessonOutput:
        user = f"""DỮ LIỆU GỐC:
{_json(data.source.model_dump())}
ĐỘ TUỔI: {data.age}
LĨNH VỰC: {data.field}
TÊN HOẠT ĐỘNG: {data.title}
MỤC TIÊU NĂM: {data.year_goal}
MỤC TIÊU THÁNG/CHỦ ĐỀ: {data.month_goal}
THỰC TRẠNG TRẺ:
{_json(data.child_context.model_dump())}
THỜI GIAN: {data.duration_minutes}
KHÔNG GIAN: {data.space or ""}

Hãy thiết kế hoạt động theo 7 bước. Không biến thành kịch bản cô nói."""
        result = await self.provider.structured(
            system=prompts.LESSON, user=user, output_model=LessonOutput
        )
        result.source = data.source
        result.trace = [
            f"Năng lực: {data.source.competency_id}",
            f"YCCĐ: {data.source.requirement_id}",
            f"Chỉ số: {data.source.indicator_id}",
            f"Mục tiêu năm: {data.year_goal}",
            f"Mục tiêu tháng/chủ đề: {data.month_goal}",
            f"Hoạt động: {data.title}",
        ]
        return result

    async def review(self, data: ReviewInput) -> ReviewOutput:
        issues = [ReviewIssue(**x) for x in review_text(data.text)]
        overall = "Đạt kiểm tra cơ bản." if all(i.status == "dat" for i in issues) else "Cần rà soát/sửa một số điểm."
        return ReviewOutput(issues=issues, overall=overall)

    async def trace(self, data: TraceInput) -> TraceOutput:
        path = [
            f"NL [{data.source.competency_id}] {data.source.competency}",
            f"YCCĐ [{data.source.requirement_id}] {data.source.requirement}",
            f"CS [{data.source.indicator_id}] {data.source.indicator}",
        ]
        if data.year_goal:
            path.append(f"Mục tiêu năm: {data.year_goal}")
        if data.month_goal:
            path.append(f"Mục tiêu tháng/chủ đề: {data.month_goal}")
        if data.activity_goal:
            path.append(f"Mục tiêu hoạt động: {data.activity_goal}")
        return TraceOutput(path=path, valid=True)
