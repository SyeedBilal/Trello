import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';
import { requireOwnedList } from '../lists/list.service.js';

export interface CardInput {
  title?: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  labels?: string[];
}

export async function requireOwnedCard(cardId: string, userId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, list: { board: { ownerId: userId } } },
  });
  if (!card) throw new AppError(404, 'Card not found');
  return card;
}

export async function createCard(listId: string, userId: string, input: CardInput) {
  await requireOwnedList(listId, userId);
  const aggregate = await prisma.card.aggregate({
    where: { listId },
    _max: { position: true },
  });
  return prisma.card.create({
    data: {
      listId,
      title: input.title!,
      description: input.description ?? null,
      priority: input.priority ?? 'MEDIUM',
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      labels: input.labels ?? [],
      position: (aggregate._max.position ?? -1) + 1,
    },
  });
}

export async function getCards(listId: string, userId: string) {
  await requireOwnedList(listId, userId);
  return prisma.card.findMany({ where: { listId }, orderBy: { position: 'asc' } });
}

export async function getCard(cardId: string, userId: string) {
  return requireOwnedCard(cardId, userId);
}

export async function updateCard(cardId: string, userId: string, input: CardInput) {
  await requireOwnedCard(cardId, userId);
  return prisma.card.update({
    where: { id: cardId },
    data: {
      ...input,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
    },
  });
}

export async function deleteCard(cardId: string, userId: string) {
  await requireOwnedCard(cardId, userId);
  await prisma.card.delete({ where: { id: cardId } });
}
