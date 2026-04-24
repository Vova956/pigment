import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the sqlite open() helper ─────────────────────────────────────────────
// The database module is a thin wrapper around sqlite.open(). We only need to
// verify that it passes the right config and caches the resulting handle.

const fakeHandle = { fake: true };
const openMock = vi.fn();

vi.mock('sqlite', () => ({
  open: (...args: any[]) => openMock(...args),
}));

vi.mock('sqlite3', () => ({
  default: { Database: function () {} },
}));

const { initDB, getDB } = await import('../db/database');

describe('database module', () => {
  beforeEach(() => {
    openMock.mockReset();
    openMock.mockResolvedValue(fakeHandle);
  });

  it('initDB resolves with a handle from sqlite.open', async () => {
    const handle = await initDB();
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.any(String),
        driver: expect.any(Function),
      })
    );
    expect(handle).toBe(fakeHandle);
  });

  it('getDB returns the same handle once initialised', async () => {
    await initDB();
    expect(getDB()).toBe(fakeHandle);
  });
});
