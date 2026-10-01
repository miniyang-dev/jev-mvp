import type { Dimension, Judgment } from "@/lib/schema";
import { safeGet, safeSet, safeRemove } from "@/lib/storage";

/** A known-correct answer for one article, kept forever so the expensive part
 * — a human deciding who was actually right — is only paid once per article.
 *
 * Only two things ever get in here:
 *   - `human-judged`: the user explicitly arbitrated a disagreement in /batch.
 *   - `adversarial-authored`: a stress-test sample whose answer we wrote ourselves.
 *
 * Notably absent: "Jev and Gemini agreed". Consensus is not truth — two models
 * agreeing on the same wrong answer is exactly the failure mode a golden set
 * exists to catch, so writing consensus in here would freeze errors into the
 * answer key. */
export interface GoldenLabelEntry {
  textHash: string;
  /** First ~120 chars, for the management panel only — never used for matching. */
  textPreview: string;
  /** Only the dimensions actually known; an unknown dimension is simply absent. */
  judgment: Judgment;
  /** Tracked per dimension, not per article: an adversarial sample ships with
   * an authored answer for some dimensions, and the user may later judge the
   * ones it left blank — so a single entry really can have two sources. */
  sources: Partial<Record<Dimension, GoldenLabelSource>>;
  createdAt: number;
  updatedAt: number;
}

export type GoldenLabelSource = "human-judged" | "adversarial-authored";

export type GoldenSet = Record<string, GoldenLabelEntry>;

const GOLDEN_KEY = "jev-mvp:golden-set";
const PREVIEW_LENGTH = 120;

/** FNV-1a (32-bit), hex. Articles are matched on `text.trim()` and nothing
 * more — no whitespace collapsing, no case folding. More aggressive
 * normalization would risk silently merging two genuinely different articles'
 * ground truth, which is a far worse failure than the one it prevents: a
 * re-pasted article with different internal whitespace just misses its label,
 * which is visible (the row stops showing 黃金答案) and checkable against the
 * stored `textPreview`. Collisions are ~1 in 4 billion — fine at this scale. */
export function hashArticleText(text: string): string {
  const normalized = text.trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    // hash * 16777619, kept in 32-bit range via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Entries written before `sources` replaced a single per-entry `source` are
 * upgraded on read, so an older store doesn't render blank provenance. */
function normalizeEntry(entry: GoldenLabelEntry & { source?: GoldenLabelSource }): GoldenLabelEntry {
  if (entry.sources) return entry;
  const legacy = entry.source ?? "human-judged";
  const upgraded: GoldenLabelEntry & { source?: GoldenLabelSource } = { ...entry };
  delete upgraded.source;
  return {
    ...upgraded,
    sources: Object.fromEntries(knownDimensions(entry).map((d) => [d, legacy])),
  };
}

export function loadGoldenSet(): GoldenSet {
  const stored = safeGet<GoldenSet>(GOLDEN_KEY) ?? {};
  return Object.fromEntries(
    Object.entries(stored).map(([hash, entry]) => [hash, normalizeEntry(entry)])
  );
}

/** Newest first, for the management panel. Takes the set rather than reading
 * storage, so a page that already holds it in state doesn't re-parse it. */
export function sortGoldenEntries(set: GoldenSet): GoldenLabelEntry[] {
  return Object.values(set).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getGoldenLabel(text: string): GoldenLabelEntry | null {
  return loadGoldenSet()[hashArticleText(text)] ?? null;
}

/** Merges per dimension: dimensions present in `judgment` overwrite, the rest
 * are kept. Last write wins on a per-dimension basis — deliberately simple,
 * there's no conflict-resolution UI and a re-judgment is assumed to be the
 * user correcting themselves. */
export function upsertGoldenLabel(
  text: string,
  judgment: Judgment,
  source: GoldenLabelSource
): GoldenLabelEntry {
  const set = loadGoldenSet();
  const textHash = hashArticleText(text);
  const now = Date.now();
  const existing = set[textHash];

  const incomingSources = Object.fromEntries(
    (Object.keys(judgment) as Dimension[])
      .filter((dimension) => judgment[dimension] !== undefined)
      .map((dimension) => [dimension, source])
  );

  const entry: GoldenLabelEntry = {
    textHash,
    textPreview: text.trim().slice(0, PREVIEW_LENGTH),
    judgment: { ...existing?.judgment, ...judgment },
    sources: { ...existing?.sources, ...incomingSources },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  set[textHash] = entry;
  safeSet(GOLDEN_KEY, set);
  return entry;
}

export function removeGoldenLabel(textHash: string): void {
  const set = loadGoldenSet();
  delete set[textHash];
  safeSet(GOLDEN_KEY, set);
}

export function clearGoldenSet(): void {
  safeRemove(GOLDEN_KEY);
}

/** Which dimensions this entry actually has an answer for. */
export function knownDimensions(entry: GoldenLabelEntry): Dimension[] {
  const dimensions: Dimension[] = [];
  if (entry.judgment.sentiment !== undefined) dimensions.push("sentiment");
  if (entry.judgment.region !== undefined) dimensions.push("region");
  if (entry.judgment.noise !== undefined) dimensions.push("noise");
  return dimensions;
}
