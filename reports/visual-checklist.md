# 视觉与质量线自查清单（design-quality-bar.md A–G）

逐项对应 `handoff/spec/design-quality-bar.md`。结论只三种：**PASS / FAIL / N/A（附原因）**。
数值证据来自磁盘上的真实输出，不手抄：

- 单元测试：`reports/test-node.txt`
- 构建：`reports/build.txt`
- 浏览器验收：`reports/test-e2e.txt`
- 截图：`reports/visual/*.png`（清单见 `reports/visual/shots.json`）
- 性能采样：`reports/perf.json`
- 令牌对比度：`tools/contrast-pairs.json` → `npm run verify:contrast`

---

## A. 视觉基础

| 条目 | 结论 | 证据 |
|---|---|---|
| A1 排版 | PASS | 字阶 7 级固定于 `src/ui/tokens.css`（12/14/16/20/25/31/39 px，比例≈1.25）；正文行长受面板 320px 限制，≤40 汉字；`font-feature-settings:"kern"`、`font-variant-numeric:tabular-nums`；标题用 `var(--font-zh)`（宋体系），正文用 `var(--font-ui)`（黑体系），西文艺术字用 Georgia；无浏览器默认 `h1–h6` 字号（全部由令牌控制）。字号/行高/字重/字距逐级在令牌中写死。 |
| A2 色彩 | PASS | 全站 UI 色只出现在 `src/ui/tokens.css`；21 组**真实使用配对**全部达标（`npm run verify:contrast` → 21/21 通过）：正文 14.48:1、次字 7.85:1、弱字 6.03:1、强调 7.00:1、边框 3.51:1、焦点环 6.43:1、反白/深底 14.77:1。语义色均 ≥4.5:1，且都同时带文字标签与线性 SVG 图标，不靠颜色单独表意。焦点色 `#185A8A` 与选中态边框 `#526563` 不同色相、不同明度，可区分。**一处修正**：规划案给的 `--border:#8B9994` 实测仅 2.89:1（面板底）/2.60:1（页底），低于 A2 的 3:1，按规划案 §3.1「不合格改令牌而非改测试」暗化为 `#7C8A85`（3.51:1 / 3.16:1，同色相）。 |
| A3 间距与栅格 | PASS | 4px 基准，梯度 4/8/12/16/24/32/48/64/96（`--space-1..24`）；控件内部 8/12，卡 16/24，区块 32，页边 24/48；同类控件统一用同一档（按钮 `--space-2/--space-4`，卡片 `--space-6`）。主容器限宽 1720px（画布允许全宽，正文面板 320px 限宽）。 |
| A4 形状与层级 | PASS | 圆角 4/8/12/16/999 五档，同类一致；阴影 `--shadow-0..4` 五档对应无/卡/浮层/弹层/吐司；z-index 集中为 `--z-scene/hud/panel/menu/dialog/toast` 六档，组件内不写魔法数字；分隔只用边框（`--line`），不与阴影、底色叠加。 |
| A5 图标与媒体 | PASS | 全部图标来自单一内联 SVG 集 `src/ui/icons.js`（viewBox 0 0 24 24，stroke-width 1.75，round 线帽），尺寸 16/20/24，**零 emoji**；canvas 有 `aria-label` 与文字替代；图片无外链（页面零外部请求）；canvas 尺寸由 CSS 固定，无布局跳动。 |

## B. 交互与体验

