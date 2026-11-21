import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: typeof import('../src/app.js').app;
let prisma: typeof import('../src/lib/prisma.js').prisma;
let tokenA = '';
let tokenB = '';
let userAId = '';
let userBId = '';
let boardAId = '';
let boardBId = '';
let listAId = '';
let listBId = '';
let cardAId = '';
let cardBId = '';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeAll(async () => {
  app = (await import('../src/app.js')).app;
  prisma = (await import('../src/lib/prisma.js')).prisma;

  const registerA = await request(app).post('/api/auth/register').send({
    name: 'Phase Three A', email: `phase3-a-${suffix}@example.com`, password: 'StrongPassword123!',
  });
  const registerB = await request(app).post('/api/auth/register').send({
    name: 'Phase Three B', email: `phase3-b-${suffix}@example.com`, password: 'StrongPassword123!',
  });

  expect(registerA.status).toBe(201);
  expect(registerB.status).toBe(201);
  tokenA = registerA.body.data.accessToken;
  tokenB = registerB.body.data.accessToken;
  userAId = registerA.body.data.user.id;
  userBId = registerB.body.data.user.id;

  const boardA = await request(app).post('/api/boards').set('Authorization', `Bearer ${tokenA}`).send({ title: 'Drag Board A' });
  const boardB = await request(app).post('/api/boards').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Drag Board B' });
  boardAId = boardA.body.data.board.id;
  boardBId = boardB.body.data.board.id;

  const listA = await request(app).post(`/api/boards/${boardAId}/lists`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'To Do' });
  const listB = await request(app).post(`/api/boards/${boardAId}/lists`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'In Progress' });
  listAId = listA.body.data.list.id;
  listBId = listB.body.data.list.id;

  const cardA = await request(app).post(`/api/lists/${listAId}/cards`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'Implement Login API', priority: 'HIGH' });
  const cardB = await request(app).post(`/api/lists/${listAId}/cards`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'Write tests', priority: 'MEDIUM' });
  cardAId = cardA.body.data.card.id;
  cardBId = cardB.body.data.card.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe('Phase 3 card ordering', () => {
  it('reorders cards within a list and normalizes positions', async () => {
    const response = await request(app).patch(`/api/boards/${boardAId}/cards/reorder`).set('Authorization', `Bearer ${tokenA}`).send({
      items: [
        { cardId: cardBId, listId: listAId, position: 0 },
        { cardId: cardAId, listId: listAId, position: 1 },
      ],
    });

    expect(response.status).toBe(200);
    const cards = await prisma.card.findMany({ where: { listId: listAId }, orderBy: { position: 'asc' } });
    expect(cards.map((card) => card.id)).toEqual([cardBId, cardAId]);
    expect(cards.map((card) => card.position)).toEqual([0, 1]);
  });

  it('moves a card between lists and normalizes source and destination positions', async () => {
    const response = await request(app).patch(`/api/boards/${boardAId}/cards/reorder`).set('Authorization', `Bearer ${tokenA}`).send({
      items: [
        { cardId: cardAId, listId: listBId, position: 0 },
        { cardId: cardBId, listId: listAId, position: 0 },
      ],
    });

    expect(response.status).toBe(200);
    const moved = await prisma.card.findUnique({ where: { id: cardAId } });
    expect(moved?.listId).toBe(listBId);
    expect(moved?.position).toBe(0);

    const sourceCards = await prisma.card.findMany({ where: { listId: listAId }, orderBy: { position: 'asc' } });
    const destinationCards = await prisma.card.findMany({ where: { listId: listBId }, orderBy: { position: 'asc' } });
    expect(sourceCards.map((card) => card.position)).toEqual([0]);
    expect(destinationCards.map((card) => card.position)).toEqual([0]);
  });

  it('rejects card reorder attempts by a board owner other than the authenticated user', async () => {
    const response = await request(app).patch(`/api/boards/${boardAId}/cards/reorder`).set('Authorization', `Bearer ${tokenB}`).send({
      items: [{ cardId: cardAId, listId: listBId, position: 0 }],
    });
    expect(response.status).toBe(404);
  });

  it('rejects a card or list belonging outside the specified board', async () => {
    const foreignList = await request(app).post(`/api/boards/${boardBId}/lists`).set('Authorization', `Bearer ${tokenB}`).send({ title: 'Foreign List' });
    const response = await request(app).patch(`/api/boards/${boardAId}/cards/reorder`).set('Authorization', `Bearer ${tokenA}`).send({
      items: [{ cardId: cardAId, listId: foreignList.body.data.list.id, position: 0 }],
    });
    expect(response.status).toBe(404);
  });
});

describe('Phase 3 list ordering', () => {
  it('reorders lists and stores sequential positions', async () => {
    const response = await request(app).patch(`/api/boards/${boardAId}/lists/reorder`).set('Authorization', `Bearer ${tokenA}`).send({
      items: [
        { listId: listBId, position: 0 },
        { listId: listAId, position: 1 },
      ],
    });

    expect(response.status).toBe(200);
    const lists = await prisma.list.findMany({ where: { boardId: boardAId }, orderBy: { position: 'asc' } });
    expect(lists.map((list) => list.id)).toEqual([listBId, listAId]);
    expect(lists.map((list) => list.position)).toEqual([0, 1]);
  });

  it('rejects list reorder attempts by a non-owner', async () => {
    const response = await request(app).patch(`/api/boards/${boardAId}/lists/reorder`).set('Authorization', `Bearer ${tokenB}`).send({
      items: [{ listId: listAId, position: 0 }, { listId: listBId, position: 1 }],
    });
    expect(response.status).toBe(404);
  });
});
