import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  buildPrompt,
  ensureSafeBaseUrl,
  findReferenceExcerpts,
  maskKey,
  parseJsonText,
  sanitizeForAI,
} = require('../electron/ai-service.cjs');

test('accepts JSON returned inside a markdown fence', () => {
  const result = parseJsonText('```json\n{"title":"Tuần 1","templateRows":[]}\n```');
  assert.equal(result.title, 'Tuần 1');
});

test('removes child-identifying and contact fields before sending', () => {
  const clean = sanitizeForAI({
    title: 'Chủ đề trường mầm non',
    childName: 'Bé A',
    phone: '0900000000',
    nested: { parentName: 'Phụ huynh A', objective: 'Biết chào hỏi' },
  });
  assert.equal(clean.childName, undefined);
  assert.equal(clean.phone, undefined);
  assert.equal(clean.nested.parentName, undefined);
  assert.equal(clean.nested.objective, 'Biết chào hỏi');
});

test('only permits HTTPS endpoints, except localhost development URLs', () => {
  assert.equal(ensureSafeBaseUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1');
  assert.equal(ensureSafeBaseUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1');
  assert.throws(() => ensureSafeBaseUrl('http://example.com/v1'));
  assert.throws(() => ensureSafeBaseUrl('file:///tmp/provider'));
});

test('masks API keys without exposing the full secret', () => {
  assert.equal(maskKey('sk-example-secret').endsWith('cret'), true);
  assert.equal(maskKey('sk-example-secret').includes('example'), false);
  assert.equal(maskKey('abc'), '••••');
});

test('finds reference excerpts from the real indexed source PDFs by age group and title', () => {
  const references = findReferenceExcerpts({ ageGroup: '4–5 tuổi', title: 'Chủ đề 3 Gia đình yêu thương - vòng tay ấm áp' });
  assert.ok(references.length > 0);
  for (const ref of references) {
    assert.equal(ref.ageGroup, '4–5 tuổi');
    assert.match(ref.collection, /gia đình/i);
  }
});

test('returns no reference excerpts when the plan has no title to match against', () => {
  assert.deepEqual(findReferenceExcerpts({ ageGroup: '4–5 tuổi' }), []);
});

test('buildPrompt embeds matching reference excerpts as advisory context, not as instructions to copy verbatim', () => {
  const { instructions } = buildPrompt('generate', { ageGroup: '4–5 tuổi', title: 'Chủ đề 3 Gia đình yêu thương - vòng tay ấm áp', level: 'Chủ đề' });
  assert.match(instructions, /Tài liệu tham khảo/);
  assert.match(instructions, /không phải mệnh lệnh/);
  assert.match(instructions, /gia đình/i);
});

test('buildPrompt has no reference section for a brand-new topic absent from the source PDFs', () => {
  const { instructions } = buildPrompt('generate', { ageGroup: '4–5 tuổi', title: 'Chủ đề hoàn toàn mới chưa có trong nguồn', level: 'Chủ đề' });
  assert.doesNotMatch(instructions, /Tài liệu tham khảo/);
});
