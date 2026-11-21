import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: typeof import('../src/app.js').app;
let prisma: typeof import('../src/lib/prisma.js').prisma;

let userAId = '';
let userBId = '';
let tokenA = '';
let tokenB = '';
let boardAId = '';
let boardBId = '';
let listAId = '';
let cardAId = '';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeAll(async () => {
  app = (await import('../src/app.js')).app;
  prisma = (await import('../src/lib/prisma.js')).prisma;

  const registerA = await request(app).post('/api/auth/register').send({
    name: 'Phase Two A', email: `phase2-a-${suffix}@example.com`, password: 'StrongPassword123!',
  });
  const registerB = await request(app).post('/api/auth/register').send({
    name: 'Phase Two B', email: `phase2-b-${suffix}@example.com`, password: 'StrongPassword123!',
  });

  expect(registerA.status).toBe(201);
  expect(registerB.status).toBe(201);
  tokenA = registerA.body.data.accessToken;
  tokenB = registerB.body.data.accessToken;
  userAId = registerA.body.data.user.id;
  userBId = registerB.body.data.user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe('Phase 2 board CRUD', () => {
  it('creates and lists only the authenticated user boards', async () => {
    const createA = await request(app).post('/api/boards').set('Authorization', `Bearer ${tokenA}`).send({ title: 'A Board', description: 'Owned by A' });
    const createB = await request(app).post('/api/boards').set('Authorization', `Bearer ${tokenB}`).send({ title: 'B Board', description: 'Owned by B' });

    expect(createA.status).toBe(201);
    expect(createB.status).toBe(201);
    boardAId = createA.body.data.board.id;
    boardBId = createB.body.data.board.id;

    const listA = await request(app).get('/api/boards').set('Authorization', `Bearer ${tokenA}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.boards.every((board: { id: string }) => board.id !== boardBId)).toBe(true);
  });

  it('gets and updates a board while preventing cross-user access', async () => {
    const detail = await request(app).get(`/api/boards/${boardAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(detail.status).toBe(200);

    const forbidden = await request(app).get(`/api/boards/${boardAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(forbidden.status).toBe(404);

    const update = await request(app).patch(`/api/boards/${boardAId}`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'A Board Updated', description: 'Updated description' });
    expect(update.status).toBe(200);
    expect(update.body.data.board.title).toBe('A Board Updated');
  });
});

describe('Phase 2 list and card CRUD', () => {
  it('creates ordered lists and prevents cross-user list creation', async () => {
    const first = await request(app).post(`/api/boards/${boardAId}/lists`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'To Do' });
    const second = await request(app).post(`/api/boards/${boardAId}/lists`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'Done' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.list.position).toBe(0);
    expect(second.body.data.list.position).toBe(1);
    listAId = first.body.data.list.id;

    const forbidden = await request(app).post(`/api/boards/${boardBId}/lists`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'Unauthorized' });
    expect(forbidden.status).toBe(404);

    const ordered = await request(app).get(`/api/boards/${boardAId}/lists`).set('Authorization', `Bearer ${tokenA}`);
    expect(ordered.body.data.lists.map((list: { position: number }) => list.position)).toEqual([0, 1]);
  });

  it('creates, updates, retrieves and deletes cards', async () => {
    const create = await request(app).post(`/api/lists/${listAId}/cards`).set('Authorization', `Bearer ${tokenA}`).send({
      title: 'Write tests', description: 'Add integration coverage', priority: 'HIGH', dueDate: '2026-12-01T12:00:00.000Z', labels: ['Testing'],
    });
    expect(create.status).toBe(201);
    expect(create.body.data.card.position).toBe(0);
    cardAId = create.body.data.card.id;

    const detail = await request(app).get(`/api/cards/${cardAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(detail.status).toBe(200);

    const update = await request(app).patch(`/api/cards/${cardAId}`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'Write integration tests', priority: 'MEDIUM', labels: ['Backend', 'Testing'] });
    expect(update.status).toBe(200);
    expect(update.body.data.card.priority).toBe('MEDIUM');

    const forbidden = await request(app).get(`/api/cards/${cardAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(forbidden.status).toBe(404);

    const remove = await request(app).delete(`/api/cards/${cardAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(remove.status).toBe(200);
  });

  it('renames and deletes lists with cascade behavior', async () => {
    const rename = await request(app).patch(`/api/lists/${listAId}`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'In Progress' });
    expect(rename.status).toBe(200);

    const forbidden = await request(app).patch(`/api/lists/${listAId}`).set('Authorization', `Bearer ${tokenB}`).send({ title: 'Hijacked' });
    expect(forbidden.status).toBe(404);

    const remove = await request(app).delete(`/api/lists/${listAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(remove.status).toBe(200);
  });

  it('deletes a board and cascades its associated resources', async () => {
    const remove = await request(app).delete(`/api/boards/${boardAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(remove.status).toBe(200);

    const missing = await request(app).get(`/api/boards/${boardAId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(missing.status).toBe(404);
  });
});
