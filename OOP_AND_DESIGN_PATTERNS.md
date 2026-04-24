# Pigment — OOP Principles & Design Patterns

This document satisfies the academic submission requirements for:
- **Use the basic concepts behind object-oriented design** (polymorphism, abstraction,
  inheritance, encapsulation)
- **Design Patterns** (documented in source code with motivation and usage explanation)

Each entry below cross-references the exact source file and line so reviewers can
verify the implementation directly.

---

## Part 1 — Object-Oriented Principles

### 1.1 Abstraction

> *Hiding implementation complexity behind a clean, stable interface.*

#### Example A — `DrawingToolHandler` (abstract class)

**File:** [`client/src/tools/DrawingToolHandler.ts`](client/src/tools/DrawingToolHandler.ts)

`DrawingToolHandler` is an `abstract` class that declares *what* every drawing tool
must provide (`cursor`, `hasStrokePreview`, `onMove`, `onEnd`) without saying *how*.
`Canvas.tsx` depends entirely on this abstraction and never imports a concrete handler
class. The entire pointer-event lifecycle is expressed through four abstract / default
methods — the ray-casting, eraser hit-detection, and lasso polygon math are completely
hidden from the caller.

```ts
// Canvas.tsx — works with the abstraction, never with a concrete type
const handler: DrawingToolHandler = ToolHandlerFactory.create(tool);
handler.onMove(pt, points, layers, erased);   // runtime dispatch
handler.onEnd(points, layers, userId, name);  // runtime dispatch
```

#### Example B — `GeometryService` (static utility)

**File:** [`client/src/services/GeometryService.ts`](client/src/services/GeometryService.ts)

Callers ask "does this stroke hit this point?" or "is this point inside this polygon?"
without ever seeing the ray-casting algorithm or SVG matrix transforms.

```ts
// EraserToolHandler — calls the abstraction
if (GeometryService.strokeHitsPoint(stroke, pt, radius)) { … }

// LassoToolHandler — calls the abstraction
if (GeometryService.strokeInLasso(stroke, lassoPoints)) { … }
```

---

### 1.2 Encapsulation

> *Bundling data and behaviour; restricting direct access to internal state.*

#### Example A — `UserColorService.COLORS`

**File:** [`client/src/services/UserColorService.ts`](client/src/services/UserColorService.ts)

The colour palette is `private static readonly … as const`. External code cannot read,
replace, or mutate the array. The hashing algorithm (how the index is computed) is
also private — callers only call `getColor(userId)`.

```ts
export class UserColorService {
  private static readonly COLORS = [      // private + readonly + as const
    '#e85d04', '#0d9488', '#7c3aed', …
  ] as const;

  static getColor(userId: string): string { … }  // only public surface
}
```

#### Example B — `DrawingToolHandler.tool`

**File:** [`client/src/tools/DrawingToolHandler.ts`](client/src/tools/DrawingToolHandler.ts)

The `DrawingTool` configuration is stored as `protected readonly`. Concrete subclasses
can read `this.tool.color` and `this.tool.width` to build their stroke, but no code
outside the class hierarchy can read or mutate the field.

```ts
export abstract class DrawingToolHandler {
  constructor(protected readonly tool: DrawingTool) {}
  //          ^^^^^^^^^^^ ^^^^^^^^
  //          accessible to subclasses only; immutable reference
}
```

#### Example C — `CanvasEventBus.listeners`

**File:** [`client/src/services/CanvasEventBus.ts`](client/src/services/CanvasEventBus.ts)

The internal subscription map is `private readonly`. The only way to interact with it
is through `on()`, `off()`, `emit()`, and `clear()` — the Map itself is invisible
to external code.

```ts
export class CanvasEventBus<…> {
  private readonly listeners = new Map<…>();  // hidden from all callers
  on(…): () => void { … }
  off(…): void { … }
  emit(…): void { … }
}
```

---

### 1.3 Inheritance

> *Subclasses reuse and specialise behaviour defined by a parent class.*

**File:** [`client/src/tools/`](client/src/tools/)

Every concrete tool handler inherits from `DrawingToolHandler`:

```
DrawingToolHandler          (abstract base)
├── PenToolHandler          overrides onEnd → produces a 'pen' Stroke
├── HighlighterToolHandler  overrides onEnd → produces a 'highlighter' Stroke
├── EraserToolHandler       overrides onMove → performs hit-detection each step
├── LassoToolHandler        overrides onEnd → computes the enclosed selection Set
└── TextToolHandler         inherits defaults; text placement is handled by Canvas
```

Each subclass inherits the base `onMove` (append-point) and `onEnd` (no-op) from the
parent, overriding only the methods where its behaviour differs. For example,
`TextToolHandler` needs no override at all — it completely relies on the inherited
defaults because text placement bypasses the stroke lifecycle.

