import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mock the database module ───────────────────────────────────────────────────
// Using mock objects (dependency injection via vi.mock) to isolate the route
// logic from the actual SQLite database, so tests are fast and deterministic.

const mockDb = {
  get: vi.fn(),
  run: vi.fn(),
};

vi.mock('../db/database', () => ({
  getDB: () => mockDb,
}));

// ── Import route after mocking ────────────────────────────────────────────────

const { default: sessionRoutes } = await import('../routes/session.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/sessions', sessionRoutes);
  return app;
}

// ── POST /sessions ────────────────────────────────────────────────────────────

describe('POST /sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no collision on the first generated ID
    mockDb.get.mockResolvedValue(undefined);
    mockDb.run.mockResolvedValue(undefined);
  });

  it('returns 201 with a sessionId on success', async () => {
    const res = await request(buildApp()).post('/sessions').send({ name: 'My Session' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
  });

  it('sessionId is a 6-character alphanumeric string', async () => {
    const res = await request(buildApp()).post('/sessions').send({});

    expect(res.body.sessionId).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('works without a name in the body', async () => {
    const res = await request(buildApp()).post('/sessions').send({});

    expect(res.status).toBe(201);
  });

  it('inserts the session into the database', async () => {
    await request(buildApp()).post('/sessions').send({ name: 'Art Class' });

    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT INTO sessions (id, name) VALUES (?, ?)',
      expect.any(String),
      'Art Class',
    );
  });

  it('retries ID generation on collision', async () => {
    // First call to get() returns a collision, second returns undefined (free)
    mockDb.get.mockResolvedValueOnce({ id: 'AAABBB' }).mockResolvedValue(undefined);

    const res = await request(buildApp()).post('/sessions').send({});

    expect(res.status).toBe(201);
    // get() should be called at least twice due to the retry
    expect(mockDb.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ── GET /sessions/:id ─────────────────────────────────────────────────────────

describe('GET /sessions/:id', () => {
  const mockSession = { id: 'ABC123', name: 'Test Session', created_at: '2024-01-01' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and the session when found', async () => {
    mockDb.get.mockResolvedValue(mockSession);

    const res = await request(buildApp()).get('/sessions/ABC123');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'ABC123', name: 'Test Session' });
  });

  it('returns 404 when session does not exist', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const res = await request(buildApp()).get('/sessions/XXXXXX');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Session not found');
  });

  it('uppercases the session ID before querying', async () => {
    mockDb.get.mockResolvedValue(mockSession);

    await request(buildApp()).get('/sessions/abc123');

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.any(String),
      'ABC123',
    );
  });
});
