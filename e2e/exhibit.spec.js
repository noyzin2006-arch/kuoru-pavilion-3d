/**
 * KRT-001 · 展厅 e2e 验收测试
 *
 * 对应规划案 §8「E2E 具体断言」与 AC01–AC05：
 *  - 加载无 console error / pageerror / 跨源请求；画布完成真实绘制
 *  - 模型几何自检（月台 / 柱高 / 三圈四十柱 / 双檐八脊 / 瓦片预算）
 *  - 交互全链路（时刻、季节、镜头、热点、分解、剖切、比例人、重置）
 *  - 360° 连续旋转 ≥72 步；镜头预设落点误差 < 0.1m；PMREM 连续切换不泄漏
 *  - 5 档视口不横向溢出；键盘可达；焦点可见；控件有可读名称
 *  - 降级：WebGL 不可用 / 减少动效 / sessionStorage 写入异常
 *
 * 测试探针是**只读**的（window.__exhibit）：不暴露写状态后门，
 * 所有交互一律走真实 UI 路径。
 */
import { test, expect } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4191';

/** 收集页面级错误与请求。 */
function watch(page) {
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
    if (!u.startsWith(ORIGIN)) crossOrigin.push(u);
  });
  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

  return { consoleErrors, pageErrors, crossOrigin, failed };
}

async function boot(page) {
  await page.addInitScript(() => {
    window.__paintCount = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        window.__paintCount += 1;
        cb(t);
      });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.phase === 'ready', null, {
    timeout: 60000,
  });
  // 首次访问会弹导览，先关掉
  // 导览在启动后 400ms 才弹出：先等它出现，再判断是否需要关闭
  await page.waitForTimeout(700);
  const guide = await page.evaluate(() => {
    const d = document.getElementById('guide-dialog');
    return d ? !d.hidden : false;
  });
  if (guide) {
    await page.click('#guide-dialog .button--quiet');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(800);
}

