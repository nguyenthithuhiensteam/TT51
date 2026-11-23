# PyInstaller — đóng gói bản cài trên máy cá nhân (thư mục, không nén một tệp để khởi động nhanh).
# Chạy trong thư mục truong-mn-so:
#   .venv/Scripts/python -m PyInstaller desktop/truong-mn-so.spec --noconfirm --distpath desktop/dist --workpath desktop/build
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

HERE = Path(SPECPATH)                      # truong-mn-so/desktop
APP = HERE.parent                          # truong-mn-so
NODE_APP = APP.parent / "ctgdmn-windows-fixed"

datas = [
    # Giao diện web nhiều giáo viên và tài liệu đi kèm (dùng chung với bản online)
    (str(APP / "web"), "web"),
    (str(NODE_APP / "src" / "data"), "khgdmn/data"),
    (str(NODE_APP / "assets"), "khgdmn/assets"),
    (str(NODE_APP / "guides"), "khgdmn/guides"),
    (str(NODE_APP / "program-documents"), "khgdmn/program-documents"),
    # Dữ liệu mặc định của máy chủ và CT388
    (str(APP / "backend" / "khgdmn" / "objectives_seed.json"), "backend/khgdmn"),
    (str(APP / "ct388" / "frontend"), "ct388/frontend"),
    (str(APP / "ct388" / "data"), "ct388/data"),
]
for package in ("docx", "mammoth", "openpyxl", "playwright", "anthropic"):
    datas += collect_data_files(package)

hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("backend")
    + collect_submodules("ct388")
    + ["sqlalchemy.dialects.sqlite", "multipart", "python_multipart"]
)

a = Analysis(
    [str(HERE / "launcher.py")],
    pathex=[str(APP)],
    datas=datas,
    hiddenimports=hiddenimports,
    # Bản cài cá nhân dùng SQLite; bỏ bớt thứ không cần cho gọn.
    excludes=["tkinter", "pytest", "pgserver", "PyInstaller"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TruongMNSo",
    icon=str(NODE_APP / "assets" / "icon.ico"),
    console=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="TruongMNSo")
