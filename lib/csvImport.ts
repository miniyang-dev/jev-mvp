import Papa from "papaparse";
import type { BatchArticleInput } from "@/lib/batchTypes";

export const CSV_TEMPLATE = `text
"今天真的氣死我了！這家台北的店竟然又把我的訂單搞砸。"
"這是一篇平淡的新聞稿，內容中性沒有明顯情緒。"
`;

export interface CsvImportResult {
  articles: BatchArticleInput[];
  /** 1-based row numbers (excluding header) that were skipped because `text` was empty. */
  skippedRows: number[];
}

/** Parses a CSV file's text into batch articles. Only a `text` column is
 * needed — baseline judgments are made after the fact, once Jev and Gemini's
 * answers are in, so there's nothing to pre-fill here. Uses a real CSV parser
 * (not hand-rolled) since article text may itself contain commas/newlines. */
export function parseArticlesCsv(csvText: string): CsvImportResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const articles: BatchArticleInput[] = [];
  const skippedRows: number[] = [];

  data.forEach((row, i) => {
    const text = row.text?.trim();
    if (!text) {
      skippedRows.push(i + 1);
      return;
    }
    articles.push({ id: crypto.randomUUID(), text });
  });

  return { articles, skippedRows };
}
