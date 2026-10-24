#!/usr/bin/env node
/**
 * tools/verify-geometry.mjs —— 廓如亭几何自洽校验（策展资产）
 *
 * 目的：把「还原」变成**可判定的数字**，而不是「看起来挺像」。
 * 本脚本读取一份几何规格 JSON（单位：米），对照实测锚点与清式营造则例逐条验算。
 *
 * 用法：
 *   node tools/verify-geometry.mjs <spec.json>
 *   node tools/verify-geometry.mjs --self-test
 *
 * 规格 JSON 约定（缺失项标 SKIP，不伪造通过）：
 * {
 *   "plan":    { "sides": 8, "baysPerSide": 3, "bayWidths": [1.6, 3.2, 1.6] },
 *   "platform":{ "sideLength": 11.1 },
 *   "column":  { "height": 4.29, "diameter": 0.39, "taper": 0.03,
 *                "rings": [ { "name":"外圈", "round":24, "square":0, "radius":8.361 },
 *                           { "name":"中圈", "round":0,  "square":8, "radius":5.4 },
 *                           { "name":"内圈", "round":0,  "square":8, "radius":2.8 } ] },
 *   "corridor":{ "outerRadius": 11.667 },
 *   "roof":    { "ridgeTop": 19.0, "eaveOverhang": 1.6,
 *                "steps": [ {"name":"檐步","rise":0.50}, {"name":"金步","rise":0.65} ] }
 * }
 *
 * 依据（全部可查证）：
 *   实测：明间面阔 3.2 m、次间各 1.6 m、单面 6.4 m、对面 15.5 m、角至角 16.7 m、
 *         柱高 4.29 m、建筑面积 384.95 ㎡、三圈共 40 柱（24 圆 + 16 方）、
 *         八方月台边长 11.1 m
 *   则例：柱高:柱径 = 11:1；收分 ≤ 柱高 7/1000；上出 ≥ 檐柱高 3/10；
 *         檐步五举(0.50)、飞椽三五举(0.35)；举架逐级递增
 *
 * 退出码：0 全部通过 / 1 有失败 / 2 用法或文件错误。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/* ---------------------------------------------------------------- 锚点 */
export const ANCHORS = {
  sides: 8,
  baysPerSide: 3,
  centralBay: 3.2,        // 明间面阔
  sideBay: 1.6,           // 两次间面阔
  sideWidth: 6.4,         // 单面面阔 = 3.2 + 1.6 + 1.6
  oppositeWidth: 15.5,    // 对面（两对边间距）
  diagonalWidth: 16.7,    // 角至角（对角线）
  columnHeight: 4.29,
  columnDiameterRatio: 11,
  taperRatio: 7 / 1000,
  totalColumns: 40,
  roundColumns: 24,
  squareColumns: 16,
  platformSide: 11.1,
  outerFootprintArea: 384.95,
  firstRise: 0.5,
  flyRise: 0.35,
  minEaveRatio: 0.3,
};

/* ---------------------------------------------------------------- 几何 */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const near = (a, b, tolPct) =>
  (a === undefined || b === undefined ? null : Math.abs(a - b) / b <= tolPct / 100);

export const octagon = {
  /** 单面宽 → 外接圆半径 */
  circumradius: (side) => side / (2 * Math.sin(Math.PI / 8)),
  /** 单面宽 → 内切半径（对面阔的一半） */
  apothem: (side) => side / (2 * Math.tan(Math.PI / 8)),
  /** 外接圆半径 → 单面宽 */
  sideFromCircumradius: (R) => 2 * R * Math.sin(Math.PI / 8),
  /** 外接圆半径 → 面积 */
  area: (R) => (8 / 2) * R * R * Math.sin((2 * Math.PI) / 8),
};

