import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const { createPlanDocx } = require('../electron/export-word.cjs');

const base = {
  schoolName: 'TRƯỜNG MẦM NON HOA SEN',
  schoolYear: '2026 - 2027',
  className: 'Lớp mẫu giáo 5 - 6 tuổi',
  author: 'Nguyễn Thị A',
  title: 'Trường mầm non',
  objectives: 'Trẻ mạnh dạn, tự tin.',
  activities: 'Quan sát và trò chuyện.',
  materials: 'Tranh ảnh, đồ chơi.',
  assessment: 'Đa số trẻ đạt yêu cầu.',
};

for (const [type, fields] of Object.entries({
  annual: { annualRows: 'Tháng 9 | Trường mầm non | Tự tin | Làm quen | Tham quan' },
  theme: { themePhysical: 'Bật xa | Bật qua vạch | Trò chơi vận động' },
  weekly: { weeklyRows: 'Hoạt động học | Thể dục | Văn học | Toán | Âm nhạc | Tạo hình' },
  lesson: { lessonTitle: 'Khám phá trường mầm non', teacherActivities: 'Cô gợi mở.', childActivities: 'Trẻ quan sát.' },
})) {
  test(`creates a valid ${type} DOCX package`, async () => {
    const buffer = await createPlanDocx({ ...base, level: type, ...fields }, {
      name: base.schoolName,
      schoolYear: base.schoolYear,
    });
    assert.equal(buffer.subarray(0, 2).toString(), 'PK');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /TRƯỜNG MẦM NON HOA SEN/);
    assert.match(xml, /w:tbl/);
  });
}
