# Testing Guide

This document outlines the testing strategy and setup for the Pigment collaborative painting application.

## Test Structure

### Client Tests (`/client`)
- **Framework**: Vitest + React Testing Library
- **Test Location**: `client/src/**/__tests__/` or `client/src/**/*.test.tsx`
- **Config**: `client/vitest.config.ts`

### Server Tests (`/server`)
- **Framework**: Vitest
- **Test Location**: `server/src/**/__tests__/` or `server/src/**/*.test.ts`
- **Config**: `server/vitest.config.ts`

## Getting Started

### Install Test Dependencies

#### Client
```bash
cd client
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

#### Server
```bash
cd server
npm install --save-dev vitest @vitest/ui
```

### Add Test Scripts

#### Client (`client/package.json`)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### Server (`server/package.json`)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Categories

### 1. Unit Tests
Test individual functions and components in isolation.

**Client Examples:**
- Component rendering
- State management
- Utility functions
- Canvas drawing functions

**Server Examples:**
- WebSocket message handlers
- Configuration loading
- Data validation
- Business logic

### 2. Integration Tests
Test how different parts work together.

**Examples:**
- Client-server communication
- WebSocket message flow
- Multiple client interactions
- Canvas state synchronization

### 3. E2E Tests (Future)
Full application flow tests using Playwright or Cypress.

**Examples:**
- User joins a painting session
- Drawing synchronization between clients
- Connection recovery

## Running Tests

### Local Development
```bash
# Run all tests (root)
npm test

# Client tests only
cd client && npm test

# Server tests only
cd server && npm test

# With coverage
npm run test:coverage

# With UI
npm run test:ui
```

### CI/CD
Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

See `.github/workflows/ci.yml` for the CI configuration.

## Test Patterns

### Client Component Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders with correct props', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeDefined();
  });

  it('handles user interaction', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // Assert expected behavior
  });
});
```

### Server WebSocket Test Example
```typescript
import { describe, it, expect } from 'vitest';
import WebSocket from 'ws';

describe('WebSocket Server', () => {
  it('broadcasts messages to all clients', async () => {
    // Setup multiple mock clients
    // Send message from one client
    // Verify all clients receive the message
  });
});
```

## Coverage Goals
- **Target Coverage**: 80%+ for critical paths
- **Unit Tests**: 90%+ coverage
- **Integration Tests**: Key user flows
- **E2E Tests**: Critical business scenarios

## TODO
- [ ] Install test dependencies for client
- [ ] Install test dependencies for server
- [ ] Write unit tests for existing components
- [ ] Write WebSocket server tests
- [ ] Set up E2E testing framework
- [ ] Add test coverage reporting to CI
- [ ] Set up visual regression testing (optional)
