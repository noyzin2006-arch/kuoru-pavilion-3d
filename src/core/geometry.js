/**
 * KRT-001 · 廓如亭几何内核（纯函数，无 DOM / 无 three 依赖）
 *
 * 数值全部来自规划案 §5.2「以米为单位的几何合同」。
 * 坐标约定：Y 竖直、X 东西、Z 南北，**+Z 为南**，亭中轴在 (0,0,0)，北为 -Z。
 *
 * 等级标注（H 史料交叉核实 / I 依营造则例推算 / S 示意性构图）：
 *  - 月台边长 11.100m        H
 *  - 柱高 4.290m             H
 *  - 八面、每面三间           H
 *  - 三圈 40 柱（24 圆 16 方） H
 *  - 建筑投影边长 8.931m     H+I（按 384.95㎡ 等面积推算，属假设）
 *  - 中/内圈半径、斗栱、彩画尺寸等  I
 *  - 远景方位与距离           S
 */

/* ============================================================ 常量与工具 */

export const DEG = Math.PI / 180;

/** 正八边形面积 = 2(1+√2) · s² */
export function octagonArea(side) {
  return 2 * (1 + Math.SQRT2) * side * side;
}

/** 正八边形外接圆半径 R = s / (2·sin(π/8)) */
export function octagonCircumradius(side) {
  return side / (2 * Math.sin(Math.PI / 8));
}

