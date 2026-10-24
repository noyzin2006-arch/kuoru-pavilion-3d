import { defineConfig } from 'vite';

/**
 * KRT-001 颐和园廓如亭实时三维数字复原
 *
 * 约束（来自规划案 §1 / §5）：
 *  - 成品页面运行时零外部请求：所有依赖本地打包，不引 CDN。
 *  - 相对 base，便于部署到任意静态托管子路径。
 */
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // 规划案 §5.5：未压缩 JS ≤ 1.5MiB；three 本体约 550KB，留出余量
    chunkSizeWarningLimit: 1600,
  },
});