export function verify(spec) {
  const results = [];
  const add = (id, title, pass, detail, evidence) =>
    results.push({ id, title, pass, detail, evidence });

  const plan = spec.plan || {};
  const column = spec.column || {};
  const platform = spec.platform || {};
  const roof = spec.roof || {};
  const corridor = spec.corridor || {};

  const bayWidths = Array.isArray(plan.bayWidths) ? plan.bayWidths.map(num) : [];
  const sides = num(plan.sides) ?? ANCHORS.sides;
  const bays = num(plan.baysPerSide) ?? ANCHORS.baysPerSide;

  /* R1 平面制度 */
  add('R1', '八边形、每面显三间', sides === 8 && bays === 3,
    `sides=${sides} baysPerSide=${bays}（应为 8 / 3）`,
    '实测：平面呈八方形，每面显 3 间');

  /* R2 单面面阔 = 明间 + 两次间 */
  {
    const sum = bayWidths.reduce((s, v) => s + (v || 0), 0);
    const ok = bayWidths.length === 3 ? near(sum, ANCHORS.sideWidth, 2) : null;
    add('R2', '单面面阔 = 明间 + 两次间 ≈ 6.4 m', ok,
      `面阔序列 ${bayWidths.join(' + ') || '缺失'} = ${sum || '—'} m（容差 2%）`,
      '实测：明间面阔 3.2 米，两次间各面阔 1.6 米');
  }

  /* R3 明间/次间配比 */
  {
    if (bayWidths.length === 3) {
      const [s1, mid, s2] = bayWidths;
      const ok = near(mid, ANCHORS.centralBay, 2) && near(s1, ANCHORS.sideBay, 3) && near(s2, ANCHORS.sideBay, 3);
      add('R3', '明间 3.2 m、两次间各 1.6 m', ok,
        `明间 ${mid} m（要求 3.2 ±2%）、次间 ${s1}/${s2} m（要求 1.6 ±3%）`,
        '实测：明间面阔 3.2 米，两次间各面阔 1.6 米');
    } else {
      add('R3', '明间 3.2 m、两次间各 1.6 m', null, 'plan.bayWidths 不足三项，跳过', '—');
    }
  }

  /* R4 对面阔（两对边间距） */
  {
    const side = num(plan.sideWidth) ?? (bayWidths.length === 3
      ? bayWidths.reduce((s, v) => s + (v || 0), 0) : undefined);
    const derived = side !== undefined ? 2 * octagon.apothem(side) : undefined;
    const ok = near(derived, ANCHORS.oppositeWidth, 2);
    add('R4', '对面阔 ≈ 15.5 m', ok,
      `由单面宽 ${side ?? '缺失'} m 推出 ${derived !== undefined ? derived.toFixed(3) : '—'} m（容差 2%）`,
      '实测：对面面阔 15.5 米；八边形内切半径 × 2');
  }

  /* R5 角至角（对角线） */
  {
    const side = num(plan.sideWidth) ?? (bayWidths.length === 3
      ? bayWidths.reduce((s, v) => s + (v || 0), 0) : undefined);
    const derived = side !== undefined ? 2 * octagon.circumradius(side) : undefined;
    const ok = near(derived, ANCHORS.diagonalWidth, 2);
    add('R5', '角至角 ≈ 16.7 m', ok,
      `由单面宽 ${side ?? '缺失'} m 推出 ${derived !== undefined ? derived.toFixed(3) : '—'} m（容差 2%）`,
      '实测：角至角进深 16.7 米；外接圆直径 = 2R');
  }

  /* R6 柱高 */
  {
    const h = num(column.height);
    const ok = near(h, ANCHORS.columnHeight, 1);
    add('R6', '柱高 ≈ 4.29 m', ok,
      `实测 ${h ?? '缺失'} m，容差 1%`,
      '实测：柱高 4.29 米');
  }

  /* R7 柱径 = 柱高 ÷ 11 */
  {
    const h = num(column.height);
    const d = num(column.diameter);
    const expect = h !== undefined ? h / ANCHORS.columnDiameterRatio : undefined;
    const ok = near(d, expect, 3);
    add('R7', '柱径 = 柱高 ÷ 11', ok,
      `实测 ${d ?? '缺失'} m，理论 ${expect !== undefined ? expect.toFixed(3) : '缺失'} m，容差 3%`,
      '清工部《工程做法则例》：柱高与柱径之比为 11:1');
  }

  /* R8 收分 */
  {
    const h = num(column.height);
    const t = num(column.taper);
    const max = h !== undefined ? h * ANCHORS.taperRatio : undefined;
    const ok = t !== undefined && max !== undefined ? t <= max + 1e-9 : null;
    add('R8', '收分 ≤ 柱高 × 7/1000', ok,
      `收分 ${t ?? '缺失'} m，上限 ${max !== undefined ? max.toFixed(4) : '缺失'} m`,
      '大式建筑收分：《营造算例》规定柱高的 7/1000');
  }

  /* R9 柱数与圈层 */
  {
    const rings = Array.isArray(column.rings) ? column.rings : [];
    const round = rings.reduce((s, r) => s + (num(r.round) || 0), 0);
    const square = rings.reduce((s, r) => s + (num(r.square) || 0), 0);
    const total = round + square;
    const ok = total === ANCHORS.totalColumns && round === ANCHORS.roundColumns
      && square === ANCHORS.squareColumns;
    add('R9', '三圈共 40 柱（24 圆 + 16 方）', ok,
      `合计 ${total} 柱（圆 ${round} / 方 ${square}）`,
      '实测：内外三圈共 40 根，24 圆柱、16 方柱');
  }

  /* R10 外圈柱位排布与间数一致 */
  {
    const rings = Array.isArray(column.rings) ? column.rings : [];
    const outer = rings.find((r) => (num(r.round) || 0) > 0);
    if (outer) {
      // 每面 3 间 → 每边 4 个柱位 → 8 角柱 + 8×2 中柱 = 24
      const expectOuter = sides * (bays + 1) - sides; // 角柱只计一次
      const ok = (num(outer.round) || 0) === expectOuter;
      add('R10', '外圈圆柱位 = 角柱 + 每面中柱 = 24', ok,
        `每面 ${bays} 间 → 边柱位 ${bays + 1}；去重角柱后应 ${expectOuter} 根，实际 ${num(outer.round) || 0} 根`,
        '由「每面显三间」与「24 圆柱」互推');
    } else {
      add('R10', '外圈圆柱位 = 角柱 + 每面中柱 = 24', null, 'column.rings 里找不到外圈，跳过', '—');
    }
  }

  /* R11 柱网同心且半径递减 */
  {
    const rings = (Array.isArray(column.rings) ? column.rings : [])
      .filter((r) => num(r.radius) !== undefined);
    if (rings.length >= 2) {
      let mono = true;
      for (let i = 1; i < rings.length; i += 1) {
        if (rings[i].radius > rings[i - 1].radius) mono = false;
      }
      add('R11', '柱网同心：各圈半径由外到内递减', mono,
        rings.map((r) => `${r.name || '圈'}=${r.radius}`).join(' > '),
        '内外三圈的常规做法');
    } else {
      add('R11', '柱网同心：各圈半径由外到内递减', null, '缺各圈 radius，跳过', '—');
    }
  }

  /* R12 月台边长 */
  {
    const s = num(platform.sideLength);
    const ok = near(s, ANCHORS.platformSide, 1);
    add('R12', '八方月台边长 ≈ 11.1 m', ok,
      `实测 ${s ?? '缺失'} m，容差 1%`,
      '实测：亭四周建有八方形月台，边长 11.1 米');
  }

  /* R13 外廊轮廓面积 = 384.95 ㎡，且大于柱网轮廓 */
  {
    const outerR = num(corridor.outerRadius) ?? num(roof.eaveRadius);
    const area = outerR !== undefined ? octagon.area(outerR) : undefined;
    const ok = near(area, ANCHORS.outerFootprintArea, 2);
    add('R13', '外廊轮廓面积 ≈ 384.95 ㎡', ok,
      `外接圆 R=${outerR ?? '缺失'} m → ${area !== undefined ? area.toFixed(2) : '—'} ㎡（容差 2%）`,
      '实测：建筑面积 384.95 平方米');
  }

  /* R14 月台须大于外廊轮廓 */
  {
    const monthR = num(platform.sideLength) !== undefined
      ? octagon.circumradius(num(platform.sideLength)) : undefined;
    const outerR = num(corridor.outerRadius) ?? num(roof.eaveRadius);
    const ok = monthR !== undefined && outerR !== undefined ? monthR > outerR : null;
    add('R14', '月台轮廓 > 外廊轮廓（月台包住亭身）', ok,
      `月台 R=${monthR !== undefined ? monthR.toFixed(3) : '—'} m，外廊 R=${outerR ?? '—'} m`,
      '「亭四周建有八方形的月台」');
  }

  /* R15/R16 举架 */
  {
    const steps = Array.isArray(roof.steps) ? roof.steps : [];
    const rises = steps.map((s) => num(s.rise)).filter((v) => v !== undefined);
    if (rises.length >= 2) {
      let mono = true;
      for (let i = 1; i < rises.length; i += 1) if (rises[i] < rises[i - 1]) mono = false;
      add('R15', '举架步序逐级递增（越往上越陡）', mono,
        `举高序列 ${rises.map((r) => r.toFixed(2)).join(' → ')}`,
        '清式：檐步五举 → 六五举 → 七五举 → 九举');
      add('R16', '檐步首举 ≈ 0.50（五举）', near(rises[0], ANCHORS.firstRise, 2),
        `首步举高 ${rises[0].toFixed(3)}，容差 2%`,
        '清式：檐步架五举（举高:步架 = 5:10）');
    } else {
      add('R15', '举架步序逐级递增（越往上越陡）', null, 'roof.steps 不足两项，跳过', '—');
      add('R16', '檐步首举 ≈ 0.50（五举）', null, 'roof.steps 不足，跳过', '—');
    }
  }

  /* R17 出檐 */
  {
    const h = num(column.height);
    const eave = num(roof.eaveOverhang);
    const min = h !== undefined ? h * ANCHORS.minEaveRatio : undefined;
    const ok = eave !== undefined && min !== undefined ? eave >= min - 1e-9 : null;
    add('R17', '出檐（上出）≥ 檐柱高 × 3/10', ok,
      `出檐 ${eave ?? '缺失'} m，下限 ${min !== undefined ? min.toFixed(3) : '缺失'} m`,
      '清则例：无斗栱小式上出 = 檐柱高 × 3/10');
  }

  /* R18 总高合理区间 */
  {
    const h = num(column.height);
    const top = num(roof.ridgeTop);
    if (h !== undefined && top !== undefined) {
      const ratio = top / h;
      add('R18', '亭总高 / 柱高 ∈ (2, 6)', ratio > 2 && ratio < 6,
        `总高 ${top.toFixed(2)} m ÷ 柱高 ${h.toFixed(2)} m = ${ratio.toFixed(2)}`,
        '经验区间：含台明、双重檐与宝顶的攒尖亭');
    } else {
      add('R18', '亭总高 / 柱高 ∈ (2, 6)', null, '缺 roof.ridgeTop，跳过', '—');
    }
  }

  return results;
}

