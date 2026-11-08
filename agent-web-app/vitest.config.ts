import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/* Two projects: the server and shared code run under node, the UI under happy-dom; one coverage gate across both (CLAUDE.md §5.5). */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["tests/server/**/*.test.ts", "tests/shared/**/*.test.ts", "tests/isolation.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "happy-dom",
          setupFiles: ["tests/setup.ts"],
          include: ["tests/web/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "shared/**/*.ts", "web/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "server/main.ts", "web/main.tsx"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90, perFile: true },
      reporter: [["text", { skipFull: true }], "html", "json-summary"],
    },
  },
});
