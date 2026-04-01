import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pixi': ['pixi.js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
