import { dbSelect } from "./client";

export interface SearchResult {
  id: string;
  type: "task" | "document";
  title: string;
  code: string;
  link: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const like = `%${query.trim()}%`;

  const tasks = await dbSelect<{ id: string; title: string; code: string }>(
    `SELECT id, title, code FROM tasks WHERE deleted_at IS NULL
     AND (title LIKE ? OR code LIKE ?) LIMIT 5`,
    [like, like],
  );
  const documents = await dbSelect<{ id: string; title: string; code: string }>(
    `SELECT id, title, code FROM documents WHERE deleted_at IS NULL
     AND (title LIKE ? OR code LIKE ?) LIMIT 5`,
    [like, like],
  );

  return [
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      code: t.code,
      link: `/cong-viec/${t.id}`,
    })),
    ...documents.map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.title,
      code: d.code,
      link: `/van-phong-so/${d.id}`,
    })),
  ];
}