| 条目 | 结论 | 证据 |
|---|---|---|
| B1 状态完整性 | PASS | C01–C10 全部具备默认/悬停/按下/聚焦/禁用/加载/错误/空/成功态（`src/ui/components.js`）。空态有引导文案（「请选择一个构件了解形制」）；加载态有阶段文案；错误态就地提示 + 重试按钮（`role=alert`）；成功态 toast（`role=status`）。静态说明性元素不虚构 hover/disabled。 |
| B2 反馈与时序 | PASS | 所有可交互元素 hover/按下变化在 120ms 内（`--motion-fast`）；时刻/季节切换为异步操作，先更新状态再重建 IBL（期间保持旧环境，不黑场）；破坏性操作只有「重置」，提供的是可逆的状态重置而非不可逆操作，故不做二次确认弹窗而是 toast 告知「已恢复默认」。 |
| B3 导航与信息架构 | PASS | 一级「廓如亭展厅」+ 二级四面板（构件详情 / 场景控制 / 复原依据 / 帮助），层级 ≤2，无多页跳转；位置标识常驻（顶栏「廓如亭 · 结构复原 / 颐和园实时三维数字复原 / 非激光扫描」）；首屏即可看到模型与主要控件。 |
| B4 文案 | PASS | 四态文案具体：「还没有选中的构件，从画面标记或目录开始」「正在建立瓦面与彩画（第2/4步）」「你的浏览器没有成功启动实时三维，请刷新或阅读文字结构说明」「廓如亭模型就绪，拖动旋转、滚轮缩放」；按钮均为动词短语（「分解结构」「平面剖切」「显示 1.70m 比例人」「重置视图与结构」）；无「操作失败」类无信息文案。 |
| B5 响应式 | PASS | 断点 480/768/1024/1280 逐档改布局（e2e 5 档视口用例 + 1440 用例均断言无横向滚动）；移动端可点区域 ≥44×44（`--control-min-size`）；控件不依赖 hover（radio/按钮均为原生可聚焦元素）。 |

## C. 无障碍

| 条目 | 结论 | 证据 |
|---|---|---|
| C 全键盘 | PASS | Tab 顺序：跳转链接 → 帮助 → 构件目录 → 时刻/季节 → 结构拆解 → 镜头预设 → 视角工具 → 画布；Enter/Space 操作原生控件；画布聚焦后 ←/→ 转 10°、↑/↓ 改极角 6°、+/- 缩放 1.12×、Shift+方向键平移 0.5m、R 复位（e2e 断言方向键确实改变相机位置）。快捷键只在画布聚焦时生效，不截获输入框按键。 |
| C 焦点可见 | PASS | `:focus-visible` 统一 3px 蓝环 + 2px 外扩（`--focus-ring`），与选中态可区分；e2e 统计 Tab 可达目标 ≥3（实测 20 个）。 |
| C 语义与标注 | PASS | 语义化标签（header/main/aside/section/fieldset/legend）、标题层级不跳级（h1→h2→h3）、图标按钮均有 `aria-label`、表单控件均有 label 关联；详情面板用 `aside[aria-labelledby]`，移动端为模态 sheet（遮罩 + Esc + 焦点还原）；画布有文字替代（WebGL2 不可用时展示结构说明）。 |
| C 缩放 200% | PASS | 375px 视口（≈1440px 的 200% 缩放等效宽度）下无横向滚动、无内容被裁切（e2e 5 档视口用例）；面板可折行，未使用定高裁切文案。 |
| C reduced-motion | PASS | `prefers-reduced-motion: reduce` 时全部动效时长置 0（令牌层），三维镜头直接跳转（不做插值）；已实测生效。 |
| C 颜色非唯一载体 | PASS | 构件置信度用「H/I/S 文字 + 徽标」双编码；季节/时刻用文字 + 选中边框双重表达。 |

## D. 性能

| 条目 | 结论 | 证据 |
|---|---|---|
| D 冷启动 | PASS（桌面/移动中位数与最大值均 ≤2.5s） | `reports/perf.json`（1440×900 与 375×812 各 5 次新 context 采样） |
| D 交互响应 | PASS | 过渡 800ms 内完成，操作反馈 ≤100ms（`reports/perf.json` 的 feedbackMs） |
| D CLS | PASS（≤0.1） | `reports/perf.json` 的 cls |
| D 稳态帧率 | PASS | `reports/perf.json` 的 fps（真实 GPU，headful Chrome） |
| D 动画只动 transform/opacity | PASS | DOM 过渡只用 opacity/transform；三维动画走 three 的属性更新，未用 width/height 布局动画 |
| D 纹理与三角形预算 | PASS | 瓦片实例 13872（≤18000）；产物 JS 645KB（gzip 171KB，≤1.5MiB）；贴图全部程序化生成，无外部纹理 |

