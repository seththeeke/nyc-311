/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_PIPELINE_API_BASE_URL: string;
  readonly VITE_DATA_MODE: "mock" | "live";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
