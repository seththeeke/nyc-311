import type { ReactElement } from "react";
import { MonitoringTile, type MonitoringTileAccent } from "../MonitoringTile";
import {
  CoverageIcon,
  DataWarehouseIcon,
  IngestionIcon,
  IntegrationTestsIcon,
  LambdaHealthIcon,
  OrderEventsIcon,
  OrdersIcon,
  PipelineIcon,
  ReportsIcon,
} from "../monitoring/MonitoringTileIcons";

interface MonitoringTileConfig {
  title: string;
  description: string;
  to: string;
  accent: MonitoringTileAccent;
  icon: ReactElement;
  external?: boolean;
}

const MONITORING_TILES: MonitoringTileConfig[] = [
  {
    title: "Ingestion",
    description: "NYC 311 poller run history and status.",
    to: "/monitoring/ingestion",
    accent: "cyan",
    icon: <IngestionIcon />,
  },
  {
    title: "Pipeline",
    description: "Nyc311Pipeline stage status and deploy history.",
    to: "/monitoring/pipeline",
    accent: "violet",
    icon: <PipelineIcon />,
  },
  {
    title: "Orders",
    description: "Orders created from promoted Requests, filterable by stage and status.",
    to: "/monitoring/orders",
    accent: "emerald",
    icon: <OrdersIcon />,
  },
  {
    title: "Order Events",
    description: "The full OrderEvent history — accept/reject/case outcomes and beyond.",
    to: "/monitoring/order-events",
    accent: "emerald",
    icon: <OrderEventsIcon />,
  },
  {
    title: "Lambda Health",
    description: "Invocations, successes, and errors per Lambda, over the last 7 days.",
    to: "/monitoring/lambda-health",
    accent: "amber",
    icon: <LambdaHealthIcon />,
  },
  {
    title: "Test Coverage",
    description: "Vitest coverage reports for backend, web-app, and cdk.",
    to: "/coverage/index.html",
    accent: "rose",
    icon: <CoverageIcon />,
    external: true,
  },
  {
    title: "Integration Tests",
    description: "Which GET routes the integration-test suite reached on its most recent run.",
    to: "/monitoring/integration-tests",
    accent: "indigo",
    icon: <IntegrationTestsIcon />,
  },
  {
    title: "Data Warehouse",
    description: "Explore the warehouse schema, job run history, and job results.",
    to: "/data",
    accent: "cyan",
    icon: <DataWarehouseIcon />,
  },
  {
    title: "Reports",
    description: "Week-over-week trends assembled from the daily warehouse job runs.",
    to: "/reports",
    accent: "emerald",
    icon: <ReportsIcon />,
  },
];

export function MonitoringPage(): ReactElement {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-blue-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="animate-aurora-3 absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live &middot; Nyc311
        </div>

        <h1
          className="animate-fade-in-up mt-6 bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Monitoring
        </h1>
        <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400" style={{ animationDelay: "150ms" }}>
          Real-time visibility into the ingestion poller and the deploy pipeline — read-only, always on.
        </p>

        <div
          className="animate-fade-in-up mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2"
          style={{ animationDelay: "220ms" }}
        >
          {MONITORING_TILES.map((tile) => (
            <MonitoringTile key={tile.to} {...tile} />
          ))}
        </div>
      </div>
    </main>
  );
}
