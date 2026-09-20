const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  DEVELOPMENT_DOMAINS,
  PLAN_RESPONSE_SCHEMA,
  normalizePlanType,
  validatePlanResponse,
} = require('./plan-schema.cjs');

const DEFAULTS = Object.freeze({
  openai: { model: 'gpt-5.6-luna', baseUrl: 'https://api.openai.com/v1' },
  gemini: { model: 'gemini-3.6-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  claude: { model: 'claude-sonnet-4-20250514', baseUrl: 'https://api.anthropic.com/v1' },
  compatible: { model: '', baseUrl: '' },
});

const STATUS = Object.freeze({
  OFFLINE: 'offline',
  UNCONFIGURED: 'unconfigured',
  UNTESTED: 'untested',
  READY: 'ready',
  INVALID_KEY: 'invalid_key',
  QUOTA: 'quota',
  MODEL: 'model_unavailable',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
});

function maskKey(value = '') {
  const key = String(value);
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(Math.max(4, key.length));
  return `${'•'.repeat(12)}${key.slice(-4)}`;
}

function ensureSafeBaseUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Địa chỉ API không hợp lệ.'); }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Địa chỉ API phải dùng HTTPS; HTTP chỉ được phép cho dịch vụ trên chính máy này.');
  }
  return url.toString().replace(/\/+$/, '');
}

function parseJsonText(value) {
  if (value && typeof value === 'object') return value;
  let text = String(value || '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  try { return JSON.parse(text); } catch { throw new Error('AI trả về JSON lỗi hoặc có văn bản thừa không thể làm sạch.'); }
}

function sanitizeForAI(value, key = '') {
  const blocked = /(child|student|tre|trẻ).*(name|birth|health|disability|phone|address)|parent|mother|father|email|phone|address|contact|medical/i;
  if (blocked.test(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeForAI(item)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([nestedKey, nestedValue]) => [nestedKey, sanitizeForAI(nestedValue, nestedKey)])
        .filter(([, nestedValue]) => nestedValue !== undefined),
    );
  }
  return value;
}

function buildPrompt(action, plan = {}) {
  const type = normalizePlanType(plan.level);
  const minimal = sanitizeForAI({
    ageGroup: plan.ageGroup || '',
    level: plan.level || '',
    title: plan.title || '',
    period: plan.period || '',
    context: plan.context || '',
    objectives: plan.objectives || '',
    activities: plan.activities || '',
    materials: plan.materials || '',
    differentiation: plan.differentiation || '',
    assessment: plan.assessment || '',
    family: plan.family || '',
    classConditions: plan.classConditions || '',
    requestedSection: plan.requestedSection || '',
  });
  const instructions = [
    'Bạn là trợ lý chuyên môn giáo dục mầm non Việt Nam.',
    'Chỉ đề xuất bản nháp để giáo viên rà soát; không tự phê duyệt hoặc thay đổi dữ liệu chương trình nguồn.',
    'Không thêm họ tên, ngày sinh, sức khỏe, khuyết tật, địa chỉ, số điện thoại hoặc dữ liệu nhận dạng của trẻ.',
    `Loại kế hoạch: ${type}.`,
    type === 'theme' ? `Nhóm lĩnh vực chuẩn: ${DEVELOPMENT_DOMAINS.join('; ')}.` : '',
    'Trả về duy nhất JSON đúng schema được cung cấp, dùng tiếng Việt chuẩn.',
    action === 'validate' ? 'Rà soát tính nhất quán; giữ nguyên ý chính và ghi đề xuất vào assessment.' : '',
    action === 'improve' ? 'Cải thiện riêng phần requestedSection, nhưng vẫn trả về đầy đủ đối tượng.' : '',
  ].filter(Boolean).join('\n');
  return { instructions, input: JSON.stringify(minimal) };
}

class AIConfigStore {
  constructor(filePath, safeStorage) {
    this.filePath = filePath;
    this.safeStorage = safeStorage;
    this.sessionKeys = new Map();
  }

  readFile() {
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')); } catch { return {}; }
  }

