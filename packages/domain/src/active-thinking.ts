import { z } from "zod";

export interface ActiveThinking {
  id: string;
  text: string;
  startedAt: number;
  updatedAt: number;
  estimatedTokens?: number;
  expectedTokens?: number;
}

export const activeThinkingSchema = z.object({
  id: z.string(),
  text: z.string(),
  startedAt: z.number(),
  updatedAt: z.number(),
  estimatedTokens: z.number().optional(),
  expectedTokens: z.number().optional(),
});
