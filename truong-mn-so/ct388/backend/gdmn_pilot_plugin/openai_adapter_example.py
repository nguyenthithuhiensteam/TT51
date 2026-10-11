\
"""
Ví dụ adapter. Chỉ dùng khi app của bạn đã có OpenAI client.
Không bắt buộc plugin phụ thuộc trực tiếp vào SDK OpenAI.
"""
from typing import Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class OpenAIProviderExample:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    async def structured(self, *, system: str, user: str, output_model: Type[T]) -> T:
        # Hãy thay phần này bằng wrapper AI hiện có của app.
        # Mục tiêu là trả về một instance của output_model.
        raise NotImplementedError("Kết nối với AI wrapper hiện có của app.")
