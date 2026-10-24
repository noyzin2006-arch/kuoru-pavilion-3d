# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: exhibit.spec.js >> 廓如亭展厅 >> AC02 加载无错误、无跨源请求、画布完成真实绘制
- Location: e2e/exhibit.spec.js:59:3

# Error details

```
Error: 跨源请求: http://127.0.0.1:4191/ | http://127.0.0.1:4191/assets/index-Bcv-9v7l.js | http://127.0.0.1:4191/assets/index-oln0QoyY.css

expect(received).toHaveLength(expected)

Expected length: 0
Received length: 3
Received array:  ["http://127.0.0.1:4191/", "http://127.0.0.1:4191/assets/index-Bcv-9v7l.js", "http://127.0.0.1:4191/assets/index-oln0QoyY.css"]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "跳到三维场景" [ref=e2] [cursor=pointer]:
    - /url: "#scene-region"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - heading "廓如亭 · 结构复原" [level=1] [ref=e5]
      - paragraph [ref=e6]: 颐和园实时三维数字复原 / 非激光扫描
    - button "打开使用帮助与导览" [ref=e8] [cursor=pointer]
  - main [ref=e12]:
    - complementary [ref=e13]:
      - heading "复原依据" [level=2] [ref=e14]
      - paragraph [ref=e15]: 本页面为程序化复原，非文物测绘或激光扫描成果。标注分为 H（史料交叉核实）、I（依营造则例推算）、 S（示意性构图）三级。
      - group [ref=e16]:
        - generic "资料来源与口径" [ref=e17] [cursor=pointer]
    - region "廓如亭三维场景" [ref=e18]:
      - generic [ref=e19]:
        - generic "廓如亭三维场景，可用方向键旋转、加减号缩放" [ref=e20]
        - generic:
          - button "查看重檐八脊攒尖顶" [ref=e21] [cursor=pointer]: 重檐八脊攒…
          - button "查看斗栱" [ref=e22] [cursor=pointer]: 斗栱
          - button "查看旋子大点金彩画" [ref=e23] [cursor=pointer]: 旋子大点金…
          - button "查看藻井" [ref=e24] [cursor=pointer]: 藻井
          - button "查看亭内八块木匾" [ref=e25] [cursor=pointer]: 亭内八块木匾
          - button "查看内外三圈四十柱" [ref=e26] [cursor=pointer]: 内外三圈四…
          - button "查看八方月台与宇墙" [ref=e27] [cursor=pointer]: 八方月台与…
          - button "查看圆宝顶与十六吻兽" [ref=e28] [cursor=pointer]: 圆宝顶与十…
        - group "视角工具" [ref=e29]:
          - group "视角工具" [ref=e30]:
            - button "左转" [ref=e31] [cursor=pointer]
            - button "右转" [ref=e35] [cursor=pointer]
            - button "放大" [ref=e39] [cursor=pointer]
            - button "缩小" [ref=e43] [cursor=pointer]
            - button "复位" [ref=e47] [cursor=pointer]
        - status [ref=e51]: 廓如亭模型就绪，拖动旋转、滚轮缩放
    - complementary [ref=e52]:
      - heading "场景控制" [level=2] [ref=e53]
      - generic [ref=e54]:
        - generic [ref=e55]:
          - heading "构件目录" [level=3] [ref=e57]
          - paragraph [ref=e58]: 当前视角没有可见标记时，可从这里直接定位
          - list [ref=e59]:
            - listitem [ref=e60]:
              - button "定位重檐八脊攒尖顶" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: 重檐八脊攒尖顶
                - generic [ref=e63]: H
            - listitem [ref=e64]:
              - button "定位斗栱" [ref=e65] [cursor=pointer]:
                - generic [ref=e66]: 斗栱
                - generic [ref=e67]: H
            - listitem [ref=e68]:
              - button "定位旋子大点金彩画" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: 旋子大点金彩画
                - generic [ref=e71]: H
            - listitem [ref=e72]:
              - button "定位藻井" [ref=e73] [cursor=pointer]:
                - generic [ref=e74]: 藻井
                - generic [ref=e75]: H
            - listitem [ref=e76]:
              - button "定位亭内八块木匾" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: 亭内八块木匾
                - generic [ref=e79]: H
            - listitem [ref=e80]:
              - button "定位内外三圈四十柱" [ref=e81] [cursor=pointer]:
                - generic [ref=e82]: 内外三圈四十柱
                - generic [ref=e83]: H
            - listitem [ref=e84]:
              - button "定位八方月台与宇墙" [ref=e85] [cursor=pointer]:
                - generic [ref=e86]: 八方月台与宇墙
                - generic [ref=e87]: H
            - listitem [ref=e88]:
              - button "定位圆宝顶与十六吻兽" [ref=e89] [cursor=pointer]:
                - generic [ref=e90]: 圆宝顶与十六吻兽
                - generic [ref=e91]: H
        - generic [ref=e92]:
          - heading "时刻与季节" [level=3] [ref=e93]
          - group "时段" [ref=e94]:
            - generic [ref=e96]:
              - radio "晨" [ref=e97]
              - generic [ref=e98] [cursor=pointer]: 晨
              - radio "午" [checked] [ref=e99]
              - generic [ref=e100] [cursor=pointer]: 午
              - radio "黄昏" [ref=e101]
              - generic [ref=e102] [cursor=pointer]: 黄昏
              - radio "夜" [ref=e103]
              - generic [ref=e104] [cursor=pointer]: 夜
          - group "季节" [ref=e105]:
            - generic [ref=e107]:
              - radio "春" [checked] [ref=e108]
              - generic [ref=e109] [cursor=pointer]: 春
              - radio "夏" [ref=e110]
              - generic [ref=e111] [cursor=pointer]: 夏
              - radio "秋" [ref=e112]
              - generic [ref=e113] [cursor=pointer]: 秋
              - radio "冬" [ref=e114]
              - generic [ref=e115] [cursor=pointer]: 冬
        - generic [ref=e116]:
          - heading "结构拆解" [level=3] [ref=e118]
          - paragraph [ref=e119]: 分解观察分层，剖切查看内部结构（非测绘剖面）
          - generic [ref=e120]:
            - button "分解结构" [ref=e121] [cursor=pointer]
            - slider "分解比例" [ref=e122]: "0"
          - generic [ref=e123]:
            - button "平面剖切" [ref=e124] [cursor=pointer]
            - slider "剖切位置" [ref=e125]: "0"
          - button "显示 1.70m 比例人" [ref=e126] [cursor=pointer]
        - generic [ref=e127]:
          - heading "镜头预设" [level=3] [ref=e129]
          - paragraph [ref=e130]: 切换到常用观察位置
          - generic [ref=e131]:
            - button "总览" [pressed] [ref=e132] [cursor=pointer]
            - button "正南" [ref=e133] [cursor=pointer]
            - button "正东" [ref=e134] [cursor=pointer]
            - button "梁架" [ref=e135] [cursor=pointer]
            - button "藻井" [ref=e136] [cursor=pointer]
            - button "台阶" [ref=e137] [cursor=pointer]
```

