"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Disables the button while its form's server action runs (prevents double submits).
export function SubmitButton({ children, pending, variant = "primary" }: { children: ReactNode; pending?: string; variant?: "primary" | "secondary" | "danger" }) {
  const status = useFormStatus();
  const styles = {
    primary: "bg-violet-600 text-white hover:bg-violet-700",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button type="submit" disabled={status.pending}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${styles}`}>
      {status.pending ? pending ?? "Working…" : children}
    </button>
  );
}
