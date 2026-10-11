"""Kiểm thử phần KH GDMN đã chuyển sang Python: đối chiếu hành vi với bản Node."""
import os
import tempfile
from pathlib import Path

os.environ.setdefault("CTGDMN_DATA_DIR", tempfile.mkdtemp(prefix="tmns-default-"))

import pytest
from fastapi.testclient import TestClient

from backend.khgdmn.security import hash_password, verify_password
from backend.main import create_app

NODE_HASH = (Path(__file__).with_name("node_hash.txt")).read_text(encoding="utf-8").strip()


@pytest.fixture()
def client(tmp_path):
    app = create_app(f"sqlite:///{tmp_path / 'test.sqlite'}")
    with TestClient(app) as test_client:
        yield test_client


def login(client, username, password):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def setup_admin(client):
    response = client.post("/api/auth/setup-first-admin", json={"username": "admin", "fullName": "Quản trị", "password": "matkhau123"})
    assert response.status_code == 200, response.text
    return login(client, "admin", "matkhau123")


def test_password_hash_compatible_with_node():
    assert verify_password("matkhau123", NODE_HASH)
    assert not verify_password("sai-mat-khau", NODE_HASH)
    assert verify_password("matkhau123", hash_password("matkhau123"))


def test_first_admin_and_login_flow(client):
    assert client.get("/api/auth/status").json() == {"hasUsers": False}
    admin = setup_admin(client)
    assert client.get("/api/auth/status").json() == {"hasUsers": True}
    again = client.post("/api/auth/setup-first-admin", json={"username": "x2", "fullName": "B", "password": "matkhau123"})
    assert again.status_code == 400 and "đã được thiết lập" in again.json()["error"]
    bad = client.post("/api/auth/login", json={"username": "admin", "password": "sai"})
    assert bad.status_code == 400 and bad.json()["error"] == "Tên đăng nhập hoặc mật khẩu không đúng."
    assert client.get("/api/accounts", headers=admin).json()[0]["username"] == "admin"
    client.post("/api/auth/logout", headers=admin)
    assert client.get("/api/accounts", headers=admin).json()["error"] == "Phiên đăng nhập không hợp lệ."


def test_account_request_approval_and_permissions(client):
    admin = setup_admin(client)
    assert client.post("/api/auth/request-account", json={"username": "gv.lan", "fullName": "Cô Lan", "password": "matkhau123"}).json() == {"ok": True}
    requests = client.get("/api/accounts/requests", headers=admin).json()
    assert requests[0]["fullName"] == "Cô Lan"
    approved = client.post(f"/api/accounts/requests/{requests[0]['id']}/approve", headers=admin).json()
    assert approved["roles"] == ["teacher"]
    teacher = login(client, "gv.lan", "matkhau123")
    denied = client.get("/api/accounts", headers=teacher)
    assert denied.status_code == 400 and denied.json()["error"] == "Bạn không có quyền thực hiện thao tác này."
    result = client.post("/api/accounts/import", headers=admin, json={"rows": [
        {"username": "gv.mai", "fullName": "Cô Mai", "password": "matkhau123", "roles": ["teacher"]},
        {"username": "gv.lan", "fullName": "Trùng", "password": "matkhau123", "roles": ["teacher"]},
        {"username": "hack", "fullName": "X", "password": "matkhau123", "roles": ["system_admin"]},
    ]}).json()
    assert result["created"] == 1 and result["skipped"] == 1 and len(result["errors"]) == 1


