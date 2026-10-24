#!/usr/bin/env node
/**
 * tools/perf.mjs —— 性能采样（规划案 §8「实测性能方法」）
 *
 *  - 1440×900 DPR1 与 375×812 DPR1，各 5 次新 context（无缓存）取中位数与最大值；
 *  - 交互时间：navigationStart → 三维可操作且 UI ready；
 *  - 稳定 30s 记录 FPS 中位值（high 桌面目标 ≥50fps，low ≥30fps）；
 *  - CLS：PerformanceObserver 收集 layout-shift（排除 hadRecentInput）求和 ≤ 0.1；
 *  - 交互反馈：click → 下一帧的间隔 ≤ 100ms。
 *
 * 用 **headful Chrome**（真实 Metal GPU）测量：无头 Chromium 是 SwiftShader 软渲染，
 * 帧率不代表真实硬件。
 *
 * 用法：node tools/perf.mjs --dist dist --out reports/perf.json
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const root = resolve(arg('--dist', 'dist'));
const outFile = resolve(arg('--out', 'reports/perf.json'));
const RUNS = Number(arg('--runs', '5'));
const FPS_SECONDS = Number(arg('--fps-seconds', '30'));

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let p = new URL(req.url, 'http://x').pathname;
      if (p.endsWith('/')) p += 'index.html';
      const body = await readFile(join(root, p));
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('nf');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}/` };
}

async function measureRun(browser, base, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    window.__clsEntries = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__cls += entry.value;
          window.__clsEntries.push({ value: entry.value, startTime: entry.startTime });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* 不支持 layout-shift 时按 0 计 */
    }
  });

  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.phase === 'ready', null, {
    timeout: 60000,
  });
  const readyMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? n.domContentLoadedEventEnd : 0;
  });
  const cls = await page.evaluate(() => window.__cls);

  // 交互反馈：点击时刻 → 下一帧
  const feedback = await page.evaluate(async () => {
    const canvas = document.getElementById('scene-canvas');
    const start = performance.now();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r()));
    return performance.now() - start;
  });

  await ctx.close();
  return { readyMs, domContentLoadedMs: nav, cls, feedbackMs: feedback };
}

async function measureFps(browser, base, viewport, seconds) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
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
  if (guide) await page.click('#guide-dialog .button--quiet');

  const samples = await page.evaluate(
    (sec) =>
      new Promise((resolve) => {
        const out = [];
        let frames = 0;
        let last = performance.now();
        const t0 = last;
        function tick(now) {
          frames += 1;
          if (now - last >= 1000) {
            out.push((frames * 1000) / (now - last));
            frames = 0;
            last = now;
          }
          if (now - t0 < sec * 1000) requestAnimationFrame(tick);
          else resolve(out);
        }
        requestAnimationFrame(tick);
      }),
    seconds,
  );
  await ctx.close();
  return samples;
}

async function main() {
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`✗ ${root}/index.html 不存在，先构建。`);
    process.exit(2);
  }
  const { server, base } = await startServer();
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });

  const viewports = [
    { name: 'desktop-1440x900', width: 1440, height: 900, target: 50 },
    { name: 'mobile-375x812', width: 375, height: 812, target: 30 },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    renderer: 'headful Chrome（真实 GPU）',
    runs: RUNS,
    fpsSeconds: FPS_SECONDS,
    viewports: [],
  };

  for (const vp of viewports) {
    console.log(`\n== ${vp.name} ==`);
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      const r = await measureRun(browser, base, { width: vp.width, height: vp.height });
      runs.push(r);
      console.log(
        `  第 ${i + 1} 次：可交互 ${r.readyMs} ms，CLS ${r.cls.toFixed(4)}，点击→下一帧 ${r.feedbackMs.toFixed(1)} ms`,
      );
    }
    const fps = await measureFps(browser, base, { width: vp.width, height: vp.height }, FPS_SECONDS);
    const readyList = runs.map((r) => r.readyMs);
    const clsList = runs.map((r) => r.cls);
    const fbList = runs.map((r) => r.feedbackMs);
    const entry = {
      viewport: vp.name,
      targetFps: vp.target,
      runs,
      readyMs: { median: median(readyList), max: Math.max(...readyList), values: readyList },
      cls: { median: median(clsList), max: Math.max(...clsList), values: clsList },
      feedbackMs: { median: median(fbList), max: Math.max(...fbList), values: fbList },
      fps: { median: median(fps), min: Math.min(...fps), samples: fps },
      pass: {
        interactive: median(readyList) <= 2500 && Math.max(...readyList) <= 2500,
        cls: Math.max(...clsList) <= 0.1,
        feedback: Math.max(...fbList) <= 100,
        fps: median(fps) >= vp.target,
      },
    };
    report.viewports.push(entry);
    console.log(
      `  中位可交互 ${entry.readyMs.median.toFixed(0)} ms（最大 ${entry.readyMs.max}）｜CLS 最大 ${entry.cls.max.toFixed(4)}｜点击反馈最大 ${entry.feedbackMs.max.toFixed(1)} ms｜FPS 中位 ${entry.fps.median.toFixed(1)}`,
    );
  }

  await browser.close();
  server.close();
  await writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n性能报告写入 ${outFile}`);
}

main().catch((e) => {
  console.error('性能采样失败：', e);
  process.exit(2);
});
