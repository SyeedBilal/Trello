import { z } from 'zod';

export const aiSummarySchema = z.object({
  overview: z.string().trim().min(1).max(4000),
  bottlenecks: z.array(z.object({
    issue: z.string().trim().min(1).max(1000),
    evidence: z.string().trim().min(1).max(1000),
  })).max(20).default([]),
  recommendedActions: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
});

export type AiSummaryResponse = z.infer<typeof aiSummarySchema>;
