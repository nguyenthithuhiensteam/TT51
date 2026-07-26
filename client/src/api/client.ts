export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: string[];
  constructor(status: number, message: string, code?: string, issues?: string[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

function getToken(): string | null {
  return localStorage.getItem("mamnon_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("mamnon_token", token);
  else localStorage.removeItem("mamnon_token");
}

async function request<T>(path: string, opts: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof Blob)) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...opts, headers });
  } catch (e) {
    throw new ApiError(0, "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
    }
    throw new ApiError(res.status, body?.error || "Đã xảy ra lỗi không xác định.", body?.code, body?.issues);
  }
  return body as T;
}

export function get<T>(path: string, signal?: AbortSignal) {
  return request<T>(path, { method: "GET", signal });
}
export function post<T>(path: string, data?: unknown, signal?: AbortSignal) {
  return request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined, signal });
}
export function put<T>(path: string, data?: unknown, signal?: AbortSignal) {
  return request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined, signal });
}
export function patch<T>(path: string, data?: unknown) {
  return request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined });
}
export function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

async function fetchBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error || "Không thể tải tệp xuống.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob, filename: match?.[1] || "tep-xuat.bin" };
}

export async function downloadFile(path: string, fallbackName: string) {
  const { blob, filename } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function openBlobInNewTab(path: string, autoPrint = false) {
  const { blob } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (autoPrint && win) {
    win.addEventListener("load", () => {
      win.focus();
      win.print();
    });
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
