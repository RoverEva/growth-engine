"use server";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { back, field } from "@/lib/flash";
import { supabaseServer } from "@/lib/supabase/server";

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: field(form, "email"), password: field(form, "password") });
  if (error) back("/login", { error: error.message });
  redirect(safeNext(field(form, "next")));
}

export async function signUp(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email: field(form, "email"),
    password: field(form, "password"),
    options: { emailRedirectTo: `${env.appUrl()}/auth/confirm` },
  });
  if (error) back("/login", { error: error.message });
  back("/login", { notice: "Check your email to confirm your account, then sign in." });
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
