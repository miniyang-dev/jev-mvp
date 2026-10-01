import type { SentimentCategory } from "@/lib/labels";

/**
 * Single source of truth for the 1-10 sentiment intensity scale.
 * Ordered low -> high on one spectrum: super happy -> calm -> super angry.
 * Index 0 in this array corresponds to Jev's 0-indexed Score level 0 (displayed as score 1).
 */
export const SENTIMENT_LEVELS: {
  score: number;
  description: string;
  category: SentimentCategory;
}[] = [
  { score: 1, description: "極度正面、狂喜", category: "super_happy" },
  { score: 2, description: "明顯開心", category: "super_happy" },
  { score: 3, description: "稍微開心", category: "general_happy" },
  {
    score: 4,
    description: "非常輕微的正面情緒、接近平靜",
    category: "general_happy",
  },
  { score: 5, description: "中性，沒有明顯情緒", category: "calm" },
  {
    score: 6,
    description: "非常輕微的不滿、接近平靜",
    category: "general_angry",
  },
  { score: 7, description: "稍微生氣/不滿", category: "general_angry" },
  { score: 8, description: "明顯生氣", category: "super_angry" },
  { score: 9, description: "很生氣、強烈不滿", category: "super_angry" },
  { score: 10, description: "極度負面、暴怒", category: "super_angry" },
];

/** Ordered level descriptions for Jev's Score primitive (index 0 = display score 1). */
export const JEV_SENTIMENT_CRITERIA = SENTIMENT_LEVELS.map((l) => l.description) as [
  string,
  string,
  ...string[],
];

/** Rubric text handed to Gemini so both providers score against the same scale. */
export const SENTIMENT_RUBRIC_TEXT = SENTIMENT_LEVELS.map(
  (l) => `${l.score} = ${l.description}`
).join("\n");

/**
 * Converts a continuous 1-10 score back into one of the 5 category labels,
 * using distance from the calm midpoint (5) as the intensity signal:
 * distance 0 -> calm, distance 1-2 -> general, distance 3+ -> super.
 */
export function scoreToCategory(score: number): SentimentCategory {
  const distance = Math.abs(score - 5);
  if (distance < 0.5) return "calm";
  const isAngry = score > 5;
  const isSuper = distance >= 3;
  if (isAngry) return isSuper ? "super_angry" : "general_angry";
  return isSuper ? "super_happy" : "general_happy";
}
