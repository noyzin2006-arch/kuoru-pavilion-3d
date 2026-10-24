/**
 * KRT-001 · Playwright 配置
 *
 * 规划案 AC02：在 375×812 与 1440×900 两个宽度实测 console error 0、pageerror 0、跨源请求 0。
 * 只在本地静态服务上跑，不需要网络。
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4191',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: false },
    },
  ],
  webServer: {
    command: 'node scripts/serve-static.mjs --root dist --port 4191',
    url: 'http://127.0.0.1:4191/',
    // 绝不复用已有服务：本机 4173 等端口可能被其它项目占用，复用会测到别人的应用
    reuseExistingServer: false,
    timeout: 30000,
  },
});
