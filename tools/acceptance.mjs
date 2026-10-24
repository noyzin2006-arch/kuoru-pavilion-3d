#!/usr/bin/env node
/**
 * tools/acceptance.mjs —— 本机验收探针（策展资产）
 *
 * 目的：把「页面能不能用」变成**可复现的数值证据**，而不是「看起来没问题」。
 * 覆盖 design-quality-bar.md 的 F（交付前自检）与验收要求里的：
 *   - 控制台 error 0、pageerror 0
 *   - 外部网络请求 0（依赖全部本地打包）
 *   - WebGL 上下文存活、canvas 有实际渲染尺寸
 *   - 375 / 1440 两个宽度下无破版、无横向滚动（画布区除外）
 *   - 键盘可达（Tab 能走到主要交互元素）
 *
 * 用法：
 *   node tools/acceptance.mjs --dist dist --out reports/acceptance
 *   node tools/acceptance.mjs --dist dist --out reports/acceptance --url http://127.0.0.1:4173/
 *
 * 退出码：0 = 全部硬指标通过；1 = 有硬指标失败；2 = 用法/环境错误。
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

/* ---------------------------------------------------------------- playwright 解析
 * 优先用项目里的 node_modules；没有就退回本机 npx 缓存里的 playwright。
 * 目的是让本工具在「依赖还没装」时也能先跑起来做环境探测。
 */
function resolvePlaywright() {
  const candidates = [];
  try {
    candidates.push(require.resolve('playwright'));
  } catch { /* 项目还没装依赖 */ }
  const npxRoot = join(process.env.HOME || '', '.npm', '_npx');
  if (existsSync(npxRoot)) {
    for (const dir of require('node:fs').readdirSync(npxRoot)) {
      const p = join(npxRoot, dir, 'node_modules', 'playwright');
      if (existsSync(p)) candidates.push(p);
    }
  }
  for (const c of candidates) {
    try {
      const mod = require(c);
      if (mod && mod.chromium) return mod;
    } catch { /* 试下一个 */ }
  }
  throw new Error('找不到 playwright：先 npm i -D @playwright/test，或确保 ~/.npm/_npx 里有缓存');
}