  writeFile(value) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  getPublicConfig() {
    const stored = this.readFile();
    const provider = stored.provider || '';
    const hasStoredKey = Boolean(stored.encryptedKey);
    const sessionKey = this.sessionKeys.get(provider) || '';
    return {
      provider,
      model: stored.model || DEFAULTS[provider]?.model || '',
      baseUrl: stored.baseUrl || DEFAULTS[provider]?.baseUrl || '',
      timeoutMs: Number(stored.timeoutMs) || 60000,
      retries: Number(stored.retries) || 1,
      keyMode: sessionKey ? 'session' : hasStoredKey ? 'machine' : 'none',
      maskedKey: maskKey(sessionKey || (hasStoredKey ? `stored-${stored.keySuffix || ''}` : '')),
      consentAccepted: Boolean(stored.consentAccepted),
      lastTest: stored.lastTest || null,
    };
  }

  getSecret(provider) {
    const session = this.sessionKeys.get(provider);
    if (session) return session;
    const stored = this.readFile();
    if (!stored.encryptedKey || stored.provider !== provider) return '';
    if (!this.safeStorage?.isEncryptionAvailable()) throw new Error('Kho bảo mật Windows hiện chưa sẵn sàng.');
    return this.safeStorage.decryptString(Buffer.from(stored.encryptedKey, 'base64'));
  }

  save(config = {}) {
    const provider = String(config.provider || '').trim();
    if (!DEFAULTS[provider]) throw new Error('Nhà cung cấp AI không hợp lệ.');
    const model = String(config.model || DEFAULTS[provider].model || '').trim();
    if (!model) throw new Error('Cần nhập tên mô hình AI.');
    const baseUrl = ensureSafeBaseUrl(config.baseUrl, DEFAULTS[provider].baseUrl);
    const key = String(config.apiKey || '').trim();
    const keyMode = config.keyMode === 'session' ? 'session' : 'machine';
    const previous = this.readFile();
    const stored = {
      provider,
      model,
      baseUrl,
      timeoutMs: Math.max(5000, Math.min(180000, Number(config.timeoutMs) || 60000)),
      retries: Math.max(0, Math.min(3, Number(config.retries) || 0)),
      consentAccepted: Boolean(config.consentAccepted),
      lastTest: previous.provider === provider ? previous.lastTest || null : null,
      keySuffix: key ? key.slice(-4) : previous.keySuffix || '',
    };
    if (keyMode === 'session') {
      if (key) this.sessionKeys.set(provider, key);
      if (previous.provider === provider && previous.encryptedKey) stored.encryptedKey = previous.encryptedKey;
    } else if (key) {
      if (!this.safeStorage?.isEncryptionAvailable()) throw new Error('Không thể lưu khóa: kho bảo mật Windows chưa sẵn sàng.');
      stored.encryptedKey = this.safeStorage.encryptString(key).toString('base64');
      this.sessionKeys.delete(provider);
    } else if (previous.provider === provider && previous.encryptedKey) {
      stored.encryptedKey = previous.encryptedKey;
    }
    this.writeFile(stored);
    return this.getPublicConfig();
  }

  recordTest(result) {
    const stored = this.readFile();
    stored.lastTest = { ...result, at: new Date().toISOString() };
    this.writeFile(stored);
  }

