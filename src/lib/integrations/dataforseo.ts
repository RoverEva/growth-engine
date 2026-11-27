import "server-only";
import { env, requireEnv } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/retry";

// DataForSEO Labs "Keyword Ideas" (live):
// POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live
// Response items: tasks[].result[].items[] with keyword, keyword_info.{search_volume,cpc,competition},
// keyword_properties.keyword_difficulty and search_intent_info.main_intent.
// Request/response handling adapted from TheCraigHewitt/seomachine (MIT).
const BASE_URL = "https://api.dataforseo.com";

export type Intent = "informational" | "navigational" | "commercial" | "transactional" | "unknown";

export interface KeywordIdea {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  keywordDifficulty: number | null;
  intent: Intent;
}

function authHeader() {
  const login = requireEnv(env.dataforseoLogin(), "DATAFORSEO_LOGIN");
  const password = requireEnv(env.dataforseoPassword(), "DATAFORSEO_PASSWORD");
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

interface DfsResponse {
  status_code: number;
  status_message: string;
  cost?: number;
  tasks?: Array<{ status_code: number; status_message: string; result?: Array<{ items?: unknown[] | null }> | null }>;
}

const INTENTS = new Set(["informational", "navigational", "commercial", "transactional"]);

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Pure parser, unit-tested separately from the network call.
export function parseKeywordIdeas(response: DfsResponse): { ideas: KeywordIdea[]; cost: number } {
  if (response.status_code !== 20000) {
    throw new HttpError(`DataForSEO error ${response.status_code}: ${response.status_message}`, response.status_code === 40100 ? 401 : 400, response);
  }
  const task = response.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new HttpError(`DataForSEO task error ${task?.status_code ?? "?"}: ${task?.status_message ?? "no task returned"}`, 400, response);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped third-party JSON, validated field by field below
  const items = (task.result?.[0]?.items ?? []) as Array<Record<string, any>>;
  const seen = new Set<string>();
  const ideas: KeywordIdea[] = [];
  for (const item of items) {
    const keyword = typeof item?.keyword === "string" ? item.keyword.trim() : "";
    const key = keyword.toLowerCase().replace(/\s+/g, " ");
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    const intent = item.search_intent_info?.main_intent;
    ideas.push({
      keyword,
      searchVolume: num(item.keyword_info?.search_volume),
      cpc: num(item.keyword_info?.cpc),
      competition: num(item.keyword_info?.competition),
      keywordDifficulty: num(item.keyword_properties?.keyword_difficulty),
      intent: INTENTS.has(intent) ? intent : "unknown",
    });
  }
  return { ideas, cost: num(response.cost) ?? 0 };
}

export async function fetchKeywordIdeas(params: { seeds: string[]; locationCode: number; languageCode: string; limit: number }) {
  const body = [{
    keywords: params.seeds.slice(0, 200),
    location_code: params.locationCode,
    language_code: params.languageCode,
    limit: Math.min(Math.max(params.limit, 1), 1000),
    filters: ["keyword_info.search_volume", ">", 0],
    order_by: ["relevance,desc", "keyword_info.search_volume,desc"],
  }];
  const response = await fetchJson<DfsResponse>(`${BASE_URL}/v3/dataforseo_labs/google/keyword_ideas/live`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 60000,
  });
  return parseKeywordIdeas(response);
}

// Real connection check: returns the account login and balance.
export async function testDataForSeo(): Promise<string> {
  const response = await fetchJson<{ status_code: number; status_message: string; tasks?: Array<{ result?: Array<{ login?: string; money?: { balance?: number } }> }> }>(
    `${BASE_URL}/v3/appendix/user_data`, { headers: { Authorization: authHeader() }, timeoutMs: 15000 });
  if (response.status_code !== 20000) throw new Error(`${response.status_code} ${response.status_message}`);
  const info = response.tasks?.[0]?.result?.[0];
  return `Connected as ${info?.login ?? "unknown"}; balance $${info?.money?.balance ?? "?"}`;
}