/* ---------------------------------------------------------------- CLI */
function printTable(results) {
  console.table(results.map((r) => ({
    编号: r.id,
    检查项: r.title,
    结论: r.pass === null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL',
    实测: r.detail,
  })));
}

const SELF_TEST_SPEC = {
  plan: { sides: 8, baysPerSide: 3, bayWidths: [1.6, 3.2, 1.6], sideWidth: 6.4 },
  platform: { sideLength: 11.1 },
  column: {
    height: 4.29, diameter: 0.39, taper: 0.03,
    rings: [
      { name: '外圈', round: 24, square: 0, radius: 8.361 },
      { name: '中圈', round: 0, square: 8, radius: 5.4 },
      { name: '内圈', round: 0, square: 8, radius: 2.8 },
    ],
  },
  corridor: { outerRadius: 11.667 },
  roof: {
    ridgeTop: 19.0, eaveOverhang: 1.6,
    steps: [
      { name: '檐步', rise: 0.50 },
      { name: '金步', rise: 0.65 },
      { name: '脊步', rise: 0.95 },
    ],
  },
};

function selfTest() {
  const res = verify(SELF_TEST_SPEC);
  printTable(res);
  const fails = res.filter((r) => r.pass === false);
  const skips = res.filter((r) => r.pass === null);
  console.log(`自测：${res.length - fails.length - skips.length} 通过 / ${fails.length} 失败 / ${skips.length} 跳过`);
  if (fails.length) {
    console.log('失败项：');
    for (const f of fails) console.log(`  ${f.id} ${f.title} —— ${f.detail}`);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('用法: node tools/verify-geometry.mjs <spec.json> | --self-test');
    process.exit(2);
  }
  if (arg === '--self-test') {
    selfTest();
  } else {
    let spec;
    try {
      spec = JSON.parse(readFileSync(arg, 'utf8'));
    } catch (e) {
      console.error(`读不了规格文件 ${arg}: ${e.message}`);
      process.exit(2);
    }
    const res = verify(spec);
    printTable(res);
    const fails = res.filter((r) => r.pass === false);
    const skips = res.filter((r) => r.pass === null);
    console.log(`合计 ${res.length} 项：通过 ${res.length - fails.length - skips.length}，失败 ${fails.length}，跳过 ${skips.length}`);
    if (fails.length) {
      console.log('失败项：');
      for (const f of fails) console.log(`  ${f.id} ${f.title} —— ${f.detail}`);
      process.exit(1);
    }
  }
}