```ts
// PenToolHandler — inherits onMove, overrides only onEnd
export class PenToolHandler extends DrawingToolHandler {
  get cursor(): string { return 'default'; }
  get hasStrokePreview(): boolean { return true; }

  override onEnd(points, layers, userId, userName): ToolEndResult {
    if (!points.length) return {};
    return { stroke: { … tool: 'pen' … } };
  }
}
```

---

### 1.4 Polymorphism

> *A single interface used to represent different underlying forms (types).*

**File:** [`client/src/tools/ToolHandlerFactory.ts`](client/src/tools/ToolHandlerFactory.ts)
and `Canvas.tsx`

`ToolHandlerFactory.create()` always returns the abstract type `DrawingToolHandler`,
regardless of which concrete class was instantiated. Canvas.tsx calls `handler.onMove()`
and `handler.onEnd()` — the JavaScript runtime dispatches the correct override based on
the actual object type at that moment. No `if/switch` branching is needed in Canvas.tsx.

```ts
// ToolHandlerFactory — returns abstract type
static create(tool: DrawingTool): DrawingToolHandler {
  switch (tool.type) {
    case 'pen':    return new PenToolHandler(tool);      // ┐
    case 'eraser': return new EraserToolHandler(tool);   // │ all DrawingToolHandler
    case 'lasso':  return new LassoToolHandler(tool);    // ┘
    …
  }
}

// Canvas.tsx — polymorphic calls
const handler = ToolHandlerFactory.create(activeTool);
const result = handler.onMove(pt, …);   // dispatched to the correct subclass
```

**Runtime dispatch table:**

| `tool.type` | `handler.onMove()` runs | `handler.onEnd()` runs |
|-------------|------------------------|------------------------|
| `'pen'` | base (append point) | `PenToolHandler.onEnd` → emits Stroke |
| `'highlighter'` | base (append point) | `HighlighterToolHandler.onEnd` → emits Stroke |
| `'eraser'` | `EraserToolHandler.onMove` → hit-detects | base (no-op) |
| `'lasso'` | base (append point) | `LassoToolHandler.onEnd` → computes Set |
| `'text'` | base (append point) | base (no-op) |

---

## Part 2 — Design Patterns

### 2.1 Strategy Pattern

**Classification:** Behavioural  
**Files:** [`client/src/tools/DrawingToolHandler.ts`](client/src/tools/DrawingToolHandler.ts),
all files in [`client/src/tools/`](client/src/tools/)

**Intent:** Define a family of algorithms, encapsulate each one, and make them
interchangeable. Let the algorithm vary independently from the clients that use it.

**Roles in Pigment:**

| Strategy Role | Pigment Class |
|---------------|---------------|
| Abstract Strategy | `DrawingToolHandler` |
| Concrete Strategy A | `PenToolHandler` |
| Concrete Strategy B | `HighlighterToolHandler` |
| Concrete Strategy C | `EraserToolHandler` |
| Concrete Strategy D | `LassoToolHandler` |
| Concrete Strategy E | `TextToolHandler` |
| Context | `Canvas.tsx` (holds `handler: DrawingToolHandler`) |

**Why Strategy here?**  
All drawing tools share the same pointer-event lifecycle (down → move → up) but differ
in what they compute at each step. Before this refactor, Canvas.tsx contained a large
`switch` statement inside every event handler. Strategy extracted each branch into its
own class:
- Adding a new tool is a matter of creating one new subclass and adding one case
  to `ToolHandlerFactory` — Canvas.tsx is never modified.
- Each handler is independently testable without rendering Canvas.tsx.

```ts
// Context (Canvas.tsx) — only knows the abstract Strategy type
const handler: DrawingToolHandler = ToolHandlerFactory.create(activeTool);

// On pointer move — Strategy executes its algorithm
const { newPoints, newlyErasedIds } = handler.onMove(pt, points, layers, erased);

// On pointer up — Strategy commits its result
const { stroke, lassoSelection } = handler.onEnd(points, layers, userId, userName);
```

---

### 2.2 Factory Method Pattern

**Classification:** Creational  
**File:** [`client/src/tools/ToolHandlerFactory.ts`](client/src/tools/ToolHandlerFactory.ts)

**Intent:** Define an interface for creating an object, but let a single class decide
which class to instantiate. The factory method lets a class defer instantiation to
subclasses (or, here, a centralised static method).

**Roles in Pigment:**

| Factory Role | Pigment Class |
|--------------|---------------|
| Creator | `ToolHandlerFactory` |
| Factory Method | `ToolHandlerFactory.create(tool)` |
| Abstract Product | `DrawingToolHandler` |
| Concrete Products | `PenToolHandler`, `EraserToolHandler`, … |

