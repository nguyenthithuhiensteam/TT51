"""CT388 chạy chung máy chủ dưới /ct388 mà không đụng API của KH GDMN."""
from test_khgdmn_core import client  # noqa: F401


def test_ct388_served_under_prefix(client):
    assert client.get("/ct388/api/health").status_code == 200
    page = client.get("/ct388/")
    assert page.status_code == 200 and "<html" in page.text.lower()
    assert "'/ct388'" in client.get("/ct388/js/api.js").text
    assert client.get("/ct388", follow_redirects=False).headers["location"] == "/ct388/"
    # Dữ liệu chương trình lõi CT388 được nạp từ Excel đi kèm khi khởi động lần đầu.
    domains = client.get("/ct388/api/domains")
    assert domains.status_code in (200, 401), domains.text
    # API của KH GDMN vẫn là của KH GDMN.
    assert client.get("/api/auth/status").json() == {"hasUsers": False}
