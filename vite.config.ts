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
        // Vite 8 / rolldown only accepts manualChunks as a function.
        // The object form { pixi: ['pixi.js'] } worked under rollup but
        // throws "manualChunks is not a function" now.
        manualChunks(id: string) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
            return 'pixi';
          }
        },
      },
    },
  },
});
