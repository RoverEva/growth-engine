import "server-only";

// All secrets are read on the server only. None of these names start with
// NEXT_PUBLIC_, so Next.js never bundles them into browser code.
function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export const env = {
  supabaseUrl: () => read("SUPABASE_URL"),
  supabaseAnonKey: () => read("SUPABASE_ANON_KEY"),
  dataforseoLogin: () => read("DATAFORSEO_LOGIN"),
  dataforseoPassword: () => read("DATAFORSEO_PASSWORD"),
  githubToken: () => read("GITHUB_TOKEN"),
  openaiKey: () => read("OPENAI_API_KEY"),
  gscCredentials: () => read("GSC_SERVICE_ACCOUNT_JSON"),
  triggerKey: () => read("TRIGGER_SECRET_KEY"),
  appUrl: () => read("APP_URL") ?? "http://localhost:3000",
};

export function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new MissingConfigError(name);
  return value;
}

export class MissingConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`${variable} is not set. Add it to .env.local (see README.md).`);
    this.name = "MissingConfigError";
  }
}
