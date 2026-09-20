const PLAN_TYPES = Object.freeze({
  annual: 'Kế hoạch giáo dục năm',
  theme: 'Kế hoạch chủ đề/tháng',
  weekly: 'Kế hoạch giáo dục tuần',
  lesson: 'Giáo án/hoạt động giáo dục ngày',
});

const DEVELOPMENT_DOMAINS = Object.freeze([
  'Giáo dục phát triển thể chất',
  'Giáo dục phát triển tình cảm và kỹ năng xã hội',
  'Giáo dục phát triển ngôn ngữ',
  'Giáo dục phát triển nhận thức',
  'Giáo dục phát triển thẩm mỹ',
]);

const WEEK_DAYS = Object.freeze([
  ['monday', 'Thứ hai'],
  ['tuesday', 'Thứ ba'],
  ['wednesday', 'Thứ tư'],
  ['thursday', 'Thứ năm'],
  ['friday', 'Thứ sáu'],
]);

function normalizePlanType(level = '') {
  const value = String(level).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PLAN_TYPES, value)) return value;
  if (value.includes('năm')) return 'annual';
  if (value.includes('tháng') || value.includes('chủ đề')) return 'theme';
  if (value.includes('tuần')) return 'weekly';
  return 'lesson';
}

function splitLines(value = '') {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePipeRows(value = '', keys = []) {
  return splitLines(value).map((line) => {
    const parts = line.split('|').map((part) => part.trim());
    return Object.fromEntries(keys.map((key, index) => [key, parts[index] || '']));
  });
}

function parseThemeRows(plan = {}) {
  const fields = [
    ['themePhysical', DEVELOPMENT_DOMAINS[0]],
    ['themeSocial', DEVELOPMENT_DOMAINS[1]],
    ['themeLanguage', DEVELOPMENT_DOMAINS[2]],
    ['themeCognitive', DEVELOPMENT_DOMAINS[3]],
    ['themeAesthetic', DEVELOPMENT_DOMAINS[4]],
  ];
  const rows = [];
  for (const [field, domain] of fields) {
    const parsed = parsePipeRows(plan[field], ['objective', 'content', 'activity']);
    parsed.forEach((row, index) => rows.push({ domain, index: index + 1, ...row }));
  }
  if (!rows.length && (plan.objectives || plan.activities)) {
    rows.push({
      domain: DEVELOPMENT_DOMAINS[0],
      index: 1,
      objective: plan.objectives || '',
      content: plan.content || '',
      activity: plan.activities || '',
    });
  }
  return rows;
}

function parseAnnualRows(plan = {}) {
  const rows = parsePipeRows(plan.annualRows, ['period', 'theme', 'objective', 'content', 'activity']);
  if (!rows.length && (plan.objectives || plan.activities)) {
    rows.push({
      period: plan.period || '',
      theme: plan.title || '',
      objective: plan.objectives || '',
      content: plan.content || '',
      activity: plan.activities || '',
    });
  }
  return rows;
}

function parseWeeklyRows(plan = {}) {
  const rows = parsePipeRows(plan.weeklyRows, [
    'activity',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]);
  if (!rows.length && (plan.activities || plan.objectives)) {
    rows.push({
      activity: 'Hoạt động học',
      monday: plan.activities || plan.objectives || '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    });
  }
  return rows;
}

function planRows(plan = {}) {
  const type = normalizePlanType(plan.level);
  if (type === 'annual') return parseAnnualRows(plan);
  if (type === 'theme') return parseThemeRows(plan);
  if (type === 'weekly') return parseWeeklyRows(plan);
  return [];
}

const genericRowSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: { type: 'string' },
    period: { type: 'string' },
    theme: { type: 'string' },
    objective: { type: 'string' },
    content: { type: 'string' },
    activity: { type: 'string' },
    monday: { type: 'string' },
    tuesday: { type: 'string' },
    wednesday: { type: 'string' },
    thursday: { type: 'string' },
    friday: { type: 'string' },
    teacherActivity: { type: 'string' },
    childActivity: { type: 'string' },
  },
  required: [
    'category',
    'period',
    'theme',
    'objective',
    'content',
    'activity',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'teacherActivity',
    'childActivity',
  ],
};

const PLAN_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    context: { type: 'string' },
    objectives: { type: 'string' },
    activities: { type: 'string' },
    materials: { type: 'string' },
    differentiation: { type: 'string' },
    assessment: { type: 'string' },
    family: { type: 'string' },
    templateRows: { type: 'array', items: genericRowSchema },
  },
  required: [
    'title',
    'context',
    'objectives',
    'activities',
    'materials',
    'differentiation',
    'assessment',
    'family',
    'templateRows',
  ],
});

function validatePlanResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI không trả về một đối tượng JSON hợp lệ.');
  }
  const required = PLAN_RESPONSE_SCHEMA.required;
  for (const field of required.filter((item) => item !== 'templateRows')) {
    if (typeof value[field] !== 'string') throw new Error(`Trường AI "${field}" không hợp lệ.`);
  }
  if (!Array.isArray(value.templateRows)) throw new Error('Danh sách dòng biểu mẫu do AI trả về không hợp lệ.');
  for (const row of value.templateRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Một dòng biểu mẫu AI không hợp lệ.');
    for (const key of genericRowSchema.required) {
      if (typeof row[key] !== 'string') throw new Error(`Trường dòng AI "${key}" không hợp lệ.`);
    }
  }
  return value;
}

function rowsToFormFields(planType, rows = []) {
  if (planType === 'annual') {
    return {
      annualRows: rows
        .map((row) => [row.period, row.theme, row.objective, row.content, row.activity].join(' | '))
        .join('\n'),
    };
  }
  if (planType === 'theme') {
    const fields = {
      themePhysical: [],
      themeSocial: [],
      themeLanguage: [],
      themeCognitive: [],
      themeAesthetic: [],
    };
    const mapping = new Map(DEVELOPMENT_DOMAINS.map((domain, index) => [domain, Object.keys(fields)[index]]));
    for (const row of rows) {
      const target = mapping.get(row.category) || 'themePhysical';
      fields[target].push([row.objective, row.content, row.activity].join(' | '));
    }
    return Object.fromEntries(Object.entries(fields).map(([key, lines]) => [key, lines.join('\n')]));
  }
  if (planType === 'weekly') {
    return {
      weeklyRows: rows
        .map((row) => [
          row.activity || row.category,
          row.monday,
          row.tuesday,
          row.wednesday,
          row.thursday,
          row.friday,
        ].join(' | '))
        .join('\n'),
    };
  }
  const first = rows[0] || {};
  return {
    teacherActivities: first.teacherActivity || first.activity || '',
    childActivities: first.childActivity || '',
  };
}

module.exports = {
  DEVELOPMENT_DOMAINS,
  PLAN_RESPONSE_SCHEMA,
  PLAN_TYPES,
  WEEK_DAYS,
  normalizePlanType,
  parseAnnualRows,
  parsePipeRows,
  parseThemeRows,
  parseWeeklyRows,
  planRows,
  rowsToFormFields,
  splitLines,
  validatePlanResponse,
};
