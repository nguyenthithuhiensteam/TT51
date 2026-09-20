export const PRIVACY_WARNING = 'Không đưa họ tên, ngày sinh, sức khỏe, hình ảnh, hoàn cảnh gia đình hoặc thông tin nhận dạng của trẻ lên dịch vụ AI công cộng.';

export const AI_SERVICES = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
  { id: 'copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com' },
];

export function isSafeHttpsUrl(value) {
  try {
    const raw = String(value || '').trim();
    if (!raw.startsWith('https://')) return false;
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function connectionStatus(isOnline) {
  return isOnline ? { online: true, label: 'Trực tuyến' } : { online: false, label: 'Ngoại tuyến' };
}

export function canOpenAiService(service, isOnline) {
  return Boolean(isOnline && service && isSafeHttpsUrl(service.url));
}

export function createStructuredPrompt(content = '') {
  const source = String(content || '').trim();
  return [
    '# Yêu cầu hỗ trợ giáo dục mầm non',
    '',
    '## Vai trò',
    'Bạn là trợ lý chuyên môn giáo dục mầm non. Hãy trả lời bằng tiếng Việt, rõ ràng và phù hợp độ tuổi.',
    '',
    '## Nội dung cần hỗ trợ',
    source || '[Nhập nội dung kế hoạch hoặc yêu cầu tại đây]',
    '',
    '## Yêu cầu đầu ra',
    '- Đánh dấu rõ mọi nội dung được tạo là “AI đề xuất – cần giáo viên rà soát”.',
    '- Trình bày có cấu trúc và nêu những điểm giáo viên cần kiểm tra.',
    '- Không suy đoán hoặc yêu cầu dữ liệu cá nhân của trẻ.',
    '- Không sử dụng họ tên, ngày sinh, sức khỏe, hình ảnh, hoàn cảnh gia đình hoặc thông tin nhận dạng của trẻ.',
  ].join('\n');
}

export function detectPersonalData(value) {
  const text = String(value || '');
  const warnings = [];
  if (/(?:^|\D)(?:\+?84|0)(?:[ .-]?\d){9,10}(?:\D|$)/.test(text)) warnings.push('Có thể chứa số điện thoại.');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) warnings.push('Có thể chứa địa chỉ email.');
  if (/(?:ngày\s*sinh|sinh\s*ngày)\s*[:：-]?\s*(?:0?[1-9]|[12]\d|3[01])[\/.\-](?:0?[1-9]|1[0-2])[\/.\-](?:19|20)?\d{2}/i.test(text)) warnings.push('Có thể chứa ngày sinh.');
  return warnings;
}
