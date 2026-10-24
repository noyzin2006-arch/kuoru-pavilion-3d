#!/usr/bin/env node
/**
 * tools/contrast.mjs —— WCAG 对比度核查工具（策展资产，纯函数，无第三方依赖）
 *
 * 用途：给 design-quality-bar.md 的 A2 硬指标提供**数值证据**，
 *       避免「看起来对比度够了」这种不可判定结论。
 *
 * 用法：
 *   node tools/contrast.mjs "#1a1a1a" "#ffffff"        # 单对
 *   node tools/contrast.mjs --pairs pairs.json            # 批量（见下方 schema）
 *
 * pairs.json schema：
 *   {
 *     "pairs": [
 *       { "name": "正文 / 页面背景", "fg": "#1a1a1a", "bg": "#ffffff",
 *         "min": 4.5, "note": "正文 A2 要求 ≥4.5:1" }
 *     ]
 *   }
 *
 * 判定规则（对齐 A2）：
 *   正文文字        ≥ 4.5
 *   大字(≥24px 或 ≥18.66px粗体) ≥ 3.0
 *   控件边框/图标   ≥ 3.0
 *   禁用态         ≥ 2.0（仍须可辨认）
 */

export function hexToRgb(hex) {
  const s = String(hex).trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`非法 hex: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x 相对亮度 */
export function relativeLuminance(rgb) {
  const chan = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG 对比度，返回值 1–21 */
export function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 相对亮度是否可判定（浮点容差） */
export function isReadable(fgHex, bgHex, min) {
  return contrastRatio(fgHex, bgHex) >= min - 1e-9;
}

/** 混合两个不透明色（用于计算半透明叠层的实际对比度） */
export function mix(fgHex, bgHex, alpha) {
  const f = hexToRgb(fgHex);
  const b = hexToRgb(bgHex);
  const m = (x, y) => Math.round(x * alpha + y * (1 - alpha));
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(m(f.r, b.r))}${hex(m(f.g, b.g))}${hex(m(f.b, b.b))}`;
}

function fmt(ratio) {
  return `${ratio.toFixed(2)}:1`;
}

function runCli(argv) {
  const args = argv.slice(2);
  if (args[0] === '--pairs') {
    const spec = JSON.parse(readFileSync(args[1], 'utf8'));
    let failed = 0;
    const rows = [];
    for (const p of spec.pairs) {
      const ratio = contrastRatio(p.fg, p.bg);
      const ok = isReadable(p.fg, p.bg, p.min ?? 4.5);
      if (!ok) failed += 1;
      rows.push({
        名称: p.name ?? '(未命名)',
        前景: p.fg,
        背景: p.bg,
        对比度: fmt(ratio),
        要求: `≥${p.min ?? 4.5}:1`,
        结论: ok ? 'PASS' : 'FAIL',
        备注: p.note ?? '',
      });
    }
    console.table(rows);
    console.log(`合计 ${rows.length} 组，通过 ${rows.length - failed}，失败 ${failed}`);
    process.exit(failed === 0 ? 0 : 1);
  }

  if (args.length >= 2) {
    const ratio = contrastRatio(args[0], args[1]);
    console.log(`${args[0]} vs ${args[1]} = ${fmt(ratio)}`);
    for (const [label, min] of [['正文', 4.5], ['大字/控件', 3], ['禁用态', 2]]) {
      console.log(`  ${label} (≥${min}:1) ${isReadable(args[0], args[1], min) ? 'PASS' : 'FAIL'}`);
    }
    return;
  }

  console.log('用法: node tools/contrast.mjs <fgHex> <bgHex> | --pairs <pairs.json>');
  process.exit(2);
}

// ESM 与 CJS 双兼容：既能被 import 也能直接 node 运行
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (invokedDirectly) {
  runCli(process.argv);
}
