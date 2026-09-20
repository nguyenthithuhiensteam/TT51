const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const {
  PLAN_TYPES,
  normalizePlanType,
  parseAnnualRows,
  parseThemeRows,
  parseWeeklyRows,
} = require('./plan-schema.cjs');

const BUILT_INS = Object.entries(PLAN_TYPES).map(([type, name]) => ({
  id: `builtin-${type}`,
  name: `${name} - mẫu chuẩn`,
  type,
  builtIn: true,
}));

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraphText(paragraphXml = '') {
  return [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function textParagraph(value = '', options = {}) {
  const properties = options.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p><w:r>${properties}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`;
}

function tableCell(value, width, options = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${textParagraph(value, options)}</w:tc>`;
}

function tableRow(values, widths, header = false) {
  return `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${values.map((value, index) => tableCell(value, widths[index], { bold: header })).join('')}</w:tr>`;
}

function planTableXml(plan) {
  const type = normalizePlanType(plan.level);
  let widths;
  let header;
  let rows;
  if (type === 'annual') {
    widths = [520, 1120, 1800, 2400, 2400, 2440];
    header = ['STT', 'Thời gian', 'Chủ đề', 'Mục tiêu', 'Nội dung', 'Hoạt động'];
    rows = parseAnnualRows(plan).map((item, index) => [index + 1, item.period, item.theme, item.objective, item.content, item.activity]);
  } else if (type === 'theme') {
    widths = [560, 3360, 3240, 3240];
    header = ['STT', 'Mục tiêu', 'Nội dung', 'Hoạt động'];
    rows = parseThemeRows(plan).map((item, index) => [index + 1, `${item.domain}\n${item.objective}`, item.content, item.activity]);
  } else if (type === 'weekly') {
    widths = [1600, 1848, 1848, 1848, 1848, 1848];
    header = ['Nội dung hoạt động', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu'];
    rows = parseWeeklyRows(plan).map((item) => [item.activity, item.monday, item.tuesday, item.wednesday, item.thursday, item.friday]);
  } else {
    widths = [5000, 5000];
    header = ['Hoạt động của cô', 'Hoạt động của trẻ'];
    rows = [[plan.teacherActivities || plan.activities || '', plan.childActivities || '']];
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((sum, value) => sum + value, 0)}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${tableRow(header, widths, true)}${rows.map((values) => tableRow(values, widths)).join('')}</w:tbl>`;
}

class TemplateManager {
  constructor(root) {
    this.root = root;
    this.registryPath = path.join(root, 'templates.json');
  }

  readRegistry() {
    try { return JSON.parse(fs.readFileSync(this.registryPath, 'utf8')); } catch { return { custom: [], defaultByType: {} }; }
  }

  writeRegistry(registry) {
    fs.mkdirSync(this.root, { recursive: true });
    const temporary = `${this.registryPath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(registry, null, 2), 'utf8');
    fs.renameSync(temporary, this.registryPath);
  }

  list() {
    const registry = this.readRegistry();
    return {
      templates: [...BUILT_INS, ...registry.custom.map((item) => ({ ...item, builtIn: false }))],
      defaultByType: registry.defaultByType,
    };
  }

  async importTemplate(sourcePath, metadata = {}) {
    if (path.extname(sourcePath).toLowerCase() !== '.docx') throw new Error('Mẫu tùy chỉnh phải là tệp DOCX.');
    const source = fs.readFileSync(sourcePath);
    let zip;
    try { zip = await JSZip.loadAsync(source); } catch { throw new Error('Tệp mẫu DOCX bị lỗi hoặc không đúng định dạng.'); }
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) throw new Error('Mẫu DOCX không có nội dung Word hợp lệ.');
    const xml = await documentFile.async('string');
    const hasTableMarker = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
      .some((match) => paragraphText(match[0]).trim() === '{{PLAN_TABLE}}');
    if (!hasTableMarker) throw new Error('Mẫu DOCX cần có biến {{PLAN_TABLE}} trong một dòng riêng.');
    const type = normalizePlanType(metadata.type);
    const id = `custom-${crypto.randomUUID()}`;
    fs.mkdirSync(this.root, { recursive: true });
    const filename = `${id}.docx`;
    fs.writeFileSync(path.join(this.root, filename), source, { flag: 'wx' });
    const registry = this.readRegistry();
    registry.custom.push({ id, type, name: String(metadata.name || path.basename(sourcePath, '.docx')).trim(), filename, createdAt: new Date().toISOString() });
    this.writeRegistry(registry);
    return this.list();
  }

  setDefault(typeValue, templateId) {
    const type = normalizePlanType(typeValue);
    const registry = this.readRegistry();
    const exists = [...BUILT_INS, ...registry.custom].some((item) => item.id === templateId && item.type === type);
    if (!exists) throw new Error('Mẫu mặc định không hợp lệ.');
    registry.defaultByType[type] = templateId;
    this.writeRegistry(registry);
    return this.list();
  }

  resolve(templateId, plan) {
    const type = normalizePlanType(plan.level);
    const registry = this.readRegistry();
    const selected = templateId || registry.defaultByType[type] || `builtin-${type}`;
    return registry.custom.find((item) => item.id === selected && item.type === type) || null;
  }

  async renderCustom(templateId, plan, school) {
    const template = this.resolve(templateId, plan);
    if (!template) return null;
    const filePath = path.resolve(this.root, template.filename);
    if (!filePath.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error('Đường dẫn mẫu không an toàn.');
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) throw new Error('Mẫu DOCX không có nội dung Word hợp lệ.');
    let xml = await documentFile.async('string');
    const tokens = {
      '{{SCHOOL_NAME}}': school.name || '',
      '{{SCHOOL_YEAR}}': school.schoolYear || '',
      '{{PLAN_TITLE}}': plan.title || '',
      '{{PLAN_PERIOD}}': plan.period || '',
      '{{PLAN_CLASS}}': plan.className || plan.ageGroup || '',
      '{{PLAN_AUTHOR}}': plan.author || '',
      '{{PLAN_OBJECTIVES}}': plan.objectives || '',
      '{{PLAN_ACTIVITIES}}': plan.activities || '',
      '{{PLAN_MATERIALS}}': plan.materials || '',
      '{{PLAN_ASSESSMENT}}': plan.assessment || '',
    };
    for (const [token, value] of Object.entries(tokens)) xml = xml.split(token).join(xmlEscape(value));
    const dynamicTable = planTableXml(plan);
    let tableReplaced = false;
    xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
      if (paragraphText(paragraphXml).trim() !== '{{PLAN_TABLE}}') return paragraphXml;
      tableReplaced = true;
      return dynamicTable;
    });
    if (!tableReplaced) throw new Error('Mẫu DOCX tùy chỉnh cần có biến {{PLAN_TABLE}} trong một dòng riêng.');
    zip.file('word/document.xml', xml);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  backupPayload() {
    const registry = this.readRegistry();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      registry,
      files: Object.fromEntries(registry.custom.map((item) => [item.filename, fs.readFileSync(path.join(this.root, item.filename)).toString('base64')])),
    };
  }

  restorePayload(payload) {
    if (payload?.version !== 1 || !payload.registry || typeof payload.files !== 'object') throw new Error('Bản sao lưu mẫu không hợp lệ.');
    fs.mkdirSync(this.root, { recursive: true });
    for (const item of payload.registry.custom || []) {
      if (!/^custom-[a-f0-9-]+\.docx$/i.test(item.filename)) throw new Error('Tên tệp mẫu trong bản sao lưu không an toàn.');
      const data = payload.files[item.filename];
      if (typeof data !== 'string') throw new Error('Bản sao lưu thiếu dữ liệu mẫu DOCX.');
      fs.writeFileSync(path.join(this.root, item.filename), Buffer.from(data, 'base64'));
    }
    this.writeRegistry(payload.registry);
    return this.list();
  }
}

module.exports = { BUILT_INS, TemplateManager, planTableXml };
