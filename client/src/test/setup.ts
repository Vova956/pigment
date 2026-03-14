import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Extend Vitest matchers
// import matchers from '@testing-library/jest-dom/matchers';
// expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
