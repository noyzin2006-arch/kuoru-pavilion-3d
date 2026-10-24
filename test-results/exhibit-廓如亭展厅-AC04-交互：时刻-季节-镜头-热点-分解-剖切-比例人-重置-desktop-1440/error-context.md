# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: exhibit.spec.js >> 廓如亭展厅 >> AC04 交互：时刻/季节/镜头/热点/分解/剖切/比例人/重置
- Location: e2e/exhibit.spec.js:114:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#detail-body')
Expected substring: "非"
Received string:    "木构斗栱置信度 H · 史料交叉核实结构作用：斗栱把檐口荷载一层层传到柱头，同时把屋檐挑出到柱网之外；它也是判定建筑等级与时代的重要标志。可观测依据：每根外檐柱头一组，柱间按间距另加，简化后共二十四主组，上檐另有八组。推断偏差：本复原采用三层简化斗栱并标注为 I 级，不冒充特定清式标准件；真实踩数与层数未查证。本页为程序化复原成果，不是文物测绘或激光扫描数据；尺寸依据公开史料与清式营造则例推算，与实测可能存在偏差，不应作为修缮或研究依据。资料来源：简报 H：斗栱上檐周围枋檩饰旋子大点金彩画；尺寸为规划案 §5.2 推算"
Timeout: 10000ms

Call log:
  - Expect "toContainText" locator('#detail-body') with timeout 10000ms
  - waiting for locator('#detail-body')
    24 × locator resolved to <div id="detail-body" class="detail-panel__body">…</div>
       - unexpected value "木构斗栱置信度 H · 史料交叉核实结构作用：斗栱把檐口荷载一层层传到柱头，同时把屋檐挑出到柱网之外；它也是判定建筑等级与时代的重要标志。可观测依据：每根外檐柱头一组，柱间按间距另加，简化后共二十四主组，上檐另有八组。推断偏差：本复原采用三层简化斗栱并标注为 I 级，不冒充特定清式标准件；真实踩数与层数未查证。本页为程序化复原成果，不是文物测绘或激光扫描数据；尺寸依据公开史料与清式营造则例推算，与实测可能存在偏差，不应作为修缮或研究依据。资料来源：简报 H：斗栱上檐周围枋檩饰旋子大点金彩画；尺寸为规划案 §5.2 推算"

