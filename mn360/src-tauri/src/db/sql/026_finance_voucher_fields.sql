-- MN360 — bổ sung trường còn thiếu để in đúng mẫu số C40-BB (Phiếu thu) / C41-BB (Phiếu chi)
-- theo Thông tư 107/2017/TT-BTC (chế độ kế toán hành chính sự nghiệp).

ALTER TABLE revenues ADD COLUMN payer_address TEXT;
ALTER TABLE revenues ADD COLUMN reason TEXT;
ALTER TABLE revenues ADD COLUMN attachment_count INTEGER;

ALTER TABLE expenses ADD COLUMN payee_address TEXT;
ALTER TABLE expenses ADD COLUMN reason TEXT;
ALTER TABLE expenses ADD COLUMN attachment_count INTEGER;
