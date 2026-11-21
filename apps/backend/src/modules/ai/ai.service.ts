import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { getBoard } from '../boards/board.service.js';
import { buildSummaryPrompt, type BoardSummaryInput } from './ai.prompt.js';
import { aiSummarySchema, type AiSummaryResponse } from './ai.validation.js';

type ListStatus = 'completed' | 'inProgress' | 'pending';

export interface BoardSummarySource {
  lists: Array<{
    title: string;
    cards: Array<{
      title: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      dueDate: Date | null;
    }>;
  }>;
}

function classifyList(title: string): ListStatus {
  const name = title.toLowerCase();
  if (/(done|complete|completed|closed|resolved|published|shipped|deployed|archive)/.test(name)) return 'completed';
  if (/(in progress|in-progress|doing|active|working|review|testing|qa|blocked)/.test(name)) return 'inProgress';
  return 'pending';
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calculateBoardStatistics(board: BoardSummarySource) {
  const allCards = board.lists.flatMap((list) => list.cards.map((card) => ({
    ...card,
    status: classifyList(list.title),
  })));
  const totalTasks = allCards.length;
  const completed = allCards.filter((card) => card.status === 'completed').length;
  const inProgress = allCards.filter((card) => card.status === 'inProgress').length;
  const pending = allCards.filter((card) => card.status === 'pending').length;

  return {
    totalTasks,
    completed,
    inProgress,
    pending,
    completionPercentage: totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100),
  };
}

export function calculateOverdueTasks(board: BoardSummarySource, currentDate: string) {
  return board.lists.flatMap((list) => list.cards.flatMap((card) => {
    if (!card.dueDate || classifyList(list.title) === 'completed') return [];
    const dueDate = toIsoDate(card.dueDate);
    return dueDate < currentDate ? [{ title: card.title, dueDate }] : [];
  }));
}

export function calculateHighPriorityTasks(board: BoardSummarySource) {
  return board.lists.flatMap((list) => list.cards
    .filter((card) => card.priority === 'HIGH' && classifyList(list.title) !== 'completed')
    .map((card) => ({ title: card.title, dueDate: card.dueDate ? toIsoDate(card.dueDate) : null })));
}

export async function generateBoardSummary(boardId: string, userId: string) {
  if (!env.GROQ_API_KEY) throw new AppError(503, 'AI summary is unavailable: GROQ_API_KEY is not configured');

  const board = await getBoard(boardId, userId);
  if (!board) throw new AppError(404, 'Board not found');

  const now = new Date();
  const currentDate = toIsoDate(now);
  const statistics = calculateBoardStatistics(board);
  const overdueTasks = calculateOverdueTasks(board, currentDate);
  const highPriorityTasks = calculateHighPriorityTasks(board);

  const input: BoardSummaryInput = {
    board: { title: board.title, description: board.description },
    currentDate: toIsoDate(now),
    lists: board.lists.map((list) => ({
      name: list.title,
      status: classifyList(list.title),
      cards: list.cards.map((card) => ({
        title: card.title,
        description: card.description,
        priority: card.priority,
        dueDate: card.dueDate ? toIsoDate(card.dueDate) : null,
        labels: card.labels,
        status: classifyList(list.title),
      })),
    })),
    statistics,
    overdueTasks,
    highPriorityTasks,
  };

  const { system, user } = buildSummaryPrompt(input);
  let providerResponse: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    providerResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'AI provider timed out');
    }
    throw new AppError(502, 'Unable to contact the AI provider');
  } finally {
    clearTimeout(timeout);
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 429) throw new AppError(429, 'AI provider rate limit reached; please try again later');
    if (providerResponse.status === 404) {
      throw new AppError(502, 'Configured Groq model is unavailable. Check GROQ_MODEL and use an active model for your Groq account.');
    }
    throw new AppError(502, `AI provider request failed (${providerResponse.status})`);
  }

  const providerBody = await providerResponse.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = providerBody?.choices?.[0]?.message?.content;
  if (!content) throw new AppError(502, 'AI provider returned no summary');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, 'AI provider returned malformed JSON');
  }

  const validation = aiSummarySchema.safeParse(parsed);
  if (!validation.success) throw new AppError(502, 'AI provider returned an invalid summary');

  const ai: AiSummaryResponse = validation.data;
  return {
    overview: ai.overview,
    progress: statistics,
    highPriorityTasks,
    overdueTasks,
    bottlenecks: ai.bottlenecks,
    recommendedActions: ai.recommendedActions,
  };
}
