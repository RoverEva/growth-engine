import "server-only";

// Checks that each cited source URL is reachable (HTTP 2xx/3xx). This catches
// dead or invented links. It does not confirm the page supports the claim;
// that needs the Phase 2 AI fact check.
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i;

export function isCheckableUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export async function checkSourceUrl(raw: string): Promise<{ ok: boolean; status: number | null; error?: string }> {
  if (!isCheckableUrl(raw)) return { ok: false, status: null, error: "Not a public http(s) URL" };
  const attempt = async (method: "HEAD" | "GET") => {
    const response = await fetch(raw, {
      method, redirect: "follow", signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "GrowthEngine/1.0 (+source check)" },
    });
    return response.status;
  };
  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 403 || status === 501) status = await attempt("GET");
    return { ok: status >= 200 && status < 400, status };
  } catch (error) {
    return { ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
  }
}
