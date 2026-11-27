// Retries a call when the failure is temporary (rate limit, server error,
// network). Permanent errors (bad credentials, bad input) fail immediately.
export class HttpError extends Error {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 408 || error.status === 429 || error.status >= 500;
  if (error instanceof TypeError) return true; // fetch network failure
  if (error instanceof Error && /timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(error.message)) return true;
  return false;
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onAttempt?: (attempt: number, error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const base = options.baseDelayMs ?? 1000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      options.onAttempt?.(attempt, error);
      if (attempt === attempts || !isRetryable(error)) break;
      await sleep(base * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 30000, ...rest } = init;
  const response = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  if (!response.ok) {
    const message = typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : text.slice(0, 300);
    throw new HttpError(`${response.status} ${response.statusText}: ${message}`, response.status, body);
  }
  return body as T;
}
