import { query } from "../db.js";

export async function snapshotPageVersion(pageId: string, actor?: string) {
  const { rows } = await query<{
    title: string;
    content: string;
    format: string;
    tags: string[];
  }>("SELECT title, content, format, tags FROM page WHERE id=$1", [pageId]);
  if (!rows.length) return;
  const p = rows[0];
  await query(
    "INSERT INTO page_version(page_id, title, content, format, tags, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
    [
      pageId,
      p.title,
      p.content,
      p.format || "rich",
      p.tags || [],
      actor || null,
    ]
  );
}