def test_children_assessments_and_objectives(client):
    admin = setup_admin(client)
    child = client.post("/api/children", headers=admin, json={"fullName": "Bé An", "classLabel": "Lá 1"}).json()
    assert child["fullName"] == "Bé An" and child["active"] is True
    bad = client.post("/api/assessments", headers=admin, json={"childId": child["id"], "domain": "Sai", "level": "Đạt"})
    assert bad.json()["error"] == "Lĩnh vực phát triển không hợp lệ."
    assessment = client.post("/api/assessments", headers=admin, json={
        "childId": child["id"], "domain": "Giáo dục phát triển ngôn ngữ", "level": "Đạt", "observation": "Kể chuyện tốt"}).json()
    assert client.get(f"/api/assessments?childId={child['id']}", headers=admin).json()[0]["id"] == assessment["id"]
    assert client.post(f"/api/children/{child['id']}/deactivate", headers=admin).json() == {"ok": True}
    assert client.get("/api/children", headers=admin).json() == []

    objectives = client.get("/api/objectives", headers=admin).json()
    assert len(objectives) == 287
    nha_tre = client.get("/api/objectives?ageGroup=25–36 tháng", headers=admin).json()
    assert nha_tre and all(item["ageGroup"] == "25–36 tháng" for item in nha_tre)
    created = client.post("/api/objectives", headers=admin, json={
        "ageGroup": "25–36 tháng", "code": "MT-X", "domain": "Giáo dục phát triển nhận thức", "description": "Mục tiêu riêng"}).json()
    assert created["scope"] == "custom"
    dup = client.post("/api/objectives", headers=admin, json={
        "ageGroup": "25–36 tháng", "code": "MT-X", "domain": "Giáo dục phát triển nhận thức", "description": "Lặp"})
    assert dup.json()["error"] == "Mã MT-X đã tồn tại trong nhóm tuổi này."


def test_workspace_plan_workflow_backup_restore(client):
    admin = setup_admin(client)
    client.post("/api/accounts", headers=admin, json={"username": "gv.hoa", "fullName": "Cô Hoa", "password": "matkhau123", "roles": ["teacher"], "staffId": "staff-hoa", "mustChangePassword": False})
    assert client.post("/api/repository/bootstrap", headers=admin, json={"legacy": {"workspace": {"schoolProfile": {"name": "MN Hướng Dương"}}}}).json() is True
    state = client.get("/api/repository/state", headers=admin).json()
    assert state["workspace"]["schemaVersion"] == 4
    assert client.get("/api/branding/public").json()["schoolName"] == "MN Hướng Dương"

    teacher = login(client, "gv.hoa", "matkhau123")
    workspace = client.get("/api/repository/state", headers=teacher).json()["workspace"]
    workspace["plans"] = [{"id": "plan-1", "title": "KH tuần 1", "authorTeacherId": "staff-hoa", "workflowStatus": "draft"}]
    workspace["schoolProfile"] = {"name": "Bị sửa trái phép"}
    assert client.post("/api/repository/state", headers=teacher, json={"workspace": workspace, "review": {}}).json() is True
    saved = client.get("/api/repository/state", headers=admin).json()["workspace"]
    assert saved["schoolProfile"]["name"] == "MN Hướng Dương"
    assert [p["id"] for p in saved["plans"]] == ["plan-1"]

    other = {**workspace, "plans": [{"id": "plan-2", "authorTeacherId": "staff-khac"}]}
    rejected = client.post("/api/repository/state", headers=teacher, json={"workspace": other})
    assert rejected.json()["error"] == "Giáo viên chỉ được tạo kế hoạch của chính mình."

    moved = client.post("/api/plans/plan-1/transition", headers=teacher, json={"toStatus": "sent_team"}).json()
    assert moved["workflowStatus"] == "sent_team"
    locked = client.post("/api/plans/plan-1/transition", headers=teacher, json={"toStatus": "approved"})
    assert locked.json()["error"] == "Chuyển trạng thái kế hoạch không hợp lệ."

    backup = client.get("/api/repository/backup", headers=admin).json()
    assert backup["format"] == "ctgdmn-sqlite-backup" and len(backup["users"]) == 2
    assert client.post("/api/repository/restore", headers=admin, json=backup).json() is True
    actions = [row["action"] for row in client.get("/api/repository/audit", headers=admin).json()]
    assert "backup.restore" in actions and "plan.transition" in actions