/** 正八边形内切半径 r = s / (2·tan(π/8)) */
export function octagonApothem(side) {
  return side / (2 * Math.tan(Math.PI / 8));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 角度归一到 (-π, π] */
export function wrapAngle(a) {
  const two = Math.PI * 2;
  let x = (a + Math.PI) % two;
  if (x < 0) x += two;
  return x - Math.PI;
}

/* ============================================================ 模型配置 */

/**
 * PAVILION_CONFIG —— 平面只用这一套模型配置定义（规划案 §5.2）。
 * 几何函数接收配置，不读取 DOM。
 */
export const PAVILION_CONFIG = Object.freeze({
  /** 八方月台：边长 H；表面高与厚度 I */
  platform: Object.freeze({
    side: 11.1,
    topY: 0.65,
    thickness: 0.65,
    wallHeight: 1.16,
    wallThickness: 0.25,
    balusterSpacing: 2.7,
    balusterHeight: 1.34,
    cornerPostHeight: 1.4,
    gateWidth: 1.8,
    gateHeight: 1.28,
  }),

  /** 建筑投影：按简报建筑面积 384.95㎡ 等面积推算的八边形边长 H+I */
  footprint: Object.freeze({
    area: 384.95,
    side: 8.931, // = sqrt(384.95 / [2(1+√2)])
    circumradius: 11.669,
  }),

  /** 三圈柱位 H（柱数与种类）/ I（分圈分配与半径） */
  columns: Object.freeze({
    height: 4.29,
    roundDiameter: 0.4,
    squareSide: 0.36,
    plinthHeight: 0.24,
    plinthOuterDiameter: 0.76,
    outerRingScale: 1.0,
    middleRingScale: 0.76,
    innerRingScale: 0.48,
  }),

  /** 台明与踏跺 I */
  terrace: Object.freeze({
    stoneHeight: 0.48,
    innerStepHeight: 0.18,
    stairCount: 6,
    stairRise: 0.108,
    stairTread: 0.34,
    stairWidth: 2.1,
    stairSides: ['east', 'west', 'south'],
  }),

  /** 地坪与坐凳 I */
  floor: Object.freeze({
    goldBrickY: 0.69,
    brickSize: 0.3,
    benchHeight: 0.46,
    benchDepth: 0.38,
    walkwayClearWidth: 1.2,
  }),

  /** 柱顶枋檩：六檩 H，尺寸 I */
  framing: Object.freeze({
    eaveFangSection: [0.32, 0.4],
    innerFangSection: [0.3, 0.38],
    purlinSize: 0.22,
    purlinsPerRadial: 3,
  }),

  /** 重檐屋顶：八脊双檐 H，具体数值 I */
  roof: Object.freeze({
    levels: Object.freeze({
      lower: Object.freeze({
        rmax: 12.65,
        eaveY: 5.42,
        innerR: 8.2,
        innerY: 6.88,
        tileThickness: 0.12,
        ridgeCount: 8,
      }),
      upper: Object.freeze({
        rmax: 8.38,
        eaveY: 7.14,
        innerR: 0.72,
        innerY: 9.5,
        tileThickness: 0.12,
        ridgeCount: 8,
      }),
    }),
    /** 曲线形状参数：lerp 指数、檐端下垂、上翘高斯 */
    profile: Object.freeze({
      exponent: 1.15,
      eaveSag: 0.16,
      flareAmp: 0.08,
      flareCenter: 0.8,
      flareWidth: 0.11,
    }),
    /** 圆宝顶 H（底半径/顶半径/高为 I） */
    finial: Object.freeze({
      baseRadius: 0.62,
      topRadius: 0.1,
      height: 0.95,
      topY: 10.45,
    }),
    /** 吻兽：上檐 8 + 下檐 8 = 16（数量 H，布局 I） */
    beastCount: 16,
  }),

  /** 斗栱：存在 H，踩数/层数 I */
  brackets: Object.freeze({
    perOuterColumn: true,
    extraWhenGapOver: 2.6,
    layers: 3,
    projection: 0.38,
    layerRise: 0.14,
    totalHeight: 0.42,
    baseY: 5.06,
    upperGroups: 8,
  }),

  /** 雀替与笼花：存在 H，数量与尺寸 I */
  brackets2: Object.freeze({
    queTiCount: 48,
    queTiThickness: 0.065,
    queTiLength: 0.65,
    queTiDrop: 0.45,
    longhuaCount: 24,
    longhuaPerSide: 3,
  }),

  /** 藻井与匾额：有藻井/8 匾/东匾 H，具体文本尺寸 I */
  ceiling: Object.freeze({
    apothem: 3.65,
    centerY: 7.85,
    rings: 3,
    shrinkPerRing: 0.32,
    plaqueWidth: 1.9,
    plaqueHeight: 0.48,
    plaqueThickness: 0.07,
    plaqueY: 4.3,
    innerPlaqueCount: 8,
  }),

  /** 人物尺度 S */
  human: Object.freeze({
    height: 1.7,
    baseY: 0.65,
  }),

  /** 远处示意场景 S */
  landscape: Object.freeze({
    dikeLength: 85,
    dikeWidth: 18,
    lakeExtent: 600,
    bridgeStart: [-22, 0, -52],
    bridgeEnd: [-150, 0, -96],
    bridgeArches: 17,
    islandCenter: [-170, 0, -110],
    islandDiameter: 80,
    hillCenter: [-240, 0, -360],
    hillHeight: 55,
    foxiangge: [-235, 35, -370],
    foxianggeHeight: 41,
  }),
});

/* ============================================================ 几何函数 */

/**
 * 正八边形顶点。
 *
 * θ_i = 2πi/8 + rotation；x = R·sinθ、z = R·cosθ（+Z 为南）。
 * 默认 rotation = -π/8 ⇒ θ = -22.5° + i·45° ⇒
 * **八条边的中心分别落在正南(0°)、东南(45°)、正东(90°)…**
 * 这样规划案要求的「4 门开在东南西北方向中点」与「东面挂廓如亭匾」才落在面上。
 *
 * @param {number} side 八边形边长（米）
 * @param {number} [y] 顶点所在高度
 * @param {number} [rotation] 绕 Y 轴的整体旋转（弧度）
 * @returns {Array<[number, number, number]>} 8 个顶点
 */
export function makeOctagon(side, y = 0, rotation = -Math.PI / 8) {
  const R = octagonCircumradius(side);
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const theta = (2 * Math.PI * i) / 8 + rotation;
    pts.push([R * Math.sin(theta), y, R * Math.cos(theta)]);
  }
  return pts;
}

/**
 * 沿八边形各边取点，**不重复角点**。
 * 每条边取 t = 0, 1/3, 2/3 → 8×3 = 24 点；相邻边共享角点由 t=0 承担。
 * 于是每条边恰好 3 跨 ⇒ 每面显三间。
 *
 * @param {Array<[number, number, number]>} vertices makeOctagon 的输出
 * @param {number} [divisions] 每边取点数（含起点、不含终点）
 * @returns {Array<[number, number, number]>}
 */
export function interpolateSides(vertices, divisions = 3) {
  const out = [];
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    for (let k = 0; k < divisions; k += 1) {
      const t = k / divisions;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
    }
  }
  return out;
}

/**
 * 三圈柱位：外圈 24 根圆柱（8 角柱 + 每边 2 中柱），中/内圈各 8 根方柱。
 *
 * @param {typeof PAVILION_CONFIG} [config]
 * @returns {Array<object>} 40 个语义化柱描述
 */
