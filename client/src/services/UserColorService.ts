/**
 * Deterministically maps a user ID to a display colour.
 * Single Responsibility: owns all user-colour logic in one place.
 */
export class UserColorService {
  private static readonly COLORS = [
    '#e85d04', '#0d9488', '#7c3aed', '#e11d48', '#0284c7', '#d97706',
  ] as const;

  static getColor(userId: string): string {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
    return UserColorService.COLORS[Math.abs(h) % UserColorService.COLORS.length];
  }
}
