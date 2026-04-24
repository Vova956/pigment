import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the database module ──────────────────────────────────────────────────
// session-state calls getDB() lazily per operation, so a single module-level
// mock is enough to intercept every call.

const mockDb = {
  get: vi.fn(),
  run: vi.fn(),
};

vi.mock('../db/database', () => ({
  getDB: () => mockDb,
}));

// Imported dynamically so the mock is in place before module evaluation.
const { loadSnapshot, applyMessage, flushAll } = await import('../db/session-state');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStroke(id: string, userId = 'user-1', userName = 'Alice') {
  return {
    id,
    userId,
    userName,
    points: [{ x: 0, y: 0 }],
    color: '#000',
    width: 2,
    tool: 'pen',
    timestamp: 1,
  };
}

function makeImage(id: string) {
  return {
    id,
    userId: 'u',
    userName: 'Alice',
    dataUrl: 'data:image/png;base64,x',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    timestamp: 1,
  };
}

function makeText(id: string) {
  return {
    id,
    userId: 'u',
    userName: 'Alice',
    text: 'hi',
    x: 0,
    y: 0,
    fontSize: 14,
    color: '#000',
    timestamp: 1,
  };
}

// Each test works on a fresh sessionId so the module-level cache does not
// leak state between tests.
let counter = 0;
function nextSessionId(): string {
  return `SESS${++counter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.get.mockResolvedValue(undefined);
  mockDb.run.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(async () => {
  // Drain any pending debounced writes so they do not leak into later tests.
  await vi.runAllTimersAsync();
  vi.useRealTimers();
  await flushAll();
});

// ── loadSnapshot ──────────────────────────────────────────────────────────────

describe('loadSnapshot', () => {
  it('returns an empty snapshot when no row exists', async () => {
    const id = nextSessionId();
    const snap = await loadSnapshot(id);
    expect(snap).toEqual({ layers: {}, images: [], texts: [] });
  });

  it('parses and returns the stored snapshot when a row exists', async () => {
    const id = nextSessionId();
    const stored = {
      layers: { a: { userName: 'A', visible: true, strokes: [] } },
      images: [],
      texts: [],
    };
    mockDb.get.mockResolvedValueOnce({ snapshot: JSON.stringify(stored) });

    const snap = await loadSnapshot(id);
    expect(snap).toEqual(stored);
  });

  it('caches the snapshot so subsequent calls avoid re-reading the database', async () => {
    const id = nextSessionId();
    await loadSnapshot(id);
    await loadSnapshot(id);
    await loadSnapshot(id);
    expect(mockDb.get).toHaveBeenCalledTimes(1);
  });
});

// ── applyMessage: stroke ──────────────────────────────────────────────────────

describe('applyMessage — stroke', () => {
  it('adds a stroke to a fresh layer keyed by userId when no layerId is supplied', async () => {
    const id = nextSessionId();
    const stroke = makeStroke('s1', 'u-42', 'Bob');

    const changed = await applyMessage(id, { type: 'stroke', stroke } as any);

    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.layers['u-42'].strokes).toHaveLength(1);
    expect(snap.layers['u-42'].strokes[0].id).toBe('s1');
    expect(snap.layers['u-42'].userName).toBe('Bob');
  });

  it('skips duplicate stroke IDs', async () => {
    const id = nextSessionId();
    const stroke = makeStroke('s1');

    const first = await applyMessage(id, { type: 'stroke', stroke } as any);
    const second = await applyMessage(id, { type: 'stroke', stroke } as any);

    expect(first).toBe(true);
    expect(second).toBe(false);
    const snap = await loadSnapshot(id);
    expect(snap.layers['user-1'].strokes).toHaveLength(1);
  });

  it('honors an explicit layerId', async () => {
    const id = nextSessionId();
    const stroke = makeStroke('s1');
    await applyMessage(id, { type: 'stroke', stroke, layerId: 'custom-layer' } as any);

    const snap = await loadSnapshot(id);
    expect(snap.layers['custom-layer']).toBeDefined();
    expect(snap.layers['user-1']).toBeUndefined();
  });
});

// ── applyMessage: strokes_erased ──────────────────────────────────────────────

describe('applyMessage — strokes_erased', () => {
  it('removes strokes matching the provided IDs', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('b') } as any);

    const changed = await applyMessage(id, { type: 'strokes_erased', strokeIds: ['a'] } as any);

    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.layers['user-1'].strokes.map((s) => s.id)).toEqual(['b']);
  });

  it('returns false when strokeIds is empty or missing', async () => {
    const id = nextSessionId();
    expect(await applyMessage(id, { type: 'strokes_erased', strokeIds: [] } as any)).toBe(false);
    expect(await applyMessage(id, { type: 'strokes_erased' } as any)).toBe(false);
  });
});

// ── applyMessage: strokes_moved ───────────────────────────────────────────────

describe('applyMessage — strokes_moved', () => {
  it('updates the points of matching strokes', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);

    const newPoints = [{ x: 100, y: 100 }];
    const changed = await applyMessage(id, {
      type: 'strokes_moved',
      strokes: [{ id: 'a', points: newPoints }],
    } as any);

    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.layers['user-1'].strokes[0].points).toEqual(newPoints);
  });

  it('returns false when strokes list is empty', async () => {
    const id = nextSessionId();
    expect(await applyMessage(id, { type: 'strokes_moved', strokes: [] } as any)).toBe(false);
  });

  it('leaves non-matching strokes unchanged', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('b') } as any);

    await applyMessage(id, {
      type: 'strokes_moved',
      strokes: [{ id: 'a', points: [{ x: 9, y: 9 }] }],
    } as any);

    const snap = await loadSnapshot(id);
    const strokes = snap.layers['user-1'].strokes;
    expect(strokes.find((s) => s.id === 'a')!.points).toEqual([{ x: 9, y: 9 }]);
    expect(strokes.find((s) => s.id === 'b')!.points).toEqual([{ x: 0, y: 0 }]);
  });
});

// ── applyMessage: clear_canvas ────────────────────────────────────────────────

describe('applyMessage — clear_canvas', () => {
  it('empties strokes on every layer and clears images and texts', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);
    await applyMessage(id, { type: 'image', image: makeImage('i1') } as any);
    await applyMessage(id, { type: 'text', canvasText: makeText('t1') } as any);

    const changed = await applyMessage(id, { type: 'clear_canvas' } as any);
    expect(changed).toBe(true);

    const snap = await loadSnapshot(id);
    for (const layer of Object.values(snap.layers)) {
      expect(layer.strokes).toHaveLength(0);
    }
    expect(snap.images).toHaveLength(0);
    expect(snap.texts).toHaveLength(0);
  });
});

// ── applyMessage: image ──────────────────────────────────────────────────────

describe('applyMessage — image', () => {
  it('adds a new image', async () => {
    const id = nextSessionId();
    const changed = await applyMessage(id, { type: 'image', image: makeImage('i1') } as any);
    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.images).toHaveLength(1);
    expect(snap.images[0].id).toBe('i1');
  });

  it('skips duplicate image IDs', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'image', image: makeImage('i1') } as any);
    const changed = await applyMessage(id, { type: 'image', image: makeImage('i1') } as any);
    expect(changed).toBe(false);
  });
});

// ── applyMessage: image_move ──────────────────────────────────────────────────

describe('applyMessage — image_move', () => {
  it('updates the x/y of a matching image', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'image', image: makeImage('i1') } as any);
    const changed = await applyMessage(id, {
      type: 'image_move',
      imageId: 'i1',
      x: 42,
      y: 99,
    } as any);
    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.images[0]).toMatchObject({ x: 42, y: 99 });
  });

  it('returns false when the image ID is unknown', async () => {
    const id = nextSessionId();
    const changed = await applyMessage(id, {
      type: 'image_move',
      imageId: 'missing',
      x: 1,
      y: 2,
    } as any);
    expect(changed).toBe(false);
  });
});

// ── applyMessage: text ────────────────────────────────────────────────────────

describe('applyMessage — text', () => {
  it('adds a new text', async () => {
    const id = nextSessionId();
    const changed = await applyMessage(id, { type: 'text', canvasText: makeText('t1') } as any);
    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.texts).toHaveLength(1);
  });

  it('skips duplicate text IDs', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'text', canvasText: makeText('t1') } as any);
    const changed = await applyMessage(id, { type: 'text', canvasText: makeText('t1') } as any);
    expect(changed).toBe(false);
  });
});

// ── applyMessage: layer_comment ───────────────────────────────────────────────

describe('applyMessage — layer_comment', () => {
  it('appends a comment to an existing layer', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);
    const changed = await applyMessage(id, {
      type: 'layer_comment',
      layerUserId: 'user-1',
      comment: { text: 'nice' },
    } as any);
    expect(changed).toBe(true);
    const snap = await loadSnapshot(id);
    expect(snap.layers['user-1'].comments).toEqual([{ text: 'nice' }]);
  });

  it('returns false when the target layer does not exist', async () => {
    const id = nextSessionId();
    const changed = await applyMessage(id, {
      type: 'layer_comment',
      layerUserId: 'ghost',
      comment: { text: 'hi' },
    } as any);
    expect(changed).toBe(false);
  });
});

// ── applyMessage: unknown type ────────────────────────────────────────────────

describe('applyMessage — unknown message type', () => {
  it('returns false and does not schedule a persist', async () => {
    const id = nextSessionId();
    const changed = await applyMessage(id, { type: 'unknown_message' } as any);
    expect(changed).toBe(false);
  });
});

// ── Persistence scheduling ────────────────────────────────────────────────────

describe('applyMessage — debounced persistence', () => {
  it('writes to the database after the debounce window elapses', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('s1') } as any);

    expect(mockDb.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('collapses rapid consecutive writes into a single persist', async () => {
    const id = nextSessionId();
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('a') } as any);
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('b') } as any);
    await applyMessage(id, { type: 'stroke', stroke: makeStroke('c') } as any);

    await vi.advanceTimersByTimeAsync(600);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('swallows errors thrown by the database run', async () => {
    const id = nextSessionId();
    mockDb.run.mockRejectedValueOnce(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await applyMessage(id, { type: 'stroke', stroke: makeStroke('s1') } as any);
    await vi.advanceTimersByTimeAsync(600);
    // Let the rejection settle so console.error fires before we assert on it.
    await vi.waitFor(() => expect(err).toHaveBeenCalled());
    err.mockRestore();
  });
});

// ── flushAll ──────────────────────────────────────────────────────────────────

describe('flushAll', () => {
  it('persists every pending session immediately and clears the queue', async () => {
    const id1 = nextSessionId();
    const id2 = nextSessionId();
    await applyMessage(id1, { type: 'stroke', stroke: makeStroke('a') } as any);
    await applyMessage(id2, { type: 'stroke', stroke: makeStroke('b') } as any);

    // No auto-persist yet
    expect(mockDb.run).not.toHaveBeenCalled();

    await flushAll();

    expect(mockDb.run).toHaveBeenCalledTimes(2);

    // A second flush is a no-op (queue drained).
    mockDb.run.mockClear();
    await flushAll();
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});
