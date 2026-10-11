# Trường Mầm non Số — máy chủ gộp KH GDMN + CT388 (Python/FastAPI).
# Build từ THƯ MỤC GỐC repo (cần cả giao diện KH GDMN ở ctgdmn-windows-fixed/):
#   docker build -f truong-mn-so/Dockerfile -t truong-mn-so .
# Ảnh Playwright cho Python có sẵn Chromium để in PDF; phiên bản phải khớp "playwright" trong requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble

WORKDIR /app

COPY truong-mn-so/requirements.txt ./requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Máy chủ Python
COPY truong-mn-so/backend ./backend
COPY truong-mn-so/ct388 ./ct388

# Giao diện và tài liệu đi kèm của KH GDMN (giữ nguyên, dùng chung với bản Windows)
COPY ctgdmn-windows-fixed/src ./khgdmn/src
COPY ctgdmn-windows-fixed/assets ./khgdmn/assets
COPY ctgdmn-windows-fixed/guides ./khgdmn/guides
COPY ctgdmn-windows-fixed/program-documents ./khgdmn/program-documents

ENV PYTHONUNBUFFERED=1 \
    KHGDMN_FRONTEND_DIR=/app/khgdmn/src \
    KHGDMN_ASSETS_DIR=/app/khgdmn/assets \
    KHGDMN_GUIDES_DIR=/app/khgdmn/guides \
    KHGDMN_DOCUMENTS_DIR=/app/khgdmn/program-documents \
    CTGDMN_DATA_DIR=/data \
    PORT=10000

EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
