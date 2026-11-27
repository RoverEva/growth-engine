import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withRetry } from "@/lib/retry";

export class DuplicateRunError extends Error {
  constructor(kind: string) {
    super(`A ${kind.replace(/_/g, " ")} run with the same input is already in progress.`);
    this.name = "DuplicateRunError";
  }
}

type LogLine = { at: string; level: "info" | "warn" | "error"; message: string };

// Records one automation run (an external call or job) in automation_runs:
// status, attempts, input/output, errors and a short log. A second run with the
// same idempotency key while the first is still running is rejected by a
// unique index, which prevents duplicate generation.
export async function runAutomation<T>(
  supabase: SupabaseClient,
  params: { projectId: string; kind: string; input: Record<string, unknown>; idempotencyKey?: string; userId: string; attempts?: number },
  work: (log: (message: string, level?: LogLine["level"]) => void) => Promise<{ output: T; costUsd?: number }>,
): Promise<{ runId: string; output: T }> {
  const log: LogLine[] = [];
  const write = (message: string, level: LogLine["level"] = "info") => log.push({ at: new Date().toISOString(), level, message });

  const { data: run, error } = await supabase
    .from("automation_runs")
    .insert({
      project_id: params.projectId, kind: params.kind, input: params.input, status: "running",
      idempotency_key: params.idempotencyKey ?? null, started_at: new Date().toISOString(), created_by: params.userId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new DuplicateRunError(params.kind);
    throw new Error(`Could not record the run: ${error.message}`);
  }

  let attempts = 0;
  try {
    const result = await withRetry(
      async (attempt) => {
        attempts = attempt;
        if (attempt > 1) write(`Retry attempt ${attempt}`, "warn");
        return work(write);
      },
      { attempts: params.attempts ?? 3, onAttempt: (attempt, err) => write(`Attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`, "warn") },
    );
    await supabase.from("automation_runs").update({
      status: "succeeded", output: result.output as never, attempts, log, cost_usd: result.costUsd ?? null, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    return { runId: run.id, output: result.output };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    write(message, "error");
    await supabase.from("automation_runs").update({
      status: "failed", error: message, attempts, log, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    throw err;
  }
}
