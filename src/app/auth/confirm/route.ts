import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Email confirmation link target. Handles both Supabase link styles:
// ?code=… (default PKCE flow) and ?token_hash=…&type=… (custom email template).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const supabase = await supabaseServer();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };
  if (!error) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.redirect(new URL("/login?error=Confirmation+link+is+invalid+or+expired", request.url));
}
