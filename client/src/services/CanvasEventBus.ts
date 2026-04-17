import type { Stroke, User, ChatMessage, ActivityEvent, Point } from '../types/canvas';

// ── Event map ─────────────────────────────────────────────────────────────────

/**
 * Exhaustive map of every event the canvas subsystem can emit.
 * Adding a new event requires only a new entry here — no other file changes.
 *
 * OOP — ABSTRACTION: callers subscribe to named events without knowing how or
 * where the event is emitted.
 */
export interface CanvasEventMap {
  stroke_added: Stroke;
  strokes_erased: { ids: string[] };
  user_joined: User;
  user_left: { userId: string };
  cursor_moved: { userId: string; cursor: Point };
  chat_message: ChatMessage;
  activity_logged: ActivityEvent;
  canvas_cleared: Record<string, never>;
}

// ── Listener type ─────────────────────────────────────────────────────────────

/** A typed callback for a single event kind. */
type Listener<T> = (payload: T) => void;

// ── CanvasEventBus ─────────────────────────────────────────────────────────────

/**
 * Typed publish/subscribe event bus for canvas events.
 *
 * ─────────────────────────────────────────────────────
 * DESIGN PATTERN: Observer (Publish/Subscribe variant)
 * ─────────────────────────────────────────────────────
 * Roles in this pattern:
 *   Subject (Publisher)  — CanvasEventBus itself maintains the observer list
 *                          and notifies all registered listeners on emit().
 *   Observer (Subscriber)— Any callback passed to on(). Components subscribe
 *                          to events they care about and ignore the rest.
 *   Event               — A named key from CanvasEventMap with a typed payload.
 *
 * Why Observer here?
 *   Canvas.tsx receives WebSocket messages from many sources (strokes, cursors,
 *   chat, user join/leave). Without an event bus, every new feature that reacts
 *   to WebSocket messages must be wired directly inside Canvas.tsx, growing it
 *   without bound. The Observer pattern decouples producers (WebSocket handlers)
 *   from consumers (UI components, activity loggers, chat panels) so that:
 *     • New subscribers can be added without touching the emission site.
 *     • Subscribers are removed automatically via the returned unsubscribe
 *       function, preventing memory leaks in React useEffect hooks.
 *     • The bus is injected as a dependency, making components unit-testable
 *       without a real WebSocket connection.
 *
 * OOP — ENCAPSULATION:
 *   The `listeners` map is `private readonly`. External code can only interact
 *   through on(), off(), and emit() — the internal data structure is hidden.
 *
 * OOP — ABSTRACTION:
 *   The generic type parameter <EventMap> makes the bus reusable for any
 *   domain without exposing the subscription machinery. Callers see a simple
 *   "subscribe to X, get called with typed payload" contract.
 * ─────────────────────────────────────────────────────
 *
 * @example
 * ```ts
 * const bus = new CanvasEventBus();
 *
 * // Subscribe (Observer registers itself with the Subject)
 * const unsubscribe = bus.on('stroke_added', (stroke) => {
 *   console.log('New stroke from', stroke.userName);
 * });
 *
 * // Publish (Subject notifies all Observers)
 * bus.emit('stroke_added', myStroke);
 *
 * // Unsubscribe when done (clean up in useEffect return)
 * unsubscribe();
 * ```
 */
export class CanvasEventBus<EventMap extends Record<string, unknown> = CanvasEventMap> {
  /** ENCAPSULATION: internal state; not accessible outside this class. */
  private readonly listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  /**
   * Registers {@link listener} to be called every time {@link event} is emitted.
   *
   * @returns An unsubscribe function. Call it (e.g. in a useEffect cleanup)
   *          to prevent memory leaks.
   */
  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  /**
   * Removes a previously registered {@link listener} for {@link event}.
   * Calling this with a listener that was never registered is a safe no-op.
   */
  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  /**
   * Notifies all observers subscribed to {@link event} with the given
   * {@link payload}. Listeners are called synchronously in subscription order.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  /**
   * Returns the number of active listeners for {@link event}.
   * Useful for debugging and assertions in tests.
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Removes all listeners for every event.
   * Call this when tearing down a canvas session to prevent stale callbacks.
   */
  clear(): void {
    this.listeners.clear();
  }
}
