import { signIn, signUp } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { TopBar } from "@/components/top-bar";
import { Card, Notice, inputClass, labelClass } from "@/components/ui";
import { env } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const configured = Boolean(env.supabaseUrl() && env.supabaseAnonKey());
  return (
    <>
      <TopBar />
      <main className="mx-auto grid max-w-md gap-4 px-4 py-12">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <Notice notice={params.notice} error={params.error} />
        {!configured ? (
          <Card title="Setup needed">
            <p className="text-sm text-slate-600">
              Supabase is not connected. Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>seo-engine/.env.local</code>,
              apply the migrations, and restart. See <code>seo-engine/README.md</code>.
            </p>
          </Card>
        ) : (
          <Card>
            <form action={signIn} className="grid gap-3">
              <input type="hidden" name="next" value={params.next ?? "/"} />
              <label className={labelClass}>Email<input className={inputClass} name="email" type="email" autoComplete="email" required /></label>
              <label className={labelClass}>Password<input className={inputClass} name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
              <div className="flex gap-2">
                <SubmitButton pending="Signing in…">Sign in</SubmitButton>
                <button formAction={signUp} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" type="submit">Create account</button>
              </div>
              <p className="text-xs text-slate-500">New accounts confirm by email. A project owner then adds you to a project.</p>
            </form>
          </Card>
        )}
      </main>
    </>
  );
}