def test_restore_accepts_node_backup_users(client):
    admin = setup_admin(client)
    backup = client.get("/api/repository/backup", headers=admin).json()
    backup["users"].append({
        "id": "user-node", "username": "tu.node", "full_name": "Từ bản Node", "staff_id": "", "title": "", "team": "",
        "class_ids_json": "[]", "roles_json": '["teacher"]', "scope_json": "{}", "active": 1, "password_hash": NODE_HASH,
        "must_change_password": 0, "created_at": "2026-09-01T00:00:00.000Z", "last_login_at": None, "created_by": "",
    })
    assert client.post("/api/repository/restore", headers=admin, json=backup).json() is True
    login(client, "tu.node", "matkhau123")


def test_not_ported_routes_and_frontend(client):
    response = client.post("/api/exports/word")
    assert response.status_code == 501
    assert client.get("/api/health").json() == {"ok": True}
    home = client.get("/")
    assert home.status_code == 200 and "<html" in home.text.lower()


def _docx_bytes(paragraph_text: str) -> bytes:
    import io
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", f'<w:document><w:body><w:p><w:r><w:t>{paragraph_text}</w:t></w:r></w:p></w:body></w:document>')
    return buffer.getvalue()


def test_templates_import_default_backup_restore(client):
    admin = setup_admin(client)
    listed = client.get("/api/templates", headers=admin).json()
    assert [t["id"] for t in listed["templates"]] == ["builtin-annual", "builtin-theme", "builtin-weekly", "builtin-lesson"]
    missing = client.post("/api/templates/import", headers=admin, files={"file": ("mau.docx", _docx_bytes("Không có biến"))}, data={"type": "weekly"})
    assert missing.json()["error"] == "Mẫu DOCX cần có biến {{PLAN_TABLE}} trong một dòng riêng."
    imported = client.post("/api/templates/import", headers=admin, files={"file": ("Mẫu tuần.docx", _docx_bytes("{{PLAN_TABLE}}"))}, data={"type": "weekly", "name": ""}).json()
    custom = [t for t in imported["templates"] if not t["builtIn"]]
    assert imported["canceled"] is False and custom[0]["name"] == "Mẫu tuần" and custom[0]["type"] == "weekly"
    assert client.post("/api/templates/default", headers=admin, json={"type": "weekly", "templateId": custom[0]["id"]}).json()["defaultByType"] == {"weekly": custom[0]["id"]}
    assert client.post("/api/templates/default", headers=admin, json={"type": "annual", "templateId": custom[0]["id"]}).json()["error"] == "Mẫu mặc định không hợp lệ."
    backup = client.get("/api/templates/backup", headers=admin).json()
    assert list(backup["files"]) == [custom[0]["filename"]]
    assert client.post("/api/templates/restore", headers=admin, json=backup).json()["canceled"] is False
    assert client.get("/api/ai/config", headers=admin).json()["keyMode"] == "none"


def test_online_videos(client):
    admin = setup_admin(client)
    assert [v["id"] for v in client.get("/api/videos", headers=admin).json()] == ["builtin-video-ctgdmn-guide"]
    bad = client.post("/api/videos", headers=admin, json={"title": "X", "sourceType": "online", "url": "http://khong-an-toan"})
    assert bad.json()["error"] == "Video trực tuyến chỉ chấp nhận URL HTTPS an toàn."
    created = client.post("/api/videos", headers=admin, json={"title": "Hướng dẫn soạn bài", "sourceType": "online", "url": "https://www.youtube.com/watch?v=abc", "audience": ["principal"]}).json()
    client.post("/api/accounts", headers=admin, json={"username": "gv.tam", "fullName": "Cô Tâm", "password": "matkhau123", "roles": ["teacher"], "mustChangePassword": False})
    teacher = login(client, "gv.tam", "matkhau123")
    assert created["id"] not in [v["id"] for v in client.get("/api/videos", headers=teacher).json()]
    assert client.post("/api/videos/builtin-video-ctgdmn-guide/open-online", headers=teacher).json()["url"].startswith("https://")
    assert "đã được sử dụng" in client.delete("/api/videos/builtin-video-ctgdmn-guide", headers=admin).json()["error"]
    assert client.delete(f"/api/videos/{created['id']}", headers=admin).json() is True
