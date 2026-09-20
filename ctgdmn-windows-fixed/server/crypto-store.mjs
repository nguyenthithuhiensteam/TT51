import crypto from 'node:crypto';

/**
 * Thay thế Electron `safeStorage` (mã hóa bằng kho bảo mật hệ điều hành) cho bản máy chủ web:
 * mã hóa bằng AES-256-GCM với một khóa chủ đọc từ biến môi trường, không bao giờ ghi vào mã nguồn.
 * Cùng interface (`isEncryptionAvailable`, `encryptString`, `decryptString`) mà `ai-service.cjs` cần,
 * nên không phải sửa gì ở lớp dịch vụ AI dùng chung giữa bản desktop và bản web.
 */
export class ServerSafeStorage {
  constructor(masterKeyBase64) {
    this.key = masterKeyBase64 ? Buffer.from(masterKeyBase64, 'base64') : null;
    if (this.key && this.key.length !== 32) {
      throw new Error('AI_CONFIG_ENCRYPTION_KEY phải là chuỗi base64 mã hóa đúng 32 byte (dùng: openssl rand -base64 32).');
    }
  }

  isEncryptionAvailable() {
    return Boolean(this.key);
  }

  encryptString(plainText) {
    if (!this.key) throw new Error('Chưa cấu hình AI_CONFIG_ENCRYPTION_KEY trên máy chủ.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  decryptString(buffer) {
    if (!this.key) throw new Error('Chưa cấu hình AI_CONFIG_ENCRYPTION_KEY trên máy chủ.');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