# Test source

```ts
  1   | /**
  2   |  * KRT-001 · 展厅 e2e 验收测试
  3   |  *
  4   |  * 对应规划案 AC02 / AC03 / AC04 / AC05：
  5   |  *  - 控制台 error 0、pageerror 0、跨源请求 0、画布完成真实绘制
  6   |  *  - 模型几何自检（validatePavilion 的等价断言）
  7   |  *  - 交互：轨道/时刻/季节/热点/镜头/分解/剖切/比例人/重置
  8   |  *  - 无障碍：Tab 可达、焦点可见、无横向滚动、按钮有可读名称
  9   |  */
  10  | import { test, expect } from '@playwright/test';
  11  | 
  12  | /** 收集页面级错误与请求。 */
  13  | function watch(page) {
  14  |   const consoleErrors = [];
  15  |   const pageErrors = [];
  16  |   const crossOrigin = [];
  17  |   const failed = [];
  18  | 
  19  |   page.on('console', (m) => {
  20  |     if (m.type() === 'error') consoleErrors.push(m.text());
  21  |   });
  22  |   page.on('pageerror', (e) => pageErrors.push(String(e)));
  23  |   page.on('request', (r) => {
  24  |     const u = r.url();
  25  |     if (!u.startsWith('http://127.0.0.1:4173') && !u.startsWith('data:') && !u.startsWith('blob:')) {
  26  |       crossOrigin.push(u);
  27  |     }
  28  |   });
  29  |   page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
  30  | 
  31  |   return { consoleErrors, pageErrors, crossOrigin, failed };
  32  | }
  33  | 
  34  | async function boot(page) {
  35  |   await page.addInitScript(() => {
  36  |     window.__paintCount = 0;
  37  |     const raf = window.requestAnimationFrame.bind(window);
  38  |     window.requestAnimationFrame = (cb) =>
  39  |       raf((t) => {
  40  |         window.__paintCount += 1;
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
> 65  |     expect(w.crossOrigin, `跨源请求: ${w.crossOrigin.join(' | ')}`).toHaveLength(0);
      |                                                                 ^ Error: 跨源请求: http://127.0.0.1:4191/ | http://127.0.0.1:4191/assets/index-Bcv-9v7l.js | http://127.0.0.1:4191/assets/index-oln0QoyY.css
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
  141 |     await expect(page.locator('#detail-body')).toContainText('非');
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
```