\
from typing import Protocol, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class AIProvider(Protocol):
    async def structured(self, *, system: str, user: str, output_model: Type[T]) -> T:
        """Triển khai adapter cho OpenAI/LLM đang dùng trong app."""
        ...

class MissingAIProvider:
    async def structured(self, *, system: str, user: str, output_model: Type[T]) -> T:
        raise RuntimeError(
            "Plugin chưa được gắn AIProvider. "
            "Hãy truyền provider của app vào register(app, ai_provider=...)."
        )
