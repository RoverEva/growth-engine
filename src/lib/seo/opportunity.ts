// Scores how good a keyword is for one project, 0–100. Deterministic and
// explainable: business relevance (from brand topics) × search demand × ease.
export interface KeywordSignals {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  intent: string;
}

const OFF_TOPIC = /\b(jobs?|salary|login|download free pdf crack|answers key leak|porn|casino)\b/i;

// `terms` comes from that project's projects/<slug>/PROJECT.json (topic_terms).
export function businessRelevance(keyword: string, terms: Record<string, number>): number {
  const text = ` ${keyword.toLowerCase()} `;
  if (OFF_TOPIC.test(text)) return 0;
  let score = 0;
  for (const [term, weight] of Object.entries(terms)) {
    const pattern = new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
    if (pattern.test(text)) score += weight;
  }
  return Math.min(100, score);
}

const INTENT_WEIGHT: Record<string, number> = { informational: 1, commercial: 0.9, transactional: 0.7, navigational: 0.3, unknown: 0.7 };

export function opportunityScore(signals: KeywordSignals, relevance: number): number {
  if (relevance === 0) return 0;
  const volume = Math.max(0, signals.searchVolume ?? 0);
  // 10 searches/mo ≈ 0.25, 100 ≈ 0.5, 1,000 ≈ 0.75, 10,000+ = 1.
  const demand = volume > 0 ? Math.min(1, Math.log10(volume) / 4) : 0.1;
  const difficulty = signals.keywordDifficulty ?? 50;
  const ease = 1 - Math.min(100, Math.max(0, difficulty)) / 100;
  const intent = INTENT_WEIGHT[signals.intent] ?? 0.7;
  const score = 100 * (0.45 * (relevance / 100) + 0.3 * demand + 0.25 * ease) * intent;
  return Math.round(Math.max(0, Math.min(100, score)));
}
