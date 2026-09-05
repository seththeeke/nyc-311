import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export function HomePage(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">NYC 311</h1>
      <p className="mt-2 text-slate-600">
        <Link to="/monitoring" className="text-blue-600 underline">
          View system monitoring
        </Link>
      </p>
      <p className="mt-2 text-slate-600">
        <Link to="/data" className="text-blue-600 underline">
          Explore the data warehouse
        </Link>
      </p>
    </main>
  );
}
