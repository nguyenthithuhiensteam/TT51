const {
  DEVELOPMENT_DOMAINS,
  WEEK_DAYS,
  normalizePlanType,
  parseAnnualRows,
  parseThemeRows,
  parseWeeklyRows,
} = require('./plan-schema.cjs');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function row(cells, tag = 'td') {
  return `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
}

function title(plan, school, type) {
  const labels = {
    annual: 'KẾ HOẠCH GIÁO DỤC NĂM',
    theme: 'KẾ HOẠCH GIÁO DỤC CHỦ ĐỀ',
    weekly: 'KẾ HOẠCH CHĂM SÓC GIÁO DỤC TRẺ',
    lesson: 'GIÁO ÁN HOẠT ĐỘNG GIÁO DỤC',
  };
  return `<header>
    <b>${escapeHtml(String(school.name || 'TRƯỜNG MẦM NON').toUpperCase())}</b>
    <h1>${labels[type]}</h1>
    <h2>${escapeHtml(String(plan.title || 'Kế hoạch giáo dục'))}</h2>
    <strong>Thời gian thực hiện: ${escapeHtml(plan.period || '................................')}</strong>
    <em>Lớp: ${escapeHtml(plan.className || plan.ageGroup || '')} - Giáo viên: ${escapeHtml(plan.author || '')}</em>
  </header>`;
}

function annual(plan) {
  return `<table><thead>${row(['STT', 'Thời gian', 'Chủ đề', 'Mục tiêu', 'Nội dung', 'Hoạt động'], 'th')}</thead><tbody>${
    parseAnnualRows(plan).map((item, index) => row([index + 1, item.period, item.theme, item.objective, item.content, item.activity])).join('')
  }</tbody></table>`;
}

function theme(plan) {
  const items = parseThemeRows(plan);
  let sequence = 0;
  const body = [];
  for (const domain of DEVELOPMENT_DOMAINS) {
    const rows = items.filter((item) => item.domain === domain);
    if (!rows.length) continue;
    body.push(`<tr class="section"><td colspan="4">${escapeHtml(domain.toUpperCase())}</td></tr>`);
    rows.forEach((item) => { sequence += 1; body.push(row([sequence, item.objective, item.content, item.activity])); });
  }
  return `<table><thead>${row(['STT', 'Mục tiêu', 'Nội dung', 'Hoạt động'], 'th')}</thead><tbody>${body.join('')}</tbody></table>`;
}

function weekly(plan) {
  return `${plan.objectives ? `<h3>MỤC TIÊU TRỌNG TÂM TRONG TUẦN</h3><p>${escapeHtml(plan.objectives)}</p>` : ''}<table><thead>${row(['Nội dung hoạt động', ...WEEK_DAYS.map(([, label]) => label)], 'th')}</thead><tbody>${
    parseWeeklyRows(plan).map((item) => row([item.activity, ...WEEK_DAYS.map(([key]) => item[key])])).join('')
  }</tbody></table>${plan.assessment ? `<h3>ĐÁNH GIÁ VÀ ĐIỀU CHỈNH SAU TUẦN</h3><p>${escapeHtml(plan.assessment)}</p>` : ''}${plan.weeklyNotes ? `<h3>GHI CHÚ VÀ ĐIỀU CHỈNH TRONG TUẦN</h3><p>${escapeHtml(plan.weeklyNotes)}</p>` : ''}`;
}

function lesson(plan) {
  return `<h2>${escapeHtml(plan.lessonDomain || plan.developmentArea || 'LĨNH VỰC PHÁT TRIỂN')}</h2>
    <h2>${escapeHtml(String(plan.lessonTitle || plan.title || '').toUpperCase())}</h2>
    <h3>I. MỤC ĐÍCH - YÊU CẦU</h3><p>${escapeHtml(plan.lessonObjectives || plan.objectives || '')}</p>
    <h3>II. CHUẨN BỊ</h3><p>${escapeHtml(plan.lessonPreparation || plan.materials || '')}</p>
    <h3>III. TIẾN HÀNH HOẠT ĐỘNG</h3>
    <table><thead>${row(['Hoạt động của cô', 'Hoạt động của trẻ'], 'th')}</thead><tbody>${row([plan.teacherActivities || plan.activities || '', plan.childActivities || ''])}</tbody></table>
    <h3 class="center">ĐÁNH GIÁ CUỐI NGÀY</h3><p>${escapeHtml(plan.dailyEvaluation || plan.assessment || '................................................................................................')}</p>`;
}

function signatures(plan) {
  if (!(plan.signers || []).length) return '<h3 class="center">NHẬN XÉT CỦA BAN GIÁM HIỆU</h3><p class="review-lines">........................................................................................................................<br><br>........................................................................................................................<br><br>........................................................................................................................</p>';
  return `<h3 class="center">XÁC NHẬN VÀ CHỮ KÝ</h3><div class="signatures">${plan.signers.slice(0, 3).map((item) => `<div><b>${escapeHtml(item.displayTitle || item.role)}</b>${item.mode === 'image' && item.imageData ? `<img src="${item.imageData}">` : '<span class="sign-space"></span>'}<strong>${item.mode === 'hand' ? '' : escapeHtml(item.name)}</strong></div>`).join('')}</div>`;
}

function createPlanHtml(plan = {}, school = {}) {
  const type = normalizePlanType(plan.level);
  const body = type === 'annual' ? annual(plan) : type === 'theme' ? theme(plan) : type === 'weekly' ? weekly(plan) : lesson(plan);
  const landscape = type !== 'lesson';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Trường Mầm non Số - ${escapeHtml(plan.title || 'Kế hoạch giáo dục')}</title><style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${landscape ? '10mm' : '15mm 14mm 14mm 20mm'}; }
    * { box-sizing: border-box; } body { font-family: "Times New Roman", serif; font-size: ${landscape ? '11pt' : '13pt'}; line-height: 1.25; color: #000; }
    header { text-align:center; margin-bottom: 10px; } header b, header strong, header em { display:block; } h1 { font-size: 17pt; margin:4px 0; } h2 { font-size:15pt; text-align:center; margin:5px 0; } h3 { font-size:13pt; margin:10px 0 4px; } p { white-space:normal; margin:3px 0 8px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; page-break-inside:auto; } thead { display:table-header-group; } tr { page-break-inside:avoid; } th,td { border:1px solid #000; padding:5px; vertical-align:top; overflow-wrap:anywhere; } th { text-align:center; vertical-align:middle; background:#eef5f4; font-weight:bold; } .section td { background:#f2f2f2; font-weight:bold; } .center { text-align:center; }
    .signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; text-align:center; } .signatures div { display:flex; flex-direction:column; align-items:center; } .signatures img { width:120px; height:55px; object-fit:contain; } .sign-space { height:70px; } .review-lines { text-align:center; }
  </style></head><body>${title(plan, school, type)}${body}${signatures(plan)}</body></html>`;
}

module.exports = { createPlanHtml, escapeHtml };
