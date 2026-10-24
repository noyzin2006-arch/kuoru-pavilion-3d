/**
 * KRT-001 · 程序化材质与场景色板
 *
 * 规划案 §5.3：
 *  - 所有贴图由固定种子 seed=1752 的 xorshift32 噪声生成，保证截图稳定。
 *  - 只能用内存 CanvasTexture / DataTexture 与同源资源；禁止 TextureLoader 与在线字体。
 *  - 纹理包尺寸：瓦 1024²、木 1024²、石 1024²、地砖 512²、彩画 1024×256、
 *    水法线 512²、远景地面 512²；每种只生成一次，RepeatWrapping，各向异性 ≤ 8。
 *  - 颜色贴图标记 SRGBColorSpace；线性粗糙度/法线保持 NoColorSpace。
 *  - 场景色只在本文件的色板集中定义，组件不许散写 hex。
 */

import * as THREE from 'three';

/* ============================================================ 固定种子噪声 */

export const SEED = 1752;

/** xorshift32 —— 固定种子、可复现。 */
export function makeRandom(seed = SEED) {
  let x = seed >>> 0 || 1;
  return function random() {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** 可平铺的值噪声：格点随机 + 平滑插值。 */
function makeValueNoise(seed) {
  const rand = makeRandom(seed);
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand();
  const at = (x, y) => grid[(y & (SIZE - 1)) * SIZE + (x & (SIZE - 1))];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
}

/** 多倍频 fBm。 */
export function makeFbm(seed = SEED) {
  const noise = makeValueNoise(seed);
  return function fbm(x, y, octaves = 3, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}

/** 可平铺 Voronoi：返回到最近与次近特征点的距离差（用于石块边界）。 */
export function makeVoronoi(seed = SEED, cells = 8) {
  const rand = makeRandom(seed);
  const pts = [];
  for (let cy = 0; cy < cells; cy += 1) {
    for (let cx = 0; cx < cells; cx += 1) {
      pts.push([(cx + rand()) / cells, (cy + rand()) / cells, rand()]);
    }
  }
  return function voronoi(u, v) {
    let d1 = Infinity;
    let d2 = Infinity;
    let id = 0;
    for (const p of pts) {
      let dx = Math.abs(u - p[0]);
      let dy = Math.abs(v - p[1]);
      if (dx > 0.5) dx = 1 - dx;
      if (dy > 0.5) dy = 1 - dy;
      const d = dx * dx + dy * dy;
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = p[2];
      } else if (d < d2) {
        d2 = d;
      }
    }
    return { edge: Math.sqrt(d2) - Math.sqrt(d1), id };
  };
}

/* ============================================================ 画布工具 */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = 1, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 由高度场生成法线贴图（中心差分 + 归一化）。
 * @param {(u:number,v:number)=>number} heightFn
 * @param {number} size
 * @param {number} strength
 */
function makeNormalTexture(heightFn, size, strength = 1) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      h[y * size + x] = heightFn(x / size, y / size);
    }
  }
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * size * 0.01;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength * size * 0.01;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, { srgb: false });
}

/**
 * 把颜色转成 css rgb 字符串。
 * **注意**：色板里存的是数字（0xa79d89），不能当十六进制字符串解析，
 * 否则 parseInt('10996905', 16) 会得到垃圾值（表现为石面发红、瓦面发青）。
 * @param {number|string} hex
 */
