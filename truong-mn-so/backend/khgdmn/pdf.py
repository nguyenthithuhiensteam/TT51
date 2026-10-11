"""In HTML kế hoạch ra PDF bằng Chromium ẩn (Playwright) — chuyển từ server/pdf.mjs.

Chọn trình duyệt:
- PLAYWRIGHT_CHROMIUM_PATH: đường dẫn tới tệp chạy Chromium/Chrome.
- PLAYWRIGHT_CHANNEL: dùng trình duyệt có sẵn trên máy, ví dụ `msedge` hoặc `chrome` (tiện khi chạy trên Windows).
- Không đặt gì: Chromium đi kèm Playwright (có sẵn trong ảnh Docker mcr.microsoft.com/playwright/python).
"""
from __future__ import annotations

import asyncio
import os

from playwright.async_api import Browser, async_playwright

from .plan_schema import normalize_plan_type

_lock = asyncio.Lock()
_playwright = None
_browser: Browser | None = None


async def _get_browser() -> Browser:
    global _playwright, _browser
    async with _lock:
        if _browser is None or not _browser.is_connected():
            if _playwright is None:
                _playwright = await async_playwright().start()
            options: dict = {"args": ["--no-sandbox"]}
            if os.environ.get("PLAYWRIGHT_CHROMIUM_PATH"):
                options["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_PATH"]
            elif os.environ.get("PLAYWRIGHT_CHANNEL"):
                options["channel"] = os.environ["PLAYWRIGHT_CHANNEL"]
            _browser = await _playwright.chromium.launch(**options)
        return _browser


async def render_plan_pdf(html: str, plan: dict) -> bytes:
    browser = await _get_browser()
    page = await browser.new_page()
    try:
        # HTML kế hoạch tự chứa (ảnh chữ ký là data:), nên chặn mọi yêu cầu mạng khi in.
        await page.route("**/*", lambda route: route.abort())
        await page.set_content(html, wait_until="load")
        landscape = normalize_plan_type((plan or {}).get("level")) != "lesson"
        return await page.pdf(format="A4", landscape=landscape, print_background=True,
                              margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    finally:
        await page.close()


async def close_pdf_engine() -> None:
    global _playwright, _browser
    if _browser is not None:
        await _browser.close()
        _browser = None
    if _playwright is not None:
        await _playwright.stop()
        _playwright = None