  clear() {
    this.sessionKeys.clear();
    try { fs.unlinkSync(this.filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function mapHttpError(status, message = '') {
  if (status === 401 || status === 403) return Object.assign(new Error('Khóa API không hợp lệ hoặc không có quyền.'), { code: STATUS.INVALID_KEY });
  if (status === 402 || status === 429) return Object.assign(new Error('Tài khoản không đủ hạn mức hoặc đang bị giới hạn.'), { code: STATUS.QUOTA });
  if (status === 404 || /model/i.test(message)) return Object.assign(new Error('Mô hình không tồn tại hoặc chưa được cấp quyền.'), { code: STATUS.MODEL });
  return Object.assign(new Error(message || `Dịch vụ AI phản hồi lỗi HTTP ${status}.`), { code: STATUS.UNAVAILABLE });
}

async function fetchJson(url, options, timeoutMs, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abort = () => controller.abort(signal.reason || 'cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw mapHttpError(response.status, data?.error?.message || data?.message || text);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timedOut = !signal?.aborted;
      throw Object.assign(new Error(timedOut ? 'Yêu cầu AI đã hết thời gian chờ.' : 'Đã hủy yêu cầu AI.'), { code: timedOut ? STATUS.TIMEOUT : 'cancelled' });
    }
    if (error.code) throw error;
    throw Object.assign(new Error('Không thể kết nối thực tế đến dịch vụ AI đã chọn.'), { code: STATUS.OFFLINE, cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

class LocalAIService {
  constructor(store, audit = () => {}) {
    this.store = store;
    this.audit = audit;
    this.controllers = new Map();
  }

  checkAIConfiguration() {
    const config = this.store.getPublicConfig();
    return { configured: Boolean(config.provider && (config.keyMode !== 'none')), config };
  }

  async requestProvider(config, apiKey, prompt, schema, signal) {
    const baseUrl = ensureSafeBaseUrl(config.baseUrl, DEFAULTS[config.provider]?.baseUrl);
    if (config.provider === 'gemini') {
      const url = `${baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
      const data = await fetchJson(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.instructions }] },
          contents: [{ role: 'user', parts: [{ text: prompt.input }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
        }),
      }, config.timeoutMs, signal);
      return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    }
    if (config.provider === 'claude') {
      const data = await fetchJson(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 8192,
          system: `${prompt.instructions}\nJSON Schema:\n${JSON.stringify(schema)}`,
          messages: [{ role: 'user', content: prompt.input }],
        }),
      }, config.timeoutMs, signal);
      return data?.content?.filter((item) => item.type === 'text').map((item) => item.text).join('') || '';
    }
    const data = await fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: prompt.instructions },
          { role: 'user', content: prompt.input },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'ctgdmn_plan', strict: true, schema },
        },
      }),
    }, config.timeoutMs, signal);
    return data?.choices?.[0]?.message?.content || '';
  }

  async run(action, plan = {}, requestId = crypto.randomUUID()) {
    const { configured, config } = this.checkAIConfiguration();
    if (!configured) throw Object.assign(new Error('Chưa cấu hình GenAI.'), { code: STATUS.UNCONFIGURED });
    if (!config.consentAccepted) throw new Error('Cần xác nhận thông báo an toàn dữ liệu trước khi dùng AI.');
    const apiKey = this.store.getSecret(config.provider);
    if (!apiKey) throw Object.assign(new Error('Chưa có khóa API.'), { code: STATUS.UNCONFIGURED });
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    const prompt = buildPrompt(action, plan);
    let lastError;
    try {
      for (let attempt = 0; attempt <= config.retries; attempt += 1) {
        try {
          const text = await this.requestProvider(config, apiKey, prompt, PLAN_RESPONSE_SCHEMA, controller.signal);
          const result = validatePlanResponse(parseJsonText(text));
          this.audit('ai.request', { provider: config.provider, model: config.model, action, ok: true });
          return { requestId, result, sentData: JSON.parse(prompt.input) };
        } catch (error) {
          lastError = error;
          if (controller.signal.aborted || ['invalid_key', 'quota', 'model_unavailable'].includes(error.code)) break;
        }
      }
      this.audit('ai.request', { provider: config.provider, model: config.model, action, ok: false, code: lastError?.code || 'invalid_response' });
      throw lastError;
    } finally {
      this.controllers.delete(requestId);
    }
  }

  async testAIConnection() {
    const { configured, config } = this.checkAIConfiguration();
    if (!configured) return { ok: false, status: STATUS.UNCONFIGURED };
    try {
      const result = await this.run('validate', { level: 'Ngày/hoạt động', title: 'Kiểm tra kết nối', objectives: 'Trả về bản nháp kiểm tra kết nối.' }, `test-${crypto.randomUUID()}`);
      const status = { ok: Boolean(result.result), status: STATUS.READY };
      this.store.recordTest(status);
      return status;
    } catch (error) {
      const status = { ok: false, status: error.code || STATUS.UNAVAILABLE, message: error.message };
      this.store.recordTest(status);
      return status;
    }
  }

  cancelAIRequest(requestId) {
    const controller = this.controllers.get(requestId);
    if (!controller) return false;
    controller.abort('cancelled');
    return true;
  }
}

module.exports = {
  AIConfigStore,
  DEFAULTS,
  LocalAIService,
  STATUS,
  buildPrompt,
  ensureSafeBaseUrl,
  maskKey,
  parseJsonText,
  sanitizeForAI,
};
