/**
 * Deterministically maps a user ID string to a display colour.
 *
 * ─────────────────────────────────────────────────────
 * OOP — ENCAPSULATION
 * ─────────────────────────────────────────────────────
 * The colour palette is declared `private static readonly`:
 *   • `private`  — external code cannot read or replace the array.
 *   • `static`   — shared across all instances (no duplication in memory).
 *   • `readonly` — the reference cannot be reassigned after class load.
 *   • `as const` — TypeScript narrows each element to its literal type,
 *                  preventing accidental mutation of array contents.
 *
 * The hash function is internal implementation detail; callers only need
 * to know "give me a user ID, I give you a colour string". The hashing
 * algorithm can change without any caller needing updating.
 *
 * Single Responsibility: this class owns all user-colour logic and nothing
 * else. Colour assignments are stable across page reloads because the hash
 * is deterministic (same input always produces the same output).
 * ─────────────────────────────────────────────────────
 */
export class UserColorService {
  /** ENCAPSULATION: hidden from all external code. */
  private static readonly COLORS = [
    '#e85d04',
    '#0d9488',
    '#7c3aed',
    '#e11d48',
    '#0284c7',
    '#d97706',
  ] as const;

  /**
   * Returns a hex colour string for the given user ID.
   * The mapping is stable: the same ID always returns the same colour.
   *
   * @param userId - Any non-empty string that uniquely identifies a user.
   * @returns A hex colour string from the internal palette.
   */
  static getColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return UserColorService.COLORS[Math.abs(hash) % UserColorService.COLORS.length];
  }
}
