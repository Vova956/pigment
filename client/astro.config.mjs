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
    }
  }
});
