const mammoth = require('mammoth');
const { detectPersonalData } = require('./validation.cjs');

function decodeHtml(value) {
  return String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '').trim();
}

function extractTables(html) {
  return [...String(html).matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((table) =>
    [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1]))));
}

async function parseWordBuffer(buffer, filename = '') {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const [raw, converted] = await Promise.all([
    mammoth.extractRawText({ buffer: input }),
    mammoth.convertToHtml({ buffer: input }, { includeDefaultStyleMap: true }),
  ]);
  const html = converted.value || '';
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: decodeHtml(match[2]) }));
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => decodeHtml(match[1])).filter(Boolean);
  const tables = extractTables(html);
  const text = String(raw.value || '').trim();
  return { filename, text, headings, paragraphs, tables, warnings: [...(raw.messages || []), ...(converted.messages || [])].map((message) => message.message), privacyWarnings: detectPersonalData(text) };
}

module.exports = { parseWordBuffer, extractTables };
