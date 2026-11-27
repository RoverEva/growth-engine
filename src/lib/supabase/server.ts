import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, requireEnv } from "@/lib/env";

// A Supabase client acting as the signed-in user. Every query runs under
// row-level security with that user's role.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(requireEnv(env.supabaseUrl(), "SUPABASE_URL"), requireEnv(env.supabaseAnonKey(), "SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session cookie instead.
        }
      },
    },
  });
}
