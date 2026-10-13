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


def test_ai_quota_and_per_user_switch(client, fake_provider):
    from test_khgdmn_core import login

    admin = setup_admin(client)
    routes.ai_service().store.box = SecretBox(KEY)
    client.post("/api/ai/config", headers=admin, json={"provider": "claude", "apiKey": "sk-ant-123456789", "consentAccepted": True, "retries": 0})
    client.post("/api/accounts", headers=admin, json={"username": "gv.ai", "fullName": "Cô AI", "password": "matkhau123",
                                                       "roles": ["teacher"], "mustChangePassword": False})
    teacher = login(client, "gv.ai", "matkhau123")
    teacher_id = next(u["id"] for u in client.get("/api/accounts", headers=admin).json() if u["username"] == "gv.ai")

    assert client.get("/api/ai/my-status", headers=teacher).json() == {"enabled": True, "used": 0, "limit": 10, "remaining": 10, "configured": True}
    assert client.post("/api/ai/policy", headers=admin, json={"dailyLimit": 2}).json()["dailyLimit"] == 2
    assert client.post("/api/ai/policy", headers=teacher, json={"dailyLimit": 99}).json()["error"] == "Bạn không có quyền thực hiện thao tác này."

    fake_provider.replies = [json.dumps(GOOD_LESSON), json.dumps(GOOD_LESSON)]
    for _ in range(2):
        assert client.post("/api/ai/generate", headers=teacher, json={"action": "generate", "plan": LESSON}).json()["result"] == GOOD_LESSON
    over = client.post("/api/ai/generate", headers=teacher, json={"action": "generate", "plan": LESSON})
    assert "hết 2 lượt AI hôm nay" in over.json()["error"]
    assert len(fake_provider.calls) == 2  # lượt thứ 3 không gọi dịch vụ AI
    assert client.get("/api/ai/my-status", headers=teacher).json()["remaining"] == 0

    accounts = {u["username"]: u for u in client.get("/api/accounts", headers=admin).json()}
    assert accounts["gv.ai"]["aiUsedToday"] == 2 and accounts["gv.ai"]["aiEnabled"] is True

    client.post(f"/api/accounts/{teacher_id}/ai", headers=admin, json={"enabled": False})
    client.post("/api/ai/policy", headers=admin, json={"dailyLimit": 0})
    blocked = client.post("/api/ai/generate", headers=teacher, json={"action": "generate", "plan": LESSON})
    assert blocked.json()["error"] == "Tài khoản của bạn chưa được quản trị cho phép dùng AI."

    # Quản trị luôn dùng được, không giới hạn.
    fake_provider.replies = [json.dumps(GOOD_LESSON)]
    assert client.post("/api/ai/generate", headers=admin, json={"action": "generate", "plan": LESSON}).json()["result"] == GOOD_LESSON
    assert client.get("/api/ai/my-status", headers=admin).json()["limit"] == 0

    # Giáo viên mới mặc định không được dùng khi quản trị tắt mặc định.
    client.post("/api/ai/policy", headers=admin, json={"defaultEnabled": False})
    client.post("/api/accounts", headers=admin, json={"username": "gv.moi", "fullName": "Cô Mới", "password": "matkhau123",
                                                       "roles": ["teacher"], "mustChangePassword": False})
    assert client.get("/api/ai/my-status", headers=login(client, "gv.moi", "matkhau123")).json()["enabled"] is False


def _anthropic_error(cls, status, message):
    import httpx2

    response = httpx2.Response(status, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))
    return cls(message, response=response, body={"type": "error", "error": {"type": "x", "message": message}})


def _fake_claude(monkeypatch, beta_error=None, plain_error=None):
    calls = {"beta": 0, "plain": 0}

    class FakeBlock:
        type = "text"
        text = json.dumps(GOOD_LESSON)

    class FakeResponse:
        stop_reason = "end_turn"
        content = [FakeBlock()]

    class Messages:
        def __init__(self, kind, error):
            self.kind, self.error = kind, error

        async def create(self, **kwargs):
            calls[self.kind] += 1
            if self.error:
                raise self.error
            return FakeResponse()

    class FakeClient:
        def __init__(self, **kwargs):
            self.messages = Messages("plain", plain_error)
            self.beta = type("Beta", (), {"messages": Messages("beta", beta_error)})()

        async def close(self):
            pass

    monkeypatch.setattr(ai.anthropic, "AsyncAnthropic", FakeClient)
    return calls


CLAUDE_CONFIG = {"provider": "claude", "model": "claude-opus-5-5", "baseUrl": "https://api.anthropic.com/v1", "timeoutMs": 30000}
PROMPT = {"instructions": "x", "input": "{}"}


async def test_claude_retries_without_fallback_beta_when_not_permitted(monkeypatch):
    calls = _fake_claude(monkeypatch, beta_error=_anthropic_error(ai.anthropic.PermissionDeniedError, 403, "beta not enabled"))
    assert json.loads(await ai.request_provider(CLAUDE_CONFIG, "sk-x", PROMPT, ai.LESSON_RESPONSE_SCHEMA)) == GOOD_LESSON
    assert calls == {"beta": 1, "plain": 1}


async def test_claude_error_messages_show_anthropic_reason(monkeypatch):
    _fake_claude(monkeypatch, beta_error=_anthropic_error(ai.anthropic.AuthenticationError, 401, "invalid x-api-key"))
    with pytest.raises(ai.AIError) as bad_key:
        await ai.request_provider(CLAUDE_CONFIG, "sk-x", PROMPT, ai.LESSON_RESPONSE_SCHEMA)
    assert "Khóa API không hợp lệ" in bad_key.value.message and "invalid x-api-key" in bad_key.value.message

    _fake_claude(monkeypatch, plain_error=_anthropic_error(ai.anthropic.BadRequestError, 400, "Your credit balance is too low to access the Anthropic API."))
    with pytest.raises(ai.AIError) as no_credit:
        await ai.request_provider({**CLAUDE_CONFIG, "model": "claude-sonnet-4-6"}, "sk-x", PROMPT, ai.LESSON_RESPONSE_SCHEMA)
    assert no_credit.value.code == ai.QUOTA and "hết số dư" in no_credit.value.message
