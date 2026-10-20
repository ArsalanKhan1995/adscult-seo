import type { AiEngine } from "@/shared/ai-visibility";
import type { ErrorCode } from "@/shared/error-codes";

export interface AiCitation {
  url: string;
  domain: string;
  title: string | null;
  position: number;
}

export interface ParsedAiAnswer {
  /** Null when the engine gave no answer (or Google showed no AI Overview). */
  answerMarkdown: string | null;
  /** Plain prose for brand matching; empty without an answer. */
  answerText: string;
  citations: AiCitation[];
  collectedAt: string | null;
}

export type AiAnswerOutcome =
  | { status: "completed"; answer: ParsedAiAnswer }
  | { status: "failed"; code: ErrorCode; message: string; retryable: boolean };
export interface AiAnswerRequest {
  engine: AiEngine;
  task: { tag: string; prompt: string };
  locationCode: number;
  languageCode: string;
}
export interface PostedAiTask {
  tag: string;
  taskId: string;
}
