export const REGION_LABELS = {
  taiwan: "台灣",
  usa: "美國",
  arab: "阿拉伯",
  japan: "日本",
  korea: "韓國",
} as const;

export type RegionKey = keyof typeof REGION_LABELS;

export const REGION_KEYS = Object.keys(REGION_LABELS) as RegionKey[];

export function regionKeyForLabel(label: string): RegionKey | null {
  const entry = (Object.entries(REGION_LABELS) as [RegionKey, string][]).find(
    ([, value]) => value === label
  );
  return entry ? entry[0] : null;
}

export const SENTIMENT_CATEGORY_LABELS = {
  super_angry: "超級生氣",
  general_angry: "一般生氣",
  calm: "平靜",
  general_happy: "一般開心",
  super_happy: "超級開心",
} as const;

export type SentimentCategory = keyof typeof SENTIMENT_CATEGORY_LABELS;

export const SENTIMENT_CATEGORY_KEYS = Object.keys(
  SENTIMENT_CATEGORY_LABELS
) as SentimentCategory[];
