\
from .provider import MissingAIProvider
from .service import GDMNPilotService
from .router import build_router

def register(app, ai_provider=None):
    """
    Gắn plugin vào FastAPI app hiện có.
    Không thay đổi DB hay route cũ.
    """
    provider = ai_provider or MissingAIProvider()
    service = GDMNPilotService(provider)
    app.include_router(build_router(service))
    return service
