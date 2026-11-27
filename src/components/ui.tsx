import Link from "next/link";
import type { ReactNode } from "react";

export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <div role={error ? "alert" : "status"}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {error ?? notice}
    </div>
  );
}

const BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", in_review: "bg-amber-100 text-amber-800", approved: "bg-sky-100 text-sky-800",
  rejected: "bg-red-100 text-red-700", pr_open: "bg-violet-100 text-violet-800", published: "bg-emerald-100 text-emerald-800",
  succeeded: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-700", running: "bg-amber-100 text-amber-800", queued: "bg-slate-100 text-slate-700",
  working: "bg-emerald-100 text-emerald-800", planned: "bg-slate-100 text-slate-600", missing: "bg-red-100 text-red-700",
  owner: "bg-violet-100 text-violet-800", editor: "bg-sky-100 text-sky-800", viewer: "bg-slate-100 text-slate-700",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[value] ?? "bg-slate-100 text-slate-700"}`}>{label ?? value.replace(/_/g, " ")}</span>;
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title || actions ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-slate-50";
export const labelClass = "grid gap-1 text-sm font-medium text-slate-700";

export function Button({ children, variant = "primary", ...props }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-violet-600 text-white hover:bg-violet-700",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return <button {...props} className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${styles} ${props.className ?? ""}`}>{children}</button>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="font-medium text-violet-700 hover:underline" href={href}>{children}</Link>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>;
}