## E. 工程与一致性

| 条目 | 结论 | 证据 |
|---|---|---|
| E 单一令牌源 | PASS | UI 色只在 `src/ui/tokens.css`；3D 物体色只在 `src/scene/materials.js` 的 `SCENE_PALETTE`；组件内无裸 hex |
| E 同类组件一致 | PASS | 全部按钮走同一套 `.button` / `.icon-button` 规则（同一状态矩阵 M） |
| E 单一真源 | PASS | 展厅状态只有 `src/core/state.js` 的 reducer；几何只有 `src/core/geometry.js` 的 `PAVILION_CONFIG`；UI 不直接改 3D 构件位置 |
| E 无死代码 | PASS | 无 TODO / 未使用导出；`tools/` 下三个脚本均有对应 npm script 入口 |
| E 命名与目录一致 | PASS | 与规划案 §5.1 的模块清单逐项对应（`src/core` `src/scene` `src/ui` `tests` `e2e` `tools` `scripts`） |

## F. 视觉检查（实际看过的截图）

| 检查项 | 看的是什么 | 看到什么 | 结论 |
|---|---|---|---|
| 默认态（总览） | `reports/visual/02-autumn-dusk-overview.png` 等 | 八角重檐轮廓一眼可辨：下檐与上檐分明、八条垂脊放射、宝顶居中 | PASS |
| 春·午·正南 | `reports/visual/01-spring-noon-south.png` | 正南机位下双檐出檐与柱网清晰，瓦垄脊线连续 | PASS |
| 秋·黄昏 | `reports/visual/02-autumn-dusk-overview.png` | 暖光落在屋面，树叶转黄，水色偏灰 | PASS |
| 冬·夜 | `reports/visual/03-winter-night.png` | 夜景整体压暗，檐下暖灯可见，不出现纯黑死面 | PASS |
| 藻井内部 | `reports/visual/04-caojing-interior.png` | 仰视可见藻井分层与彩绘，不是贴图平板 | PASS |
| 分解 100% | `reports/visual/05-explode-100.png` | 屋面、枋梁、坐凳逐层拉开，柱网留在原位 | PASS |
| 剖切 50% | `reports/visual/06-section-50.png` | 竖直剖面切开，内部柱网可见 | PASS |
| 空态 | `reports/visual/07-empty-detail.png` | 详情面板显示「请选择一个构件了解形制」引导 | PASS |
| 移动默认 | `reports/visual/08-mobile-default.png` | 375px 下画布占首屏，控制区在下方，控件 44px | PASS |
| 移动详情 | `reports/visual/09-mobile-detail.png` | 底部 sheet 展示构件说明，带遮罩与关闭 | PASS |
| 加载态 | `reports/visual/loading-desktop.png` | 模型未建立时给出阶段说明，不是空白 | PASS |
| 错误态 | `reports/visual/10-error-webgl-unavailable.png` | WebGL2 不可用时给出文字结构说明 | PASS |

## G. 不合格项（任一出现即否决）

| 检查 | 结论 |
|---|---|
| 残留浏览器默认样式（默认按钮、默认字体、默认列表缩进） | 无：按钮与输入统一重置，列表用 `list-style:none` |
| 占位文案（暂无数据 / 操作失败 / 确定吗？） | 无：四态文案均为具体说明 |
| 同类元素尺寸/圆角/间距不一致 | 无 |
| 只有默认态、缺悬停/聚焦/加载/错误/空态 | 无：见 B1 |
| 焦点看不见、键盘走不通 | 无：见 C |
| 移动端横向滚动 / 元素重叠 / 按钮点不准 | 无：5 档视口断言通过；曾发现「详情面板遮挡右侧控制区」的真实缺陷，已改为右栏流内 + 移动端模态 sheet 后复测通过 |
| emoji 或风格不一的多套图标 | 无：单一 SVG 图标集 |
| 颜色裸写 / 对比度不足 / 只靠颜色表意 | 无：见 A2 |
| 动效掉帧或无视 reduced-motion | 无：见 D 与 C |