```

```yaml
- paragraph: 木构
- heading "斗栱" [level=3]
- paragraph: 置信度 H · 史料交叉核实
- paragraph: 结构作用：斗栱把檐口荷载一层层传到柱头，同时把屋檐挑出到柱网之外；它也是判定建筑等级与时代的重要标志。 可观测依据：每根外檐柱头一组，柱间按间距另加，简化后共二十四主组，上檐另有八组。 推断偏差：本复原采用三层简化斗栱并标注为 I 级，不冒充特定清式标准件；真实踩数与层数未查证。 本页为程序化复原成果，不是文物测绘或激光扫描数据；尺寸依据公开史料与清式营造则例推算，与实测可能存在偏差，不应作为修缮或研究依据。
- paragraph: 资料来源：简报 H：斗栱上檐周围枋檩饰旋子大点金彩画；尺寸为规划案 §5.2 推算
```

# Test source

```ts
  41  |         cb(t);
  42  |       });
  43  |   });
  44  |   await page.goto('/');
  45  |   await page.waitForFunction(() => !!window.__exhibit, null, { timeout: 30000 });
  46  |   // 首次访问会弹导览，先关掉
  47  |   const guide = await page.evaluate(() => {
  48  |     const d = document.getElementById('guide-dialog');
  49  |     return d ? !d.hidden : false;
  50  |   });
  51  |   if (guide) {
  52  |     await page.click('#guide-dialog .button--quiet');
  53  |     await page.waitForTimeout(300);
  54  |   }
  55  |   await page.waitForTimeout(1200);
  56  | }
  57  | 
  58  | test.describe('廓如亭展厅', () => {
  59  |   test('AC02 加载无错误、无跨源请求、画布完成真实绘制', async ({ page }) => {
  60  |     const w = watch(page);
  61  |     await boot(page);
  62  | 
  63  |     expect(w.consoleErrors, `console error: ${w.consoleErrors.join(' | ')}`).toHaveLength(0);
  64  |     expect(w.pageErrors, `pageerror: ${w.pageErrors.join(' | ')}`).toHaveLength(0);
  65  |     expect(w.crossOrigin, `跨源请求: ${w.crossOrigin.join(' | ')}`).toHaveLength(0);
  66  |     expect(w.failed, `失败请求: ${w.failed.join(' | ')}`).toHaveLength(0);
  67  | 
  68  |     const paintCount = await page.evaluate(() => window.__paintCount);
  69  |     expect(paintCount, '画布至少完成两次真实绘制').toBeGreaterThan(2);
  70  | 
  71  |     const canvas = await page.evaluate(() => {
  72  |       const c = document.getElementById('scene-canvas');
  73  |       const gl = c.getContext('webgl2');
  74  |       return { w: c.width, h: c.height, alive: !!gl && !gl.isContextLost() };
  75  |     });
  76  |     expect(canvas.w).toBeGreaterThan(100);
  77  |     expect(canvas.h).toBeGreaterThan(100);
  78  |     expect(canvas.alive).toBe(true);
  79  |   });
  80  | 
  81  |   test('AC03 模型几何自检：月台/柱高/三圈四十柱/双檐八脊', async ({ page }) => {
  82  |     await boot(page);
  83  |     const m = await page.evaluate(() => {
  84  |       const ex = window.__exhibit;
  85  |       const parts = ex.pavilion.parts;
  86  |       const cols = ex.pavilion.columns;
  87  |       return {
  88  |         metrics: ex.pavilion.metrics,
  89  |         columnCount: cols.length,
  90  |         round: cols.filter((c) => c.kind === 'round').length,
  91  |         square: cols.filter((c) => c.kind === 'square').length,
  92  |         topY: cols[0].topY,
  93  |         plinthTopY: cols[0].plinthTopY,
  94  |         partIds: [...parts.keys()],
  95  |         tileCount: ex.pavilion.metrics.tileCount,
  96  |       };
  97  |     });
  98  | 
  99  |     expect(m.columnCount).toBe(40);
  100 |     expect(m.round).toBe(24);
  101 |     expect(m.square).toBe(16);
  102 |     expect(Math.abs(m.topY - 5.18)).toBeLessThan(0.001);
  103 |     expect(Math.abs(m.plinthTopY - 0.89)).toBeLessThan(0.001);
  104 |     expect(m.tileCount).toBeGreaterThan(0);
  105 |     expect(m.tileCount).toBeLessThanOrEqual(18000);
  106 |     expect(new Set(m.partIds).size).toBe(m.partIds.length);
  107 |     expect(m.partIds).toContain('roof-lower');
  108 |     expect(m.partIds).toContain('roof-upper');
  109 |     expect(m.partIds).toContain('roof-finial');
  110 |     expect(m.partIds).toContain('ceiling-caojing');
  111 |     expect(m.partIds).toContain('plaques-inner');
  112 |   });
  113 | 
  114 |   test('AC04 交互：时刻/季节/镜头/热点/分解/剖切/比例人/重置', async ({ page }) => {
  115 |     await boot(page);
  116 | 
  117 |     // 时刻切换
  118 |     await page.getByLabel('黄昏', { exact: true }).check();
  119 |     await expect
  120 |       .poll(() => page.evaluate(() => window.__exhibit.state.time))
  121 |       .toBe('dusk');
  122 |     // 季节切换
  123 |     await page.getByLabel('秋', { exact: true }).check();
  124 |     await expect
  125 |       .poll(() => page.evaluate(() => window.__exhibit.state.season))
  126 |       .toBe('autumn');
  127 | 
  128 |     // 镜头预设
  129 |     await page.getByRole('button', { name: '正南' }).click();
  130 |     await expect
  131 |       .poll(() => page.evaluate(() => window.__exhibit.state.preset))
  132 |       .toBe('south');
  133 | 
  134 |     // 构件目录 → 选中 → 详情面板
  135 |     await page.getByRole('button', { name: '定位斗栱' }).click();
  136 |     await expect
  137 |       .poll(() => page.evaluate(() => window.__exhibit.state.selectedPartId))
  138 |       .toBe('brackets-dougong');
  139 |     await expect(page.locator('#detail-panel')).toBeVisible();
  140 |     await expect(page.locator('#detail-body')).toContainText('斗栱');
> 141 |     await expect(page.locator('#detail-body')).toContainText('非');
      |                                                ^ Error: expect(locator).toContainText(expected) failed
  142 | 
  143 |     // 分解
  144 |     await page.getByRole('button', { name: '分解结构' }).click();
  145 |     await expect
  146 |       .poll(() => page.evaluate(() => window.__exhibit.state.explodeEnabled))
  147 |       .toBe(true);
  148 |     await page.locator('input[aria-label="分解比例"]').fill('60');
  149 |     await expect
  150 |       .poll(() => page.evaluate(() => window.__exhibit.state.explode))
  151 |       .toBe(60);
  152 |     const moved = await page.evaluate(() => window.__exhibit.pavilion.parts.get('roof-upper').position.y);
  153 |     expect(moved).toBeGreaterThan(1.0);
  154 | 
  155 |     // 剖切
  156 |     await page.getByRole('button', { name: '平面剖切' }).click();
  157 |     await expect
  158 |       .poll(() => page.evaluate(() => window.__exhibit.state.sectionEnabled))
  159 |       .toBe(true);
  160 |     await page.locator('input[aria-label="剖切位置"]').fill('40');
  161 |     await expect
  162 |       .poll(() => page.evaluate(() => window.__exhibit.state.section))
  163 |       .toBe(40);
  164 |     const clipped = await page.evaluate(() => {
  165 |       const mats = window.__exhibit.pavilion.materials;
  166 |       return mats.filter((m) => m.clippingPlanes && m.clippingPlanes.length).length;
  167 |     });
  168 |     expect(clipped).toBeGreaterThan(0);
  169 | 
  170 |     // 比例人
  171 |     await page.getByRole('button', { name: /显示 1.70m 比例人/ }).click();
  172 |     await expect
  173 |       .poll(() => page.evaluate(() => window.__exhibit.state.showHuman))
  174 |       .toBe(true);
  175 |     expect(await page.evaluate(() => window.__exhibit.pavilion.parts.get('scale-human').visible)).toBe(true);
  176 | 
  177 |     // 重置（状态里的 RESET 动作由视图工具的复位镜头触发，这里直接派发）
  178 |     await page.evaluate(() => window.__exhibit.dispatch({ type: 'RESET' }));
  179 |     await expect
  180 |       .poll(() => page.evaluate(() => window.__exhibit.state.explode))
  181 |       .toBe(0);
  182 |   });
  183 | 
  184 |   test('AC05 无障碍与布局：Tab 可达、焦点可见、无横向滚动、控件有名称', async ({ page }) => {
  185 |     await boot(page);
  186 | 
  187 |     // 文档不横向滚动
  188 |     const scroll = await page.evaluate(() => ({
  189 |       scrollW: document.documentElement.scrollWidth,
  190 |       clientW: document.documentElement.clientWidth,
  191 |     }));
  192 |     expect(scroll.scrollW).toBeLessThanOrEqual(scroll.clientW + 1);
  193 | 
  194 |     // 所有按钮都有可读名称
  195 |     const unnamed = await page.evaluate(() =>
  196 |       [...document.querySelectorAll('button')]
  197 |         .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()))
  198 |         .map((b) => b.outerHTML.slice(0, 80)),
  199 |     );
  200 |     expect(unnamed).toHaveLength(0);
  201 | 
  202 |     // Tab 能走到主要交互控件
  203 |     const reached = new Set();
  204 |     for (let i = 0; i < 25; i += 1) {
  205 |       await page.keyboard.press('Tab');
  206 |       const info = await page.evaluate(() => {
  207 |         const a = document.activeElement;
  208 |         if (!a || a === document.body) return null;
  209 |         const s = getComputedStyle(a);
  210 |         return {
  211 |           name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24),
  212 |           outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
  213 |         };
  214 |       });
  215 |       if (info) reached.add(info.name);
  216 |     }
  217 |     expect(reached.size, `Tab 可达目标数：${[...reached].join(' / ')}`).toBeGreaterThanOrEqual(3);
  218 | 
  219 |     // 画布聚焦后方向键能转视角
  220 |     await page.locator('#scene-canvas').focus();
  221 |     const before = await page.evaluate(() => window.__exhibit.rig.camera.position.toArray());
  222 |     await page.keyboard.press('ArrowLeft');
  223 |     await page.waitForTimeout(200);
  224 |     const after = await page.evaluate(() => window.__exhibit.rig.camera.position.toArray());
  225 |     expect(Math.abs(before[0] - after[0]) + Math.abs(before[2] - after[2])).toBeGreaterThan(0.05);
  226 |   });
  227 | });
  228 | 
```