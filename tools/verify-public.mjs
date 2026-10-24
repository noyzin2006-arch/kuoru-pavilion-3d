#!/usr/bin/env node
/**
 * tools/verify-public.mjs —— 公开 URL 的匿名只读冒烟（规划案 §8/§9）
 *
 * 用**全新无登录 context**（无 Cookie、无 localStorage）直接访问公开 URL，确认：
 *   1. HTTP 200，页面标题正确
 *   2. 三维模型确实渲染（画布有绘制、renderer 有 draw call、WebGL 上下文存活）
 *   3. 可以拖拽旋转（相机矩阵变化）
 *   4. console error 0、pageerror 0、跨源请求 0
 *   5. 截图留档
 *
 * 用法：node tools/verify-public.mjs --url <公开URL> --out reports/public
 */

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg('--url', '');
const outDir = resolve(arg('--out', 'reports/public'));
if (!url) {
  console.error('用法: node tools/verify-public.mjs --url <公开URL> [--out reports/public]');
  process.exit(2);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false, channel: 'chrome' });
// 全新 context：无 Cookie、无 localStorage，等同匿名访问
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
const crossOrigin = [];
const failed = [];

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith('data:') || u.startsWith('blob:')) return;
  if (!u.startsWith(url)) crossOrigin.push(u);
});
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

const response = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
const status = response ? response.status() : 0;
const title = await page.title();

await page.waitForFunction(() => window.__exhibit && window.__exhibit.phase === 'ready', null, {
  timeout: 60000,
});
// 关掉首次导览
await page.waitForTimeout(700);
const guideOpen = await page.evaluate(() => {
  const d = document.getElementById('guide-dialog');
  return d ? !d.hidden : false;
});
if (guideOpen) {
  await page.click('#guide-dialog .button--quiet');
  await page.waitForTimeout(400);
}
await page.waitForTimeout(800);

const before = await page.evaluate(() => window.__exhibit.getCamera().position);
// 真实拖拽：按住画布左键拖 120px
const box = await page.locator('#scene-canvas').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(600);
const after = await page.evaluate(() => window.__exhibit.getCamera().position);

const probe = await page.evaluate(() => {
  const c = document.getElementById('scene-canvas');
  const gl = c.getContext('webgl2');
  return {
    renderCalls: window.__exhibit.getRenderCalls(),
    glAlive: !!gl && !gl.isContextLost(),
    canvasW: c.width,
    canvasH: c.height,
    hotspots: window.__exhibit.getHotspotCount(),
    parts: window.__exhibit.getPartIds().length,
  };
});

const shot = `${outDir}/public-url.png`;
await page.screenshot({ path: shot });

const moved =
  Math.abs(before[0] - after[0]) + Math.abs(before[1] - after[1]) + Math.abs(before[2] - after[2]);

const checks = [
  ['HTTP 200', status === 200, `状态 ${status}`],
  ['标题正确', title.includes('廓如亭'), title],
  ['三维已就绪', probe.renderCalls > 0, `draw calls ${probe.renderCalls}`],
  ['WebGL 上下文存活', probe.glAlive, `${probe.canvasW}×${probe.canvasH}`],
  ['可拖拽旋转', moved > 0.05, `相机位移 ${moved.toFixed(3)}`],
  ['构件热点齐备', probe.hotspots === 8, `${probe.hotspots} 个热点 / ${probe.parts} 个构件组`],
  ['console error = 0', consoleErrors.length === 0, consoleErrors.join(' | ')],
  ['pageerror = 0', pageErrors.length === 0, pageErrors.join(' | ')],
  ['跨源请求 = 0', crossOrigin.length === 0, crossOrigin.join(' | ')],
  ['失败请求 = 0', failed.length === 0, failed.join(' | ')],
];

console.log(`\n匿名访问 ${url}`);
console.log(`检查时间：${new Date().toISOString()}\n`);
let failedCount = 0;
for (const [name, ok, detail] of checks) {
  if (!ok) failedCount += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name} —— ${detail}`);
}
console.log(`\n截图：${shot}`);
console.log(failedCount === 0 ? '✓ 公开 URL 匿名实测全部通过' : `✗ ${failedCount} 项未通过`);

await browser.close();
process.exit(failedCount === 0 ? 0 : 1);
