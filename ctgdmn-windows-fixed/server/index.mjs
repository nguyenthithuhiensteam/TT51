import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateImportFile, safeImportName } = require('../electron/validation.cjs');
const { parseWordBuffer } = require('../electron/import-word.cjs');
const { parseExcelBuffer } = require('../electron/import-excel.cjs');
const { importPdfFiles } = require('../electron/import-pdf.cjs');
const { createPlanDocx, createReviewDocx } = require('../electron/export-word.cjs');
const { createPlanHtml } = require('../electron/export-html.cjs');
const { createProfessionalWorkbook, createDirectoryWorkbook } = require('../electron/export-excel.cjs');
const { Repository } = require('../electron/repository.cjs');
const { authorize, safeHttpsUrl, validateVideoFile, ROLES } = require('../electron/security.cjs');
const { AIConfigStore, LocalAIService } = require('../electron/ai-service.cjs');
const { TemplateManager } = require('../electron/template-manager.cjs');
const { resolveGuidePath } = require('../electron/guide-files.cjs');
const { trustedResourceUrl } = require('../electron/trusted-resources.cjs');

import { ServerSafeStorage } from './crypto-store.mjs';
import { renderPlanPdf } from './pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.resolve(process.env.CTGDMN_DATA_DIR || path.join(root, 'data'));
fs.mkdirSync(dataDir, { recursive: true });

function documentsRoot() {
  return path.resolve(process.env.CTGDMN_DOCUMENTS_DIR || path.join(root, 'program-documents'));
}
function addedDocumentsRoot() {
  return path.join(dataDir, 'program-documents-added');
}
function guidesRoot() {
  return path.resolve(process.env.CTGDMN_GUIDES_DIR || path.join(root, 'guides'));
}
function videoRoot() {
  return path.join(dataDir, 'video-library');
}

function resolveDocument(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new Error('Đường dẫn tài liệu không hợp lệ.');
  const isAdded = relativePath.replace(/\\/g, '/').startsWith('user-added/');
  const base = path.resolve(isAdded ? addedDocumentsRoot() : documentsRoot());
  const safeRelative = isAdded ? relativePath.replace(/\\/g, '/').slice('user-added/'.length) : relativePath;
  const candidate = path.resolve(base, safeRelative);
  if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error('Ứng dụng đã chặn đường dẫn nằm ngoài kho tài liệu.');
  if (path.extname(candidate).toLowerCase() !== '.pdf') throw new Error('Ứng dụng chỉ cho phép mở tài liệu PDF trong kho chương trình.');
  return candidate;
}

function importFilters(kind) {
  if (!['word', 'excel', 'pdf'].includes(kind)) throw new Error('Loại nhập không hợp lệ.');
  return kind;
}

function safeExportName(filename, extension) {
  const name = safeImportName(filename);
  if (path.extname(name).toLowerCase() !== extension) throw new Error(`Tên tệp phải có phần mở rộng ${extension}.`);
  return name;
}

const repository = new Repository(path.join(dataDir, 'ctgdmn.sqlite'));
const safeStorage = new ServerSafeStorage(process.env.AI_CONFIG_ENCRYPTION_KEY || '');
const aiService = new LocalAIService(new AIConfigStore(path.join(dataDir, 'ai-config.secure.json'), safeStorage));
const templateManager = new TemplateManager(path.join(dataDir, 'document-templates'));

/** Nạp cấu hình AI từ biến môi trường khi máy chủ khởi động lần đầu và chưa ai cấu hình qua giao diện. */
function seedAiConfigFromEnv() {
  const existing = aiService.store.getPublicConfig();
  if (existing.provider) return;
  const provider = String(process.env.AI_PROVIDER || '').trim();
  if (!provider) return;
  const apiKey = { gemini: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY, claude: process.env.CLAUDE_API_KEY, compatible: process.env.AI_COMPATIBLE_API_KEY }[provider];
  if (!apiKey) return;
  try {
    aiService.store.save({ provider, model: process.env.AI_MODEL || '', baseUrl: process.env.AI_COMPATIBLE_BASE_URL || '', apiKey, keyMode: 'machine', consentAccepted: true });
    console.log(`[ai] Đã nạp cấu hình AI mặc định từ biến môi trường (nhà cung cấp: ${provider}).`);
  } catch (error) {
    console.error('[ai] Không nạp được cấu hình AI từ biến môi trường:', error.message);
  }
}
seedAiConfigFromEnv();

