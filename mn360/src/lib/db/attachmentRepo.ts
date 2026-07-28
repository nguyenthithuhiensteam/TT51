import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { dbExecute, nowIso } from "./client";
import { newId } from "../utils/id";

/** Mở hộp thoại chọn tệp, sao chép vào thư mục dữ liệu và ghi bản ghi attachments dùng chung. */
export async function pickAndAttachFile(
  entityTable: string,
  entityId: string,
  uploadedBy: string,
): Promise<{ filePath: string; fileName: string } | null> {
  const selected = await open({ multiple: false, directory: false });
  if (!selected || Array.isArray(selected)) return null;

  const [filePath, fileName] = await invoke<[string, string]>("save_attachment", {
    entityTable,
    entityId,
    sourcePath: selected,
  });

  await dbExecute(
    `INSERT INTO attachments (id, entity_table, entity_id, file_name, file_path, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), entityTable, entityId, fileName, filePath, uploadedBy, nowIso()],
  );

  return { filePath, fileName };
}
