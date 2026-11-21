import { prisma } from '../../lib/prisma.js';

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, createdAt: true },
  });
}
