/** Đọc số tiền bằng chữ tiếng Việt — dùng cho chứng từ kế toán (phiếu thu/phiếu chi). */

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const GROUP_UNITS = ["", "nghìn", "triệu", "tỷ"];

function readGroup(n: number, isLeadingGroup: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  const parts: string[] = [];
  const hasHundredsDigit = hundreds > 0 || !isLeadingGroup;

  if (hasHundredsDigit) {
    parts.push(`${DIGITS[hundreds]} trăm`);
  }

  if (tens === 0) {
    if (units > 0) {
      parts.push(hasHundredsDigit ? `linh ${DIGITS[units]}` : DIGITS[units]);
    }
  } else if (tens === 1) {
    parts.push("mười");
    if (units === 1) parts.push("một");
    else if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(DIGITS[units]);
  } else {
    parts.push(`${DIGITS[tens]} mươi`);
    if (units === 1) parts.push("mốt");
    else if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(DIGITS[units]);
  }

  return parts.join(" ");
}

/** Chuyển một số nguyên không âm thành chữ tiếng Việt, VD: 1200000 -> "một triệu hai trăm nghìn". */
export function numberToVietnameseWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "không";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.unshift(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > GROUP_UNITS.length) {
    // Số quá lớn (>= 1 nghìn tỷ) — vượt phạm vi thực tế của chứng từ kế toán trường mầm non.
    return n.toLocaleString("vi-VN");
  }

  const words: string[] = [];
  const offset = groups.length - 1;
  groups.forEach((g, idx) => {
    if (g === 0) return;
    const groupIndex = offset - idx;
    const isLeadingGroup = words.length === 0;
    words.push(readGroup(g, isLeadingGroup));
    if (GROUP_UNITS[groupIndex]) words.push(GROUP_UNITS[groupIndex]);
  });

  return words.join(" ").replace(/\s+/g, " ").trim();
}

/** Số tiền bằng chữ dùng trên chứng từ, VD: 1200000 -> "Một triệu hai trăm nghìn đồng chẵn." */
export function amountToVietnameseWordsVnd(amount: number): string {
  const words = numberToVietnameseWords(amount);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} đồng chẵn.`;
}
