"""Kiểm thử trợ lý AI — không gọi dịch vụ thật (thay nhà cung cấp bằng hàm giả)."""
import base64
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from backend.khgdmn import ai, routes
from backend.khgdmn.ai import SecretBox, build_prompt
from test_khgdmn_core import client, setup_admin  # noqa: F401

FIXTURES = Path(__file__).with_name("fixtures")
KEY = base64.b64encode(bytes(range(32))).decode()
LESSON = {"level": "lesson", "ageGroup": "5–6 tuổi", "lessonTitle": "Khám phá nam châm", "lessonDomain": "Phát triển nhận thức",
          "framework": "TT388", "linkedObjectivesText": "MT12. Trẻ thử nghiệm", "parentPhone": "0912345678",
          "classConditions": "Lớp 30 trẻ"}
THEME = {"level": "Kế hoạch chủ đề/tháng", "ageGroup": "4–5 tuổi", "title": "Chủ đề Gia đình bé", "objectives": "Trẻ biết thành viên",
         "requestedSection": "activities"}
GOOD_LESSON = {key: "nội dung" for key in ai.LESSON_RESPONSE_SCHEMA["required"]}
FENCE = "`" * 3


def node(*args) -> str:
    return subprocess.run(["node", str(FIXTURES / "node_ai.cjs"), *args], check=True, capture_output=True, cwd=FIXTURES).stdout.decode("utf-8")


@pytest.mark.skipif(shutil.which("node") is None, reason="Không có Node để đối chiếu")
@pytest.mark.parametrize("action,plan", [("generate", LESSON), ("improve", THEME), ("validate", THEME)])
def test_prompt_matches_node(tmp_path, action, plan):
    from backend.main import KHGDMN_PROGRAM_DATA

    ai.set_program_index_path(KHGDMN_PROGRAM_DATA / "program-index.json")
    plan_file = tmp_path / "plan.json"
    plan_file.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
    assert build_prompt(action, plan) == json.loads(node("prompt", action, str(plan_file)))


def test_prompt_drops_personal_fields():
    assert "parentPhone" not in build_prompt("generate", LESSON)["input"]


@pytest.mark.skipif(shutil.which("node") is None, reason="Không có Node để đối chiếu")
def test_encryption_compatible_with_node():
    box = SecretBox(KEY)
    assert node("decrypt", KEY, box.encrypt("sk-ant-thu-nghiem")) == "sk-ant-thu-nghiem"
    assert box.decrypt(node("encrypt", KEY, "khoa-tu-node")) == "khoa-tu-node"


@pytest.fixture()
def fake_provider(client):
    async def provider(config, api_key, prompt, schema):
        provider.calls.append({"config": config, "api_key": api_key, "schema": schema})
        reply = provider.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    provider.replies = []
    provider.calls = []
    routes.ai_service().provider_call = provider
    return provider


def test_ai_config_and_generate(client, fake_provider):
    admin = setup_admin(client)
    assert client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON}).json()["error"] == "Chưa cấu hình GenAI."
    no_box = client.post("/api/ai/config", headers=admin, json={"provider": "claude", "apiKey": "sk-ant-123456789", "consentAccepted": True})
    assert "AI_CONFIG_ENCRYPTION_KEY" in no_box.json()["error"]

    routes.ai_service().store.box = SecretBox(KEY)
    saved = client.post("/api/ai/config", headers=admin, json={"provider": "claude", "apiKey": "sk-ant-123456789", "consentAccepted": True, "retries": 1}).json()
    assert saved["model"] == "claude-opus-5-5" and saved["keyMode"] == "machine" and saved["maskedKey"] == "••••••••••••6789"
    assert "sk-ant" not in json.dumps(routes.repo().get_json("aiConfig"))

    fake_provider.replies = [f"{FENCE}json\n{json.dumps(GOOD_LESSON)}\n{FENCE}"]
    result = client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON, "requestId": "r1"}).json()
    assert result["requestId"] == "r1" and result["result"] == GOOD_LESSON and "parentPhone" not in result["sentData"]
    assert fake_provider.calls[0]["api_key"] == "sk-ant-123456789" and fake_provider.calls[0]["schema"] is ai.LESSON_RESPONSE_SCHEMA

    fake_provider.replies = ["không phải json", json.dumps(GOOD_LESSON)]
    assert client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON}).json()["result"] == GOOD_LESSON

    fake_provider.replies = [ai.AIError("Khóa API không hợp lệ hoặc không có quyền.", ai.INVALID_KEY), json.dumps(GOOD_LESSON)]
    assert client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON}).json()["error"] == "Khóa API không hợp lệ hoặc không có quyền."
    assert len(fake_provider.replies) == 1  # không thử lại khi khóa sai

    fake_provider.replies = [ai.AIError("Dịch vụ bận", ai.UNAVAILABLE), ai.AIError("Dịch vụ bận", ai.UNAVAILABLE)]
    assert client.post("/api/ai/test", headers=admin).json() == {"ok": False, "status": "unavailable", "message": "Dịch vụ bận"}
    assert client.get("/api/ai/config", headers=admin).json()["lastTest"]["status"] == "unavailable"

    assert client.delete("/api/ai/config", headers=admin).json() is True
    assert client.get("/api/ai/config", headers=admin).json()["provider"] == ""


def test_seed_from_ct388_env_key(client, fake_provider, monkeypatch):
    admin = setup_admin(client)
    monkeypatch.setenv("CT388_ANTHROPIC_API_KEY", "sk-ant-moitruong-9999")
    routes.ai_service().store.seed_from_env()
    config = client.get("/api/ai/config", headers=admin).json()
    assert config["provider"] == "claude" and config["keyMode"] == "machine" and config["maskedKey"].endswith("9999")
    fake_provider.replies = [json.dumps(GOOD_LESSON)]
    client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON})
    assert fake_provider.calls[-1]["api_key"] == "sk-ant-moitruong-9999"


async def test_claude_request_uses_sdk_structured_output(monkeypatch):
    captured = {}

    class FakeBlock:
        type = "text"
        text = json.dumps(GOOD_LESSON)

    class FakeResponse:
        stop_reason = "end_turn"
        content = [FakeBlock()]

    class FakeMessages:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return FakeResponse()

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client"] = kwargs
            self.messages = FakeMessages()
            self.beta = type("Beta", (), {"messages": FakeMessages()})()

        async def close(self):
            pass

    monkeypatch.setattr(ai.anthropic, "AsyncAnthropic", FakeClient)
    config = {"provider": "claude", "model": "claude-opus-5-5", "baseUrl": "https://api.anthropic.com/v1", "timeoutMs": 30000}
    text = await ai.request_provider(config, "sk-x", {"instructions": "hệ thống", "input": "{}"}, ai.LESSON_RESPONSE_SCHEMA)
    assert json.loads(text) == GOOD_LESSON
    assert captured["client"]["base_url"] == "https://api.anthropic.com" and captured["client"]["max_retries"] == 0
    assert captured["output_config"] == {"format": {"type": "json_schema", "schema": ai.LESSON_RESPONSE_SCHEMA}}
    assert captured["fallbacks"] == "default" and captured["betas"] == ["server-side-fallback-2026-07-01"]
