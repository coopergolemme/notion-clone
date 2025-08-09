import { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { embed } from "../embeddings.js";

export function registerAdminRoutes(app: FastifyInstance) {
  app.post("/admin/reembed-all", async () => {
    const pages = await query<{ id: string; title: string; content: string }>(
      "select id, title, content from page",
      []
    );
    let updated = 0;
    for (const p of pages.rows) {
      const vec = await embed(`${p.title}\n\n${p.content}`);
      console.log(
        vec
          ? `Re-embedding page ${p.id} (${p.title})`
          : `Failed to embed page ${p.id} (${p.title})`
      );
      console.log("Embedding vector:", vec);
      if (vec) {
        // Ensure vec is a native array of numbers, not a string
        const embeddingArray = Array.isArray(vec) ? vec.map(Number) : [];
        const embeddingString = `[${embeddingArray.join(",")}]`; // Use square brackets
        await query("update page set embedding=$1::vector where id=$2", [
          embeddingString,
          p.id,
        ]);
        updated++;
      }
    }
    return { updated };
  });
}
