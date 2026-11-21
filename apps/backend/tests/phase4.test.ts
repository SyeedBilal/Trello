import { describe, expect, it } from 'vitest';
import { buildSummaryPrompt } from '../src/modules/ai/ai.prompt.js';
import { calculateBoardStatistics, calculateHighPriorityTasks, calculateOverdueTasks, type BoardSummarySource } from '../src/modules/ai/ai.service.js';
import { aiSummarySchema } from '../src/modules/ai/ai.validation.js';

describe('Phase 4 AI summary support', () => {
  it('calculates task statuses from list membership and ignores missing or completed due dates', () => {
    const board: BoardSummarySource = {
      lists: [
        {
          title: 'Completed',
          cards: [{ title: 'Shipped feature', priority: 'HIGH', dueDate: new Date('2026-11-10T00:00:00.000Z') }],
        },
        {
          title: 'In Progress',
          cards: [
            { title: 'Current work', priority: 'HIGH', dueDate: new Date('2026-11-20T00:00:00.000Z') },
            { title: 'Undated work', priority: 'LOW', dueDate: null },
          ],
        },
        {
          title: 'Backlog',
          cards: [{ title: 'Upcoming work', priority: 'MEDIUM', dueDate: new Date('2026-11-25T00:00:00.000Z') }],
        },
      ],
    };

    expect(calculateBoardStatistics(board)).toEqual({
      totalTasks: 4,
      completed: 1,
      inProgress: 2,
      pending: 1,
      completionPercentage: 25,
    });
    expect(calculateOverdueTasks(board, '2026-11-21')).toEqual([
      { title: 'Current work', dueDate: '2026-11-20' },
    ]);
    expect(calculateHighPriorityTasks(board)).toEqual([
      { title: 'Current work', dueDate: '2026-11-20' },
    ]);
  });

  it('validates structured AI output', () => {
    const result = aiSummarySchema.safeParse({
      overview: 'The project has work remaining.',
      bottlenecks: [{ issue: 'Pending backend tasks', evidence: 'Three backend cards are in To Do' }],
      recommendedActions: ['Complete the authentication API'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed AI output', () => {
    expect(aiSummarySchema.safeParse({ overview: '', bottlenecks: 'none' }).success).toBe(false);
  });

  it('includes only supplied board facts in the prompt', () => {
    const prompt = buildSummaryPrompt({
      board: { title: 'Website Development', description: 'Build the company site' },
      currentDate: '2026-11-21',
      lists: [{
        name: 'To Do',
        status: 'pending',
        cards: [{
          title: 'Implement Login API',
          description: 'Create authentication endpoints',
          priority: 'HIGH',
          dueDate: '2026-11-25',
          labels: ['Backend'],
          status: 'pending',
        }],
      }],
      statistics: { totalTasks: 1, completed: 0, inProgress: 0, pending: 1, completionPercentage: 0 },
      overdueTasks: [],
      highPriorityTasks: [{ title: 'Implement Login API', dueDate: '2026-11-25' }],
    });

    expect(prompt.user).toContain('Implement Login API');
    expect(prompt.user).toContain('2026-11-21');
    expect(prompt.system).toContain('Do not invent tasks');
  });
});
