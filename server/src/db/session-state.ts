import { getDB } from "./database";

// ── Types mirror the shape the client serializes ──────────────────────────────
// Kept loose (unknown) — the server is a pass-through; it doesn't introspect
// stroke/image/text internals.

interface Point { x: number; y: number; }
interface Stroke {
  id: string;
  userId: string;
  userName: string;
  points: Point[];
  color: string;
  width: number;
  tool: string;
  timestamp: number;
}
interface LayerData {
  userName: string;
  userId?: string;
  visible: boolean;
  strokes: Stroke[];
  comments?: unknown[];
  name?: string;
}
interface CanvasImage {
  id: string; userId: string; userName: string; dataUrl: string;
  x: number; y: number; width: number; height: number; timestamp: number;
}
interface CanvasText {
  id: string; userId: string; userName: string; text: string;
  x: number; y: number; fontSize: number; color: string; timestamp: number;
}

export interface SessionSnapshot {
  layers: Record<string, LayerData>;
  images: CanvasImage[];
  texts: CanvasText[];
}

// ── In-memory cache keyed by sessionId ───────────────────────────────────────
const cache = new Map<string, SessionSnapshot>();
const pendingWrites = new Map<string, NodeJS.Timeout>();
const WRITE_DEBOUNCE_MS = 500;

function empty(): SessionSnapshot {
  return { layers: {}, images: [], texts: [] };
}

export async function loadSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const cached = cache.get(sessionId);
  if (cached) return cached;

  const db = getDB();
  const row = await db.get<{ snapshot: string }>(
    "SELECT snapshot FROM session_state WHERE session_id = ?",
    sessionId,
  );
  const snap = row ? (JSON.parse(row.snapshot) as SessionSnapshot) : empty();
  cache.set(sessionId, snap);
  return snap;
}

/** Schedule a persist. Repeated calls within the debounce window collapse into one write. */
function schedulePersist(sessionId: string) {
  const existing = pendingWrites.get(sessionId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingWrites.delete(sessionId);
    void persistNow(sessionId);
  }, WRITE_DEBOUNCE_MS);
  pendingWrites.set(sessionId, t);
}

async function persistNow(sessionId: string) {
  const snap = cache.get(sessionId);
  if (!snap) return;
  const db = getDB();
  try {
    await db.run(
      `INSERT INTO session_state (session_id, snapshot, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE SET
         snapshot = excluded.snapshot,
         updated_at = CURRENT_TIMESTAMP`,
      sessionId,
      JSON.stringify(snap),
    );
  } catch (err) {
    console.error(`Failed to persist session ${sessionId}:`, err);
  }
}

// ── Mutators: apply each broadcast message to the snapshot ───────────────────
//
// These mirror the client's case handlers so re-joiners see the same state.
// Returns true if anything changed (so the caller knows whether to persist).

export async function applyMessage(sessionId: string, msg: any): Promise<boolean> {
  const snap = await loadSnapshot(sessionId);
  let changed = true;

  switch (msg.type) {
    case "stroke": {
      const layerId: string = msg.layerId ?? msg.stroke.userId;
      const existing = snap.layers[layerId] ?? {
        userName: msg.stroke.userName,
        userId: msg.stroke.userId,
        visible: true,
        strokes: [],
        comments: [],
      };
      // Skip duplicates (clients replay their own messages via broadcast fan-out)
      if (existing.strokes.some((s) => s.id === msg.stroke.id)) return false;
      snap.layers[layerId] = { ...existing, strokes: [...existing.strokes, msg.stroke] };
      break;
    }

    case "strokes_erased": {
      const ids = new Set<string>(msg.strokeIds ?? []);
      if (!ids.size) return false;
      for (const [lid, layer] of Object.entries(snap.layers)) {
        snap.layers[lid] = { ...layer, strokes: layer.strokes.filter((s) => !ids.has(s.id)) };
      }
      break;
    }

    case "strokes_moved": {
      const moves: Array<{ id: string; points: Point[] }> = msg.strokes ?? [];
      if (!moves.length) return false;
      const moveMap = new Map(moves.map((m) => [m.id, m.points]));
      for (const [lid, layer] of Object.entries(snap.layers)) {
        snap.layers[lid] = {
          ...layer,
          strokes: layer.strokes.map((s) =>
            moveMap.has(s.id) ? { ...s, points: moveMap.get(s.id)! } : s,
          ),
        };
      }
      break;
    }

    case "clear_canvas": {
      for (const [lid, l] of Object.entries(snap.layers)) {
        snap.layers[lid] = { ...l, strokes: [] };
      }
      snap.images = [];
      snap.texts = [];
      break;
    }

    case "image":
      if (snap.images.some((i) => i.id === msg.image.id)) return false;
      snap.images.push(msg.image);
      break;

    case "image_move": {
      const idx = snap.images.findIndex((i) => i.id === msg.imageId);
      if (idx === -1) return false;
      snap.images[idx] = { ...snap.images[idx], x: msg.x, y: msg.y };
      break;
    }

    case "text":
      if (snap.texts.some((t) => t.id === msg.canvasText.id)) return false;
      snap.texts.push(msg.canvasText);
      break;

    case "layer_comment": {
      const layer = snap.layers[msg.layerUserId];
      if (!layer) return false;
      snap.layers[msg.layerUserId] = {
        ...layer,
        comments: [...(layer.comments ?? []), msg.comment],
      };
      break;
    }

    default:
      changed = false;
  }

  if (changed) schedulePersist(sessionId);
  return changed;
}

/** Flush any pending writes (used on shutdown). */
export async function flushAll(): Promise<void> {
  const ids = Array.from(pendingWrites.keys());
  for (const id of ids) {
    const t = pendingWrites.get(id);
    if (t) clearTimeout(t);
    pendingWrites.delete(id);
    await persistNow(id);
  }
}
