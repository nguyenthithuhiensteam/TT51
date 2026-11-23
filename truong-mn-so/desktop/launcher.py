"""Trường Mầm non Số — bản cài trên máy cá nhân (chạy không cần Internet).

Chạy máy chủ FastAPI ngay trên máy (chỉ nghe 127.0.0.1), mở giao diện trong cửa sổ Microsoft Edge chế độ
ứng dụng; đóng cửa sổ thì tắt máy chủ. Dữ liệu ở %LOCALAPPDATA%\\TruongMNSo (giữ nguyên khi gỡ/cài lại app).

Chạy thử khi phát triển:  .venv/Scripts/python desktop/launcher.py   (trong thư mục truong-mn-so)
"""
from __future__ import annotations

import base64
import ctypes
import json
import logging
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_NAME = "Trường Mầm non Số"
APP_ID = "TruongMNSo"
PORTS = range(8787, 8797)


def bundle_paths() -> dict[str, Path]:
    """Vị trí mã và tài liệu đi kèm: trong gói PyInstaller (sys._MEIPASS) hoặc trong repo khi chạy thử."""
    if getattr(sys, "frozen", False):
        root = Path(sys._MEIPASS)  # noqa: SLF001 — thư mục _internal của PyInstaller
        node_app = root / "khgdmn"
        return {"root": root, "web": root / "web", "data": node_app / "data", "assets": node_app / "assets",
                "guides": node_app / "guides", "documents": node_app / "program-documents"}
    root = Path(__file__).resolve().parents[1]
    node_app = root.parent / "ctgdmn-windows-fixed"
    return {"root": root, "web": root / "web", "data": node_app / "src" / "data", "assets": node_app / "assets",
            "guides": node_app / "guides", "documents": node_app / "program-documents"}


def user_data_dir() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    path = base / APP_ID
    (path / "logs").mkdir(parents=True, exist_ok=True)
    return path


def load_secrets(data_dir: Path) -> dict:
    """Khóa riêng của máy này (tạo một lần): ký phiên CT388, mã hóa khóa AI lưu trong CSDL."""
    path = data_dir / "secrets.json"
    try:
        stored = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        stored = {}
    changed = False
    if not stored.get("ct388_auth_secret"):
        stored["ct388_auth_secret"], changed = secrets.token_hex(32), True
    if not stored.get("ai_config_encryption_key"):
        stored["ai_config_encryption_key"], changed = base64.b64encode(secrets.token_bytes(32)).decode(), True
    if changed:
        path.write_text(json.dumps(stored, indent=2), encoding="utf-8")
    return stored


def configure_environment(paths: dict[str, Path], data_dir: Path) -> None:
    keys = load_secrets(data_dir)
    db_file = (data_dir / "truong-mn-so.sqlite").as_posix()
    env = {
        "KHGDMN_LOCAL_MODE": "1",
        # KH GDMN (bảng kh_*) và CT388 dùng chung một tệp SQLite trong thư mục dữ liệu của người dùng.
        "DATABASE_URL": f"sqlite:///{db_file}",
        "CTGDMN_DATA_DIR": str(data_dir),
        "KHGDMN_FRONTEND_DIR": str(paths["web"]),
        "KHGDMN_PROGRAM_DATA_DIR": str(paths["data"]),
        "KHGDMN_ASSETS_DIR": str(paths["assets"]),
        "KHGDMN_GUIDES_DIR": str(paths["guides"]),
        "KHGDMN_DOCUMENTS_DIR": str(paths["documents"]),
        "CT388_AUTH_SECRET": keys["ct388_auth_secret"],
        "AI_CONFIG_ENCRYPTION_KEY": keys["ai_config_encryption_key"],
        # Xuất PDF bằng Microsoft Edge có sẵn trên Windows 10/11, không cần tải trình duyệt riêng.
        "PLAYWRIGHT_CHANNEL": "msedge",
    }
    for key, value in env.items():
        os.environ.setdefault(key, value)


def is_our_server(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/auth/status", timeout=1.5) as response:
            return json.loads(response.read()).get("localMode") is True
    except Exception:  # noqa: BLE001 — cổng trống hoặc chương trình khác
        return False


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def find_edge() -> Path | None:
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if base:
            candidate = Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
            if candidate.exists():
                return candidate
    return None


def open_window(url: str, data_dir: Path) -> subprocess.Popen | None:
    """Cửa sổ Edge chế độ ứng dụng với hồ sơ riêng, để biết khi nào người dùng đóng cửa sổ."""
    edge = find_edge()
    if edge is None:
        webbrowser.open(url)
        return None
    profile = data_dir / "edge-profile"
    return subprocess.Popen([str(edge), f"--app={url}", f"--user-data-dir={profile}", "--no-first-run",
                             "--no-default-browser-check", "--window-size=1366,860"])


def message_box(text: str, title: str = APP_NAME, error: bool = False) -> None:
    if sys.platform == "win32":
        ctypes.windll.user32.MessageBoxW(None, text, title, 0x10 if error else 0x40)
    else:
        print(f"{title}: {text}")


def wait_until_ready(port: int, server_thread: threading.Thread, timeout: float = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not server_thread.is_alive():
            return False
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as response:
                if response.status == 200:
                    return True
        except Exception:  # noqa: BLE001
            time.sleep(0.3)
    return False


def main() -> int:
    paths = bundle_paths()
    data_dir = user_data_dir()
    logging.basicConfig(filename=data_dir / "logs" / "app.log", level=logging.INFO, encoding="utf-8",
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("launcher")

    # Đang chạy rồi (người dùng bấm biểu tượng lần nữa): chỉ mở thêm cửa sổ.
    for port in PORTS:
        if is_our_server(port):
            open_window(f"http://127.0.0.1:{port}/", data_dir)
            return 0

    port = next((p for p in PORTS if port_free(p)), None)
    if port is None:
        message_box("Không tìm được cổng trống (8787–8796) để chạy ứng dụng. Hãy khởi động lại máy rồi thử lại.", error=True)
        return 1

    configure_environment(paths, data_dir)
    sys.path.insert(0, str(paths["root"]))
    try:
        import uvicorn

        from backend.main import app
    except Exception:  # noqa: BLE001
        log.exception("Không khởi tạo được máy chủ")
        message_box(f"Không khởi động được ứng dụng. Chi tiết lỗi lưu tại:\n{data_dir / 'logs' / 'app.log'}", error=True)
        return 1

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", log_config=None))
    thread = threading.Thread(target=server.run, name="server", daemon=True)
    thread.start()
    if not wait_until_ready(port, thread):
        log.error("Máy chủ không phản hồi sau khi khởi động")
        message_box(f"Ứng dụng khởi động không thành công. Chi tiết lỗi lưu tại:\n{data_dir / 'logs' / 'app.log'}", error=True)
        return 1
    log.info("Đang chạy tại http://127.0.0.1:%s", port)

    window = open_window(f"http://127.0.0.1:{port}/", data_dir)
    if window is not None:
        window.wait()  # người dùng đóng cửa sổ → tắt máy chủ
    else:
        message_box(f"{APP_NAME} đang chạy trong trình duyệt.\nBấm OK khi dùng xong để tắt ứng dụng.")
    server.should_exit = True
    thread.join(timeout=10)
    return 0


if __name__ == "__main__":
    sys.exit(main())
