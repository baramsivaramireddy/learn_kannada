"use client";

import { useState } from "react";

type CheckState = "idle" | "checking" | "ok" | "error";

type CheckResult = {
  state: CheckState;
  message: string;
};

const apiUrl =  "https://dev.learnkannada.co.in/api/";

function Icon({ name }: { name: "browser" | "dns" | "server" | "database" | "terraform" | "deploy" }) {
  const paths = {
    browser: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
    dns: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2 2.2 3 4.8 3 8s-1 5.8-3 8c-2-2.2-3-4.8-3-8s1-5.8 3-8Z" /></>,
    server: <><rect x="4" y="3" width="16" height="7" rx="1" /><rect x="4" y="14" width="16" height="7" rx="1" /><path d="M8 6.5h.01M11 6.5h.01M8 17.5h.01M11 17.5h.01" /></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    terraform: <><path d="m12 3 7 4v8l-7 4-7-4V7l7-4Z" /><path d="m8 9 4 2 4-2M12 11v5" /></>,
    deploy: <><path d="M5 19h14M7 16V8m5 8V5m5 11v-5" /><path d="m5 8 2-2 2 2M10 5l2-2 2 2M15 11l2-2 2 2" /></>,
  };

  return <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">{paths[name]}</svg>;
}

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
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Simple Infra</p>
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

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Deployment path</p>
              <h2 className="mt-2 text-2xl font-semibold">How the system works</h2>
            </div>
            <span className="text-sm text-cyan-200">AWS · Nginx · Prisma</span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="border-l-2 border-cyan-300 pl-4">
              <p className="text-sm font-semibold text-cyan-200">01 · Frontend</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Next.js is exported as static files and served directly by Nginx.
              </p>
            </div>
            <div className="border-l-2 border-cyan-300 pl-4">
              <p className="text-sm font-semibold text-cyan-200">02 · API</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Nginx forwards <code className="text-slate-100">/api</code> requests to the Express systemd service.
              </p>
            </div>
            <div className="border-l-2 border-cyan-300 pl-4">
              <p className="text-sm font-semibold text-cyan-200">03 · Database</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Prisma checks the private PostgreSQL RDS connection from the EC2 server.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 border-y border-slate-800 py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">AWS infrastructure</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">From browser to private database</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-slate-400 sm:text-right">Region: ap-south-2 · Default VPC · Private RDS</p>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
            <div className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 p-4">
              <div className="mb-4 flex items-center justify-between text-cyan-200"><Icon name="browser" /><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" /></div>
              <p className="text-sm font-semibold text-cyan-200">01 · Browser</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Requests `dev.learnkannada.co.in` over HTTPS.</p>
            </div>
            <span className="hidden text-2xl text-cyan-300 lg:block">-&gt;</span>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between text-amber-200"><Icon name="dns" /><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_#fcd34d]" /></div>
              <p className="text-sm font-semibold text-amber-200">02 · Route53 + EIP</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Public DNS points the application name to the EC2 Elastic IP.</p>
            </div>
            <span className="hidden text-2xl text-cyan-300 lg:block">-&gt;</span>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between text-emerald-200"><Icon name="server" /><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_#6ee7b7]" /></div>
              <p className="text-sm font-semibold text-emerald-200">03 · EC2 + Nginx</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Nginx serves `frontend/out` and forwards `/api` to port 4000.</p>
            </div>
            <span className="hidden text-2xl text-cyan-300 lg:block">-&gt;</span>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between text-fuchsia-200"><Icon name="server" /><span className="h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_14px_#f0abfc]" /></div>
              <p className="text-sm font-semibold text-fuchsia-200">04 · Express + Prisma</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">The systemd backend handles health routes and opens the database query.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 pl-6 text-sm text-slate-500 lg:ml-[72%] lg:pl-0">
            <span className="h-12 border-l border-dashed border-slate-600" />
            <span>-&gt; private DNS -&gt; port 5432</span>
          </div>

          <div className="mt-1 flex justify-center lg:justify-end">
            <div className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 lg:w-[24%]">
              <div className="mb-4 flex items-center justify-between text-rose-200"><Icon name="database" /><span className="h-2 w-2 rounded-full bg-rose-300 shadow-[0_0_14px_#fda4af]" /></div>
              <p className="text-sm font-semibold text-rose-200">05 · Private RDS PostgreSQL</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">No public access. The database security group accepts traffic only from the app security group.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-3 text-slate-300"><Icon name="terraform" /><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Terraform creates</p></div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li className="flex gap-3"><span className="text-cyan-300">•</span><span><strong className="text-slate-100">EC2 t3.micro:</strong> Ubuntu host for Nginx and the Express daemon.</span></li>
              <li className="flex gap-3"><span className="text-cyan-300">•</span><span><strong className="text-slate-100">Security groups:</strong> HTTP/HTTPS/SSH to EC2 and PostgreSQL only from EC2.</span></li>
              <li className="flex gap-3"><span className="text-cyan-300">•</span><span><strong className="text-slate-100">RDS db.t3.micro:</strong> PostgreSQL 17 in private subnets.</span></li>
              <li className="flex gap-3"><span className="text-cyan-300">•</span><span><strong className="text-slate-100">Route53:</strong> public app record and VPC-private database record.</span></li>
              <li className="flex gap-3"><span className="text-cyan-300">•</span><span><strong className="text-slate-100">Elastic IP:</strong> stable public address for the EC2 instance.</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-3 text-slate-300"><Icon name="deploy" /><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Ansible deploys</p></div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li className="flex gap-3"><span className="font-mono text-cyan-300">01</span><span>SSH into the EC2 host and clone the `basic-infra` branch from GitHub.</span></li>
              <li className="flex gap-3"><span className="font-mono text-cyan-300">02</span><span>Install Node.js, Nginx, dependencies, Prisma, and the 2 GB swap file.</span></li>
              <li className="flex gap-3"><span className="font-mono text-cyan-300">03</span><span>Build the static Next.js export into `frontend/out`.</span></li>
              <li className="flex gap-3"><span className="font-mono text-cyan-300">04</span><span>Run Express with systemd and configure Nginx plus HTTPS.</span></li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}

