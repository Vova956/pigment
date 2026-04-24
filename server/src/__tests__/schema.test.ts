import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock database ─────────────────────────────────────────────────────────────

const mockDb = {
  exec: vi.fn(),
};

vi.mock('../db/database', () => ({
  getDB: () => mockDb,
}));

const { createTables } = await import('../db/schema');

// ── createTables ──────────────────────────────────────────────────────────────

describe('createTables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.exec.mockResolvedValue(undefined);
  });

  it('executes a single exec call', async () => {
    await createTables();
    expect(mockDb.exec).toHaveBeenCalledTimes(1);
  });

  it('creates the users table', async () => {
    await createTables();
    const sql = mockDb.exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(sql).toMatch(/username TEXT UNIQUE NOT NULL/);
    expect(sql).toMatch(/email TEXT UNIQUE NOT NULL/);
    expect(sql).toMatch(/password_hash TEXT NOT NULL/);
  });

  it('creates the sessions table', async () => {
    await createTables();
    const sql = mockDb.exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS sessions/);
    expect(sql).toMatch(/id TEXT PRIMARY KEY/);
  });

  it('creates the session_state table with a cascading foreign key', async () => {
    await createTables();
    const sql = mockDb.exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS session_state/);
    expect(sql).toMatch(/FOREIGN KEY \(session_id\) REFERENCES sessions\(id\) ON DELETE CASCADE/);
  });

  it('propagates errors from the database', async () => {
    mockDb.exec.mockRejectedValueOnce(new Error('disk full'));
    await expect(createTables()).rejects.toThrow('disk full');
  });
});
