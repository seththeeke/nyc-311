export type DataMode = "mock" | "live";

export interface AppConfig {
  apiBaseUrl: string;
  dataMode: DataMode;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  dataMode: import.meta.env.VITE_DATA_MODE === "live" ? "live" : "mock",
};
