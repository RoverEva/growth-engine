import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export function TopBar({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Growth <span className="text-violet-600">Engine</span>
        </Link>
        <nav aria-label="Engine" className="flex gap-3 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-violet-700">Projects</Link>
          <Link href="/queue" className="hover:text-violet-700">Approval queue</Link>
          <Link href="/setup" className="hover:text-violet-700">Setup</Link>
        </nav>
        {email ? (
          <form action={signOut} className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{email}</span>
            <button className="font-semibold text-violet-700 hover:underline" type="submit">Sign out</button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
