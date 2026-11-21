import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';

export async function requireOwnedBoard(boardId: string, userId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, ownerId: userId },
  });
  if (!board) throw new AppError(404, 'Board not found');
  return board;
}

export async function createBoard(userId: string, input: { title: string; description?: string | null }) {
  return prisma.board.create({
    data: { ownerId: userId, title: input.title, description: input.description ?? null },
  });
}

export async function getBoards(userId: string) {
  return prisma.board.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBoard(boardId: string, userId: string) {
  await requireOwnedBoard(boardId, userId);
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: { cards: { orderBy: { position: 'asc' } } },
      },
    },
  });
}

export async function updateBoard(boardId: string, userId: string, input: { title?: string; description?: string | null }) {
  await requireOwnedBoard(boardId, userId);
  return prisma.board.update({ where: { id: boardId }, data: input });
}

export async function deleteBoard(boardId: string, userId: string) {
  await requireOwnedBoard(boardId, userId);
  await prisma.board.delete({ where: { id: boardId } });
}

export interface CardReorderItem {
  cardId: string;
  listId: string;
  position: number;
}

export async function reorderCards(boardId: string, userId: string, items: CardReorderItem[]) {
  await requireOwnedBoard(boardId, userId);

  const listIds = [...new Set(items.map((item) => item.listId))];
  const cardIds = items.map((item) => item.cardId);

  const [lists, cards] = await prisma.$transaction([
    prisma.list.findMany({ where: { id: { in: listIds }, boardId }, select: { id: true } }),
    prisma.card.findMany({
      where: { id: { in: cardIds }, list: { boardId } },
      select: { id: true, listId: true },
    }),
  ]);

  if (lists.length !== listIds.length) throw new AppError(404, 'List not found');
  if (cards.length !== cardIds.length) throw new AppError(404, 'Card not found');

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < items.length; index += 1) {
      await tx.card.update({
        where: { id: items[index]!.cardId },
        data: { position: -index - 1 },
      });
    }

    for (const item of items) {
      await tx.card.update({
        where: { id: item.cardId },
        data: { listId: item.listId, position: item.position },
      });
    }

    const affectedListIds = [...new Set([
      ...cards.map((card) => card.listId),
      ...items.map((item) => item.listId),
    ])];

    for (const listId of affectedListIds) {
      const remainingCards = await tx.card.findMany({
        where: { listId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (let position = 0; position < remainingCards.length; position += 1) {
        await tx.card.update({
          where: { id: remainingCards[position]!.id },
          data: { position },
        });
      }
    }
  });

  return { updatedCards: items.length };
}

export interface ListReorderItem {
  listId: string;
  position: number;
}

export async function reorderLists(boardId: string, userId: string, items: ListReorderItem[]) {
  await requireOwnedBoard(boardId, userId);

  const lists = await prisma.list.findMany({
    where: { id: { in: items.map((item) => item.listId) }, boardId },
    select: { id: true },
  });
  if (lists.length !== items.length) throw new AppError(404, 'List not found');

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < items.length; index += 1) {
      await tx.list.update({
        where: { id: items[index]!.listId },
        data: { position: -index - 1 },
      });
    }

    for (const item of items) {
      await tx.list.update({
        where: { id: item.listId },
        data: { position: item.position },
      });
    }
  });

  return { updatedLists: items.length };
}
