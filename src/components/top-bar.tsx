import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export function TopBar({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Hatch<span className="text-violet-600">Elite</span> <span className="font-medium text-slate-500">SEO Engine</span>
        </Link>
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
