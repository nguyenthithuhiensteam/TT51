(() => {
  const key = 'ctgdmn-browser-preview-state';
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };
  const write = (value) => localStorage.setItem(key, JSON.stringify(value));
  const demoUser = { id: 'preview-user', username: 'preview', fullName: 'Người dùng thử nghiệm', roles: ['system_admin'], staffId: 'preview-staff', team: '', classIds: [], scope: {}, active: true, mustChangePassword: false };
  const state = read();
  window.ctgdmnDesktop = {
    getAuthStatus: async () => ({ hasUsers: true, canPersist: false, schoolName: 'CTGDMN – Bản xem trước' }),
    resumeSession: async () => demoUser,
    login: async () => demoUser,
    setupFirstAdmin: async () => true,
    logout: async () => true,
    logoutAll: async () => ({ count: 1 }),
    changePassword: async () => true,
    getProgramIndex: async () => fetch('./data/program-index.json').then((r) => r.json()),
    bootstrapRepository: async (legacy) => { if (!state.workspace) { state.workspace = legacy?.workspace || {}; state.review = legacy?.review || {}; write(state); } return true; },
    getRepositoryState: async () => ({ workspace: state.workspace || {}, review: state.review || {}, systemConfig: { repositoryMode: 'browser-preview', idleMinutes: 30 } }),
    saveRepositoryState: async (payload) => { state.workspace = payload.workspace || {}; state.review = payload.review || {}; write(state); return true; },
    listVideos: async () => [],
    getAuditLog: async () => [],
    updateSystemConfig: async () => true,
    createDatabaseBackup: async () => ({ format: 'browser-preview', state }),
    restoreDatabaseBackup: async (payload) => { Object.assign(state, payload?.state || {}); write(state); return true; },
    transitionPlan: async () => ({}),
    listUsers: async () => [demoUser],
    createUser: async () => demoUser,
    updateUser: async () => demoUser,
    lockUser: async () => true,
    resetUserPassword: async () => true,
    openExternalHttps: async (url) => { if (!/^https:\/\//i.test(url)) throw new Error('Chỉ cho phép URL HTTPS.'); window.open(url, '_blank', 'noopener'); return true; },
    openDocument: async (relativePath) => { window.open(`../program-documents/${relativePath}`, '_blank', 'noopener'); return { ok: true }; },
    getDocumentUrl: async (relativePath) => `../program-documents/${relativePath}`,
    openOnlineVideo: async () => true,
    getOfflineVideoUrl: async () => '',
    saveWord: async () => ({ ok: false, error: 'Xuất Word chỉ có trong bản Electron.' }),
    saveExcel: async () => ({ ok: false, error: 'Xuất Excel chỉ có trong bản Electron.' }),
    saveDirectoryExcel: async () => ({ ok: false, error: 'Xuất Excel chỉ có trong bản Electron.' }),
    chooseImportFiles: async () => ({ canceled: true, files: [] }),
    commitPdfImport: async () => [],
    undoPdfImport: async () => ({ ok: true, removed: [] }),
    platform: 'browser-preview'
  };
})();