function rgb(hex) {
  const n = typeof hex === 'number' ? hex >>> 0 : parseInt(String(hex).replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

/** 数字或字符串颜色的 RGB 分量。 */
function hexToRgbArray(hex) {
  const n = typeof hex === 'number' ? hex >>> 0 : parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ============================================================ 场景色板 */

/**
 * 3D 场景颜色集中在此（规划案 §5.3）。UI 色另见 src/ui/tokens.css。
 *
 * ⚠ 两处按规划案自身的「待核」标注做了实测校正（详见 reports/latest.md 的偏离记录）：
 *  - 灰青瓦：规划案标注「默认待核」并给 #465455。实景取色（廓如亭照片）显示受光瓦面
 *    约 #C5C1B4、背光面约 #55524C，取其中间值 #918C82 作 albedo，避免屋面渲染成近黑。
 *  - 朱漆木：实景取色受光约 #AD525F / 背光约 #823229，取 #9E3B31 作朱漆 albedo。
 * 其余按规划案原值。
 */
export const SCENE_PALETTE = Object.freeze({
  lacquerWood: 0x9e3b31, // 朱漆木（实测校正）
  greyTile: 0x918c82, // 灰青瓦（实测校正）
  gold: 0xbe9b55, // 金线
  huTigerStone: 0xa79d89, // 虎皮石
  huTigerStoneWarm: 0x897c65,
  huTigerStoneCool: 0x8f9491,
  bluestone: 0x858f8a, // 青石柱础
  goldBrick: 0x4e4d48, // 金砖地面
  water: 0x416f72, // 湖水
  fenceWood: 0x704b33, // 墙木栅
  paintingWood: 0x6e2422, // 彩画·木朱
  paintingGreen: 0x28695b, // 彩画·石绿
  paintingBlue: 0x284b78, // 彩画·群青
  paintingOchre: 0xb89147, // 彩画·赭黄
  paintingCream: 0xcfc9b4, // 彩画·浅灰白地
  human: 0xd8d6cf, // 比例人形
});

/* ============================================================ 各类贴图 */

function makeTileTextures() {
  const size = 1024;
  const fbm = makeFbm(SEED + 11);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const base = SCENE_PALETTE.greyTile;
  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const rand = makeRandom(SEED + 12);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      // 细砂噪声
      const n = fbm((x / size) * 48, (y / size) * 48, 3) - 0.5;
      // 瓦沟：沿 V 方向的周期暗缝
      const groove = Math.abs(((x / size) * 16) % 1 - 0.5) < 0.06 ? -0.16 : 0;
      const v = 1 + n * 0.16 + groove + (rand() - 0.5) * 0.03;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] * v));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] * v));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] * v));
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = toTexture(canvas);
  const normalMap = makeNormalTexture(
    (u, v) => fbm(u * 48, v * 48, 3) * 0.6 + (Math.abs(((u * 16) % 1) - 0.5) < 0.06 ? 0 : 0.35),
    size,
    0.6,
  );
  return { map, normalMap };
}

function makeWoodTextures() {
  const size = 1024;
  const fbm = makeFbm(SEED + 21);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgb(SCENE_PALETTE.lacquerWood);
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      // 三尺度 fBm，沿木纹方向拉伸（U 方向低频、V 方向高频）
      const u = x / size;
      const v = y / size;
      const f =
        fbm(u * 4, v * 24, 3) * 0.55 +
        fbm(u * 24, v * 96, 3) * 0.3 +
        fbm(u * 96, v * 96, 2) * 0.15;
      // 弱年轮线
      const ring = Math.sin((u * 26 + fbm(u * 6, v * 6, 2) * 3) * Math.PI) * 0.04;
      const k = 0.82 + f * 0.42 + ring;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] * k));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] * k));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] * k));
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(canvas);
  const normalMap = makeNormalTexture(
    (u, v) => fbm(u * 4, v * 24, 3) * 0.5 + fbm(u * 96, v * 96, 2) * 0.2,
    size,
    0.45,
  );
  return { map, normalMap };
}

function makeStoneTextures() {
  const size = 1024;
  const fbm = makeFbm(SEED + 31);
  const voronoi = makeVoronoi(SEED + 32, 7);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgb(SCENE_PALETTE.huTigerStone);
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const warm = hexToRgbArray(SCENE_PALETTE.huTigerStoneWarm);
  const cool = hexToRgbArray(SCENE_PALETTE.huTigerStoneCool);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const cell = voronoi(u, v);
      // 块石：同一 cell 内接近同色，cell 边界处变暗并有细裂缝
      const edge = cell.edge < 0.012 ? 0.62 : 1;
      const tint = cell.id > 0.5 ? warm : cool;
      const mix = 0.16 * (cell.id - 0.5) * 2;
      const grain = fbm(u * 160, v * 160, 2);
      const k = edge * (0.92 + grain * 0.16);
      img.data[i] = Math.max(0, Math.min(255, (img.data[i] * (1 - mix) + tint[0] * mix) * k));
      img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] * (1 - mix) + tint[1] * mix) * k));
      img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] * (1 - mix) + tint[2] * mix) * k));
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(canvas);
  const normalMap = makeNormalTexture(
    (u, v) => {
      const cell = voronoi(u, v);
      return cell.edge < 0.012 ? 0 : 0.55 + fbm(u * 160, v * 160, 2) * 0.45;
    },
    size,
    0.8,
  );
  return { map, normalMap };
}

