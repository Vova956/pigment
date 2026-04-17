import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';

// ── Inline WebSocket session manager ─────────────────────────────────────────
// Instead of coupling to the Express/WS server startup (which requires a DB),
// we extract and unit-test the pure session-management logic independently.
// This demonstrates the Dependency Inversion principle from the SOLID practices.

type ClientMeta = { id: string; name: string };

class SessionManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly clientSession = new Map<WebSocket, string>();
  private readonly clientUser = new Map<WebSocket, ClientMeta>();

  join(ws: WebSocket, sessionId: string, user: ClientMeta) {
    const prev = this.clientSession.get(ws);
    if (prev) this.rooms.get(prev)?.delete(ws);

    if (!this.rooms.has(sessionId)) this.rooms.set(sessionId, new Set());
    this.rooms.get(sessionId)!.add(ws);
    this.clientSession.set(ws, sessionId);
    this.clientUser.set(ws, user);
  }

  leave(ws: WebSocket): string | undefined {
    const sessionId = this.clientSession.get(ws);
    const user = this.clientUser.get(ws);
    if (sessionId && user) {
      this.rooms.get(sessionId)?.delete(ws);
      if (this.rooms.get(sessionId)?.size === 0) this.rooms.delete(sessionId);
    }
    this.clientSession.delete(ws);
    this.clientUser.delete(ws);
    return sessionId;
  }

  getPeers(ws: WebSocket): WebSocket[] {
    const sessionId = this.clientSession.get(ws);
    if (!sessionId) return [];
    const room = this.rooms.get(sessionId) ?? new Set();
    return [...room].filter((c) => c !== ws);
  }

  getSessionUsers(sessionId: string, exclude: WebSocket): ClientMeta[] {
    const room = this.rooms.get(sessionId) ?? new Set();
    return [...room]
      .filter((c) => c !== exclude)
      .map((c) => this.clientUser.get(c)!)
      .filter(Boolean);
  }

  getRoomSize(sessionId: string): number {
    return this.rooms.get(sessionId)?.size ?? 0;
  }

  hasRoom(sessionId: string): boolean {
    return this.rooms.has(sessionId);
  }
}

// ── Mock WebSocket factory ────────────────────────────────────────────────────

function mockWs(): WebSocket {
  return { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
}

// ── SessionManager unit tests ─────────────────────────────────────────────────

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  // -- join

  it('adds a client to the room on join', () => {
    const ws = mockWs();
    manager.join(ws, 'ROOM01', { id: 'u1', name: 'Alice' });
    expect(manager.getRoomSize('ROOM01')).toBe(1);
  });

  it('creates a new room when none exists', () => {
    const ws = mockWs();
    manager.join(ws, 'NEW01', { id: 'u1', name: 'Alice' });
    expect(manager.hasRoom('NEW01')).toBe(true);
  });

  it('moves a client from the old room when re-joining', () => {
    const ws = mockWs();
    manager.join(ws, 'ROOM01', { id: 'u1', name: 'Alice' });
    manager.join(ws, 'ROOM02', { id: 'u1', name: 'Alice' });
    expect(manager.getRoomSize('ROOM01')).toBe(0);
    expect(manager.getRoomSize('ROOM02')).toBe(1);
  });

  it('supports multiple clients in the same room', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.join(ws1, 'SHARED', { id: 'u1', name: 'Alice' });
    manager.join(ws2, 'SHARED', { id: 'u2', name: 'Bob' });
    expect(manager.getRoomSize('SHARED')).toBe(2);
  });

  // -- leave

  it('removes a client from the room on leave', () => {
    const ws = mockWs();
    manager.join(ws, 'ROOM01', { id: 'u1', name: 'Alice' });
    manager.leave(ws);
    expect(manager.getRoomSize('ROOM01')).toBe(0);
  });

  it('deletes the room when the last client leaves', () => {
    const ws = mockWs();
    manager.join(ws, 'ROOM01', { id: 'u1', name: 'Alice' });
    manager.leave(ws);
    expect(manager.hasRoom('ROOM01')).toBe(false);
  });

  it('returns the sessionId of the room left', () => {
    const ws = mockWs();
    manager.join(ws, 'ROOM01', { id: 'u1', name: 'Alice' });
    const id = manager.leave(ws);
    expect(id).toBe('ROOM01');
  });

  it('returns undefined when leaving without having joined', () => {
    const ws = mockWs();
    expect(manager.leave(ws)).toBeUndefined();
  });

  // -- getPeers

  it('returns all other clients in the same room', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const ws3 = mockWs();
    manager.join(ws1, 'ROOM', { id: 'u1', name: 'Alice' });
    manager.join(ws2, 'ROOM', { id: 'u2', name: 'Bob' });
    manager.join(ws3, 'ROOM', { id: 'u3', name: 'Carol' });
    const peers = manager.getPeers(ws1);
    expect(peers).toHaveLength(2);
    expect(peers).not.toContain(ws1);
  });

  it('returns empty array when no peers exist', () => {
    const ws = mockWs();
    manager.join(ws, 'SOLO', { id: 'u1', name: 'Alice' });
    expect(manager.getPeers(ws)).toHaveLength(0);
  });

  it('returns empty array when client is not in any room', () => {
    const ws = mockWs();
    expect(manager.getPeers(ws)).toHaveLength(0);
  });

  // -- getSessionUsers

  it('returns metadata for all users except the requester', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.join(ws1, 'ROOM', { id: 'u1', name: 'Alice' });
    manager.join(ws2, 'ROOM', { id: 'u2', name: 'Bob' });
    const users = manager.getSessionUsers('ROOM', ws2);
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
  });

  it('returns empty array when the room does not exist', () => {
    const ws = mockWs();
    expect(manager.getSessionUsers('GHOST', ws)).toHaveLength(0);
  });
});
