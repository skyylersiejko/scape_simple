import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bot-demo/',
  build: {
    outDir: '../public/bot-demo',
    emptyOutDir: true,
  },
});