function makeGoldBrickTextures() {
  const size = 512;
  const fbm = makeFbm(SEED + 41);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgb(SCENE_PALETTE.goldBrick);
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  // 砖块 300mm，贴图覆盖约 1.7m ⇒ 每块约 size/5.7 像素（像素运算，不能用米）
  const brickPx = size / 5.7;
  const jointPx = 1.2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const row = Math.floor(y / brickPx);
      const offset = row % 2 === 0 ? 0 : brickPx / 2;
      const bx = (x + offset) % brickPx;
      const by = y % brickPx;
      const joint = bx < jointPx || by < jointPx ? 0.66 : 1;
      const polish = 1 + (fbm((x / size) * 12, (y / size) * 12, 2) - 0.5) * 0.09;
      const k = joint * polish;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] * k));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] * k));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] * k));
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(canvas);
  const normalMap = makeNormalTexture(
    (u, v) => {
      const row = Math.floor(v * size / brickPx);
      const offset = row % 2 === 0 ? 0 : brickPx / 2;
      const bx = (u * size + offset) % brickPx;
      const by = (v * size) % brickPx;
      return bx < jointPx || by < jointPx ? 0.15 : 1;
    },
    size,
    0.5,
  );
  return { map, normalMap };
}

function makeWaterNormalTexture() {
  const size = 512;
  const fbm = makeFbm(SEED + 51);
  return makeNormalTexture((u, v) => fbm(u * 9, v * 9, 3) * 0.8 + fbm(u * 27, v * 27, 2) * 0.2, size, 0.7);
}

