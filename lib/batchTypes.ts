import type { AnalyzeResponse, Judgment } from "@/lib/schema";

export interface BatchArticleInput {
  id: string;
  text: string;
}

export type BatchRowStatus =
  | "idle"
  | "queued"
  | "running"
  | "done"
  | "error"
  /** Jev has answered; Gemini's answer is waiting on a batch job to finish. */
  | "awaiting_gemini_batch";

export interface BatchRow {
  input: BatchArticleInput;
  status: BatchRowStatus;
  result?: AnalyzeResponse;
  /** Per-article "you be the judge" calls for dimensions where Jev/Gemini disagreed. */
  judgment: Judgment;
  error?: string;
}
