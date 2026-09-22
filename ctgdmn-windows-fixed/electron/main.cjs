const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { validateImportFile, safeImportName } = require('./validation.cjs');
const { parseWordBuffer } = require('./import-word.cjs');
const { parseExcelBuffer } = require('./import-excel.cjs');
const { importPdfFiles } = require('./import-pdf.cjs');
const { createPlanDocx, createReviewDocx } = require('./export-word.cjs');
const { createPlanHtml } = require('./export-html.cjs');
const { createProfessionalWorkbook, createDirectoryWorkbook } = require('./export-excel.cjs');
const { Repository } = require('./repository.cjs');
const { authorize, safeHttpsUrl, validateVideoFile, ROLES } = require('./security.cjs');
const { AIConfigStore, LocalAIService } = require('./ai-service.cjs');
const { TemplateManager } = require('./template-manager.cjs');
const { normalizePlanType } = require('./plan-schema.cjs');
const { resolveGuidePath } = require('./guide-files.cjs');
const { trustedResourceUrl } = require('./trusted-resources.cjs');

const pendingImports = new Map();
let repository;
let aiService;
let templateManager;
let mainWindow;
const currentUser = (token) => { const config=repository.getJson('systemConfig',{idleMinutes:30});return repository.session(token,Number(config.idleMinutes)||30); };
const videoRoot = () => path.join(app.getPath('userData'),'video-library');

function documentsRoot() {
  if (process.env.CTGDMN_DOCUMENTS_DIR) {
    return path.resolve(process.env.CTGDMN_DOCUMENTS_DIR);
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'program-documents');
  }
  return path.join(__dirname, '..', 'program-documents');
}

function addedDocumentsRoot() {
  return path.join(app.getPath('userData'), 'program-documents-added');
}

function guidesRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'guides');
  return path.join(__dirname, '..', 'guides');
}

function resolveDocument(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new Error('Đường dẫn tài liệu không hợp lệ.');
  }
  const isAdded = relativePath.replace(/\\/g, '/').startsWith('user-added/');
  const root = path.resolve(isAdded ? addedDocumentsRoot() : documentsRoot());
  const safeRelative = isAdded ? relativePath.replace(/\\/g, '/').slice('user-added/'.length) : relativePath;
  const candidate = path.resolve(root, safeRelative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error('Ứng dụng đã chặn đường dẫn nằm ngoài kho tài liệu.');
  }
  if (path.extname(candidate).toLowerCase() !== '.pdf') {
    throw new Error('Ứng dụng chỉ cho phép mở tài liệu PDF trong kho chương trình.');
  }
  return candidate;
}

function importFilters(kind) {
  if (kind === 'word') return [{ name: 'Tài liệu Word', extensions: ['docx'] }];
  if (kind === 'excel') return [{ name: 'Sổ làm việc Excel', extensions: ['xlsx', 'xls'] }];
  if (kind === 'pdf') return [{ name: 'Tài liệu PDF', extensions: ['pdf'] }];
  throw new Error('Loại nhập không hợp lệ.');
}

function safeExportName(filename, extension) {
  const name = safeImportName(filename);
  if (path.extname(name).toLowerCase() !== extension) throw new Error(`Tên tệp phải có phần mở rộng ${extension}.`);
  return name;
}

