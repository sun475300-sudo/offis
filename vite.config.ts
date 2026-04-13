import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Electron의 file:// 프로토콜에서 상대경로 사용
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: false, // Electron이 직접 열기 때문에 브라우저 자동열기 비활성화
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
        },
      },
    },
  },
});
