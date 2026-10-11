\
from fastapi import APIRouter, HTTPException
from .schemas import *
from .service import GDMNPilotService

def build_router(service: GDMNPilotService) -> APIRouter:
    router = APIRouter(prefix="/api/gdmn-pilot", tags=["GDMN Pilot Assistant"])

    @router.get("/meta")
    async def meta():
        return {
            "name": "Trợ lý Chương trình GDMN thí điểm",
            "version": "1.0.0",
            "flows": [
                "5B phân giải mục tiêu",
                "Mục tiêu năm",
                "Mục tiêu tháng/chủ đề",
                "Soạn bài 7 bước",
                "Rà soát giáo án",
                "Truy xuất nguồn",
            ],
        }

    @router.post("/decompose", response_model=FiveBOutput)
    async def decompose(data: FiveBInput):
        try:
            return await service.decompose(data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/year-goal", response_model=YearGoalOutput)
    async def year_goal(data: YearGoalInput):
        try:
            return await service.year_goal(data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/month-goal", response_model=MonthGoalOutput)
    async def month_goal(data: MonthGoalInput):
        try:
            return await service.month_goal(data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/lesson", response_model=LessonOutput)
    async def lesson(data: LessonInput):
        try:
            return await service.lesson(data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/review", response_model=ReviewOutput)
    async def review(data: ReviewInput):
        return await service.review(data)

    @router.post("/trace", response_model=TraceOutput)
    async def trace(data: TraceInput):
        return await service.trace(data)

    return router
