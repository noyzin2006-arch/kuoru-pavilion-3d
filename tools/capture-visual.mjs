#!/usr/bin/env node
/**
 * tools/capture-visual.mjs —— 视觉自检截图采集（策展/验收工具）
 *
 * 规划案 §8：至少按「春午正南、秋夕总览、冬夜、藻井内部、分解100%、剖切50%」截 6 张桌面图，
 * 375px 下至少 2 张（默认 + 详情），另保留 loading、空、强制 WebGL 失败三种 UI 截图。
 *
 * 用法：node tools/capture-visual.mjs --dist dist --out reports/visual
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const root = resolve(arg('--dist', 'dist'));
const outDir = resolve(arg('--out', 'reports/visual'));

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let p = new URL(req.url, 'http://x').pathname;
      if (p.endsWith('/')) p += 'index.html';
      const file = join(root, p);
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('nf');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}/` };
}

async function boot(page, base) {
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.phase === 'ready', null, {
    timeout: 60000,
  });
  // 导览在启动后 400ms 才弹出：先等它出现，再判断是否需要关闭
  await page.waitForTimeout(700);
  const guide = await page.evaluate(() => {
    const d = document.getElementById('guide-dialog');
    return d ? !d.hidden : false;
  });
  if (guide) {
    await page.click('#guide-dialog .button--quiet');
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700);
}

/** 用真实 UI 路径设置控件。 */
/**
 * 选中某个单选项。id 用的是**值键**（dawn/noon/... 与 spring/...），不是中文标签。
 * @param {import('@playwright/test').Page} page
 * @param {'时段'|'季节'} legend
 * @param {string} value 值键
 */
async function setRadio(page, legend, value) {
  await page.locator(`#radio-${legend}-${value}`).check();
  await page.waitForTimeout(900); // 等光照与 IBL 重建（防抖 300ms + 重建）
}
async function clickPreset(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page
    .waitForFunction(() => !window.__exhibit || !window.__exhibit.isAnimating(), null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

const shots = [];

async function shoot(page, outDir, name, note) {
  const file = join(outDir, `${name}.png`);
  // 回到页顶，保证画布在视口内；并等镜头过渡真正结束
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .waitForFunction(() => !window.__exhibit || !window.__exhibit.isAnimating(), null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(350);
  await page.screenshot({ path: file });
  shots.push({ name, note, file });
  console.log(`  ✓ ${name}.png —— ${note}`);
}

async function main() {
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`✗ ${root}/index.html 不存在，先构建。`);
    process.exit(2);
  }
  await mkdir(outDir, { recursive: true });
  const { server, base } = await startServer();
  // 用真实 GPU（headful Chrome）出图：无头是 SwiftShader 软渲染，观感与真机不一致
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });

  /* ---------------- 桌面 1440×900 ---------------- */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // loading 态：导航后立即截（在 ready 之前）
  await page.goto(base, { waitUntil: 'commit' });
  await page.waitForTimeout(700);
  await shoot(page, outDir, 'loading-desktop', '加载态：模型尚未建立时的界面');

  await boot(page, base);

  // 1) 春·午·正南
  await setRadio(page, '季节', 'spring');
  await setRadio(page, '时段', 'noon');
  await clickPreset(page, '正南');
  await shoot(page, outDir, '01-spring-noon-south', '春 · 正午 · 正南机位');

  // 2) 秋 · 黄昏 · 总览
  await setRadio(page, '季节', 'autumn');
  await setRadio(page, '时段', 'dusk');
  await clickPreset(page, '总览');
  await shoot(page, outDir, '02-autumn-dusk-overview', '秋 · 黄昏 · 总览');

  // 3) 冬 · 夜
  await setRadio(page, '季节', 'winter');
  await setRadio(page, '时段', 'night');
  await shoot(page, outDir, '03-winter-night', '冬 · 夜');

  // 4) 藻井内部
  await setRadio(page, '季节', 'spring');
  await setRadio(page, '时段', 'noon');
  await clickPreset(page, '藻井');
  await shoot(page, outDir, '04-caojing-interior', '藻井仰视机位');

  // 5) 分解 100%
  await clickPreset(page, '总览');
  await page.locator('input[aria-label="分解比例"]').fill('100');
  await page.waitForTimeout(900);
  await shoot(page, outDir, '05-explode-100', '分解 100%：屋面、枋梁、坐凳逐层拉开');

  // 6) 剖切 50%
  await page.locator('input[aria-label="分解比例"]').fill('0');
  await page.getByRole('button', { name: '平面剖切' }).click();
  await page.locator('input[aria-label="剖切位置"]').fill('50');
  await page.waitForTimeout(900);
  await shoot(page, outDir, '06-section-50', '剖切 50%：竖直剖面看内部柱网');

  // 空态：详情面板无选中
  await page.getByRole('button', { name: '平面剖切' }).click();
  await page.getByRole('button', { name: '分解结构' }).click();
  await clickPreset(page, '总览');
  await shoot(page, outDir, '07-empty-detail', '空态：详情面板未选中构件时的引导文案');

  await ctx.close();

  /* ---------------- 移动 375×812 ---------------- */
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mpage = await mctx.newPage();
  await boot(mpage, base);
  await shoot(mpage, outDir, '08-mobile-default', '375px 默认视图');

  await mpage.getByRole('button', { name: '定位藻井' }).click();
  await mpage.waitForTimeout(700);
  await shoot(mpage, outDir, '09-mobile-detail', '375px 构件详情（底部 sheet）');

  // 错误态：强制 WebGL 不可用
  const ectx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const epage = await ectx.newPage();
  await epage.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return orig.call(this, type, ...rest);
    };
  });
  await epage.goto(base, { waitUntil: 'load' });
  await epage.waitForTimeout(1500);
  await shoot(epage, outDir, '10-error-webgl-unavailable', '错误态：WebGL2 不可用时的文字结构说明');

  await browser.close();
  server.close();

  await writeFile(
    join(outDir, 'shots.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), base, shots }, null, 2),
    'utf8',
  );
  console.log(`\n共 ${shots.length} 张截图写入 ${outDir}`);
}

main().catch((e) => {
  console.error('截图采集失败：', e);
  process.exit(2);
});
