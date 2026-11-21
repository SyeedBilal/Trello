import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';
import { requireOwnedBoard } from '../boards/board.service.js';

export async function requireOwnedList(listId: string, userId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, board: { ownerId: userId } },
  });
  if (!list) throw new AppError(404, 'List not found');
  return list;
}

export async function createList(boardId: string, userId: string, input: { title: string }) {
  await requireOwnedBoard(boardId, userId);
  const aggregate = await prisma.list.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  return prisma.list.create({
    data: { boardId, title: input.title, position: (aggregate._max.position ?? -1) + 1 },
  });
}

export async function getLists(boardId: string, userId: string) {
  await requireOwnedBoard(boardId, userId);
  return prisma.list.findMany({
    where: { boardId },
    orderBy: { position: 'asc' },
  });
}

export async function updateList(listId: string, userId: string, input: { title: string }) {
  await requireOwnedList(listId, userId);
  return prisma.list.update({ where: { id: listId }, data: input });
}

export async function deleteList(listId: string, userId: string) {
  await requireOwnedList(listId, userId);
  await prisma.list.delete({ where: { id: listId } });
}
