import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasEventBus } from '../CanvasEventBus';
import type { CanvasEventMap } from '../CanvasEventBus';
import type { Stroke } from '../../types/canvas';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 'stroke-1',
    userId: 'user-1',
    userName: 'Alice',
    points: [{ x: 0, y: 0 }],
    color: '#000',
    width: 2,
    tool: 'pen',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Observer Pattern — subscription ──────────────────────────────────────────

describe('CanvasEventBus.on (subscribe)', () => {
  let bus: CanvasEventBus<CanvasEventMap>;

  beforeEach(() => {
    bus = new CanvasEventBus();
  });

  it('registers a listener and returns an unsubscribe function', () => {
    const listener = vi.fn();
    const unsubscribe = bus.on('stroke_added', listener);
    expect(typeof unsubscribe).toBe('function');
  });

  it('starts with zero listeners for an event that has never been subscribed', () => {
    expect(bus.listenerCount('stroke_added')).toBe(0);
  });

  it('increments the listener count on each subscription', () => {
    bus.on('stroke_added', vi.fn());
    bus.on('stroke_added', vi.fn());
    expect(bus.listenerCount('stroke_added')).toBe(2);
  });

  it('allows the same listener to subscribe to multiple distinct events', () => {
    const shared = vi.fn();
    bus.on('stroke_added', shared);
    bus.on('canvas_cleared', shared);
    expect(bus.listenerCount('stroke_added')).toBe(1);
    expect(bus.listenerCount('canvas_cleared')).toBe(1);
  });
});

// ── Observer Pattern — emission (notify) ─────────────────────────────────────

describe('CanvasEventBus.emit (notify observers)', () => {
  let bus: CanvasEventBus<CanvasEventMap>;

  beforeEach(() => {
    bus = new CanvasEventBus();
  });

  it('calls the listener with the emitted payload', () => {
    const listener = vi.fn();
    const stroke = makeStroke();
    bus.on('stroke_added', listener);

    bus.emit('stroke_added', stroke);

    expect(listener).toHaveBeenCalledWith(stroke);
  });

  it('calls all listeners subscribed to the same event', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const l3 = vi.fn();
    bus.on('stroke_added', l1);
    bus.on('stroke_added', l2);
    bus.on('stroke_added', l3);

    bus.emit('stroke_added', makeStroke());

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
    expect(l3).toHaveBeenCalledOnce();
  });

  it('does not call listeners subscribed to a different event', () => {
    const strokeListener = vi.fn();
    const chatListener = vi.fn();
    bus.on('stroke_added', strokeListener);
    bus.on('chat_message', chatListener);

    bus.emit('stroke_added', makeStroke());

    expect(chatListener).not.toHaveBeenCalled();
  });

  it('is a safe no-op when no listeners are registered', () => {
    expect(() => bus.emit('stroke_added', makeStroke())).not.toThrow();
  });

  it('delivers the exact payload object to listeners', () => {
    const listener = vi.fn();
    bus.on('strokes_erased', listener);
    const payload = { ids: ['a', 'b', 'c'] };

    bus.emit('strokes_erased', payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('calls listeners synchronously in subscription order', () => {
    const order: number[] = [];
    bus.on('stroke_added', () => order.push(1));
    bus.on('stroke_added', () => order.push(2));
    bus.on('stroke_added', () => order.push(3));

    bus.emit('stroke_added', makeStroke());

    expect(order).toEqual([1, 2, 3]);
  });
});

// ── Observer Pattern — unsubscription ────────────────────────────────────────

describe('CanvasEventBus.off / returned unsubscribe (deregister)', () => {
  let bus: CanvasEventBus<CanvasEventMap>;

  beforeEach(() => {
    bus = new CanvasEventBus();
  });

  it('calling the unsubscribe function stops future deliveries', () => {
    const listener = vi.fn();
    const unsubscribe = bus.on('stroke_added', listener);

    unsubscribe();
    bus.emit('stroke_added', makeStroke());

    expect(listener).not.toHaveBeenCalled();
  });

  it('off() removes the specific listener without affecting others', () => {
    const keep = vi.fn();
    const remove = vi.fn();
    bus.on('stroke_added', keep);
    bus.on('stroke_added', remove);

    bus.off('stroke_added', remove);
    bus.emit('stroke_added', makeStroke());

    expect(keep).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it('decrements the listener count after unsubscription', () => {
    const listener = vi.fn();
    const unsubscribe = bus.on('stroke_added', listener);
    expect(bus.listenerCount('stroke_added')).toBe(1);

    unsubscribe();
    expect(bus.listenerCount('stroke_added')).toBe(0);
  });

  it('calling off() with a non-registered listener is a safe no-op', () => {
    const stranger = vi.fn();
    expect(() => bus.off('stroke_added', stranger)).not.toThrow();
  });

  it('calling the unsubscribe function twice is safe', () => {
    const listener = vi.fn();
    const unsub = bus.on('stroke_added', listener);
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});

// ── CanvasEventBus.clear ──────────────────────────────────────────────────────

describe('CanvasEventBus.clear', () => {
  let bus: CanvasEventBus<CanvasEventMap>;

  beforeEach(() => {
    bus = new CanvasEventBus();
  });

  it('removes all listeners across all events', () => {
    bus.on('stroke_added', vi.fn());
    bus.on('chat_message', vi.fn());
    bus.on('user_joined', vi.fn());

    bus.clear();

    expect(bus.listenerCount('stroke_added')).toBe(0);
    expect(bus.listenerCount('chat_message')).toBe(0);
    expect(bus.listenerCount('user_joined')).toBe(0);
  });

  it('allows new subscriptions after clear', () => {
    bus.on('stroke_added', vi.fn());
    bus.clear();

    const fresh = vi.fn();
    bus.on('stroke_added', fresh);
    bus.emit('stroke_added', makeStroke());

    expect(fresh).toHaveBeenCalledOnce();
  });
});

// ── Generic type parameter ─────────────────────────────────────────────────────

describe('CanvasEventBus with custom event map', () => {
  interface TestEvents {
    ping: { ts: number };
    pong: { latency: number };
  }

  it('works with a custom event map type', () => {
    const bus = new CanvasEventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('ping', listener);

    bus.emit('ping', { ts: 42 });

    expect(listener).toHaveBeenCalledWith({ ts: 42 });
  });

  it('isolates events between different bus instances', () => {
    const bus1 = new CanvasEventBus<TestEvents>();
    const bus2 = new CanvasEventBus<TestEvents>();
    const l1 = vi.fn();
    const l2 = vi.fn();

    bus1.on('ping', l1);
    bus2.on('ping', l2);
    bus1.emit('ping', { ts: 1 });

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).not.toHaveBeenCalled();
  });
});
