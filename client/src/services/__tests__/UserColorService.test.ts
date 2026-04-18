import { describe, it, expect } from 'vitest';
import { UserColorService } from '../UserColorService';

// ── Determinism ───────────────────────────────────────────────────────────────

describe('UserColorService.getColor', () => {
  it('returns the same colour for the same userId on every call', () => {
    const id = 'user-abc-123';
    expect(UserColorService.getColor(id)).toBe(UserColorService.getColor(id));
  });

  it('returns different colours for clearly distinct user IDs (probabilistically)', () => {
    const ids = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6'];
    const colours = ids.map(UserColorService.getColor);
    const uniqueCount = new Set(colours).size;
    // With 6 users and 6 slots, we expect a reasonable spread
    expect(uniqueCount).toBeGreaterThan(1);
  });

  it('returns a valid CSS hex colour string', () => {
    const testIds = ['alice', 'bob', 'charlie', 'dave', 'eve', 'frank'];
    for (const id of testIds) {
      expect(UserColorService.getColor(id)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('handles an empty string userId without throwing', () => {
    expect(() => UserColorService.getColor('')).not.toThrow();
  });

  it('handles a very long userId without throwing', () => {
    const longId = 'x'.repeat(1000);
    expect(() => UserColorService.getColor(longId)).not.toThrow();
    expect(UserColorService.getColor(longId)).toMatch(/^#/);
  });

  it('always returns one of the predefined palette colours', () => {
    const palette = ['#e85d04', '#0d9488', '#7c3aed', '#e11d48', '#0284c7', '#d97706'];
    const testIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);
    for (const id of testIds) {
      expect(palette).toContain(UserColorService.getColor(id));
    }
  });
});
