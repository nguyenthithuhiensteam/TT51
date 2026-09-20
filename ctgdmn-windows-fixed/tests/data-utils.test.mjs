import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDocuments, normalizeText, paginate, reviewSummary, safeFilename } from '../src/data-utils.js';

const documents = [
  { id: 'a', title: 'Mùa hè của bé', collection: 'Chủ đề 10', searchText: 'mua he', ageGroup: '25–36 tháng', documentType: 'Mục tiêu/kế hoạch chủ đề' },
  { id: 'b', title: 'Bé lên tiểu học', collection: 'Chủ đề 10', searchText: 'tieu hoc', ageGroup: '5–6 tuổi', documentType: 'Kế hoạch/giáo án tuần' },
];

test('chuẩn hóa được chữ tiếng Việt', () => {
  assert.equal(normalizeText('Kế hoạch ĐỘ TUỔI'), 'ke hoach do tuoi');
});

test('lọc theo từ khóa và độ tuổi', () => {
  assert.deepEqual(filterDocuments(documents, { query: 'mùa hè', ageGroup: '25–36 tháng' }).map((item) => item.id), ['a']);
  assert.equal(filterDocuments(documents, { documentType: 'Kế hoạch/giáo án tuần' }).length, 1);
});

test('phân trang không vượt giới hạn', () => {
  const result = paginate([1, 2, 3], 9, 2);
  assert.equal(result.page, 2);
  assert.deepEqual(result.items, [3]);
});

test('tính tiến độ rà soát', () => {
  assert.deepEqual(reviewSummary(documents, { reviewed: ['a'], watch: ['b'] }), { reviewed: 1, watch: 1, total: 2, percent: 50 });
});

test('tạo tên tệp sao lưu an toàn', () => {
  assert.equal(safeFilename('Trường Mầm non Tràng Đà'), 'truong-mam-non-trang-da');
});