async function createPlanPdf(plan, school) {
  const preview = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    const html = createPlanHtml(plan, school);
    await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await preview.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: normalizePlanType(plan.level) !== 'lesson',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    if (!preview.isDestroyed()) preview.destroy();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#f3f7f8',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

ipcMain.handle('documents:get-url', (_event, {token,relativePath}) => {
  authorize(currentUser(token),'data.read');
  return pathToFileURL(resolveDocument(relativePath)).href;
});

ipcMain.handle('documents:open', async (_event, {token,relativePath}) => {
  authorize(currentUser(token),'data.read');
  const error = await shell.openPath(resolveDocument(relativePath));
  return { ok: !error, error: error || null };
});

ipcMain.handle('guides:open', async (_event, {token,format}) => {
  const user = currentUser(token);
  authorize(user, 'video.view');
  const file = resolveGuidePath(guidesRoot(), format);
  if (!fs.existsSync(file)) throw new Error('Không tìm thấy tài liệu hướng dẫn đi kèm ứng dụng.');
  const error = await shell.openPath(file);
  repository.audit(user.id, 'guide.open', 'guide', format, 0, error ? 'failed' : 'success', { format });
  return { ok: !error, error: error || null };
});

ipcMain.handle('data:get-index', () => {
  const indexPath = path.join(__dirname, '..', 'src', 'data', 'program-index.json');
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
});

ipcMain.handle('branding:get-public',()=>repository.getPublicBranding());
ipcMain.handle('resources:open-trusted',async(_event,{token,resourceId})=>{const user=currentUser(token);authorize(user,'video.view');const url=trustedResourceUrl(resourceId);repository.audit(user.id,'resource.open','online_resource',resourceId);await shell.openExternal(url);return true;});
ipcMain.handle('auth:status',()=>({hasUsers:repository.hasUsers()}));
ipcMain.handle('auth:setup-first-admin',(_event,data)=>repository.createFirstAdmin(data));
ipcMain.handle('auth:request-account',(_event,data)=>repository.requestAccount(data));
ipcMain.handle('auth:login',(_event,data)=>repository.login(data.username,data.password));
ipcMain.handle('auth:logout',(_event,token)=>repository.logout(token));
ipcMain.handle('auth:change-password',(_event,{token,currentPassword,newPassword})=>repository.changePassword(currentUser(token),currentPassword,newPassword));
ipcMain.handle('accounts:list',(_event,token)=>repository.listUsers(currentUser(token)));
ipcMain.handle('accounts:create',(_event,{token,data})=>repository.createUser(currentUser(token),data));
ipcMain.handle('accounts:import',(_event,{token,rows})=>repository.importUsers(currentUser(token),rows));
ipcMain.handle('accounts:lock',(_event,{token,userId,locked})=>repository.lockUser(currentUser(token),userId,locked));
ipcMain.handle('accounts:reset-password',(_event,{token,userId,tempPassword})=>repository.resetPassword(currentUser(token),userId,tempPassword));
ipcMain.handle('accounts:list-requests',(_event,token)=>repository.listAccountRequests(currentUser(token)));
ipcMain.handle('accounts:approve-request',(_event,{token,requestId})=>repository.approveAccountRequest(currentUser(token),requestId));
ipcMain.handle('accounts:reject-request',(_event,{token,requestId,reason})=>repository.rejectAccountRequest(currentUser(token),requestId,reason));
ipcMain.handle('children:list',(_event,token)=>repository.listChildren(currentUser(token)));
ipcMain.handle('children:upsert',(_event,{token,data})=>repository.upsertChild(currentUser(token),data));
ipcMain.handle('children:deactivate',(_event,{token,childId})=>repository.deactivateChild(currentUser(token),childId));
ipcMain.handle('assessments:list',(_event,{token,childId})=>repository.listChildAssessments(currentUser(token),childId));
ipcMain.handle('assessments:upsert',(_event,{token,data})=>repository.upsertChildAssessment(currentUser(token),data));
ipcMain.handle('assessments:delete',(_event,{token,assessmentId})=>repository.deleteChildAssessment(currentUser(token),assessmentId));
ipcMain.handle('objectives:list',(_event,{token,ageGroup})=>repository.listObjectives(currentUser(token),ageGroup));
ipcMain.handle('objectives:upsert',(_event,{token,data})=>repository.upsertObjective(currentUser(token),data));
ipcMain.handle('objectives:deactivate',(_event,{token,objectiveId})=>repository.deactivateObjective(currentUser(token),objectiveId));
ipcMain.handle('repository:bootstrap',(_event,{token,legacy})=>{currentUser(token);return repository.bootstrapLegacy(legacy);});
ipcMain.handle('repository:get-state',(_event,token)=>repository.getState(currentUser(token)));
ipcMain.handle('repository:save-state',(_event,{token,payload})=>{const user=currentUser(token);const config=repository.getJson('systemConfig',{});if(config.repositoryMode==='lan')throw new Error('Chưa kết nối máy chủ LAN; dữ liệu không được ghi để tránh xung đột.');const old=repository.getJson('workspace',{});for(const plan of payload?.workspace?.plans||[]){const previous=(old.plans||[]).find((item)=>item.id===plan.id);if(!previous)authorize(user,'plan.create',plan);else if(JSON.stringify(previous)!==JSON.stringify(plan)){authorize(user,'plan.edit',plan);if(!['draft','changes_requested'].includes(previous.workflowStatus||'draft'))throw new Error('Bản kế hoạch đang gửi đã bị khóa.');}}if(!user.roles.includes(ROLES.ADMIN))for(const key of ['schoolProfile','classes','staff','signatures','customRecords','edits','sourceDocuments'])payload.workspace[key]=old[key];return repository.saveState(user,payload);});
ipcMain.handle('plans:transition',(_event,{token,planId,toStatus})=>repository.transition(currentUser(token),planId,toStatus));
ipcMain.handle('repository:update-config',(_event,{token,config})=>repository.updateConfig(currentUser(token),config));
ipcMain.handle('repository:audit',(_event,{token,limit})=>repository.auditRows(currentUser(token),limit));
ipcMain.handle('repository:backup',(_event,token)=>repository.createBackup(currentUser(token)));
ipcMain.handle('repository:restore',(_event,{token,payload})=>repository.restoreBackup(currentUser(token),payload));

ipcMain.handle('videos:list',(_event,token)=>{const user=currentUser(token);authorize(user,'video.view');const roles=user.roles||[];return repository.db.prepare('SELECT * FROM videos WHERE enabled=1 OR ?=1 ORDER BY sort_order,title').all(roles.includes(ROLES.ADMIN)?1:0).map((row)=>({...row,audience:JSON.parse(row.audience_json),canManage:roles.includes(ROLES.ADMIN)})).filter((video)=>roles.includes(ROLES.ADMIN)||!video.audience.length||video.audience.some((role)=>roles.includes(role)));});
ipcMain.handle('videos:save',(_event,{token,video})=>{const user=currentUser(token);authorize(user,'video.manage');if(video.sourceType==='online'&&!safeHttpsUrl(video.url))throw new Error('Video trực tuyến chỉ chấp nhận URL HTTPS an toàn.');const id=video.id||`video-${crypto.randomUUID()}`;repository.db.prepare(`INSERT INTO videos(id,title,description,category,audience_json,thumbnail,source_type,url,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,audience_json=excluded.audience_json,thumbnail=excluded.thumbnail,source_type=excluded.source_type,url=excluded.url,duration=excluded.duration,sort_order=excluded.sort_order,enabled=excluded.enabled,context_key=excluded.context_key,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).run(id,String(video.title||'').trim(),video.description||'',video.category||'Bắt đầu sử dụng',JSON.stringify(video.audience||[]),video.thumbnail||'',video.sourceType||'online',video.url||'',video.localPath||null,video.duration||'',Number(video.sortOrder)||0,video.enabled===false?0:1,video.contextKey||'',new Date().toISOString(),user.id);repository.audit(user.id,video.id?'video.update':'video.create','video',id);return{id};});
ipcMain.handle('videos:import-mp4',async(event,{token,metadata})=>{const user=currentUser(token);authorize(user,'video.manage');const owner=BrowserWindow.fromWebContents(event.sender);const result=await dialog.showOpenDialog(owner,{title:'Chọn video MP4 ngoại tuyến',properties:['openFile'],filters:[{name:'Video MP4',extensions:['mp4']}]});if(result.canceled)return{canceled:true};const source=result.filePaths[0];const stat=await fs.promises.stat(source);const validation=validateVideoFile(source,stat.size,'video/mp4');if(!validation.extension)throw new Error('Chỉ chấp nhận tệp MP4.');if(!validation.validSize)throw new Error('Video phải có dữ liệu và không được vượt quá 1 GB.');if(!validation.mime)throw new Error('Kiểu nội dung video không hợp lệ.');await fs.promises.mkdir(videoRoot(),{recursive:true});const filename=`${crypto.randomUUID()}.mp4`;await fs.promises.copyFile(source,path.join(videoRoot(),filename),fs.constants.COPYFILE_EXCL);const id=`video-${crypto.randomUUID()}`;repository.db.prepare('INSERT INTO videos(id,title,description,category,audience_json,source_type,local_path,duration,sort_order,enabled,context_key,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,metadata.title||path.basename(source,'.mp4'),metadata.description||'',metadata.category||'Bắt đầu sử dụng',JSON.stringify(metadata.audience||[]),'offline',filename,metadata.duration||'',Number(metadata.sortOrder)||0,1,metadata.contextKey||'',new Date().toISOString(),user.id);repository.audit(user.id,'video.import','video',id,0,'success',{filename:path.basename(source),size:stat.size});return{canceled:false,id};});
ipcMain.handle('videos:open-online',async(_event,{token,videoId})=>{const user=currentUser(token);authorize(user,'video.view');const video=repository.db.prepare('SELECT * FROM videos WHERE id=? AND enabled=1').get(videoId);if(!video||video.source_type!=='online'||!safeHttpsUrl(video.url))throw new Error('Liên kết video không hợp lệ.');repository.db.prepare('UPDATE videos SET used_count=used_count+1 WHERE id=?').run(videoId);repository.audit(user.id,'video.open','video',videoId);await shell.openExternal(video.url);return true;});
ipcMain.handle('videos:get-offline-url',(_event,{token,videoId})=>{const user=currentUser(token);authorize(user,'video.view');const video=repository.db.prepare('SELECT * FROM videos WHERE id=? AND enabled=1').get(videoId);if(!video||video.source_type!=='offline')throw new Error('Video ngoại tuyến không tồn tại.');const root=path.resolve(videoRoot());const file=path.resolve(root,video.local_path);if(!file.startsWith(`${root}${path.sep}`)||path.extname(file)!=='.mp4')throw new Error('Đường dẫn video không an toàn.');repository.db.prepare('UPDATE videos SET used_count=used_count+1 WHERE id=?').run(videoId);repository.audit(user.id,'video.play','video',videoId);return pathToFileURL(file).href;});
ipcMain.handle('videos:delete',async(_event,{token,videoId})=>{const user=currentUser(token);authorize(user,'video.manage');const video=repository.db.prepare('SELECT * FROM videos WHERE id=?').get(videoId);if(!video)throw new Error('Không tìm thấy video.');if(video.used_count>0&&video.source_type==='online')throw new Error('Không thể xóa liên kết đã được sử dụng; hãy tắt liên kết.');if(video.local_path){const root=path.resolve(videoRoot());const file=path.resolve(root,video.local_path);if(file.startsWith(`${root}${path.sep}`))await fs.promises.unlink(file).catch((error)=>{if(error.code!=='ENOENT')throw error;});}repository.db.prepare('DELETE FROM videos WHERE id=?').run(videoId);repository.audit(user.id,'video.delete','video',videoId);return true;});

ipcMain.handle('imports:choose-files', async (event, {token,kind}) => {
  const user=currentUser(token);authorize(user,user.roles.includes(ROLES.ADMIN)?'data.manage':'data.read');
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner, { title: 'Chọn tệp dữ liệu từ máy', properties: ['openFile', 'multiSelections'], filters: importFilters(kind) });
  if (result.canceled) return { canceled: true, files: [] };
  const files = [];
  for (const filePath of result.filePaths) {
    const stat = await fs.promises.stat(filePath);
    validateImportFile(filePath, stat.size, kind);
    const token = crypto.randomUUID();
    const name = path.basename(filePath);
    pendingImports.set(token, { path: filePath, name, size: stat.size, kind, createdAt: Date.now() });
    const bytes = await fs.promises.readFile(filePath);
    let preview = { filename: name };
    if (kind === 'word') preview = await parseWordBuffer(bytes, name);
    if (kind === 'excel') preview = parseExcelBuffer(bytes, name);
    files.push({ token, name, size: stat.size, preview });
  }
  return { canceled: false, kind, files };
});

ipcMain.handle('imports:commit-pdf', async (_event, { token,tokens, actor }) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const files = (tokens || []).map((token) => pendingImports.get(token)).filter((file) => file?.kind === 'pdf');
  if (!files.length) throw new Error('Không còn tệp PDF hợp lệ để thêm.');
  const imported = await importPdfFiles(files, addedDocumentsRoot(), actor);
  tokens.forEach((token) => pendingImports.delete(token));
  repository.audit(user.id,'pdf.import','source','multiple',0,'success',{count:imported.length});
  return imported.map((source) => ({ ...source, relativePath: `user-added/${source.relativePath}` }));
});

ipcMain.handle('imports:undo-pdf', async (_event, { token,relativePaths }) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const removed = [];
  for (const relativePath of relativePaths || []) {
    if (typeof relativePath !== 'string' || !relativePath.replace(/\\/g, '/').startsWith('user-added/')) throw new Error('Chỉ có thể hoàn tác PDF nguồn bổ sung.');
    const filePath = resolveDocument(relativePath);
    const root = path.resolve(addedDocumentsRoot());
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Đường dẫn hoàn tác nằm ngoài kho nguồn bổ sung.');
    try { await fs.promises.unlink(filePath); removed.push(relativePath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  repository.audit(user.id,'pdf.undo','source','multiple',0,'success',{count:removed.length});return { ok: true, removed };
});

ipcMain.handle('exports:save-word', async (event, { token,filename, type, payload, school }) => {
  const user=currentUser(token);const own=payload?.authorTeacherId===user.staffId;authorize(user,own?'document.export_own':'document.export',payload||{});if((payload?.signers||[]).some((signer)=>signer.mode==='image'))for(const signer of payload.signers.filter((item)=>item.mode==='image'))authorize(user,'signature.use',{...payload,ownerStaffId:signer.staffId});
  const safeName = safeExportName(filename, '.docx');
  const customBuffer = type === 'review' ? null : await templateManager.renderCustom(payload?.templateId, payload, school);
  const buffer = customBuffer || (type === 'review' ? await createReviewDocx(payload, school) : await createPlanDocx(payload, school));
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(owner, { title: 'Xuất tài liệu Word', defaultPath: path.join(app.getPath('downloads'), safeName), filters: [{ name: 'Tài liệu Word', extensions: ['docx'] }] });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  await fs.promises.writeFile(result.filePath, buffer);
  repository.audit(user.id,'document.export_word',type||'plan',payload?.id||'',payload?.version||0,'success',{signed:(payload?.signers||[]).some((item)=>item.mode==='image')});
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('templates:list', (_event, token) => {
  currentUser(token);
  return templateManager.list();
});

ipcMain.handle('templates:import', async (event, { token, metadata }) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const owner=BrowserWindow.fromWebContents(event.sender);
  const result=await dialog.showOpenDialog(owner,{title:'Nhập mẫu Word tùy chỉnh',properties:['openFile'],filters:[{name:'Mẫu Word',extensions:['docx']}]});
  if(result.canceled)return{canceled:true,...templateManager.list()};
  const templates=await templateManager.importTemplate(result.filePaths[0],metadata);
  repository.audit(user.id,'template.import','template','custom');
  return{canceled:false,...templates};
});

ipcMain.handle('templates:set-default', (_event, { token, type, templateId }) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const result=templateManager.setDefault(type,templateId);
  repository.audit(user.id,'template.default','template',templateId);
  return result;
});

ipcMain.handle('templates:backup', async (event, token) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const owner=BrowserWindow.fromWebContents(event.sender);
  const result=await dialog.showSaveDialog(owner,{title:'Sao lưu mẫu văn bản',defaultPath:path.join(app.getPath('downloads'),'sao-luu-mau-ctgdmn.json'),filters:[{name:'Bản sao lưu mẫu',extensions:['json']}]});
  if(result.canceled||!result.filePath)return{ok:false,canceled:true};
  await fs.promises.writeFile(result.filePath,JSON.stringify(templateManager.backupPayload()));
  repository.audit(user.id,'template.backup','template','all');
  return{ok:true,filePath:result.filePath};
});

ipcMain.handle('templates:restore', async (event, token) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const owner=BrowserWindow.fromWebContents(event.sender);
  const result=await dialog.showOpenDialog(owner,{title:'Khôi phục mẫu văn bản',properties:['openFile'],filters:[{name:'Bản sao lưu mẫu',extensions:['json']}]});
  if(result.canceled)return{canceled:true,...templateManager.list()};
  const payload=JSON.parse(await fs.promises.readFile(result.filePaths[0],'utf8'));
  const templates=templateManager.restorePayload(payload);
  repository.audit(user.id,'template.restore','template','all');
  return{canceled:false,...templates};
});

ipcMain.handle('exports:save-pdf', async (event, { token, filename, payload, school }) => {
  const user=currentUser(token);const own=payload?.authorTeacherId===user.staffId;authorize(user,own?'document.export_own':'document.export',payload||{});
  const safeName = safeExportName(filename, '.pdf');
  const buffer = await createPlanPdf(payload, school);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(owner, {
    title: 'Xuất tài liệu PDF',
    defaultPath: path.join(app.getPath('downloads'), safeName),
    filters: [{ name: 'Tài liệu PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  await fs.promises.writeFile(result.filePath, buffer);
  repository.audit(user.id,'document.export_pdf','plan',payload?.id||'',payload?.version||0);
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('ai:get-config', (_event, token) => {
  currentUser(token);
  return aiService.store.getPublicConfig();
});

ipcMain.handle('ai:save-config', (_event, { token, config }) => {
  const user=currentUser(token);
  authorize(user,'data.manage');
  const saved=aiService.store.save(config);
  repository.audit(user.id,'ai.config_save','ai',saved.provider,0,'success',{model:saved.model,keyMode:saved.keyMode});
  return saved;
});

ipcMain.handle('ai:clear-config', (_event, token) => {
  const user=currentUser(token);
  authorize(user,'data.manage');
  aiService.store.clear();
  repository.audit(user.id,'ai.config_clear','ai','local');
  return true;
});

ipcMain.handle('ai:test-connection', async (_event, token) => {
  const user=currentUser(token);
  const result=await aiService.testAIConnection();
  repository.audit(user.id,'ai.connection_test','ai',aiService.store.getPublicConfig().provider,0,result.ok?'success':'failure',{status:result.status});
  return result;
});

ipcMain.handle('ai:generate', async (_event, { token, action, plan, requestId }) => {
  const user=currentUser(token);
  if (!['generate','improve','validate'].includes(action)) throw new Error('Thao tác AI không hợp lệ.');
  const result=await aiService.run(action,plan,requestId);
  repository.audit(user.id,`ai.${action}`,'plan',plan?.id||'',plan?.version||0,'success',{provider:aiService.store.getPublicConfig().provider});
  return result;
});

ipcMain.handle('ai:cancel', (_event, { token, requestId }) => {
  currentUser(token);
  return aiService.cancelAIRequest(requestId);
});

ipcMain.handle('exports:save-excel', async (event, { token,filename, payload }) => {
  const user=currentUser(token);authorize(user,user.roles.includes(ROLES.ADMIN)?'data.manage':'document.export');
  const safeName = safeExportName(filename, '.xlsx');
  const workbook = await createProfessionalWorkbook(payload);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(owner, { title: 'Xuất sổ làm việc Excel', defaultPath: path.join(app.getPath('downloads'), safeName), filters: [{ name: 'Sổ làm việc Excel', extensions: ['xlsx'] }] });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  await workbook.xlsx.writeFile(result.filePath);
  repository.audit(user.id,'document.export_excel','workbook',filename);
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('exports:save-directory', async (event, { token,filename, kind, rows, template, school }) => {
  const user=currentUser(token);authorize(user,'data.manage');
  const safeName = safeExportName(filename, '.xlsx');
  if (!['classes','staff','videos'].includes(kind)) throw new Error('Loại danh mục không hợp lệ.');
  const workbook = await createDirectoryWorkbook(kind, rows, template, school);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(owner, { title: template ? 'Lưu tệp Excel mẫu' : 'Xuất danh mục Excel', defaultPath:path.join(app.getPath('downloads'),safeName), filters:[{name:'Sổ làm việc Excel',extensions:['xlsx']}] });
  if (result.canceled || !result.filePath) return {ok:false,canceled:true};
  await workbook.xlsx.writeFile(result.filePath); return {ok:true,filePath:result.filePath};
});

app.whenReady().then(() => {
  repository=new Repository(path.join(app.getPath('userData'),'ctgdmn.sqlite'));
  aiService=new LocalAIService(new AIConfigStore(path.join(app.getPath('userData'),'ai-config.secure.json'),safeStorage));
  templateManager=new TemplateManager(path.join(app.getPath('userData'),'document-templates'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if(repository){repository.close();repository=null;}
  aiService=null;
  templateManager=null;
  if (process.platform !== 'darwin') app.quit();
});
