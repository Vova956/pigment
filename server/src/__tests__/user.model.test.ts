import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock database ─────────────────────────────────────────────────────────────

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
};

vi.mock('../db/database', () => ({
  getDB: () => mockDb,
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$hashed$'),
  },
}));

const { createUser, findUserByEmail } = await import('../db/user.model');
const bcrypt = (await import('bcrypt')).default;

// ── createUser ────────────────────────────────────────────────────────────────

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('$hashed$' as never);
  });

  it('hashes the password before storing it', async () => {
    await createUser('alice', 'alice@example.com', 'plain-pw');
    expect(bcrypt.hash).toHaveBeenCalledWith('plain-pw', 10);
  });

  it('inserts the user with username, email, and hashed password', async () => {
    await createUser('alice', 'alice@example.com', 'plain-pw');
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO users/i), [
      'alice',
      'alice@example.com',
      '$hashed$',
    ]);
  });

  it('propagates errors thrown by the database', async () => {
    mockDb.run.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
    await expect(createUser('alice', 'alice@example.com', 'pw')).rejects.toThrow(
      'UNIQUE constraint failed'
    );
  });
});

// ── findUserByEmail ───────────────────────────────────────────────────────────

describe('findUserByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries by the provided email', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, email: 'alice@example.com' });
    await findUserByEmail('alice@example.com');
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringMatching(/SELECT \* FROM users WHERE email/i),
      ['alice@example.com']
    );
  });

  it('returns the row returned by the database', async () => {
    const row = { id: 42, username: 'alice', email: 'alice@example.com', password_hash: 'x' };
    mockDb.get.mockResolvedValueOnce(row);
    await expect(findUserByEmail('alice@example.com')).resolves.toEqual(row);
  });

  it('returns undefined when no user is found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    await expect(findUserByEmail('nobody@example.com')).resolves.toBeUndefined();
  });
});
