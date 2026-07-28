/**
 * Ẩn danh dữ liệu nhận dạng trước khi gửi ra AI công cộng.
 * Không gửi tên, ngày sinh, địa chỉ, số điện thoại, thông tin sức khỏe của trẻ.
 */
export interface RedactionContext {
  names?: string[];
  addresses?: string[];
}

const PHONE_PATTERN = /\b0\d{9,10}\b/g;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const VN_DATE_PATTERN = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;

export interface RedactionResult {
  redacted: string;
  replacedCount: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(text: string, context: RedactionContext = {}): RedactionResult {
  let redacted = text;
  let replacedCount = 0;

  const countAndReplace = (pattern: RegExp, placeholder: string) => {
    redacted = redacted.replace(pattern, () => {
      replacedCount += 1;
      return placeholder;
    });
  };

  countAndReplace(PHONE_PATTERN, "[SĐT]");
  countAndReplace(ISO_DATE_PATTERN, "[NGÀY]");
  countAndReplace(VN_DATE_PATTERN, "[NGÀY]");

  for (const name of context.names ?? []) {
    if (!name.trim()) continue;
    const pattern = new RegExp(escapeRegExp(name.trim()), "gi");
    countAndReplace(pattern, "[TÊN TRẺ/PHỤ HUYNH]");
  }
  for (const address of context.addresses ?? []) {
    if (!address.trim()) continue;
    const pattern = new RegExp(escapeRegExp(address.trim()), "gi");
    countAndReplace(pattern, "[ĐỊA CHỈ]");
  }

  return { redacted, replacedCount };
}
