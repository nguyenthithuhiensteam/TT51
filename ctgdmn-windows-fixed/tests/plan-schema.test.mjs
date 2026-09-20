import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  DEVELOPMENT_DOMAINS,
  normalizePlanType,
  parseAnnualRows,
  parseThemeRows,
  parseWeeklyRows,
  rowsToFormFields,
  validatePlanResponse,
} = require('../electron/plan-schema.cjs');

test('parses annual and weekly pipe-delimited template rows', () => {
  assert.deepEqual(parseAnnualRows({
    annualRows: 'Tháng 9 | Trường mầm non | Tự tin | Làm quen trường lớp | Tham quan',
  })[0], {
    period: 'Tháng 9',
    theme: 'Trường mầm non',
    objective: 'Tự tin',
    content: 'Làm quen trường lớp',
    activity: 'Tham quan',
  });
  assert.equal(parseWeeklyRows({
    weeklyRows: 'Hoạt động học | Thể dục | Văn học | Toán | Âm nhạc | Tạo hình',
  })[0].friday, 'Tạo hình');
});

test('groups theme rows into the five development domains', () => {
  const plan = {
    themePhysical: 'Bật xa | Bật qua vạch | Trò chơi vận động',
    themeLanguage: 'Kể chuyện | Trường lớp | Đàm thoại',
  };
  const rows = parseThemeRows(plan);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].domain, DEVELOPMENT_DOMAINS[0]);
  assert.equal(rows[1].domain, DEVELOPMENT_DOMAINS[2]);
});

test('round-trips AI weekly rows into the planner editor', () => {
  const row = {
    category: 'Hoạt động học', period: '', theme: '', objective: '', content: '',
    activity: '', monday: 'Thể dục', tuesday: 'Văn học', wednesday: 'Toán',
    thursday: 'Âm nhạc', friday: 'Tạo hình', teacherActivity: '', childActivity: '',
  };
  const fields = rowsToFormFields('weekly', [row]);
  assert.match(fields.weeklyRows, /^Hoạt động học \| Thể dục/);
  assert.equal(normalizePlanType('weekly'), 'weekly');
  assert.doesNotThrow(() => validatePlanResponse({
    title: 'Tuần 1', context: '', objectives: '', activities: '', materials: '',
    differentiation: '', assessment: '', family: '', templateRows: [row],
  }));
});
