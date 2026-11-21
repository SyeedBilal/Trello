import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-at-least-32-characters-long';
process.env.FRONTEND_URL ??= 'http://localhost:5173';

let app: typeof import('../src/app.js').app;

beforeAll(async () => {
  app = (await import('../src/app.js')).app;
});

describe('GET /api/health', () => {
  it('returns a healthy backend status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Backend is healthy',
      data: { status: 'ok' },
    });
  });

  it('returns a consistent 404 response for unknown routes', async () => {
    const response = await request(app).get('/api/missing');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
