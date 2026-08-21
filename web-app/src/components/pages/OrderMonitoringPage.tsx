import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "../../hooks/useOrders";
import { OrderFilters } from "../orders/OrderFilters";
import { OrderListTable } from "../orders/OrderListTable";
import type { OrderStage, OrderStatus } from "../../models/order";

/* Small on purpose (3-order-ingestion.md's Order list view is "nothing too crazy") — just enough to prove pagination works. */
const PAGE_SIZE = 10;

const PAGE_BUTTON_CLASSES =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function OrderMonitoringPage(): ReactElement {
  const [stage, setStage] = useState<OrderStage | "">("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  /* History of cursors visited via "Next"; the last entry is the current page's cursor, [] means the first page. */
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const currentCursor = cursorStack[cursorStack.length - 1];
  const { data, isPending, isError, error } = useOrders({
    limit: PAGE_SIZE,
    cursor: currentCursor,
    stage: stage || undefined,
    status: status || undefined,
  });

  function handleStageChange(next: OrderStage | ""): void {
    setStage(next);
    setCursorStack([]);
  }

  function handleStatusChange(next: OrderStatus | ""): void {
    setStatus(next);
    setCursorStack([]);
  }

  function handleNext(): void {
    if (data?.nextCursor) {
      setCursorStack((prev) => [...prev, data.nextCursor as string]);
    }
  }

  function handleBack(): void {
    setCursorStack((prev) => prev.slice(0, -1));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[26rem] w-[26rem] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-cyan-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-4xl px-6 py-16">
        <Link to="/monitoring" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Orders
        </h1>
        <p className="mt-2 text-slate-400">Orders created from promoted Requests.</p>

        <div className="mt-6">
          <OrderFilters
            stage={stage}
            status={status}
            onStageChange={handleStageChange}
            onStatusChange={handleStatusChange}
          />
        </div>

        {isPending && <p className="mt-6 text-slate-400">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-red-400">
            Failed to load orders{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && data.orders.length === 0 && (
          <p className="mt-6 text-slate-400">No orders match these filters.</p>
        )}

        {!isPending && !isError && data.orders.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white p-4 shadow-2xl shadow-emerald-950/20 ring-1 ring-black/5">
            <OrderListTable orders={data.orders} />
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={handleBack} disabled={cursorStack.length === 0} className={PAGE_BUTTON_CLASSES}>
                &larr; Back
              </button>
              <button type="button" onClick={handleNext} disabled={!data.nextCursor} className={PAGE_BUTTON_CLASSES}>
                Next &rarr;
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