const currentUser = (token) => {
  const config = repository.getJson('systemConfig', { idleMinutes: 30 });
  return repository.session(token, Number(config.idleMinutes) || 30);
};
const tokenFromRequest = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(req.query.token || '');

const app = express();
app.use(express.json({ limit: '25mb' }));
const upload = multer({ dest: path.join(dataDir, 'uploads-tmp') });
const pendingImports = new Map();

function handler(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (result !== undefined && !res.headersSent) res.json(result);
    } catch (error) {
      if (!res.headersSent) res.status(error.httpStatus || 400).json({ error: error.message || 'Có lỗi không xác định.' });
    }
  };
}

// ---- Công khai (không cần đăng nhập) ----
app.get('/api/data/index', handler(() => JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'program-index.json'), 'utf8'))));
app.get('/api/branding/public', handler(() => repository.getPublicBranding()));
app.get('/api/auth/status', handler(() => ({ hasUsers: repository.hasUsers() })));
app.post('/api/auth/setup-first-admin', handler((req) => repository.createFirstAdmin(req.body)));
app.post('/api/auth/login', handler((req) => repository.login(req.body.username, req.body.password)));

// ---- Xác thực ----
app.post('/api/auth/logout', handler((req) => { repository.logout(tokenFromRequest(req)); return { ok: true }; }));
app.post('/api/auth/change-password', handler((req) => { repository.changePassword(currentUser(tokenFromRequest(req)), req.body.currentPassword, req.body.newPassword); return { ok: true }; }));

// ---- Tài khoản ----
app.get('/api/accounts', handler((req) => repository.listUsers(currentUser(tokenFromRequest(req)))));
app.post('/api/accounts', handler((req) => repository.createUser(currentUser(tokenFromRequest(req)), req.body)));
app.post('/api/accounts/import', handler((req) => repository.importUsers(currentUser(tokenFromRequest(req)), req.body.rows)));
app.post('/api/accounts/:userId/lock', handler((req) => { repository.lockUser(currentUser(tokenFromRequest(req)), req.params.userId, Boolean(req.body.locked)); return { ok: true }; }));
app.post('/api/accounts/:userId/reset-password', handler((req) => { repository.resetPassword(currentUser(tokenFromRequest(req)), req.params.userId, req.body.tempPassword); return { ok: true }; }));

// ---- Kho dữ liệu / kế hoạch ----
app.post('/api/repository/bootstrap', handler((req) => { currentUser(tokenFromRequest(req)); return repository.bootstrapLegacy(req.body.legacy); }));
app.get('/api/repository/state', handler((req) => repository.getState(currentUser(tokenFromRequest(req)))));
app.post('/api/repository/state', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  const payload = req.body;
  const config = repository.getJson('systemConfig', {});
  if (config.repositoryMode === 'lan') throw new Error('Chưa kết nối máy chủ LAN; dữ liệu không được ghi để tránh xung đột.');
  const old = repository.getJson('workspace', {});
  for (const plan of payload?.workspace?.plans || []) {
    const previous = (old.plans || []).find((item) => item.id === plan.id);
    if (!previous) authorize(user, 'plan.create', plan);
    else if (JSON.stringify(previous) !== JSON.stringify(plan)) {
      authorize(user, 'plan.edit', plan);
      if (!['draft', 'changes_requested'].includes(previous.workflowStatus || 'draft')) throw new Error('Bản kế hoạch đang gửi đã bị khóa.');
    }
  }
  if (!user.roles.includes(ROLES.ADMIN)) for (const key of ['schoolProfile', 'classes', 'staff', 'signatures', 'customRecords', 'edits', 'sourceDocuments']) payload.workspace[key] = old[key];
  return repository.saveState(user, payload);
}));
app.post('/api/plans/:planId/transition', handler((req) => repository.transition(currentUser(tokenFromRequest(req)), req.params.planId, req.body.toStatus)));
app.post('/api/repository/config', handler((req) => { repository.updateConfig(currentUser(tokenFromRequest(req)), req.body); return { ok: true }; }));
app.get('/api/repository/audit', handler((req) => repository.auditRows(currentUser(tokenFromRequest(req)), Number(req.query.limit) || 500)));
app.get('/api/repository/backup', handler((req) => repository.createBackup(currentUser(tokenFromRequest(req)))));
app.post('/api/repository/restore', handler((req) => { repository.restoreBackup(currentUser(tokenFromRequest(req)), req.body); return true; }));