export function makeColumnLayout(config = PAVILION_CONFIG) {
  const c = config.columns;
  const fp = config.footprint;

  const baseY = config.platform.topY;
  const plinthTopY = baseY + c.plinthHeight;
  const topY = plinthTopY + c.height;

  const outer = makeOctagon(fp.side, baseY);
  const outerPoints = interpolateSides(outer, 3);

  /** 中圈与内圈：与外圈角点同角序的同心正八边形 */
  const angleOf = (p) => Math.atan2(p[0], p[2]);
  const cornerAngles = outer.map(angleOf);

  const columns = [];

  outerPoints.forEach((p, i) => {
    columns.push({
      id: `column-outer-${String(i + 1).padStart(2, '0')}`,
      ring: 'outer',
      kind: 'round',
      x: p[0],
      z: p[2],
      angle: angleOf(p),
      radius: c.roundDiameter / 2,
      side: 0,
      baseY,
      plinthTopY,
      topY,
      height: c.height,
    });
  });

  const ringSpec = [
    { name: 'middle', scale: c.middleRingScale, idPrefix: 'column-middle' },
    { name: 'inner', scale: c.innerRingScale, idPrefix: 'column-inner' },
  ];

  for (const ring of ringSpec) {
    const R = fp.circumradius * ring.scale;
    cornerAngles.forEach((angle, i) => {
      columns.push({
        id: `${ring.idPrefix}-${String(i + 1).padStart(2, '0')}`,
        ring: ring.name,
        kind: 'square',
        x: R * Math.sin(angle),
        z: R * Math.cos(angle),
        angle,
        radius: 0,
        side: c.squareSide,
        rotation: Math.PI / 4, // 方柱转 45° 向八方
        baseY,
        plinthTopY,
        topY,
        height: c.height,
      });
    });
  }

  return columns;
}

/**
 * 屋面剖面曲线。
 *
 * 原始曲线（规划案 §5.2）：
 *   raw(r) = lerp(eaveY, innerY, pow(clamp(1 - r/rmax), 1.15))
 *          - 0.16·(r/rmax)⁸
 *          + 0.08·exp(-((r - 0.8·rmax)/(0.11·rmax))²)
 *
 * 再做**端点归一**：线性缩放，使 r = rmax 精确落在 eaveY、r = innerR 精确落在 innerY
 * （规划案：「檐口高由 curve 公式结果与标称差需在构建时统一归一到指定值」）。
 *
 * @param {number} r 距亭心的水平半径（米）
 * @param {'lower'|'upper'} level 檐别
 * @param {typeof PAVILION_CONFIG} [config]
 * @returns {number} 高度（米）
 */
export function roofProfile(r, level, config = PAVILION_CONFIG) {
  const L = config.roof.levels[level];
  const P = config.roof.profile;
  const raw = (x) => {
    const t = clamp(x / L.rmax, 0, 1);
    const base = lerp(L.eaveY, L.innerY, Math.pow(1 - t, P.exponent));
    const sag = -P.eaveSag * Math.pow(t, 8);
    const d = (x - P.flareCenter * L.rmax) / (P.flareWidth * L.rmax);
    const flare = P.flareAmp * Math.exp(-d * d);
    return base + sag + flare;
  };
  const rawEave = raw(L.rmax);
  const rawInner = raw(L.innerR);
  const span = rawInner - rawEave;
  const k = Math.abs(span) < 1e-9 ? 1 : (L.innerY - L.eaveY) / span;
  return L.eaveY + (raw(clamp(r, 0, L.rmax)) - rawEave) * k;
}

/* ============================================================ 校验 */

/**
 * 规划案 AC03 的几何自检。
 *
 * @param {typeof PAVILION_CONFIG} config
 * @param {Array<object>} columns makeColumnLayout 的输出
 * @param {Array<{id:string}>} [parts] 全部构件记录（提供时校验 ID 唯一）
 * @returns {{ok: boolean, failures: string[], metrics: object}}
 */
