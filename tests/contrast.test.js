/**
 * KRT-001 · 对比度单测（规划案 §3.1 / 质量线 A2）
 *
 * 规则：**不合格改令牌而非改测试**。这里直接读 src/ui/tokens.css 里声明的令牌，
 * 对令牌的**真实使用配对**作断言。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { contrastRatio, hexToRgb, relativeLuminance, meetsContrast, readToken } from '../src/ui/contrast.js';

const css = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
const t = (name) => {
  const v = readToken(css, name);
  assert.ok(v, `tokens.css 缺少 --${name}`);
  return v;
};

test('对比度基本性质', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.ok(Math.abs(contrastRatio('#ffffff', '#ffffff') - 1) < 1e-9);
  // 对称
  assert.ok(Math.abs(contrastRatio('#172b2a', '#f3f0e8') - contrastRatio('#f3f0e8', '#172b2a')) < 1e-12);
  // 相对亮度边界
  assert.ok(Math.abs(relativeLuminance(hexToRgb('#000000'))) < 1e-12);
  assert.ok(Math.abs(relativeLuminance(hexToRgb('#ffffff')) - 1) < 1e-12);
});

test('短 hex 与非法 hex 处理正确', () => {
  assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
  assert.throws(() => hexToRgb('#gg0000'));
  assert.throws(() => hexToRgb('nope'));
});

test('正文与次要文字 ≥ 4.5:1（浅底）', () => {
  const pairs = [
    ['text-main', 'bg-page'],
    ['text-main', 'bg-panel'],
    ['text-sub', 'bg-panel'],
    ['text-sub', 'bg-page'],
    ['text-quiet', 'bg-panel'],
    ['text-quiet', 'bg-page'],
    ['text-main', 'accent-soft'],
  ];
  for (const [fg, bg] of pairs) {
    const r = contrastRatio(t(fg), t(bg));
    assert.ok(r >= 4.5, `${fg} on ${bg} = ${r.toFixed(2)}:1 < 4.5`);
  }
});

test('大字与控件边框 ≥ 3:1', () => {
  const pairs = [
    ['focus', 'bg-page'],
    ['focus', 'bg-panel'],
    ['border', 'bg-panel'],
    ['border', 'bg-page'],
    ['border-active', 'bg-panel'],
  ];
  for (const [fg, bg] of pairs) {
    const r = contrastRatio(t(fg), t(bg));
    assert.ok(r >= 3, `${fg} on ${bg} = ${r.toFixed(2)}:1 < 3`);
  }
});

test('语义色在面板底上 ≥ 4.5:1', () => {
  for (const name of ['success', 'warning', 'danger', 'information']) {
    const r = contrastRatio(t(name), t('bg-panel'));
    assert.ok(r >= 4.5, `${name} = ${r.toFixed(2)}:1`);
  }
});

test('深底上的反白文字 ≥ 4.5:1', () => {
  assert.ok(contrastRatio(t('text-on-dark'), t('bg-dark')) >= 4.5);
  assert.ok(contrastRatio(t('accent-soft'), t('bg-dark')) >= 4.5);
});

test('meetsContrast 边界行为', () => {
  assert.equal(meetsContrast('#767676', '#ffffff', 4.5), true);
  assert.equal(meetsContrast('#777777', '#ffffff', 4.5), false);
});
