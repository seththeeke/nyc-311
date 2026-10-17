/* / <reference types="vite/client" /> */

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_PIPELINE_API_BASE_URL: string;
  readonly VITE_DATA_MODE: "mock" | "live";
  /* Overrides VITE_DATA_MODE for the resident service only, so a live-mode dev server can still use the resident mocks. */
  readonly VITE_RESIDENT_DATA_MODE?: "mock" | "live";
  readonly VITE_RESIDENT_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
