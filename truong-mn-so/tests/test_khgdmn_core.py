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
    # TEST_DATABASE_URL=postgresql://... → chạy trên Postgres (xóa sạch bảng kh_ trước mỗi bài); mặc định SQLite tạm.
    url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.sqlite'}"
    if os.environ.get("TEST_DATABASE_URL"):
        from backend.khgdmn.db import make_engine, metadata

        engine = make_engine(url)
        metadata.drop_all(engine)
        engine.dispose()
    app = create_app(url)
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


def add_teacher(client, admin, username, full_name):
    client.post("/api/accounts", headers=admin, json={"username": username, "fullName": full_name, "password": "matkhau123",
                                                       "roles": ["teacher"], "mustChangePassword": False})
    return login(client, username, "matkhau123")


def test_each_user_has_private_workspace(client):
    admin = setup_admin(client)
    hoa = add_teacher(client, admin, "gv.hoa", "Cô Hoa")
    lan = add_teacher(client, admin, "gv.lan", "Cô Lan")
    for headers in (admin, hoa, lan):
        assert client.post("/api/repository/bootstrap", headers=headers, json={"legacy": {}}).json() is True

    workspace = client.get("/api/repository/state", headers=hoa).json()["workspace"]
    assert workspace["schemaVersion"] == 4 and workspace["plans"] == []
    workspace["plans"] = [{"id": "plan-1", "title": "KH tuần 1 của cô Hoa"}]
    workspace["schoolProfile"] = {"name": "MN Hướng Dương", "schoolYear": "2026–2027"}
    assert client.post("/api/repository/state", headers=hoa, json={"workspace": workspace, "review": {}}).json() is True

    hoa_saved = client.get("/api/repository/state", headers=hoa).json()["workspace"]
    assert hoa_saved["schoolProfile"]["name"] == "MN Hướng Dương" and [p["id"] for p in hoa_saved["plans"]] == ["plan-1"]
    # Giáo viên khác và cả quản trị đều không thấy kho của cô Hoa.
    assert client.get("/api/repository/state", headers=lan).json()["workspace"]["plans"] == []
    assert client.get("/api/repository/state", headers=admin).json()["workspace"]["plans"] == []
    # Quy trình duyệt nhiều cấp đã bỏ.
    assert client.post("/api/plans/plan-1/transition", headers=hoa, json={"toStatus": "sent_team"}).status_code == 501


def test_personal_and_full_backup(client):
    admin = setup_admin(client)
    hoa = add_teacher(client, admin, "gv.hoa", "Cô Hoa")
    client.post("/api/repository/bootstrap", headers=hoa, json={"legacy": {}})
    client.post("/api/repository/state", headers=hoa, json={"workspace": {"plans": [{"id": "plan-hoa"}]}, "review": {}})

    personal = client.get("/api/repository/backup", headers=hoa).json()
    assert personal["format"] == "truong-mn-so-personal-backup" and personal["owner"] == "gv.hoa"
    assert "users" not in personal
    client.post("/api/repository/state", headers=hoa, json={"workspace": {"plans": []}, "review": {}})
    assert client.post("/api/repository/restore", headers=hoa, json=personal).json() is True
    assert [p["id"] for p in client.get("/api/repository/state", headers=hoa).json()["workspace"]["plans"]] == ["plan-hoa"]

    full = client.get("/api/repository/backup", headers=admin).json()
    assert full["format"] == "truong-mn-so-backup" and len(full["users"]) == 2
    denied = client.post("/api/repository/restore", headers=hoa, json=full)
    assert denied.json()["error"] == "Giáo viên chỉ khôi phục được tệp sao lưu kho của riêng mình."
    client.post("/api/repository/state", headers=hoa, json={"workspace": {"plans": []}, "review": {}})
    assert client.post("/api/repository/restore", headers=admin, json=full).json() is True
    assert [p["id"] for p in client.get("/api/repository/state", headers=hoa).json()["workspace"]["plans"]] == ["plan-hoa"]


