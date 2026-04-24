# Pigment — Coding Standards

> **Enforcement**: All rules below are mechanically enforced by ESLint and Prettier.
> Run `npm run lint` and `npm run format` before every commit.
> Configuration lives in `client/.eslintrc.json`, `server/.eslintrc.json`, and `.prettierrc.json`.

---

## 1. Language & Toolchain

| Concern | Choice | Config file |
|---------|--------|-------------|
| Language | TypeScript 5 (strict mode) | `tsconfig.json` |
| Formatter | Prettier 3 | `.prettierrc.json` |
| Linter | ESLint 8 + `@typescript-eslint` | `.eslintrc.json` |
| Test runner | Vitest | `vitest.config.ts` |
| Package manager | npm workspaces | `package.json` |

**TypeScript strict mode is non-negotiable.** `noImplicitAny`, `strictNullChecks`, and
`strictFunctionTypes` are all on. Never disable them with `// @ts-ignore` unless accompanied by
a comment explaining why.

---

## 2. Formatting (Prettier)

These rules are set in `.prettierrc.json` and cannot be overridden per-file.

| Rule | Value |
|------|-------|
| Semicolons | **always** |
| Quotes | **single** (`'`) for JS/TS, double for JSX attributes |
| Tab width | **2 spaces** (no tabs) |
| Trailing commas | **es5** (trailing commas where valid in ES5) |
| Print width | **100 characters** |
| Brace style | Opening brace on the **same line** (default) |

```ts
// ✅ correct
function greet(name: string): string {
  return `Hello, ${name}`;
}

// ❌ wrong — tab indentation, missing semicolon, wrong quote
function greet(name: string): string {
	return `Hello, ${name}`
}
```

---

## 3. Naming Conventions

### 3.1 TypeScript / JavaScript

| Construct | Convention | Example |
|-----------|------------|---------|
| Classes | `PascalCase` | `ToolHandlerFactory`, `GeometryService` |
| Interfaces | `PascalCase` (no `I` prefix) | `DrawingTool`, `LayerData` |
| Type aliases | `PascalCase` | `WebSocketMessage`, `ToolMoveResult` |
| Enums | `PascalCase` (name) + `UPPER_SNAKE_CASE` (values) | `ToolType.PEN` |
| Functions / methods | `camelCase` | `generateId()`, `strokeHitsPoint()` |
| Variables | `camelCase` | `currentStroke`, `activeUsers` |
| Constants (module-level) | `UPPER_SNAKE_CASE` | `HIGHLIGHTER_OPACITY`, `DEFAULT_COLORS` |
| Private class fields | `camelCase` (no underscore prefix) | `private readonly colors` |
| React components | `PascalCase` | `Canvas`, `ToolButton` |
| React hooks | `camelCase` prefixed with `use` | `useCanvasSession()` |
| Event handlers | `camelCase` prefixed with `handle` or `on` | `handleMouseDown`, `onSelect` |
| Boolean variables | `camelCase` with `is`/`has`/`can` prefix | `isDrawing`, `hasStrokePreview` |

### 3.2 Files & Directories

| Construct | Convention | Example |
|-----------|------------|---------|
| React component files | `PascalCase.tsx` | `Canvas.tsx`, `ToolButton.tsx` |
| Service/utility files | `PascalCase.ts` | `GeometryService.ts`, `CanvasExporter.ts` |
| Type-definition files | `camelCase.ts` | `canvas.ts` |
| Test files | `<Subject>.test.ts(x)` in `__tests__/` | `GeometryService.test.ts` |
| Route files | `<resource>.routes.ts` | `auth.routes.ts` |
| Database files | `<resource>.model.ts` | `user.model.ts` |

---

## 4. Code Structure & Modularity

### 4.1 Single Responsibility Principle
Each class or module owns **exactly one** concern:

```
GeometryService   → coordinate math
UserColorService  → user → colour mapping
CanvasExporter    → serialising to PNG
ClipboardService  → clipboard I/O
CanvasEventBus    → typed event observation
```

### 4.2 Class Design

- Prefer `readonly` fields wherever possible.
- Use `private` for fields that are not part of the public API.
- Use `protected` only for fields that subclasses must access.
- Stateless utilities should expose only `static` methods and have no constructor.
- Stateful services are instantiated once by the caller (or provided via dependency injection).

```ts
// ✅ Stateless utility — no instance needed
export class GeometryService {
  static strokeHitsPoint(stroke: Stroke, pt: Point, radius: number): boolean { … }
}

// ✅ Stateful service — caller controls the lifetime
export class ClipboardService {
  copyText(text: string, onSuccess: () => void): void { … }
}
```

### 4.3 No Magic Numbers
Extract literals into named constants at the top of the module or in `types/canvas.ts`.

```ts
// ✅
const MIN_ERASER_RADIUS = 8;
const radius = Math.max(this.tool.width, MIN_ERASER_RADIUS);

// ❌
const radius = Math.max(this.tool.width, 8);
```

### 4.4 Imports
Imports are ordered:
1. Node built-ins
2. External packages
3. Internal absolute imports (`src/…`)
4. Relative imports