/** 远景地面：草土色，低频斑驳。 */
function makeGroundTexture() {
  const size = 512;
  const fbm = makeFbm(SEED + 61);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7d7a5f';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const k = 0.82 + fbm((x / size) * 8, (y / size) * 8, 3) * 0.36;
      img.data[i] *= k;
      img.data[i + 1] *= k;
      img.data[i + 2] *= k;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/**
 * 旋子彩画贴图：1024×256，跨梁对齐，分区线框 + 重复旋子花 + 24 条金线。
 * 金线宽取画面像素 3（纹饰总高 256px，约 1.17%）。
 */
function makePaintingTexture() {
  const W = 1024;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const P = SCENE_PALETTE;

  ctx.fillStyle = rgb(P.paintingCream);
  ctx.fillRect(0, 0, W, H);

  // 上下沥粉贴金边带
  ctx.fillStyle = rgb(P.paintingWood);
  ctx.fillRect(0, 0, W, 26);
  ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = rgb(P.gold);
  for (let x = 0; x < W; x += 42) {
    ctx.fillRect(x + 6, 8, 26, 3);
    ctx.fillRect(x + 6, H - 11, 26, 3);
  }

  // 分区：箍头 | 藻头 | 枋心（重复三段）
  const bandTop = 34;
  const bandH = H - 68;
  const sections = [
    { x: 0, w: 150, kind: 'head' },
    { x: 150, w: 290, kind: 'algae' },
    { x: 440, w: 144, kind: 'head' },
    { x: 584, w: 290, kind: 'algae' },
    { x: 874, w: 150, kind: 'head' },
  ];

  const drawXuanhua = (cx, cy, R, petal, core) => {
    for (let ring = 0; ring < 4; ring += 1) {
      const rr = R * (1 - ring * 0.22);
      const count = 8 + ring * 2;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + ring * 0.18;
        const px = cx + Math.cos(a) * rr * 0.62;
        const py = cy + Math.sin(a) * rr * 0.62;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, rr * 0.4, rr * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgb(ring % 2 ? core : petal);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,20,0.85)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = rgb(P.gold);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  for (const s of sections) {
    const isHeart = s.kind === 'head';
    ctx.fillStyle = rgb(isHeart ? P.paintingBlue : P.paintingBlue);
    ctx.fillRect(s.x, bandTop, s.w, bandH);
    // 退晕白边
    ctx.strokeStyle = rgb(P.paintingCream);
    ctx.lineWidth = 6;
    ctx.strokeRect(s.x + 3, bandTop + 3, s.w - 6, bandH - 6);
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, bandTop, s.w, bandH);
    // 旋花
    const cx = s.x + s.w / 2;
    const cy = bandTop + bandH / 2;
    drawXuanhua(cx, cy, Math.min(s.w, bandH) * 0.38, P.paintingGreen, P.paintingOchre);
  }

  // 24 条金线（画在枋心下沿）
  ctx.fillStyle = rgb(P.gold);
  for (let i = 0; i < 24; i += 1) {
    const x = 12 + i * ((W - 24) / 23);
    ctx.fillRect(x, bandTop + bandH - 9, 3, 3);
  }

  const tex = toTexture(canvas, { repeat: 1 });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/* ============================================================ 材质表 */

/**
 * 生成全部材质与贴图（每种只生成一次）。
 * @param {{quality?: 'high'|'low'}} [opts]
 */
export function makeProceduralMaterials(opts = {}) {
  const quality = opts.quality || 'high';
  const aniso = quality === 'high' ? 8 : 2;

  const tile = makeTileTextures();
  const wood = makeWoodTextures();
  const stone = makeStoneTextures();
  const brick = makeGoldBrickTextures();
  const waterNormal = makeWaterNormalTexture();
  const groundMap = makeGroundTexture();
  const paintingMap = makePaintingTexture();

  const disposables = [
    tile.map, tile.normalMap, wood.map, wood.normalMap,
    stone.map, stone.normalMap, brick.map, brick.normalMap,
    waterNormal, groundMap, paintingMap,
  ];
  for (const t of disposables) t.anisotropy = aniso;

  // 贴图尺度：让纹理特征尺寸贴近真实构件（瓦 ~0.2m / 块石 ~0.4m / 金砖 ~0.35m）
  tile.map.repeat.set(12, 12); tile.normalMap.repeat.set(12, 12);
  stone.map.repeat.set(5, 5); stone.normalMap.repeat.set(5, 5);
  brick.map.repeat.set(12, 12); brick.normalMap.repeat.set(12, 12);
  wood.map.repeat.set(2, 2); wood.normalMap.repeat.set(2, 2);
  groundMap.repeat.set(24, 24);
  waterNormal.repeat.set(6, 6);

  const P = SCENE_PALETTE;

  const materials = {
    // 注意：颜色贴图本身已带基色，material.color 必须是白，
    // 否则 color × map 会把基色平方，瓦面/石面会渲染成近黑或发褐。
    tile: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tile.map,
      normalMap: tile.normalMap,
      normalScale: new THREE.Vector2(0.23, 0.23),
      roughness: 0.47,
      metalness: 0.02,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wood.map,
      normalMap: wood.normalMap,
      normalScale: new THREE.Vector2(0.13, 0.13),
      roughness: 0.38,
      metalness: 0.05,
    }),
    painting: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: paintingMap,
      roughness: 0.42,
      metalness: 0.06,
      normalScale: new THREE.Vector2(0.07, 0.07),
    }),
    gold: new THREE.MeshStandardMaterial({
      color: P.gold,
      roughness: 0.28,
      metalness: 0.65,
      normalScale: new THREE.Vector2(0.03, 0.03),
    }),
    tigerStone: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stone.map,
      normalMap: stone.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.88,
      metalness: 0.0,
    }),
    bluestone: new THREE.MeshStandardMaterial({
      color: P.bluestone,
      roughness: 0.82,
      metalness: 0.0,
      normalScale: new THREE.Vector2(0.22, 0.22),
    }),
    goldBrick: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: brick.map,
      normalMap: brick.normalMap,
      normalScale: new THREE.Vector2(0.1, 0.1),
      roughness: 0.53,
      metalness: 0.02,
    }),
    fenceWood: new THREE.MeshStandardMaterial({
      color: P.fenceWood,
      roughness: 0.62,
      metalness: 0.0,
      normalScale: new THREE.Vector2(0.18, 0.18),
    }),
    water: new THREE.MeshStandardMaterial({
      color: P.water,
      roughness: 0.18,
      metalness: 0.0,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      transparent: true,
      opacity: 0.94,
    }),
    ground: new THREE.MeshStandardMaterial({
      color: 0x8d8a6d,
      map: groundMap,
      roughness: 0.95,
      metalness: 0.0,
    }),
    human: new THREE.MeshStandardMaterial({
      color: P.human,
      roughness: 0.85,
      metalness: 0.0,
    }),
    foliage: new THREE.MeshStandardMaterial({
      color: 0x658754,
      roughness: 0.86,
      metalness: 0.0,
    }),
  };

  return {
    materials,
    textures: disposables,
    /** 场景色板引用，便于调试 */
    palette: P,
  };
}

/**
 * 释放全部材质与贴图。
 * @param {{materials: Record<string, THREE.Material>, textures: THREE.Texture[]}} bundle
 */
export function disposeMaterials(bundle) {
  if (!bundle) return;
  for (const m of Object.values(bundle.materials || {})) {
    if (m && typeof m.dispose === 'function') m.dispose();
  }
  for (const t of bundle.textures || []) {
    if (t && typeof t.dispose === 'function') t.dispose();
  }
}