def test_restore_node_single_school_backup(client):
    """Tệp sao lưu của KH GDMN cũ: tài khoản giữ mật khẩu, vai trò cũ quy về giáo viên, kho chung giao cho quản trị."""
    admin = setup_admin(client)
    legacy = {
        "format": "ctgdmn-sqlite-backup", "version": 4,
        "state": {"workspace": {"schoolProfile": {"name": "MN Cũ"}, "plans": [{"id": "plan-cu"}]}, "review": {}, "systemConfig": {}},
        "users": [{
            "id": "user-node", "username": "tu.node", "full_name": "Hiệu trưởng cũ", "staff_id": "", "title": "", "team": "",
            "class_ids_json": "[]", "roles_json": '["principal"]', "scope_json": "{}", "active": 1, "password_hash": NODE_HASH,
            "must_change_password": 0, "created_at": "2026-09-01T00:00:00.000Z", "last_login_at": None, "created_by": "",
        }],
    }
    assert client.post("/api/repository/restore", headers=admin, json=legacy).json() is True
    old_user = login(client, "tu.node", "matkhau123")
    assert [u["roles"] for u in client.get("/api/accounts", headers=admin).json() if u["username"] == "tu.node"] == [["teacher"]]
    assert client.get("/api/repository/state", headers=old_user).json()["workspace"]["plans"] == []
    admin_ws = client.get("/api/repository/state", headers=admin).json()["workspace"]
    assert admin_ws["schoolProfile"]["name"] == "MN Cũ" and [p["id"] for p in admin_ws["plans"]] == ["plan-cu"]
    actions = [row["action"] for row in client.get("/api/repository/audit", headers=admin).json()]
    assert "backup.restore" in actions


def test_admin_only_creates_admin_or_teacher(client):
    admin = setup_admin(client)
    created = client.post("/api/accounts", headers=admin, json={"username": "hieu.truong", "fullName": "X", "password": "matkhau123",
                                                                 "roles": ["principal"]}).json()
    assert created["roles"] == ["teacher"]


def test_not_ported_routes_and_frontend(client):
    response = client.post("/api/videos/import-mp4")
    assert response.status_code == 501
    assert client.get("/api/health").json() == {"ok": True}
    home = client.get("/")
    assert home.status_code == 200 and "<html" in home.text.lower()


def _docx_bytes(paragraph_text: str) -> bytes:
    """Tệp Word thật (tạo bằng python-docx) có một đoạn chứa nội dung cho trước."""
    import io

    from docx import Document

    document = Document()
    document.add_paragraph(paragraph_text)
    buffer = io.BytesIO()
    document.save(buffer)
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


def test_shared_workspace_moves_to_first_admin(tmp_path):
    """Dữ liệu của bản một trường (kho chung) được giao cho quản trị đầu tiên khi máy chủ khởi động lại."""
    url = f"sqlite:///{tmp_path / 'legacy.sqlite'}"
    first = create_app(url, mount_ct388=False)
    with TestClient(first) as c:
        admin = setup_admin(c)
        repo = first.state.repository
        repo.set_json("workspace", {"plans": [{"id": "plan-chung"}], "schoolProfile": {"name": "MN Chung"}})
    second = create_app(url, mount_ct388=False)
    with TestClient(second) as c:
        admin = login(c, "admin", "matkhau123")
        plans = c.get("/api/repository/state", headers=admin).json()["workspace"]["plans"]
        assert [p["id"] for p in plans] == ["plan-chung"]
        assert second.state.repository.get_json("workspace", None) is None
        assert second.state.repository.get_json("legacy-shared-workspace", None)["schoolProfile"]["name"] == "MN Chung"


def test_reset_admin_from_env(tmp_path, monkeypatch):
    """Quên mật khẩu quản trị: đặt biến môi trường rồi khởi động lại máy chủ."""
    url = f"sqlite:///{tmp_path / 'reset.sqlite'}"
    with TestClient(create_app(url, mount_ct388=False)) as c:
        setup_admin(c)
    monkeypatch.setenv("KHGDMN_RESET_ADMIN_USERNAME", "Admin")
    monkeypatch.setenv("KHGDMN_RESET_ADMIN_PASSWORD", "MatKhauTam-2026")
    with TestClient(create_app(url, mount_ct388=False)) as c:
        assert c.post("/api/auth/login", json={"username": "admin", "password": "matkhau123"}).status_code == 400
        result = c.post("/api/auth/login", json={"username": "admin", "password": "MatKhauTam-2026"}).json()
        assert result["user"]["roles"] == ["system_admin"] and result["user"]["mustChangePassword"] is True
    monkeypatch.setenv("KHGDMN_RESET_ADMIN_USERNAME", "quantri.moi")
    with TestClient(create_app(url, mount_ct388=False)) as c:
        created = c.post("/api/auth/login", json={"username": "quantri.moi", "password": "MatKhauTam-2026"}).json()
        assert created["user"]["roles"] == ["system_admin"]
