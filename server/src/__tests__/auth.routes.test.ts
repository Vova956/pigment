import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mock dependencies ─────────────────────────────────────────────────────────
// Mock objects remove the dependency on a live database and real bcrypt hashing,
// making these tests fast, isolated, and deterministic.

const mockCreateUser = vi.fn();
const mockFindUserByEmail = vi.fn();

vi.mock('../db/user.model', () => ({
  createUser: (...args: any[]) => mockCreateUser(...args),
  findUserByEmail: (...args: any[]) => mockFindUserByEmail(...args),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('$hashed$'),
  },
}));

const { default: authRoutes } = await import('../routes/auth.routes');
const bcrypt = (await import('bcrypt')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 on successful registration', async () => {
    mockCreateUser.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'User created');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing fields');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .send({ username: 'alice', password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing fields');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing fields');
  });

  it('returns 400 when createUser throws (e.g. duplicate email)', async () => {
    mockCreateUser.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));

    const res = await request(buildApp())
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const fakeUser = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    password_hash: '$hashed$',
  };

  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const res = await request(buildApp()).post('/auth/login').send({ password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing email or password');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(buildApp()).post('/auth/login').send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Missing email or password');
  });

  it('returns 401 when user is not found', async () => {
    mockFindUserByEmail.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('returns 401 when password does not match', async () => {
    mockFindUserByEmail.mockResolvedValue(fakeUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const res = await request(buildApp())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('returns 200 with token and user on successful login', async () => {
    mockFindUserByEmail.mockResolvedValue(fakeUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(buildApp())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ id: 1, username: 'alice', email: 'alice@example.com' });
  });

  it('token is a non-empty JWT string', async () => {
    mockFindUserByEmail.mockResolvedValue(fakeUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(buildApp())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'secret' });

    // JWTs have three dot-separated base64 segments
    expect(res.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('returns 500 when findUserByEmail throws unexpectedly', async () => {
    mockFindUserByEmail.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(buildApp())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Login failed');
  });
});
