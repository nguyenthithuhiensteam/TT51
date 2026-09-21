/**
 * Cầu nối cho bản chạy trên trình duyệt (máy chủ Express thật ở server/index.mjs), thay cho
 * electron/preload.cjs. Chỉ định nghĩa khi CHƯA có window.ctgdmnDesktop — trong ứng dụng Electron
 * thật, contextBridge đã tạo sẵn trước khi tệp này chạy nên đoạn này sẽ không làm gì cả.
 */
(function () {
  if (window.ctgdmnDesktop) return;

  let authToken = '';

  async function api(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let payload;
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const response = await fetch(path, { method, headers, body: payload });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : null;
    if (!response.ok) throw new Error((data && data.error) || `Máy chủ trả về lỗi ${response.status}.`);
    return data;
  }

  async function apiUpload(path, formData) {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const response = await fetch(path, { method: 'POST', headers, body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Máy chủ trả về lỗi ${response.status}.`);
    return data;
  }

  async function apiDownload(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Máy chủ trả về lỗi ${response.status}.`);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
    const filename = match ? decodeURIComponent(match[1]) : 'tai-lieu';
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { ok: true, filePath: filename };
  }

  /** Mở hộp chọn tệp của trình duyệt (thay cho dialog.showOpenDialog của Electron). */
  function pickFile(accept, multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = Boolean(multiple);
      input.style.display = 'none';
      input.addEventListener('change', () => { resolve([...input.files]); input.remove(); }, { once: true });
      window.addEventListener('focus', function onFocus() {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => { if (!input.files.length) resolve([]); }, 300);
      }, { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  window.ctgdmnDesktop = {
    platform: 'web',

    getPublicBranding: () => api('GET', '/api/branding/public'),
    getAuthStatus: () => api('GET', '/api/auth/status'),
    setupFirstAdmin: (data) => api('POST', '/api/auth/setup-first-admin', data),
    requestAccount: (data) => api('POST', '/api/auth/request-account', data),
    login: async (username, password) => {
      const result = await api('POST', '/api/auth/login', { username, password });
      authToken = result.token;
      sessionStorage.setItem('ctgdmn-web-token', authToken);
      return result.user;
    },
    logout: async () => { const result = await api('POST', '/api/auth/logout'); authToken = ''; sessionStorage.removeItem('ctgdmn-web-token'); return result; },
    changePassword: (currentPassword, newPassword) => api('POST', '/api/auth/change-password', { currentPassword, newPassword }),

    listUsers: () => api('GET', '/api/accounts'),
    createUser: (data) => api('POST', '/api/accounts', data),
    importUsers: (rows) => api('POST', '/api/accounts/import', { rows }),
    lockUser: (userId, locked) => api('POST', `/api/accounts/${encodeURIComponent(userId)}/lock`, { locked }),
    resetUserPassword: (userId, tempPassword) => api('POST', `/api/accounts/${encodeURIComponent(userId)}/reset-password`, { tempPassword }),
    listAccountRequests: () => api('GET', '/api/accounts/requests'),
    approveAccountRequest: (requestId) => api('POST', `/api/accounts/requests/${encodeURIComponent(requestId)}/approve`),
    rejectAccountRequest: (requestId, reason) => api('POST', `/api/accounts/requests/${encodeURIComponent(requestId)}/reject`, { reason }),
    listChildren: () => api('GET', '/api/children'),
    upsertChild: (data) => api('POST', '/api/children', data),
    deactivateChild: (childId) => api('POST', `/api/children/${encodeURIComponent(childId)}/deactivate`),
    listChildAssessments: (childId) => api('GET', `/api/assessments${childId ? `?childId=${encodeURIComponent(childId)}` : ''}`),
    upsertChildAssessment: (data) => api('POST', '/api/assessments', data),
    deleteChildAssessment: (assessmentId) => api('POST', `/api/assessments/${encodeURIComponent(assessmentId)}/delete`),

    bootstrapRepository: (legacy) => api('POST', '/api/repository/bootstrap', { legacy }),
    getRepositoryState: () => api('GET', '/api/repository/state'),
    saveRepositoryState: (payload) => api('POST', '/api/repository/state', payload),
    transitionPlan: (planId, toStatus) => api('POST', `/api/plans/${encodeURIComponent(planId)}/transition`, { toStatus }),
    updateSystemConfig: (config) => api('POST', '/api/repository/config', config),
    getAuditLog: (limit) => api('GET', `/api/repository/audit?limit=${encodeURIComponent(limit || 500)}`),
    createDatabaseBackup: () => api('GET', '/api/repository/backup'),
    restoreDatabaseBackup: (payload) => api('POST', '/api/repository/restore', payload),

    listVideos: () => api('GET', '/api/videos'),
    saveVideo: (video) => api('POST', '/api/videos', video),
    importOfflineVideo: async (metadata) => {
      const [file] = await pickFile('video/mp4', false);
      if (!file) return { canceled: true };
      const formData = new FormData();
      formData.append('file', file);
      for (const [key, value] of Object.entries(metadata || {})) formData.append(key, Array.isArray(value) ? value.join(',') : value ?? '');
      return apiUpload('/api/videos/import-mp4', formData);
    },
    openOnlineVideo: async (videoId) => { const { url } = await api('POST', `/api/videos/${encodeURIComponent(videoId)}/open-online`); window.open(url, '_blank', 'noopener'); return true; },
    getOfflineVideoUrl: async (videoId) => { const { url } = await api('GET', `/api/videos/${encodeURIComponent(videoId)}/offline-url`); return url; },
    deleteVideo: (videoId) => api('DELETE', `/api/videos/${encodeURIComponent(videoId)}`),

    openGuide: async (format) => {
      try { window.open(`/api/guides/${encodeURIComponent(format)}?token=${encodeURIComponent(authToken)}`, '_blank', 'noopener'); return { ok: true, error: null }; }
      catch (error) { return { ok: false, error: error.message }; }
    },
    openTrustedResource: async (resourceId) => { const { url } = await api('GET', `/api/resources/trusted/${encodeURIComponent(resourceId)}`); window.open(url, '_blank', 'noopener'); return true; },

    getProgramIndex: () => api('GET', '/api/data/index'),
    getDocumentUrl: (relativePath) => Promise.resolve(`/api/documents/file?relativePath=${encodeURIComponent(relativePath)}&token=${encodeURIComponent(authToken)}`),
    openDocument: async (relativePath) => {
      try { window.open(`/api/documents/file?relativePath=${encodeURIComponent(relativePath)}&token=${encodeURIComponent(authToken)}`, '_blank', 'noopener'); return { ok: true, error: null }; }
      catch (error) { return { ok: false, error: error.message }; }
    },

    chooseImportFiles: async (kind) => {
      const acceptByKind = { word: '.docx', excel: '.xlsx,.xls', pdf: '.pdf' };
      const files = await pickFile(acceptByKind[kind] || '', true);
      if (!files.length) return { canceled: true, files: [] };
      const formData = new FormData();
      formData.append('kind', kind);
      for (const file of files) formData.append('files', file);
      return apiUpload('/api/imports/choose-files', formData);
    },
    commitPdfImport: (tokens, actor) => api('POST', '/api/imports/commit-pdf', { tokens, actor }),
    undoPdfImport: (relativePaths) => api('POST', '/api/imports/undo-pdf', { relativePaths }),

    saveWord: (filename, type, payload, school) => apiDownload('/api/exports/word', { filename, type, payload, school }),
    savePdf: (filename, payload, school) => apiDownload('/api/exports/pdf', { filename, payload, school }),
    saveExcel: (filename, payload) => apiDownload('/api/exports/excel', { filename, payload }),
    saveDirectoryExcel: (filename, kind, rows, template, school) => apiDownload('/api/exports/directory', { filename, kind, rows, template, school }),

    getAIConfig: () => api('GET', '/api/ai/config'),
    saveAIConfig: (config) => api('POST', '/api/ai/config', config),
    clearAIConfig: () => api('DELETE', '/api/ai/config'),
    testAIConnection: () => api('POST', '/api/ai/test'),
    runAI: (action, plan, requestId) => api('POST', '/api/ai/generate', { action, plan, requestId }),
    cancelAI: (requestId) => api('POST', '/api/ai/cancel', { requestId }),

    listTemplates: () => api('GET', '/api/templates'),
    importTemplate: async (metadata) => {
      const [file] = await pickFile('.docx', false);
      if (!file) return { canceled: true };
      const formData = new FormData();
      formData.append('file', file);
      for (const [key, value] of Object.entries(metadata || {})) formData.append(key, value ?? '');
      return apiUpload('/api/templates/import', formData);
    },
    setDefaultTemplate: (type, templateId) => api('POST', '/api/templates/default', { type, templateId }),
    backupTemplates: async () => {
      const payload = await api('GET', '/api/templates/backup');
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sao-luu-mau-ctgdmn.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { ok: true };
    },
    restoreTemplates: async () => {
      const [file] = await pickFile('.json', false);
      if (!file) return { canceled: true };
      const text = await file.text();
      const payload = JSON.parse(text);
      return api('POST', '/api/templates/restore', payload);
    },
  };

  const savedToken = sessionStorage.getItem('ctgdmn-web-token');
  if (savedToken) authToken = savedToken;
})();
