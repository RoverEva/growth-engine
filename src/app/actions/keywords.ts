"use server";
import { requireProject } from "@/lib/auth";
import { back, errorText, field } from "@/lib/flash";
import { fetchKeywordIdeas } from "@/lib/integrations/dataforseo";
import { runAutomation } from "@/lib/runs";
import { businessRelevance, opportunityScore } from "@/lib/seo/opportunity";

// Real DataForSEO call → saved keywords (no duplicates) with relevance and opportunity scores.
export async function researchKeywords(projectId: string, form: FormData) {
  const path = `/p/${projectId}/keywords`;
  let message = "";
  try {
    const { supabase, user, project } = await requireProject(projectId, "editor");
    const seeds = field(form, "seeds").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
    if (!seeds.length) throw new Error("Enter at least one seed keyword.");
    const limit = Math.min(Math.max(Number(field(form, "limit")) || 100, 10), 500);
    const locationCode = project.default_location_code as number;
    const languageCode = project.default_language_code as string;

    const { output } = await runAutomation(supabase, {
      projectId, kind: "keyword_research", userId: user.id,
      input: { seeds, limit, locationCode, languageCode },
      idempotencyKey: `seeds:${seeds.map((s) => s.toLowerCase()).sort().join("|")}:${locationCode}:${languageCode}`,
    }, async (log) => {
      const { ideas, cost } = await fetchKeywordIdeas({ seeds, locationCode, languageCode, limit });
      log(`DataForSEO returned ${ideas.length} keyword ideas (cost $${cost}).`);
      const rows = ideas.map((idea) => {
        const relevance = businessRelevance(idea.keyword);
        return {
          project_id: projectId, keyword: idea.keyword, location_code: locationCode, language_code: languageCode,
          search_volume: idea.searchVolume, keyword_difficulty: idea.keywordDifficulty, cpc: idea.cpc, competition: idea.competition,
          intent: idea.intent, business_relevance: relevance,
          opportunity_score: opportunityScore({ keyword: idea.keyword, searchVolume: idea.searchVolume, keywordDifficulty: idea.keywordDifficulty, intent: idea.intent }, relevance),
          seed_keyword: seeds.join(", "), source: "dataforseo", metrics_fetched_at: new Date().toISOString(),
        };
      });
      if (rows.length) {
        const { error } = await supabase.from("keywords").upsert(rows, { onConflict: "project_id,keyword_normalized,location_code,language_code" });
        if (error) throw new Error(`Saving keywords failed: ${error.message}`);
      }
      log(`Saved ${rows.length} keywords (existing ones updated, status kept).`);
      return { output: { saved: rows.length, relevant: rows.filter((r) => (r.business_relevance ?? 0) > 0).length }, costUsd: cost };
    });
    message = `Saved ${output.saved} keywords (${output.relevant} relevant to HatchElite).`;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: message });
}

export async function addKeyword(projectId: string, form: FormData) {
  const path = `/p/${projectId}/keywords`;
  try {
    const { supabase, project } = await requireProject(projectId, "editor");
    const keyword = field(form, "keyword");
    if (!keyword) throw new Error("Enter a keyword.");
    const relevance = businessRelevance(keyword);
    const { error } = await supabase.from("keywords").insert({
      project_id: projectId, keyword, location_code: project.default_location_code, language_code: project.default_language_code,
      business_relevance: relevance, opportunity_score: opportunityScore({ keyword, searchVolume: null, keywordDifficulty: null, intent: "unknown" }, relevance),
      source: "manual",
    });
    if (error) throw error.code === "23505" ? new Error("That keyword is already saved.") : error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Keyword added. Run research on it to get volume and difficulty." });
}

export async function setKeywordStatus(projectId: string, keywordId: string, status: string) {
  const path = `/p/${projectId}/keywords`;
  try {
    if (!["new", "shortlisted", "planned", "in_use", "ignored"].includes(status)) throw new Error("Unknown status.");
    const { supabase } = await requireProject(projectId, "editor");
    const { error } = await supabase.from("keywords").update({ status }).eq("id", keywordId).eq("project_id", projectId);
    if (error) throw error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, {});
}
