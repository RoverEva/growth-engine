"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["", "Dashboard"], ["/keywords", "Keywords"], ["/articles", "Articles"], ["/social", "Social"], ["/runs", "Run log"], ["/integrations", "Integrations"], ["/settings", "Settings"],
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/p/${projectId}`;
  return (
    <nav aria-label="Project" className="flex gap-1 overflow-x-auto">
      {ITEMS.map(([suffix, label]) => {
        const href = base + suffix;
        const active = suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={label} href={href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-slate-100"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
