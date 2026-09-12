"use client";

import { useState } from "react";

type CheckState = "idle" | "checking" | "ok" | "error";

type CheckResult = {
  state: CheckState;
  message: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [backend, setBackend] = useState<CheckResult>({ state: "idle", message: "Not checked" });
  const [database, setDatabase] = useState<CheckResult>({ state: "idle", message: "Not checked" });

  const checkService = async (path: string, setResult: (result: CheckResult) => void) => {
    setResult({ state: "checking", message: "Checking..." });
    try {
      const response = await fetch(`${apiUrl}${path}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Check failed");
      setResult({ state: "ok", message: "Connected" });
    } catch {
      setResult({ state: "error", message: "Unavailable" });
    }
  };

  const statusClass = (state: CheckState) => {
    if (state === "ok") return "text-emerald-700";
    if (state === "error") return "text-red-700";
    if (state === "checking") return "text-amber-700";
    return "text-slate-500";
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Learn Kannada</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">System status</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
          Check the API and its PostgreSQL connection from one place.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <p className="text-sm font-medium text-slate-400">Service 01</p>
            <h2 className="mt-2 text-2xl font-semibold">Backend API</h2>
            <p className={`mt-4 text-sm font-semibold ${statusClass(backend.state)}`}>{backend.message}</p>
            <button
              className="mt-8 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={backend.state === "checking"}
              onClick={() => checkService("/health", setBackend)}
            >
              Check backend
            </button>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <p className="text-sm font-medium text-slate-400">Service 02</p>
            <h2 className="mt-2 text-2xl font-semibold">PostgreSQL database</h2>
            <p className={`mt-4 text-sm font-semibold ${statusClass(database.state)}`}>{database.message}</p>
            <button
              className="mt-8 w-full rounded-xl border border-cyan-300 px-4 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60"
              disabled={database.state === "checking"}
              onClick={() => checkService("/db-health", setDatabase)}
            >
              Check database
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