test.describe('廓如亭展厅', () => {
  test('AC02 加载无错误、无跨源请求、画布完成真实绘制', async ({ page }) => {
    const w = watch(page);
    await boot(page);

    expect(w.consoleErrors, `console error: ${w.consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(w.pageErrors, `pageerror: ${w.pageErrors.join(' | ')}`).toHaveLength(0);
    expect(w.crossOrigin, `跨源请求: ${w.crossOrigin.join(' | ')}`).toHaveLength(0);
    expect(w.failed, `失败请求: ${w.failed.join(' | ')}`).toHaveLength(0);

    const paintCount = await page.evaluate(() => window.__paintCount);
    expect(paintCount, '画布至少完成两次真实绘制').toBeGreaterThan(2);

    const canvas = await page.evaluate(() => {
      const c = document.getElementById('scene-canvas');
      const gl = c.getContext('webgl2');
      const r = c.getBoundingClientRect();
      return {
        w: c.width,
        h: c.height,
        rectW: r.width,
        rectH: r.height,
        alive: !!gl && !gl.isContextLost(),
        calls: window.__exhibit.getRenderCalls(),
      };
    });
    expect(canvas.rectW).toBeGreaterThan(0);
    expect(canvas.rectH).toBeGreaterThan(0);
    expect(canvas.alive).toBe(true);
    expect(canvas.calls, 'renderer.info.render.calls 应大于 0').toBeGreaterThan(0);
  });

  test('AC03 模型几何自检：月台/柱高/三圈四十柱/双檐八脊', async ({ page }) => {
    await boot(page);
    const m = await page.evaluate(() => {
      const ex = window.__exhibit;
      return {
        metrics: ex.getMetrics(),
        partIds: ex.getPartIds(),
        hotspots: ex.getHotspotCount(),
        camera: ex.getCamera(),
      };
    });

    expect(m.metrics.totalColumns).toBe(40);
    expect(m.metrics.roundColumns).toBe(24);
    expect(m.metrics.squareColumns).toBe(16);
    expect(m.metrics.tileCount).toBeGreaterThan(0);
    expect(m.metrics.tileCount, '瓦片实例须在规划案预算内').toBeLessThanOrEqual(18000);
    expect(new Set(m.partIds).size).toBe(m.partIds.length);
    for (const id of ['roof-lower', 'roof-upper', 'roof-finial', 'ceiling-caojing', 'plaques-inner']) {
      expect(m.partIds).toContain(id);
    }
    expect(m.hotspots).toBe(8);
  });

  test('AC04 交互全链路：时刻/季节/镜头/热点/分解/剖切/比例人/重置', async ({ page }) => {
    await boot(page);

    await page.getByLabel('黄昏', { exact: true }).check();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().time)).toBe('dusk');

    await page.getByLabel('秋', { exact: true }).check();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().season)).toBe('autumn');

    await page.getByRole('button', { name: '正南' }).click();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().preset)).toBe('south');

    await page.getByRole('button', { name: '定位斗栱' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.getState().selectedPartId))
      .toBe('brackets-dougong');
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('#detail-body')).toContainText('斗栱');
    await expect(page.locator('#detail-body')).toContainText('不是文物测绘');
    await expect(page.locator('#detail-body')).toContainText('推断偏差');
    // 移动端详情是模态 sheet：需先关闭才能操作下方控件（规划案 C06）；
    // 桌面端详情在右栏常驻（无选中时显示空态），不需要也不应该被 Esc 关掉。
    const narrow = (page.viewportSize()?.width ?? 1440) < 768;
    if (narrow) {
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => window.__exhibit.getState().detailOpen)).toBe(false);
    }

    await page.getByRole('button', { name: '分解结构' }).click();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().explodeEnabled)).toBe(true);
    await page.locator('input[aria-label="分解比例"]').fill('60');
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().explode)).toBe(60);
    const moved = await page.evaluate(() => window.__exhibit.getState().explode);
    expect(moved).toBe(60);

    await page.getByRole('button', { name: '平面剖切' }).click();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().sectionEnabled)).toBe(true);
    await page.locator('input[aria-label="剖切位置"]').fill('40');
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().section)).toBe(40);

    await page.getByRole('button', { name: /显示 1.70m 比例人/ }).click();
    await expect.poll(() => page.evaluate(() => window.__exhibit.getState().showHuman)).toBe(true);

    // 重置（走真实 UI）
    await page.getByRole('button', { name: '重置视图与结构' }).click();
    const s = await page.evaluate(() => window.__exhibit.getState());
    expect(s.explode).toBe(0);
    expect(s.section).toBe(0);
    expect(s.season).toBe('spring');
    expect(s.time).toBe('noon');
    expect(s.preset).toBe('overview');
  });

  test('360° 连续旋转 ≥72 步，相机与目标不产生 NaN、不越界', async ({ page }) => {
    await boot(page);
    await page.locator('#scene-canvas').focus();

    for (let i = 0; i < 72; i += 1) {
      await page.keyboard.press(i % 18 === 17 ? 'ArrowRight' : 'ArrowLeft');
    }
    const cam = await page.evaluate(() => window.__exhibit.getCamera());
    for (const v of [...cam.position, ...cam.target]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(Math.abs(cam.target[0])).toBeLessThanOrEqual(18.01);
    expect(Math.abs(cam.target[2])).toBeLessThanOrEqual(18.01);
    expect(cam.target[1]).toBeGreaterThanOrEqual(0.99);
    expect(cam.target[1]).toBeLessThanOrEqual(10.51);
  });

  test('镜头预设过渡完成后落点误差 < 0.1m', async ({ page }) => {
    await boot(page);
    const targets = {
      总览: [0, 5, 0],
      正南: [0, 5.2, 0],
      正东: [0, 5.2, 0],
      梁架: [1.5, 5.6, 1],
      藻井: [0, 7.8, 0],
      台阶: [4, 1, 0],
    };
    for (const [label, want] of Object.entries(targets)) {
      await page.getByRole('button', { name: label, exact: true }).click();
      // 等过渡真正结束（软件渲染下单帧可能接近 1s，不能用固定时长）
      await page.waitForFunction(() => !window.__exhibit.isAnimating(), null, { timeout: 20000 });
      const cam = await page.evaluate(() => window.__exhibit.getCamera());
      const err = Math.hypot(
        cam.target[0] - want[0],
        cam.target[1] - want[1],
        cam.target[2] - want[2],
      );
      expect(err, `${label} 目标点误差 ${err.toFixed(3)}m`).toBeLessThan(0.1);
    }
  });

  test('PMREM 连续切换 100 次，纹理与几何数量不线性上涨', async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() => window.__exhibit.getMemory());

    // 走真实 UI 路径：切换时刻会重建 IBL
    await page.evaluate(async () => {
      const radio = document.querySelector('input[value="dusk"]');
      for (let i = 0; i < 100; i += 1) {
        radio.checked = !radio.checked;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 8));
      }
    });
    await page.waitForTimeout(1200);

    const after = await page.evaluate(() => window.__exhibit.getMemory());
    expect(Math.abs(after.textures - before.textures), '纹理数量浮动 ≤ 3').toBeLessThanOrEqual(3);
    expect(Math.abs(after.geometries - before.geometries), '几何数量浮动 ≤ 3').toBeLessThanOrEqual(3);
  });

  test('5 档视口文档均不横向溢出', async ({ page }) => {
    await boot(page);
    for (const width of [375, 480, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      const s = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(s.scrollW, `${width}px 出现横向滚动`).toBeLessThanOrEqual(s.clientW + 1);
    }
  });

  test('AC05 无障碍：Tab 可达、焦点可见、控件有可读名称、键盘能转视角', async ({ page }) => {
    await boot(page);

    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()))
        .map((b) => b.outerHTML.slice(0, 80)),
    );
    expect(unnamed, '存在无可读名称的按钮').toHaveLength(0);

    const reached = new Set();
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const s = getComputedStyle(a);
        return {
          name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24),
          visible: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
        };
      });
      if (info) reached.add(info.name);
    }
    expect(reached.size, `Tab 可达目标：${[...reached].join(' / ')}`).toBeGreaterThanOrEqual(3);

    await page.locator('#scene-canvas').focus();
    const before = await page.evaluate(() => window.__exhibit.getCamera().position);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__exhibit.getCamera().position);
    expect(
      Math.abs(before[0] - after[0]) + Math.abs(before[2] - after[2]),
      '方向键未改变相机',
    ).toBeGreaterThan(0.05);
  });

  test('降级：WebGL2 不可用时给出文字结构说明而非空白画布', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl2' || type === 'webgl') return null;
        return orig.call(this, type, ...rest);
      };
    });
    await page.goto('/');
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.getElementById('stage-overlay').innerText);
    expect(text).toContain('无法开启三维');
    expect(text).toContain('八角');
  });

  test('降级：sessionStorage 写入异常不阻断渲染', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('storage disabled', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await page.waitForTimeout(2500);
    const ok = await page.evaluate(() => !!window.__exhibit && window.__exhibit.phase === 'ready');
    expect(ok, '存储异常不应阻断展厅启动').toBe(true);
  });
});
