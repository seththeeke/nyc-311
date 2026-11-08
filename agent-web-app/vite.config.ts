import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* The UI lives in web/; `npm run dev` proxies /api to the server on 4311 so the UI hot-reloads against real data. */
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/web", emptyOutDir: true, chunkSizeWarningLimit: 1000 },
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": "http://127.0.0.1:4311" } },
});
