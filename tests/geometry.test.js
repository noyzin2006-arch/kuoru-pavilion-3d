/**
 * KRT-001 · 几何内核单测
 * 对应规划案 AC03（validatePavilion 的几何自检）与 §5.2 几何合同。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAVILION_CONFIG,
  makeOctagon,
  interpolateSides,
  makeColumnLayout,
  roofProfile,
  validatePavilion,
  octagonArea,
  octagonCircumradius,
  octagonApothem,
  CAMERA_PRESETS,
} from '../src/core/geometry.js';

const EPS = 1e-6;

test('正八边形：面积 / 外接圆 / 内切半径互相自洽', () => {
  const side = 11.1;
  assert.ok(Math.abs(octagonArea(side) - 2 * (1 + Math.SQRT2) * side * side) < EPS);
  // R = s / (2 sin22.5°)，r = s / (2 tan22.5°)，且 r = R cos22.5°
  assert.ok(Math.abs(octagonApothem(side) - octagonCircumradius(side) * Math.cos(Math.PI / 8)) < EPS);
});

test('八方月台：边长 11.1m，面积约 594.9 ㎡', () => {
  const p = PAVILION_CONFIG.platform;
  assert.equal(p.side, 11.1);
  assert.ok(Math.abs(octagonArea(p.side) - 594.9) < 1.0);
  assert.ok(Math.abs(octagonCircumradius(p.side) - 14.502) < 0.01);
  assert.ok(Math.abs(octagonApothem(p.side) - 13.398) < 0.01);
});

test('建筑投影：384.95 ㎡ 对应边长 8.931m、外接半径 11.669m', () => {
  const f = PAVILION_CONFIG.footprint;
  assert.ok(Math.abs(octagonArea(f.side) - f.area) < 0.5);
  assert.ok(Math.abs(octagonCircumradius(f.side) - f.circumradius) < 0.01);
});

test('makeOctagon：8 顶点，相邻边长等于给定边长', () => {
  const side = 6.4;
  const pts = makeOctagon(side, 0.65);
  assert.equal(pts.length, 8);
  for (let i = 0; i < 8; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % 8];
    const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
    assert.ok(Math.abs(d - side) < 1e-9, `第 ${i} 边长 ${d}`);
    assert.equal(a[1], 0.65);
  }
});

test('makeOctagon：默认朝向下四条边中心落在正南/正东/正北/正西（+Z 为南）', () => {
  const pts = makeOctagon(6.4, 0);
  const mid = (i) => {
    const a = pts[i];
    const b = pts[(i + 1) % 8];
    return [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
  };
  // 找正南方向的边中点（z 最大且 x≈0）
  let best = -1;
  let bestZ = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    const [x, z] = mid(i);
    if (z > bestZ) {
      bestZ = z;
      best = i;
    }
  }
  const [sx, sz] = mid(best);
  assert.ok(Math.abs(sx) < 1e-9, '正南边中点应在 X=0 轴上');
  assert.ok(sz > 0, '正南方向应为 +Z');
  assert.ok(Math.abs(sz - octagonApothem(6.4)) < 1e-9, '边中点距心应为内切半径');
});

test('interpolateSides：24 点、无重复角点、每边 3 点', () => {
  const pts = makeOctagon(6.4, 0);
  const out = interpolateSides(pts, 3);
  assert.equal(out.length, 24);
  const keys = out.map((p) => `${p[0].toFixed(6)},${p[2].toFixed(6)}`);
  assert.equal(new Set(keys).size, 24, '不应有重复点');
  // 每个角点恰好出现一次
  const cornerKeys = pts.map((p) => `${p[0].toFixed(6)},${p[2].toFixed(6)}`);
  for (const ck of cornerKeys) {
    assert.equal(keys.filter((k) => k === ck).length, 1);
  }
  // 每条边 3 跨：边自有 t∈[0,1) 的柱位恰好 3 个（末端角点归下一边所有）
  for (let i = 0; i < 8; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % 8];
    const own = out.filter((p) => {
      const cross = (b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0]);
      if (Math.abs(cross) > 1e-9) return false;
      const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[2] - a[2]) * (b[2] - a[2])) /
        ((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2);
      return t >= -1e-9 && t < 1 - 1e-9; // 排除末端共享角点
    });
    assert.equal(own.length, 3, `第 ${i} 边应有 3 个柱位（即 3 跨）`);
  }
});

test('makeColumnLayout：40 柱（24 圆 / 16 方），三圈半径递减', () => {
  const cols = makeColumnLayout();
  assert.equal(cols.length, 40);
  assert.equal(cols.filter((c) => c.kind === 'round').length, 24);
  assert.equal(cols.filter((c) => c.kind === 'square').length, 16);
  assert.equal(cols.filter((c) => c.ring === 'outer').length, 24);
  assert.equal(cols.filter((c) => c.ring === 'middle').length, 8);
  assert.equal(cols.filter((c) => c.ring === 'inner').length, 8);

  const radiusOf = (ring) => Math.hypot(cols.find((c) => c.ring === ring).x, cols.find((c) => c.ring === ring).z);
  assert.ok(radiusOf('outer') > radiusOf('middle'));
  assert.ok(radiusOf('middle') > radiusOf('inner'));
  assert.ok(Math.abs(radiusOf('outer') - 11.669) < 0.01);
  assert.ok(Math.abs(radiusOf('middle') - 11.669 * 0.76) < 0.01);
  assert.ok(Math.abs(radiusOf('inner') - 11.669 * 0.48) < 0.01);
});

test('柱身高度：柱础顶 0.89m，柱头 5.18m，柱高 4.29m', () => {
  const cols = makeColumnLayout();
  for (const c of cols) {
    assert.ok(Math.abs(c.plinthTopY - 0.89) < 1e-9);
    assert.ok(Math.abs(c.topY - 5.18) < 1e-9);
    assert.ok(Math.abs(c.height - 4.29) < 1e-9);
  }
});

test('roofProfile：上下檐的檐口与内侧高度精确归一到标称值', () => {
  for (const level of ['lower', 'upper']) {
    const L = PAVILION_CONFIG.roof.levels[level];
    assert.ok(Math.abs(roofProfile(L.rmax, level) - L.eaveY) < 1e-6, `${level} 檐口`);
    assert.ok(Math.abs(roofProfile(L.innerR, level) - L.innerY) < 1e-6, `${level} 内侧`);
  }
});

test('roofProfile：单调上升（由檐向心越高）', () => {
  for (const level of ['lower', 'upper']) {
    const L = PAVILION_CONFIG.roof.levels[level];
    let prev = -Infinity;
    for (let r = L.rmax; r >= L.innerR; r -= 0.05) {
      const h = roofProfile(r, level);
      assert.ok(h >= prev - 1e-9, `${level} 在 r=${r.toFixed(2)} 处回落`);
      prev = h;
    }
  }
});

test('validatePavilion：出厂配置通过全部几何自检', () => {
  const cols = makeColumnLayout();
  const res = validatePavilion(PAVILION_CONFIG, cols);
  assert.deepEqual(res.failures, []);
  assert.equal(res.ok, true);
  assert.equal(res.metrics.totalColumns, 40);
  assert.equal(res.metrics.roundColumns, 24);
  assert.equal(res.metrics.squareColumns, 16);
});

test('validatePavilion：能检出错误尺寸与重复 ID', () => {
  const cols = makeColumnLayout();
  const broken = {
    ...PAVILION_CONFIG,
    platform: { ...PAVILION_CONFIG.platform, side: 10 },
    columns: { ...PAVILION_CONFIG.columns, height: 3.5 },
  };
  const res = validatePavilion(broken, cols);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.includes('月台边长')));
  assert.ok(res.failures.some((f) => f.includes('柱高')));

  const dup = cols.slice();
  dup[1] = { ...dup[1], id: dup[0].id };
  const res2 = validatePavilion(PAVILION_CONFIG, dup);
  assert.ok(res2.failures.some((f) => f.includes('ID 不唯一')));
});

test('相机预设：6 个，字段齐备', () => {
  const keys = Object.keys(CAMERA_PRESETS);
  assert.equal(keys.length, 6);
  for (const k of keys) {
    const p = CAMERA_PRESETS[k];
    assert.equal(p.eye.length, 3);
    assert.equal(p.target.length, 3);
  }
});