// ---- Video ----
app.get('/api/videos', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const roles = user.roles || [];
  return repository.db.prepare('SELECT * FROM videos WHERE enabled=1 OR ?=1 ORDER BY sort_order,title').all(roles.includes(ROLES.ADMIN) ? 1 : 0)
    .map((row) => ({ ...row, audience: JSON.parse(row.audience_json), canManage: roles.includes(ROLES.ADMIN) }))
    .filter((video) => roles.includes(ROLES.ADMIN) || !video.audience.length || video.audience.some((role) => roles.includes(role)));
}));
app.post('/api/videos', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.manage');
  const video = req.body;
  if (video.sourceType === 'online' && !safeHttpsUrl(video.url)) throw new Error('Video trực tuyến chỉ chấp nhận URL HTTPS an toàn.');
  const id = video.id || `video-${crypto.randomUUID()}`;
  repository.db.prepare(`INSERT INTO videos(id,title,description,category,audience_json,thumbnail,source_type,url,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,audience_json=excluded.audience_json,thumbnail=excluded.thumbnail,source_type=excluded.source_type,url=excluded.url,duration=excluded.duration,sort_order=excluded.sort_order,enabled=excluded.enabled,context_key=excluded.context_key,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
    .run(id, String(video.title || '').trim(), video.description || '', video.category || 'Bắt đầu sử dụng', JSON.stringify(video.audience || []), video.thumbnail || '', video.sourceType || 'online', video.url || '', video.localPath || null, video.duration || '', Number(video.sortOrder) || 0, video.enabled === false ? 0 : 1, video.contextKey || '', new Date().toISOString(), user.id);
  repository.audit(user.id, video.id ? 'video.update' : 'video.create', 'video', id);
  return { id };
}));
app.post('/api/videos/import-mp4', upload.single('file'), handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.manage');
  if (!req.file) return { canceled: true };
  const validation = validateVideoFile(req.file.originalname, req.file.size, req.file.mimetype);
  if (!validation.extension) throw new Error('Chỉ chấp nhận tệp MP4.');
  if (!validation.validSize) throw new Error('Video phải có dữ liệu và không được vượt quá 1 GB.');
  if (!validation.mime) throw new Error('Kiểu nội dung video không hợp lệ.');
  await fs.promises.mkdir(videoRoot(), { recursive: true });
  const filename = `${crypto.randomUUID()}.mp4`;
  await fs.promises.copyFile(req.file.path, path.join(videoRoot(), filename));
  await fs.promises.unlink(req.file.path).catch(() => {});
  const metadata = req.body;
  const id = `video-${crypto.randomUUID()}`;
  repository.db.prepare('INSERT INTO videos(id,title,description,category,audience_json,source_type,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, metadata.title || path.basename(req.file.originalname, '.mp4'), metadata.description || '', metadata.category || 'Bắt đầu sử dụng', JSON.stringify((metadata.audience || '').split(',').filter(Boolean)), 'offline', filename, metadata.duration || '', Number(metadata.sortOrder) || 0, 1, metadata.contextKey || '', new Date().toISOString(), user.id);
  repository.audit(user.id, 'video.import', 'video', id, 0, 'success', { filename: req.file.originalname, size: req.file.size });
  return { canceled: false, id };
}));
app.post('/api/videos/:videoId/open-online', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const video = repository.db.prepare('SELECT * FROM videos WHERE id=? AND enabled=1').get(req.params.videoId);
  if (!video || video.source_type !== 'online' || !safeHttpsUrl(video.url)) throw new Error('Liên kết video không hợp lệ.');
  repository.db.prepare('UPDATE videos SET used_count=used_count+1 WHERE id=?').run(req.params.videoId);
  repository.audit(user.id, 'video.open', 'video', req.params.videoId);
  return { url: video.url };
}));
app.get('/api/videos/:videoId/offline-url', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const video = repository.db.prepare('SELECT * FROM videos WHERE id=? AND enabled=1').get(req.params.videoId);
  if (!video || video.source_type !== 'offline') throw new Error('Video ngoại tuyến không tồn tại.');
  repository.db.prepare('UPDATE videos SET used_count=used_count+1 WHERE id=?').run(req.params.videoId);
  repository.audit(user.id, 'video.play', 'video', req.params.videoId);
  return { url: `/api/videos/${req.params.videoId}/stream?token=${encodeURIComponent(tokenFromRequest(req))}` };
}));
app.get('/api/videos/:videoId/stream', handler((req, res) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const video = repository.db.prepare('SELECT * FROM videos WHERE id=? AND enabled=1').get(req.params.videoId);
  if (!video || video.source_type !== 'offline') throw new Error('Video ngoại tuyến không tồn tại.');
  const rootDir = path.resolve(videoRoot());
  const file = path.resolve(rootDir, video.local_path);
  if (!file.startsWith(`${rootDir}${path.sep}`) || path.extname(file) !== '.mp4') throw new Error('Đường dẫn video không an toàn.');
  res.sendFile(file);
}));
app.delete('/api/videos/:videoId', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.manage');
  const video = repository.db.prepare('SELECT * FROM videos WHERE id=?').get(req.params.videoId);
  if (!video) throw new Error('Không tìm thấy video.');
  if (video.used_count > 0 && video.source_type === 'online') throw new Error('Không thể xóa liên kết đã được sử dụng; hãy tắt liên kết.');
  if (video.local_path) {
    const rootDir = path.resolve(videoRoot());
    const file = path.resolve(rootDir, video.local_path);
    if (file.startsWith(`${rootDir}${path.sep}`)) await fs.promises.unlink(file).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  repository.db.prepare('DELETE FROM videos WHERE id=?').run(req.params.videoId);
  repository.audit(user.id, 'video.delete', 'video', req.params.videoId);
  return true;
}));

// ---- Tài liệu chương trình / hướng dẫn / tài nguyên ngoài ----
app.get('/api/documents/file', handler((req, res) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.read');
  res.sendFile(resolveDocument(String(req.query.relativePath || '')));
}));
app.get('/api/guides/:format', handler(async (req, res) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const file = resolveGuidePath(guidesRoot(), req.params.format);
  if (!fs.existsSync(file)) throw new Error('Không tìm thấy tài liệu hướng dẫn đi kèm ứng dụng.');
  repository.audit(user.id, 'guide.open', 'guide', req.params.format, 0, 'success', { format: req.params.format });
  res.sendFile(file);
}));
app.get('/api/resources/trusted/:resourceId', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'video.view');
  const url = trustedResourceUrl(req.params.resourceId);
  repository.audit(user.id, 'resource.open', 'online_resource', req.params.resourceId);
  return { url };
}));

// ---- Nhập dữ liệu ----
app.post('/api/imports/choose-files', upload.array('files'), handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, user.roles.includes(ROLES.ADMIN) ? 'data.manage' : 'data.read');
  const kind = importFilters(req.body.kind);
  const files = [];
  for (const file of req.files || []) {
    validateImportFile(file.originalname, file.size, kind);
    const token = crypto.randomUUID();
    pendingImports.set(token, { path: file.path, name: file.originalname, size: file.size, kind, createdAt: Date.now() });
    const bytes = await fs.promises.readFile(file.path);
    let preview = { filename: file.originalname };
    if (kind === 'word') preview = await parseWordBuffer(bytes, file.originalname);
    if (kind === 'excel') preview = parseExcelBuffer(bytes, file.originalname);
    files.push({ token, name: file.originalname, size: file.size, preview });
  }
  return { canceled: files.length === 0, kind, files };
}));
app.post('/api/imports/commit-pdf', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const { tokens, actor } = req.body;
  const files = (tokens || []).map((token) => pendingImports.get(token)).filter((file) => file?.kind === 'pdf');
  if (!files.length) throw new Error('Không còn tệp PDF hợp lệ để thêm.');
  const imported = await importPdfFiles(files, addedDocumentsRoot(), actor);
  (tokens || []).forEach((token) => pendingImports.delete(token));
  repository.audit(user.id, 'pdf.import', 'source', 'multiple', 0, 'success', { count: imported.length });
  return imported.map((source) => ({ ...source, relativePath: `user-added/${source.relativePath}` }));
}));
app.post('/api/imports/undo-pdf', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const removed = [];
  for (const relativePath of req.body.relativePaths || []) {
    if (typeof relativePath !== 'string' || !relativePath.replace(/\\/g, '/').startsWith('user-added/')) throw new Error('Chỉ có thể hoàn tác PDF nguồn bổ sung.');
    const filePath = resolveDocument(relativePath);
    const rootDir = path.resolve(addedDocumentsRoot());
    if (!filePath.startsWith(`${rootDir}${path.sep}`)) throw new Error('Đường dẫn hoàn tác nằm ngoài kho nguồn bổ sung.');
    try { await fs.promises.unlink(filePath); removed.push(relativePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  repository.audit(user.id, 'pdf.undo', 'source', 'multiple', 0, 'success', { count: removed.length });
  return { ok: true, removed };
}));

// ---- Xuất tài liệu (trả file để trình duyệt tải xuống) ----
function sendFileBuffer(res, buffer, filename, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
}
app.post('/api/exports/word', handler(async (req, res) => {
  const user = currentUser(tokenFromRequest(req));
  const { filename, type, payload, school } = req.body;
  const own = payload?.authorTeacherId === user.staffId;
  authorize(user, own ? 'document.export_own' : 'document.export', payload || {});
  if ((payload?.signers || []).some((signer) => signer.mode === 'image')) for (const signer of payload.signers.filter((item) => item.mode === 'image')) authorize(user, 'signature.use', { ...payload, ownerStaffId: signer.staffId });
  const safeName = safeExportName(filename, '.docx');
  const customBuffer = type === 'review' ? null : await templateManager.renderCustom(payload?.templateId, payload, school);
  const buffer = customBuffer || (type === 'review' ? await createReviewDocx(payload, school) : await createPlanDocx(payload, school));
  repository.audit(user.id, 'document.export_word', type || 'plan', payload?.id || '', payload?.version || 0, 'success', { signed: (payload?.signers || []).some((item) => item.mode === 'image') });
  sendFileBuffer(res, buffer, safeName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}));
app.post('/api/exports/pdf', handler(async (req, res) => {
  const user = currentUser(tokenFromRequest(req));
  const { filename, payload, school } = req.body;
  const own = payload?.authorTeacherId === user.staffId;
  authorize(user, own ? 'document.export_own' : 'document.export', payload || {});
  const safeName = safeExportName(filename, '.pdf');
  const html = createPlanHtml(payload, school);
  const buffer = await renderPlanPdf(html, payload);
  repository.audit(user.id, 'document.export_pdf', 'plan', payload?.id || '', payload?.version || 0);
  sendFileBuffer(res, buffer, safeName, 'application/pdf');
}));
app.post('/api/exports/excel', handler(async (req, res) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, user.roles.includes(ROLES.ADMIN) ? 'data.manage' : 'document.export');
  const safeName = safeExportName(req.body.filename, '.xlsx');
  const workbook = await createProfessionalWorkbook(req.body.payload);
  const buffer = await workbook.xlsx.writeBuffer();
  repository.audit(user.id, 'document.export_excel', 'workbook', req.body.filename);
  sendFileBuffer(res, buffer, safeName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}));
app.post('/api/exports/directory', handler(async (req, res) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const { filename, kind, rows, template, school } = req.body;
  const safeName = safeExportName(filename, '.xlsx');
  if (!['classes', 'staff', 'videos'].includes(kind)) throw new Error('Loại danh mục không hợp lệ.');
  const workbook = await createDirectoryWorkbook(kind, rows, template, school);
  const buffer = await workbook.xlsx.writeBuffer();
  sendFileBuffer(res, buffer, safeName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}));

// ---- Mẫu văn bản ----
app.get('/api/templates', handler((req) => { currentUser(tokenFromRequest(req)); return templateManager.list(); }));
app.post('/api/templates/import', upload.single('file'), handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  if (!req.file) return { canceled: true, ...templateManager.list() };
  const templates = await templateManager.importTemplate(req.file.path, req.body);
  await fs.promises.unlink(req.file.path).catch(() => {});
  repository.audit(user.id, 'template.import', 'template', 'custom');
  return { canceled: false, ...templates };
}));
app.post('/api/templates/default', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const result = templateManager.setDefault(req.body.type, req.body.templateId);
  repository.audit(user.id, 'template.default', 'template', req.body.templateId);
  return result;
}));
app.get('/api/templates/backup', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  repository.audit(user.id, 'template.backup', 'template', 'all');
  return templateManager.backupPayload();
}));
app.post('/api/templates/restore', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const templates = templateManager.restorePayload(req.body);
  repository.audit(user.id, 'template.restore', 'template', 'all');
  return { canceled: false, ...templates };
}));

// ---- AI ----
app.get('/api/ai/config', handler((req) => { currentUser(tokenFromRequest(req)); return aiService.store.getPublicConfig(); }));
app.post('/api/ai/config', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  const saved = aiService.store.save(req.body);
  repository.audit(user.id, 'ai.config_save', 'ai', saved.provider, 0, 'success', { model: saved.model, keyMode: saved.keyMode });
  return saved;
}));
app.delete('/api/ai/config', handler((req) => {
  const user = currentUser(tokenFromRequest(req));
  authorize(user, 'data.manage');
  aiService.store.clear();
  repository.audit(user.id, 'ai.config_clear', 'ai', 'local');
  return true;
}));
app.post('/api/ai/test', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  const result = await aiService.testAIConnection();
  repository.audit(user.id, 'ai.connection_test', 'ai', aiService.store.getPublicConfig().provider, 0, result.ok ? 'success' : 'failure', { status: result.status });
  return result;
}));
app.post('/api/ai/generate', handler(async (req) => {
  const user = currentUser(tokenFromRequest(req));
  const { action, plan, requestId } = req.body;
  if (!['generate', 'improve', 'validate'].includes(action)) throw new Error('Thao tác AI không hợp lệ.');
  const result = await aiService.run(action, plan, requestId);
  repository.audit(user.id, `ai.${action}`, 'plan', plan?.id || '', plan?.version || 0, 'success', { provider: aiService.store.getPublicConfig().provider });
  return result;
}));
app.post('/api/ai/cancel', handler((req) => { currentUser(tokenFromRequest(req)); return aiService.cancelAIRequest(req.body.requestId); }));

// ---- Trang tĩnh (giao diện) ----
app.use(express.static(path.join(root, 'src')));
app.use('/assets', express.static(path.join(root, 'assets')));
app.get('/', (_req, res) => res.sendFile(path.join(root, 'src', 'index.html')));

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`CTGDMN server: http://localhost:${port}`));

process.on('SIGTERM', () => { repository.close(); process.exit(0); });