**Why Factory here?**  
Canvas.tsx must produce different `DrawingToolHandler` instances at runtime depending
on user selection, but it should not be coupled to concrete handler class names. The
Factory centralises all construction decisions:
- The `switch` in `create()` is an exhaustive type-guard: TypeScript emits a compile
  error if a new tool type is added to the `DrawingTool` union without a corresponding
  case here.
- Every caller is shielded from implementation changes inside any concrete handler.

```ts
export class ToolHandlerFactory {
  static create(tool: DrawingTool): DrawingToolHandler {  // returns abstract type
    switch (tool.type) {
      case 'pen':         return new PenToolHandler(tool);
      case 'highlighter': return new HighlighterToolHandler(tool);
      case 'eraser':      return new EraserToolHandler(tool);
      case 'lasso':       return new LassoToolHandler(tool);
      case 'text':        return new TextToolHandler(tool);
    }
  }
}
```

---

### 2.3 Observer Pattern (Publish/Subscribe)

**Classification:** Behavioural  
**File:** [`client/src/services/CanvasEventBus.ts`](client/src/services/CanvasEventBus.ts)

**Intent:** Define a one-to-many dependency so that when one object changes state,
all its dependents are notified and updated automatically.

**Roles in Pigment:**

| Observer Role | Pigment Element |
|---------------|-----------------|
| Subject (Publisher) | `CanvasEventBus` instance |
| Observer (Subscriber) | Any callback passed to `bus.on(event, listener)` |
| ConcreteEvent | Entries in `CanvasEventMap` (`stroke_added`, `user_joined`, …) |

**Why Observer here?**  
Canvas.tsx receives WebSocket messages for many concerns: strokes, cursor positions,
chat, user presence, activity logging. Without an event bus, every new feature that
reacts to these messages must be wired directly into Canvas.tsx's WebSocket `onmessage`
handler, causing it to grow indefinitely. The Observer pattern decouples emission from
consumption:
- Multiple React components or services can observe `stroke_added` independently.
- New observers are added without touching the WebSocket message handler.
- The bus is injected as a constructor/prop dependency, so unit tests supply a mock
  bus instead of a real WebSocket — demonstrating *Dependency Injection*.
- The `on()` method returns an unsubscribe function, following the React `useEffect`
  cleanup convention to prevent memory leaks.

```ts
const bus = new CanvasEventBus();

// Observer subscribes (registers itself with the Subject)
const unsub = bus.on('stroke_added', (stroke: Stroke) => {
  setLayers(prev => addStrokeToLayer(prev, stroke));
});

// Subject emits (notifies all Observers) — called by WebSocket handler
bus.emit('stroke_added', incomingStroke);

// Observer deregisters (React useEffect cleanup)
useEffect(() => { return () => unsub(); }, []);
```

---

### 2.4 Singleton Pattern

**Classification:** Creational  
**File:** [`server/src/db/database.ts`](server/src/db/database.ts)

**Intent:** Ensure a class has only one instance and provide a global access point to it.

**Roles in Pigment:**

| Singleton Role | Pigment Element |
|----------------|-----------------|
| Singleton | The `db` module-level variable |
| Global access point | `getDB()` exported function |

**Why Singleton here?**  
SQLite allows only one concurrent writer per database file. Opening multiple connections
would risk `SQLITE_BUSY` errors under concurrent requests. The module-level `db` variable
ensures the entire server process shares exactly one database connection, initialised
once by `initDB()` at startup.

```ts
let db: Database;  // module-level — one instance per process

export async function initDB() {
  db = await open({ filename: './pigment.db', driver: sqlite3.Database });
  return db;
}

export function getDB() {
  return db;  // always the same instance
}
```

---

## Summary Table

| Pattern | Type | File | Line of evidence |
|---------|------|------|-----------------|
| Strategy | Behavioural | `DrawingToolHandler.ts` + tool handlers | Abstract class + `override onMove/onEnd` |
| Factory Method | Creational | `ToolHandlerFactory.ts` | `static create(): DrawingToolHandler` |
| Observer | Behavioural | `CanvasEventBus.ts` | `on() / off() / emit()` |
| Singleton | Creational | `server/src/db/database.ts` | Module-level `db` + `getDB()` |

| OOP Principle | File | Evidence |
|---------------|------|----------|
| Abstraction | `DrawingToolHandler.ts`, `GeometryService.ts` | `abstract` methods; static utility hiding ray-casting |
| Encapsulation | `UserColorService.ts`, `DrawingToolHandler.ts`, `CanvasEventBus.ts` | `private static readonly COLORS`; `protected readonly tool`; `private readonly listeners` |
| Inheritance | All files in `client/src/tools/` | `extends DrawingToolHandler` |
| Polymorphism | `ToolHandlerFactory.ts`, `Canvas.tsx` | `DrawingToolHandler` return type; runtime method dispatch |