export function validatePavilion(config, columns, parts = null) {
  const failures = [];
  const EPS = 0.001;

  const platformSide = config.platform.side;
  if (Math.abs(platformSide - 11.1) > EPS) {
    failures.push(`月台边长 ${platformSide} ≠ 11.1m（±0.001）`);
  }

  const colH = config.columns.height;
  if (Math.abs(colH - 4.29) > EPS) {
    failures.push(`柱高 ${colH} ≠ 4.29m（±0.001）`);
  }

  if (columns.length !== 40) {
    failures.push(`柱总数 ${columns.length} ≠ 40`);
  }
  const round = columns.filter((c) => c.kind === 'round').length;
  const square = columns.filter((c) => c.kind === 'square').length;
  if (round !== 24) failures.push(`圆柱 ${round} ≠ 24`);
  if (square !== 16) failures.push(`方柱 ${square} ≠ 16`);

  const ids = columns.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    failures.push('柱构件 ID 不唯一');
  }

  if (parts) {
    const pids = parts.map((p) => p.id);
    if (new Set(pids).size !== pids.length) {
      failures.push('构件 ID 不唯一');
    }
  }

  // 八面三间：外圈 24 点分布在 8 条边上，每边 3 跨
  const outer = columns.filter((c) => c.ring === 'outer');
  const perEdge = new Map();
  for (const c of outer) {
    const edge = Math.floor(((c.angle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI / 4));
    perEdge.set(edge, (perEdge.get(edge) || 0) + 1);
  }
  if (perEdge.size !== 8) failures.push(`外圈分布边数 ${perEdge.size} ≠ 8`);
  for (const [edge, n] of perEdge) {
    if (n !== 3) failures.push(`第 ${edge} 边柱位 ${n} ≠ 3`);
  }

  // 双檐八脊 + 圆宝顶
  const L = config.roof.levels;
  if (!(L.lower && L.upper)) failures.push('缺少上/下檐定义');
  if (L.lower.ridgeCount !== 8 || L.upper.ridgeCount !== 8) {
    failures.push('上下檐垂脊数不是各 8');
  }
  if (config.roof.finial.baseRadius <= 0 || config.roof.finial.height <= 0) {
    failures.push('圆宝顶定义缺失');
  }
  if (config.roof.beastCount !== 16) {
    failures.push(`吻兽总数 ${config.roof.beastCount} ≠ 16`);
  }

  // 剖面曲线端点归一
  for (const level of ['lower', 'upper']) {
    const eave = roofProfile(L[level].rmax, level, config);
    const inner = roofProfile(L[level].innerR, level, config);
    if (Math.abs(eave - L[level].eaveY) > 1e-6) {
      failures.push(`${level} 檐口归一失败：${eave} ≠ ${L[level].eaveY}`);
    }
    if (Math.abs(inner - L[level].innerY) > 1e-6) {
      failures.push(`${level} 内侧归一失败：${inner} ≠ ${L[level].innerY}`);
    }
  }

  const metrics = {
    platformArea: octagonArea(platformSide),
    platformCircumradius: octagonCircumradius(platformSide),
    platformApothem: octagonApothem(platformSide),
    footprintArea: octagonArea(config.footprint.side),
    footprintCircumradius: config.footprint.circumradius,
    roundColumns: round,
    squareColumns: square,
    totalColumns: columns.length,
    ridgeTopY: config.roof.finial.topY,
  };

  return { ok: failures.length === 0, failures, metrics };
}

/* ============================================================ 其它工具 */

/** 相机预设（世界米）—— 规划案 §4 */
export const CAMERA_PRESETS = Object.freeze({
  overview: { eye: [28, 16, 29], target: [0, 5, 0] },
  south: { eye: [0, 9, 32], target: [0, 5.2, 0] },
  east: { eye: [32, 9, 0], target: [0, 5.2, 0] },
  carpentry: { eye: [12, 7.7, 10], target: [1.5, 5.6, 1] },
  ceiling: { eye: [0, 3.4, 1.4], target: [0, 7.8, 0] },
  platform: { eye: [19, 3.3, 12], target: [4, 1, 0] },
});

/** 四时刻的太阳参数（艺术定向，非天文精确）—— 规划案 §5.3 */
export const TIME_OF_DAY = Object.freeze({
  dawn: { azimuth: -110, elevation: 12, color: 0xffc79a, intensity: 1.7, exposure: 1.0, lamp: 0 },
  noon: { azimuth: -155, elevation: 56, color: 0xfff4e2, intensity: 3.2, exposure: 1.05, lamp: 0 },
  dusk: { azimuth: 105, elevation: 10, color: 0xffb066, intensity: 1.5, exposure: 1.0, lamp: 0.25 },
  night: { azimuth: 160, elevation: -18, color: 0xa8c0ff, intensity: 0.13, exposure: 0.75, lamp: 0.65 },
});

/** 四季色表 —— 规划案 §5.3 */
export const SEASONS = Object.freeze({
  spring: { leaf: 0x658754, water: 0x416f72, fog: 0.009, leafFall: 0 },
  summer: { leaf: 0x2f714c, water: 0x356c74, fog: 0.007, leafFall: 0 },
  autumn: { leaf: 0xaa793d, water: 0x536d70, fog: 0.012, leafFall: 0.35 },
  winter: { leaf: 0x756a55, water: 0x617a84, fog: 0.015, leafFall: 0.65 },
});
