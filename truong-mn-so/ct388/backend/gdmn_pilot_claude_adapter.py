"""Adapter nối AIProvider của plugin gdmn_pilot_plugin với Claude API mà app
đã dùng sẵn (backend/ai_config.py + backend/routers/ai_routes.py). Plugin cố
tình không phụ thuộc SDK/nhà cung cấp AI cụ thể (xem provider.py) — file này
là phần "app tự viết" theo đúng hướng dẫn ở INSTALL.md mục 3.

Cách lấy JSON có cấu trúc từ Claude: dùng tool use (function calling) — khai
báo 1 tool có input_schema chính là JSON Schema của Pydantic model cần trả về,
ép model_choice bắt buộc gọi tool đó, rồi parse phần input của tool_use block.
Đây là cách được Anthropic khuyến nghị để lấy structured output đáng tin cậy,
thay vì yêu cầu model tự in JSON trong text (dễ lẫn text thừa/markdown).
"""

from __future__ import annotations

from typing import Type, TypeVar

import httpx
from pydantic import BaseModel

from ct388.backend.ai_config import get_api_key

T = TypeVar("T", bound=BaseModel)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5"


class ClaudeConfigMissing(RuntimeError):
    pass


class ClaudeStructuredProvider:
    """Triển khai AIProvider.structured() bằng Claude Messages API (tool use)."""

    def __init__(self, model: str = DEFAULT_MODEL, max_tokens: int = 4000, timeout: float = 60.0):
        self.model = model
        self.max_tokens = max_tokens
        self.timeout = timeout

    async def structured(self, *, system: str, user: str, output_model: Type[T]) -> T:
        api_key = get_api_key()
        if not api_key:
            raise ClaudeConfigMissing(
                "Chưa cấu hình Anthropic API key. Vào Cài đặt > Cài đặt Trợ lý AI để thêm."
            )
        schema = output_model.model_json_schema()
        tool_name = f"emit_{output_model.__name__}"
        body = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "tools": [
                {
                    "name": tool_name,
                    "description": f"Trả kết quả đúng cấu trúc {output_model.__name__}.",
                    "input_schema": schema,
                }
            ],
            "tool_choice": {"type": "tool", "name": tool_name},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                ANTHROPIC_API_URL,
                json=body,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
            )
        if resp.status_code >= 400:
            raise RuntimeError(f"Anthropic API lỗi ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        for block in data.get("content", []):
            if block.get("type") == "tool_use" and block.get("name") == tool_name:
                return output_model.model_validate(block["input"])
        raise RuntimeError("Claude không trả về kết quả có cấu trúc như yêu cầu (không thấy tool_use).")
