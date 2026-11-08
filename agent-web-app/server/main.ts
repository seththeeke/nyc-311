import { buildApp } from "./app.ts";
import { getConfig } from "./config.ts";
import { logInfo } from "./logger.ts";

/* Entry point (`npm start` / `npm run dev`): localhost only, never 0.0.0.0. */
const config = getConfig();
const app = await buildApp({ config });
await app.listen({ host: config.host, port: config.port });
logInfo("agent-web-app listening", { url: `http://${config.host}:${config.port}`, ...config });
