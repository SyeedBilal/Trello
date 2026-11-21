import { z } from 'zod';

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, 'Board title is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateBoardSchema = z.object({
  title: z.string().trim().min(1, 'Board title is required').max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
}).refine((value) => value.title !== undefined || value.description !== undefined, 'Provide a field to update');

export const reorderCardsSchema = z.object({
  items: z.array(z.object({
    cardId: z.string().uuid('Invalid card ID'),
    listId: z.string().uuid('Invalid list ID'),
    position: z.number().int().nonnegative(),
  })).min(1, 'At least one card is required'),
}).superRefine((value, ctx) => {
  const uniqueCards = new Set(value.items.map((item) => item.cardId));
  if (uniqueCards.size !== value.items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each card must appear exactly once' });
  }

  const positionsByList = new Map<string, number[]>();
  for (const item of value.items) {
    const positions = positionsByList.get(item.listId) ?? [];
    positions.push(item.position);
    positionsByList.set(item.listId, positions);
  }
  for (const positions of positionsByList.values()) {
    const sorted = [...positions].sort((a, b) => a - b);
    if (sorted.some((position, index) => position !== index)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Positions must be sequential within each list' });
    }
  }
});

export const reorderListsSchema = z.object({
  items: z.array(z.object({
    listId: z.string().uuid('Invalid list ID'),
    position: z.number().int().nonnegative(),
  })).min(1, 'At least one list is required'),
}).superRefine((value, ctx) => {
  const uniqueLists = new Set(value.items.map((item) => item.listId));
  if (uniqueLists.size !== value.items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each list must appear exactly once' });
  }
  const positions = value.items.map((item) => item.position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'List positions must be sequential' });
  }
});
