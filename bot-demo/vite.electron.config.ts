import { defineConfig } from 'vite';

// Electron build: output to dist/ with relative asset paths so
// the built files load correctly from the local filesystem.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
