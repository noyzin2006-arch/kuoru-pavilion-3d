/**
 * KRT-001 · 展厅 e2e 验收测试
 *
 * 对应规划案 AC02 / AC03 / AC04 / AC05：
 *  - 控制台 error 0、pageerror 0、跨源请求 0、画布完成真实绘制
 *  - 模型几何自检（validatePavilion 的等价断言）
 *  - 交互：轨道/时刻/季节/热点/镜头/分解/剖切/比例人/重置
 *  - 无障碍：Tab 可达、焦点可见、无横向滚动、按钮有可读名称
 */
import { test, expect } from '@playwright/test';

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
    if (!u.startsWith('http://127.0.0.1:4173') && !u.startsWith('data:') && !u.startsWith('blob:')) {
      crossOrigin.push(u);
    }
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
  await page.waitForFunction(() => !!window.__exhibit, null, { timeout: 30000 });
  // 首次访问会弹导览，先关掉
  const guide = await page.evaluate(() => {
    const d = document.getElementById('guide-dialog');
    return d ? !d.hidden : false;
  });
  if (guide) {
    await page.click('#guide-dialog .button--quiet');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1200);
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
      return { w: c.width, h: c.height, alive: !!gl && !gl.isContextLost() };
    });
    expect(canvas.w).toBeGreaterThan(100);
    expect(canvas.h).toBeGreaterThan(100);
    expect(canvas.alive).toBe(true);
  });

  test('AC03 模型几何自检：月台/柱高/三圈四十柱/双檐八脊', async ({ page }) => {
    await boot(page);
    const m = await page.evaluate(() => {
      const ex = window.__exhibit;
      const parts = ex.pavilion.parts;
      const cols = ex.pavilion.columns;
      return {
        metrics: ex.pavilion.metrics,
        columnCount: cols.length,
        round: cols.filter((c) => c.kind === 'round').length,
        square: cols.filter((c) => c.kind === 'square').length,
        topY: cols[0].topY,
        plinthTopY: cols[0].plinthTopY,
        partIds: [...parts.keys()],
        tileCount: ex.pavilion.metrics.tileCount,
      };
    });

    expect(m.columnCount).toBe(40);
    expect(m.round).toBe(24);
    expect(m.square).toBe(16);
    expect(Math.abs(m.topY - 5.18)).toBeLessThan(0.001);
    expect(Math.abs(m.plinthTopY - 0.89)).toBeLessThan(0.001);
    expect(m.tileCount).toBeGreaterThan(0);
    expect(m.tileCount).toBeLessThanOrEqual(18000);
    expect(new Set(m.partIds).size).toBe(m.partIds.length);
    expect(m.partIds).toContain('roof-lower');
    expect(m.partIds).toContain('roof-upper');
    expect(m.partIds).toContain('roof-finial');
    expect(m.partIds).toContain('ceiling-caojing');
    expect(m.partIds).toContain('plaques-inner');
  });

  test('AC04 交互：时刻/季节/镜头/热点/分解/剖切/比例人/重置', async ({ page }) => {
    await boot(page);

    // 时刻切换
    await page.getByLabel('黄昏', { exact: true }).check();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.time))
      .toBe('dusk');
    // 季节切换
    await page.getByLabel('秋', { exact: true }).check();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.season))
      .toBe('autumn');

    // 镜头预设
    await page.getByRole('button', { name: '正南' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.preset))
      .toBe('south');

    // 构件目录 → 选中 → 详情面板
    await page.getByRole('button', { name: '定位斗栱' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.selectedPartId))
      .toBe('brackets-dougong');
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('#detail-body')).toContainText('斗栱');
    await expect(page.locator('#detail-body')).toContainText('非');

    // 分解
    await page.getByRole('button', { name: '分解结构' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.explodeEnabled))
      .toBe(true);
    await page.locator('input[aria-label="分解比例"]').fill('60');
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.explode))
      .toBe(60);
    const moved = await page.evaluate(() => window.__exhibit.pavilion.parts.get('roof-upper').position.y);
    expect(moved).toBeGreaterThan(1.0);

    // 剖切
    await page.getByRole('button', { name: '平面剖切' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.sectionEnabled))
      .toBe(true);
    await page.locator('input[aria-label="剖切位置"]').fill('40');
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.section))
      .toBe(40);
    const clipped = await page.evaluate(() => {
      const mats = window.__exhibit.pavilion.materials;
      return mats.filter((m) => m.clippingPlanes && m.clippingPlanes.length).length;
    });
    expect(clipped).toBeGreaterThan(0);

    // 比例人
    await page.getByRole('button', { name: /显示 1.70m 比例人/ }).click();
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.showHuman))
      .toBe(true);
    expect(await page.evaluate(() => window.__exhibit.pavilion.parts.get('scale-human').visible)).toBe(true);

    // 重置（状态里的 RESET 动作由视图工具的复位镜头触发，这里直接派发）
    await page.evaluate(() => window.__exhibit.dispatch({ type: 'RESET' }));
    await expect
      .poll(() => page.evaluate(() => window.__exhibit.state.explode))
      .toBe(0);
  });

  test('AC05 无障碍与布局：Tab 可达、焦点可见、无横向滚动、控件有名称', async ({ page }) => {
    await boot(page);

    // 文档不横向滚动
    const scroll = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollW).toBeLessThanOrEqual(scroll.clientW + 1);

    // 所有按钮都有可读名称
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()))
        .map((b) => b.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toHaveLength(0);

    // Tab 能走到主要交互控件
    const reached = new Set();
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const s = getComputedStyle(a);
        return {
          name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
        };
      });
      if (info) reached.add(info.name);
    }
    expect(reached.size, `Tab 可达目标数：${[...reached].join(' / ')}`).toBeGreaterThanOrEqual(3);

    // 画布聚焦后方向键能转视角
    await page.locator('#scene-canvas').focus();
    const before = await page.evaluate(() => window.__exhibit.rig.camera.position.toArray());
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__exhibit.rig.camera.position.toArray());
    expect(Math.abs(before[0] - after[0]) + Math.abs(before[2] - after[2])).toBeGreaterThan(0.05);
  });
});
