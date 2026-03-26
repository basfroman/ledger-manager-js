import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
  },
});
