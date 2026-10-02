import { defineConfig } from 'vite';

const publicBackend =
  (process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/').replace(/\/$/, '');

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: publicBackend,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