/* ---------------------------------------------------------------- 静态服务器 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
};

function startServer(root) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(root, p);
      if (!file.startsWith(resolve(root))) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
    }
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      ok({ server, port: server.address().port });
    });
  });
}

/* ---------------------------------------------------------------- 主流程 */
function parseArgs(argv) {
  const out = { dist: 'dist', out: 'reports/acceptance', widths: [375, 1440], headed: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dist') out.dist = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--widths') out.widths = argv[++i].split(',').map((s) => parseInt(s, 10));
    else if (a === '--headed') out.headed = true;
    else if (a === '--url') out.url = argv[++i];
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv);
  const { chromium } = resolvePlaywright();
  const root = resolve(opts.dist);
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`✗ ${root}/index.html 不存在 —— 先构建产物。`);
    process.exit(2);
  }
  await mkdir(opts.out, { recursive: true });

  let base = opts.url;
  let server = null;
  if (!base) {
    const s = await startServer(root);
    server = s.server;
    base = `http://127.0.0.1:${s.port}/`;
    console.log(`本地静态服务：${base}（根目录 ${root}）`);
  }

  const browser = await chromium.launch({ headless: !opts.headed, channel: opts.headed ? 'chrome' : undefined });
  const results = { base, widths: [], checks: [] };
  let hardFailures = 0;

  for (const width of opts.widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const externalRequests = [];
    const failedRequests = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:')) {
        externalRequests.push(`${r.method()} ${u.slice(0, 200)}`);
      }
    });
    page.on('requestfailed', (r) => {
      failedRequests.push(`${r.method()} ${r.url().slice(0, 200)} :: ${r.failure()?.errorText ?? 'unknown'}`);
    });

    await page.goto(base, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2500); // 给首屏渲染/动画留时间

    // 首次访问会弹出导览对话框（焦点陷阱），先关掉再测键盘可达性
    const guideOpen = await page.evaluate(() => {
      const d = document.getElementById('guide-dialog');
      return d ? !d.hidden : false;
    });
    if (guideOpen) {
      await page.click('#guide-dialog .button--quiet').catch(() => {});
      await page.waitForTimeout(400);
    }

    const dom = await page.evaluate(() => {
      const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
        w: c.width, h: c.height,
        cssW: Math.round(c.getBoundingClientRect().width),
        cssH: Math.round(c.getBoundingClientRect().height),
      }));
      const de = document.documentElement;
      const webgl = canvases.map((c) => {
        const el = document.querySelector('canvas');
        if (!el) return null;
        const gl = el.getContext('webgl2') || el.getContext('webgl');
        return gl ? !gl.isContextLost() : false;
      });
      return {
        title: document.title,
        lang: document.documentElement.lang || null,
        canvases,
        webglAlive: webgl.filter((x) => x !== null),
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        hasHorizontalScroll: de.scrollWidth > de.clientWidth + 1,
        h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).slice(0, 3),
        buttons: document.querySelectorAll('button').length,
        buttonsWithoutName: [...document.querySelectorAll('button')]
          .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim())).length,
        imagesWithoutAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
        focusableCount: document.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ).length,
      };
    });

    // 键盘可达：Tab 20 次，记录是否走到多个可聚焦元素
    await page.keyboard.press('Tab');
    const tabbed = new Set();
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      const el = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const s = getComputedStyle(a);
        return {
          tag: a.tagName,
          name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          boxShadow: s.boxShadow !== 'none',
        };
      });
      if (el) tabbed.add(el.tag + ':' + el.name);
    }
    const focusVisible = [...tabbed].length > 0;

    const shot = join(opts.out, `viewport-${width}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const w = {
      width,
      title: dom.title,
      lang: dom.lang,
      canvases: dom.canvases,
      webglAlive: dom.webglAlive,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: consoleErrors.slice(0, 10),
      pageErrorCount: pageErrors.length,
      pageErrors: pageErrors.slice(0, 10),
      externalRequestCount: externalRequests.length,
      externalRequests: externalRequests.slice(0, 10),
      failedRequestCount: failedRequests.length,
      failedRequests: failedRequests.slice(0, 10),
      horizontalScroll: dom.hasHorizontalScroll,
      scrollW: dom.scrollW,
      clientW: dom.clientW,
      buttons: dom.buttons,
      buttonsWithoutName: dom.buttonsWithoutName,
      imagesWithoutAlt: dom.imagesWithoutAlt,
      focusableCount: dom.focusableCount,
      tabDistinctTargets: tabbed.size,
      screenshot: shot,
    };
    results.widths.push(w);

    const fails = [];
    if (w.consoleErrorCount > 0) fails.push(`console error ${w.consoleErrorCount} 条`);
    if (w.pageErrorCount > 0) fails.push(`pageerror ${w.pageErrorCount} 条`);
    if (w.externalRequestCount > 0) fails.push(`外部请求 ${w.externalRequestCount} 条`);
    if (w.failedRequestCount > 0) fails.push(`请求失败 ${w.failedRequestCount} 条`);
    if (w.horizontalScroll) fails.push(`出现横向滚动（scrollW ${w.scrollW} > clientW ${w.clientW}）`);
    if (w.webglAlive.length && !w.webglAlive.every(Boolean)) fails.push('WebGL 上下文已丢失');
    if (!w.canvases.length) fails.push('页面没有 canvas');
    if (w.buttonsWithoutName > 0) fails.push(`${w.buttonsWithoutName} 个按钮无可读名称`);
    if (w.imagesWithoutAlt > 0) fails.push(`${w.imagesWithoutAlt} 张图片缺 alt`);
    if (w.tabDistinctTargets < 3) fails.push(`Tab 可达目标过少（${w.tabDistinctTargets}）`);

    hardFailures += fails.length;
    results.checks.push({ width, pass: fails.length === 0, failures: fails });
    console.log(`\n[${width}px] ${fails.length === 0 ? '✓ 通过' : '✗ 失败: ' + fails.join('；')}`);
    console.log(`   console error ${w.consoleErrorCount} / pageerror ${w.pageErrorCount} / 外部请求 ${w.externalRequestCount} / 失败请求 ${w.failedRequestCount}`);
    console.log(`   canvas ${JSON.stringify(w.canvases)}  横向滚动 ${w.horizontalScroll}  Tab 目标 ${w.tabDistinctTargets}`);

    await ctx.close();
  }

  await browser.close();
  if (server) server.close();

  const summaryPath = join(opts.out, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n汇总写入 ${summaryPath}`);
  console.log(hardFailures === 0 ? '✓ 硬指标全部通过' : `✗ 硬指标失败 ${hardFailures} 项`);
  process.exit(hardFailures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('验收探针异常：', e);
  process.exit(2);
});
