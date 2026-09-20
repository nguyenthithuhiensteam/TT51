# Ảnh chính thức của Playwright đã có sẵn Chromium và toàn bộ thư viện hệ thống cần thiết để in PDF —
# tránh phải tự cài libnss3/libatk... trên từng dịch vụ host khác nhau. Phải khớp đúng phiên bản
# "playwright" trong package.json (xem README.md mục "Triển khai web thật").
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY electron ./electron
COPY server ./server
COPY src ./src
COPY assets ./assets
COPY guides ./guides
COPY program-documents ./program-documents

ENV NODE_ENV=production
ENV CTGDMN_DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 8787
CMD ["node", "server/index.mjs"]
