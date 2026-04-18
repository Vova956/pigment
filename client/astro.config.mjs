import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  server: {
    port: 3000
  },
  vite: {
    server: {
      proxy: {
        '/sessions': 'http://localhost:3001',
        '/auth': 'http://localhost:3001',
      }
    },
    optimizeDeps: {
      exclude: ['vitest', '@testing-library/react', '@testing-library/jest-dom'],
      // Don't scan test files for dependency discovery
      entries: [
        'src/**/*.{ts,tsx,astro}',
        '!src/**/__tests__/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/test/**',
      ],
    },
  }
});
