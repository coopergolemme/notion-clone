import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerPageRoutes } from "./routes/pages.js";
import { registerAIRoutes } from "./routes/ai.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerLinkRoutes } from "./routes/links.js";
import { registerExportRoutes } from "./routes/export.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerHistoryRoutes } from "./routes/history.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

registerPageRoutes(app);
registerAIRoutes(app);
registerAdminRoutes(app);
registerLinkRoutes(app);
registerExportRoutes(app);
registerSearchRoutes(app);
registerHistoryRoutes(app);

const port = Number(process.env.PORT || 3001);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API listening on :${port}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
