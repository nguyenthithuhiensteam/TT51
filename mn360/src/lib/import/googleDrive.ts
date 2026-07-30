// Chọn tệp Excel từ Google Drive để nhập dữ liệu hàng loạt. Chỉ dùng OAuth Client ID (không lưu
// Client Secret phía client — đúng khuyến nghị bảo mật của Google cho ứng dụng chạy trên máy
// người dùng). Cần cấu hình tại Cài đặt → Tích hợp Google Drive trước khi dùng, và cần Internet.
import { dbExecute, dbSelect, nowIso } from "../db/client";
import { newId } from "../utils/id";

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
}

const SETTINGS_KEY = "google_drive_config";
const DEFAULT_CONFIG: GoogleDriveConfig = { clientId: "", apiKey: "" };
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export async function loadGoogleDriveConfig(): Promise<GoogleDriveConfig> {
  const rows = await dbSelect<{ value_json: string }>(
    "SELECT value_json FROM system_settings WHERE key = ?",
    [SETTINGS_KEY],
  );
  if (!rows[0]) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(rows[0].value_json) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveGoogleDriveConfig(config: GoogleDriveConfig, userId: string): Promise<void> {
  const valueJson = JSON.stringify(config);
  await dbExecute(
    `INSERT INTO system_settings (id, key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [newId(), SETTINGS_KEY, valueJson, userId, nowIso()],
  );
}

declare global {
  interface Window {
    google?: {
      accounts?: { oauth2?: { initTokenClient: (opts: Record<string, unknown>) => { requestAccessToken: () => void } } };
      picker?: {
        DocsView: new (viewId: unknown) => { setMimeTypes: (mimeTypes: string) => unknown };
        ViewId: { SPREADSHEETS: unknown };
        PickerBuilder: new () => PickerBuilderInstance;
        Action: { PICKED: string; CANCEL: string };
      };
    };
    gapi?: { load: (name: string, opts: { callback: () => void; onerror: () => void }) => void };
  }
}

interface PickerCallbackData {
  action: string;
  docs: { id: string; name: string; mimeType: string }[];
}

interface PickerBuilderInstance {
  addView: (view: unknown) => PickerBuilderInstance;
  setOAuthToken: (token: string) => PickerBuilderInstance;
  setDeveloperKey: (key: string) => PickerBuilderInstance;
  setCallback: (cb: (data: PickerCallbackData) => void) => PickerBuilderInstance;
  build: () => { setVisible: (v: boolean) => void };
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Không tải được thư viện Google (${src})`));
    document.head.appendChild(script);
  });
}

async function ensureGoogleScripts(): Promise<void> {
  await Promise.all([
    loadScriptOnce("https://accounts.google.com/gsi/client"),
    loadScriptOnce("https://apis.google.com/js/api.js"),
  ]);
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Không tải được thư viện đăng nhập Google"));
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error("Xác thực Google Drive thất bại hoặc bị hủy"));
        } else {
          resolve(resp.access_token);
        }
      },
    });
    tokenClient.requestAccessToken();
  });
}

function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) {
      resolve();
      return;
    }
    if (!window.gapi) {
      reject(new Error("Không tải được thư viện Google API"));
      return;
    }
    window.gapi.load("picker", {
      callback: () => resolve(),
      onerror: () => reject(new Error("Không tải được Google Picker")),
    });
  });
}

export interface PickedDriveFile {
  name: string;
  bytes: ArrayBuffer;
}

const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.google-apps.spreadsheet",
].join(",");

/** Mở Google Drive Picker, trả về nội dung tệp Excel đã chọn (null nếu người dùng hủy). */
export async function pickExcelFileFromGoogleDrive(config: GoogleDriveConfig): Promise<PickedDriveFile | null> {
  if (!config.clientId || !config.apiKey) {
    throw new Error("Chưa cấu hình Google Drive — vào Cài đặt → Tích hợp Google Drive để nhập Client ID và API Key.");
  }
  await ensureGoogleScripts();
  const accessToken = await requestAccessToken(config.clientId);
  await loadPicker();

  const google = window.google;
  if (!google?.picker) throw new Error("Không tải được Google Picker");

  return new Promise((resolve, reject) => {
    const view = new google.picker!.DocsView(google.picker!.ViewId.SPREADSHEETS).setMimeTypes(EXCEL_MIME_TYPES);
    const picker = new google.picker!.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(config.apiKey)
      .setCallback(async (data: PickerCallbackData) => {
        if (data.action === google.picker!.Action.PICKED) {
          const file = data.docs[0];
          try {
            const isGoogleSheet = file.mimeType === "application/vnd.google-apps.spreadsheet";
            const url = isGoogleSheet
              ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
              : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok) throw new Error(`Tải tệp từ Google Drive thất bại (mã ${res.status})`);
            const bytes = await res.arrayBuffer();
            resolve({ name: file.name, bytes });
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Không tải được tệp từ Google Drive"));
          }
        } else if (data.action === google.picker!.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