No unused imports. ESLint's `@typescript-eslint/no-unused-vars` rule is enabled.

---

## 5. TypeScript-Specific Rules

### 5.1 No `any`
`@typescript-eslint/no-explicit-any` is set to **error**.
Use `unknown` and narrow, or define a proper type.

```ts
// ✅
function parse(raw: unknown): ParsedData {
  if (!isValidData(raw)) throw new Error('Invalid');
  return raw as ParsedData;
}

// ❌
function parse(raw: any): any { … }
```

### 5.2 Return Types on Public API
All exported functions and public class methods must have explicit return types.

```ts
// ✅
export function generateId(): string { … }

// ❌
export function generateId() { … }
```

### 5.3 Prefer `interface` for Object Shapes, `type` for Unions
```ts
// ✅
interface Stroke { id: string; points: Point[]; … }
type DrawingToolType = 'pen' | 'eraser' | 'highlighter' | 'lasso' | 'text';

// ❌ — type alias for object shape when interface would do
type Stroke = { id: string; points: Point[]; … };
```

### 5.4 Prefer `const` Assertions for Fixed Arrays/Objects
```ts
// ✅
private static readonly COLORS = ['#e85d04', '#0d9488'] as const;

// ❌
private static readonly COLORS = ['#e85d04', '#0d9488'];
```

---

## 6. React Conventions

### 6.1 Component Structure (top-to-bottom order)
1. Imports
2. Type/interface definitions local to this file
3. Component function
   a. Hooks (`useState`, `useRef`, `useEffect`, …)
   b. Derived values
   c. Event handlers
   d. JSX return
4. Exported helper components (if any)

### 6.2 Props
- Define props as a named `interface` directly above the component.
- Destructure props in the function signature.

```tsx
// ✅
interface ToolButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function ToolButton({ label, active, onClick }: ToolButtonProps) { … }
```

### 6.3 Event Handlers
Inline arrow functions in JSX are allowed only for trivially simple callbacks.
Non-trivial logic must be extracted to a named handler above the return statement.

```tsx
// ✅ trivial inline
<button onClick={() => setOpen(true)}>Open</button>

// ✅ extracted handler
function handleMouseDown(e: React.MouseEvent) {
  const pt = GeometryService.getSvgCoords(e, svgRef.current!);
  if (!pt) return;
  startDrawing(pt);
}
<svg onMouseDown={handleMouseDown} />
```

---

## 7. Comments

- **No comments** that merely restate the code. Well-named identifiers speak for themselves.
- **Do add** a comment when the *why* is non-obvious: a hidden constraint, a subtle invariant,
  a browser quirk, or a design pattern decision.
- **Design pattern annotations** (see §9) are an exception — they explicitly name the pattern
  and explain the motivation.

```ts
// ✅ — explains a non-obvious invariant
// Strict less-than (<) so touching the boundary does NOT count as a hit.
return distance2 < radius2;

// ❌ — restates the code
// Check if distance is less than radius
return distance2 < radius2;
```

---

## 8. Testing Conventions

All tests live in `__tests__/` subdirectories next to the code they test.

| Rule | Detail |
|------|--------|
| File name | `<Subject>.test.ts` or `<Subject>.test.tsx` |
| Framework | Vitest + `@testing-library/react` (client), Vitest + Supertest (server) |
| Structure | `describe` → subject; `it` → concrete behaviour in plain English |
| Assertions | One logical assertion per `it` block where possible |
| Mocks | Use `vi.mock` / `vi.fn()` to inject mock objects; never hit a real DB or network |
| Data factories | Extract repeated test-data construction into named factory functions |

```ts
// ✅ — factory function, single assertion, descriptive name
function makeStroke(points: Point[]): Stroke { … }

it('returns true when a stroke point is within radius', () => {
  const stroke = makeStroke([{ x: 10, y: 10 }]);
  expect(GeometryService.strokeHitsPoint(stroke, { x: 10, y: 10 }, 5)).toBe(true);
});
```

Run all tests with: `npm test` (root), `npm test` (client or server individually).

---

## 9. Design Pattern Annotations

Whenever a design pattern is applied, annotate the class or method with a JSDoc block that:

1. Names the pattern (`DESIGN PATTERN: <Name>`)
2. Labels the roles (`Subject`, `Strategy`, `Factory`, `Observer`, etc.)
3. Gives a one-sentence motivation

```ts
/**
 * DESIGN PATTERN: Factory
 *   Centralises construction of DrawingToolHandler subclasses.
 *   Callers depend only on the abstract DrawingToolHandler type;
 *   new tools are registered here without touching any other file.
 */
export class ToolHandlerFactory { … }
```

---

## 10. Git Workflow

- Branch naming: `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`
- Commit messages: imperative mood, ≤72 characters on the first line
  (`Add lasso selection`, not `Added lasso selection` or `Adding lasso`)
- All commits must pass `npm run lint` and `npm test` before merge

---

*This document is the authoritative reference for all code written in this repository.
If an ESLint rule conflicts with guidance here, the ESLint rule takes precedence
(because it is mechanically enforced). File a discussion to update either the rule or
this document if a conflict is found.*
