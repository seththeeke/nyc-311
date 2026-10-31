import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { config } from "../../config";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";
import { PublicApiHealth } from "../publicApi/PublicApiHealth";
import { PublicApiOperations } from "../publicApi/PublicApiOperations";
import { PublicApiSpecDownload } from "../publicApi/PublicApiSpecDownload";

/** Monitoring → Public API (16-resident-action-models.md §6.2): its health, its operations, and the spec to download. */
export function PublicApiPage(): ReactElement {
  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -right-16 h-[26rem] w-[26rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-emerald-600/15 blur-3xl" />
      </div>

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/monitoring" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-cyan via-hue-emerald to-hue-violet bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Public API
        </h1>

        <PublicApiHealth />
        <PublicApiOperations baseUrl={config.publicApiBaseUrl} />
        <PublicApiSpecDownload />
      </main>
    </div>
  );
}
