\
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

AgeGroup = Literal[
    "3-12m", "12-24m", "24-36m",
    "3-4y", "4-5y", "5-6y"
]

class SourceRef(BaseModel):
    """Dữ liệu gốc của Chương trình. Không tự ý sửa."""
    model_config = ConfigDict(extra="forbid")
    competency_id: str
    competency: str
    requirement_id: str
    requirement: str
    indicator_id: str
    indicator: str

class ChildContext(BaseModel):
    current_level: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    needs_support: List[str] = Field(default_factory=list)
    notable_differences: List[str] = Field(default_factory=list)
    notes: Optional[str] = None

class FiveBInput(BaseModel):
    source: SourceRef
    target_ages: List[AgeGroup]
    child_context: Optional[ChildContext] = None

class FiveBAnalysis(BaseModel):
    essence: str
    observable_behaviors: List[str]
    development_axes: Dict[str, str]
    context_progression: str
    support_progression: str

class GoalByAge(BaseModel):
    age: AgeGroup
    goal: str

class FiveBOutput(BaseModel):
    source: SourceRef
    analysis: FiveBAnalysis
    goals: List[GoalByAge]
    five_rights: Dict[str, bool]
    warnings: List[str] = Field(default_factory=list)

class YearGoalInput(BaseModel):
    source: SourceRef
    age: AgeGroup
    child_context: Optional[ChildContext] = None
    proposed_goal: Optional[str] = None

class YearGoalOutput(BaseModel):
    source: SourceRef
    age: AgeGroup
    year_goal: str
    rationale: str
    trace_ok: bool
    warnings: List[str] = Field(default_factory=list)

class MonthGoalInput(BaseModel):
    source: SourceRef
    year_goal: str
    month_or_theme: str
    child_context: ChildContext
    proposed_goal: Optional[str] = None

class MonthGoalOutput(BaseModel):
    source: SourceRef
    year_goal: str
    month_or_theme: str
    priority_reason: str
    month_goal: str
    opportunities: List[str]
    evidence: List[str]
    next_adjustment: str
    warnings: List[str] = Field(default_factory=list)

class LessonInput(BaseModel):
    source: SourceRef
    year_goal: str
    month_goal: str
    age: AgeGroup
    field: Literal["the_chat", "nhan_thuc", "ngon_ngu", "tinh_cam_xa_hoi", "nghe_thuat"]
    title: str
    child_context: ChildContext
    duration_minutes: Optional[int] = None
    space: Optional[str] = None

class LessonPhase(BaseModel):
    phase: str
    child_does: List[str]
    teacher_supports: List[str]
    observe: List[str]

class LessonOutput(BaseModel):
    source: SourceRef
    title: str
    age: AgeGroup
    field: str
    activity_goals: List[str]
    content: List[str]
    environment_and_materials: List[str]
    differentiation: Dict[str, List[str]]
    phases: List[LessonPhase]
    evidence: List[str]
    adjustment_after_observation: List[str]
    trace: List[str]
    warnings: List[str] = Field(default_factory=list)

class ReviewInput(BaseModel):
    text: str
    source: Optional[SourceRef] = None
    year_goal: Optional[str] = None
    month_goal: Optional[str] = None

class ReviewIssue(BaseModel):
    criterion: str
    status: Literal["dat", "can_sua", "thieu_du_lieu"]
    detail: str
    fix: str

class ReviewOutput(BaseModel):
    issues: List[ReviewIssue]
    overall: str
    revised_excerpt: Optional[str] = None

class TraceInput(BaseModel):
    source: SourceRef
    year_goal: Optional[str] = None
    month_goal: Optional[str] = None
    activity_goal: Optional[str] = None

class TraceOutput(BaseModel):
    path: List[str]
    valid: bool
    warnings: List[str] = Field(default_factory=list)
