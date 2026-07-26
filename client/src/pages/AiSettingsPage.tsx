import { useEffect, useState } from "react";
import { aiApi, type AiHealthResponse, type AiSettingsResponse } from "../api/resources";
import { ApiError } from "../api/client";

const PROVIDER_OPTIONS = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "openai_compatible", label: "Nhà cung cấp tương thích OpenAI API" },
];

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  openai_compatible: "gpt-4o-mini",
};

const STATUS_TEXT: Record<AiHealthResponse["status"], { label: string; cls: string }> = {
  connected: { label: "Đã kết nối", cls: "success" },
  not_connected: { label: "Chưa kết nối", cls: "warn" },
  invalid_key: { label: "Khóa không hợp lệ", cls: "error" },
  quota_exceeded: { label: "Hết hạn mức", cls: "error" },
  network_error: { label: "Lỗi mạng", cls: "error" },
  error: { label: "Lỗi", cls: "error" },
};

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettingsResponse | null>(null);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [health, setHealth] = useState<AiHealthResponse | null>(null);
  const [checking, setChecking] = useState(false);

  function load() {
    aiApi.getSettings().then((s) => {
      setSettings(s);
      setProvider(s.provider);
      setModel(s.model);
      setBaseUrl(s.compatibleBaseUrl || "");
    });
  }

  useEffect(load, []);

  async function save() {
    setSaving(true);
    setSaveMsg("");
    try {
      await aiApi.saveSettings({ provider, model, compatibleBaseUrl: provider === "openai_compatible" ? baseUrl : undefined, apiKey: apiKey || undefined });
      setApiKey("");
      setSaveMsg("Đã lưu cài đặt AI.");
      load();
    } catch (err) {
      setSaveMsg(err instanceof ApiError ? err.message : "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  async function checkConnection() {
    setChecking(true);
    setHealth(null);
    try {
      const res = await aiApi.health({ provider, model, baseUrl: provider === "openai_compatible" ? baseUrl : undefined });
      setHealth(res);
    } catch {
      setHealth({ status: "error", message: "Không thể kiểm tra kết nối." });
    } finally {
      setChecking(false);
    }
  }

  const currentKeyInfo = settings ? (provider === "gemini" ? settings.keys.gemini : settings.keys.openai) : null;

  return (
    <div>
      <h2>Cài đặt AI</h2>
      <p className="muted">Cấu hình nhà cung cấp AI dùng để hỗ trợ tạo và chỉnh sửa kế hoạch giáo dục. Khóa API được lưu an toàn phía máy chủ, không hiển thị lại toàn bộ sau khi lưu và không lưu trong trình duyệt.</p>

      <div className="card">
        <div className="row">
          <div className="field">
            <label>Nhà cung cấp AI</label>
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(DEFAULT_MODELS[e.target.value]); }}>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Mô hình</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODELS[provider]} />
          </div>
        </div>
        {provider === "openai_compatible" && (
          <div className="field">
            <label>Địa chỉ API (Base URL)</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.nha-cung-cap.vn/v1" />
          </div>
        )}
        <div className="field">
          <label>Khóa API {currentKeyInfo?.configured && <span className="badge-key">{currentKeyInfo.masked}</span>}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={currentKeyInfo?.configured ? "Để trống nếu không đổi khóa hiện tại" : "Nhập khóa API"}
          />
          <div className="hint">Khóa API chỉ được lưu phía máy chủ (biến môi trường hoặc kho lưu trữ bí mật riêng), không bao giờ hiển thị lại toàn bộ và không được đưa lên GitHub.</div>
        </div>
        <div className="toolbar">
          <button className="primary" disabled={saving} onClick={save}>{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
          <button disabled={checking} onClick={checkConnection}>{checking ? "Đang kiểm tra..." : "Kiểm tra kết nối"}</button>
          {saveMsg && <span className="muted">{saveMsg}</span>}
        </div>
        {health && (
          <div className={`banner ${STATUS_TEXT[health.status].cls === "success" ? "success" : STATUS_TEXT[health.status].cls === "warn" ? "warn" : "error"}`}>
            <strong>{STATUS_TEXT[health.status].label}.</strong> {health.message}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Biến môi trường liên quan (khi triển khai)</h3>
        <ul className="muted">
          <li><span className="badge-key">AI_PROVIDER</span> - gemini | openai | openai_compatible</li>
          <li><span className="badge-key">AI_MODEL</span> - tên mô hình mặc định</li>
          <li><span className="badge-key">GEMINI_API_KEY</span> / <span className="badge-key">OPENAI_API_KEY</span> - khóa API (khuyến nghị cấu hình qua biến môi trường hoặc Secret Manager thay vì màn hình này khi triển khai chính thức)</li>
        </ul>
      </div>
    </div>
  );
}
