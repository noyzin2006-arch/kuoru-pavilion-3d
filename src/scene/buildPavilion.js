/**
 * KRT-001 · 廓如亭本体装配
 *
 * 规划案 §5.1：`buildPavilion(config, resources) -> {root, parts: Map, metrics, dispose}`
 * 规划案 §5.2：八方月台、虎皮石台明与垂带踏跺、宇墙木门、三圈 40 柱/柱础、
 *   枋梁、六檩、斗栱、雀替笼花板、重檐八脊攒尖屋顶/吻兽/圆宝顶、藻井、八匾、坐凳金砖。
 */

import * as THREE from 'three';
import { makeOctagon, makeColumnLayout, octagonCircumradius } from '../core/geometry.js';
import { buildLowerRoof, buildUpperRoof, buildFinial } from './roof.js';
import {
  buildBrackets,
  buildPaintings,
  buildPurlins,
  buildBracketsDecoration,
  buildCeiling,
  buildPlaques,
} from './carpentry.js';

/** 正八棱柱（与 makeOctagon 的朝向一致：边心落在正南/正东/正北/正西）。 */
function makeOctagonalPrism(side, height, y0, material, rotation = -Math.PI / 8) {
  const R = octagonCircumradius(side);
  const geo = new THREE.CylinderGeometry(R, R, height, 8, 1, false, rotation + Math.PI / 2);
  geo.translate(0, y0 + height / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 装配亭体。
 * @param {object} config PAVILION_CONFIG
 * @param {{materials: Record<string, THREE.Material>}} resources
 * @param {{quality?: 'high'|'low'}} [opts]
 */
export function buildPavilion(config, resources, opts = {}) {
  const quality = opts.quality || 'high';
  const root = new THREE.Group();
  root.name = 'kuoru-pavilion';
  /** @type {Map<string, THREE.Object3D>} */
  const parts = new Map();

  /**
   * 亭体使用自己的材质副本：剖切（clippingPlanes）只作用于亭体，
   * 避免污染远景共享材质（规划案 §5.5「关闭立刻移除裁剪以避免材质共享污染」）。
   * 贴图对象仍然共享，程序缓存按参数复用 shader program。
   */
  const materials = {};
  for (const [key, mat] of Object.entries(resources.materials)) {
    const clone = mat.clone();
    clone.name = `pavilion-${key}`;
    materials[key] = clone;
  }
  const pavilionMaterials = Object.values(materials);

  const P = config.platform;
  const C = config.columns;
  const floorY = P.topY;

  /* ---------------------------------------------------- 月台（虎皮石台明） */
  const platformGroup = new THREE.Group();
  platformGroup.name = 'platform';
  const platform = makeOctagonalPrism(P.side, P.thickness, 0, materials.tigerStone);
  platform.name = 'platform-stone';
  platformGroup.add(platform);
  root.add(platformGroup);
  parts.set('platform-terrace', platformGroup);

  /* ---------------------------------------------------- 垂带踏跺（东/西/南） */
  const stairGroup = new THREE.Group();
  stairGroup.name = 'stairs';
  const t = config.terrace;
  const stairGeoms = [];
  for (const side of t.stairSides) {
    const dir = side === 'south' ? [0, 1] : side === 'east' ? [1, 0] : [-1, 0];
    const apothem = octagonCircumradius(P.side) * Math.cos(Math.PI / 8);
    const stepGeoms = [];
    for (let i = 0; i < t.stairCount; i += 1) {
      const y = t.stairRise * (i + 1);
      const depth = t.stairTread;
      const g = new THREE.BoxGeometry(
        side === 'south' ? t.stairWidth : depth,
        t.stairRise,
        side === 'south' ? depth : t.stairWidth,
      );
      const d = apothem + depth * (t.stairCount - i) - depth * 0.5;
      g.translate(dir[0] * d, y - t.stairRise / 2, dir[1] * d);
      stepGeoms.push(g);
    }
    // 垂带
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.16, t.stairRise * t.stairCount + 0.06, t.stairTread * t.stairCount + 0.2);
      const d = apothem + (t.stairTread * t.stairCount) / 2;
      const off = (t.stairWidth / 2) * s;
      if (side === 'south') g.translate(off, (t.stairRise * t.stairCount) / 2, d);
      else {
        g.rotateY(Math.PI / 2);
        g.translate(d, (t.stairRise * t.stairCount) / 2, off);
      }
      stepGeoms.push(g);
    }
    stairGeoms.push(...stepGeoms);
  }
  const stairs = new THREE.Mesh(mergeAll(stairGeoms), materials.tigerStone);
  stairs.castShadow = true;
  stairs.receiveShadow = true;
  stairs.name = 'stairs';
  stairGroup.add(stairs);
  root.add(stairGroup);
  parts.set('stairs', stairGroup);

  /* ---------------------------------------------------- 宇墙、望柱与木栅栏门 */
  const wallGroup = new THREE.Group();
  wallGroup.name = 'wall';
  const oct = makeOctagon(P.side, floorY);
  const gateDirs = [
    [0, 1], // 南
    [1, 0], // 东
    [0, -1], // 北
    [-1, 0], // 西
  ];
  const wallGeoms = [];
  const fenceGeoms = [];
  const postGeoms = [];
  for (let i = 0; i < 8; i += 1) {
    const a = oct[i];
    const c = oct[(i + 1) % 8];
    const mx = (a[0] + c[0]) / 2;
    const mz = (a[2] + c[2]) / 2;
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const angle = Math.atan2(c[0] - a[0], c[2] - a[2]);

    // 该边是否是门洞所在（4 个方向中点）
    const midDir = [mx / (octagonCircumradius(P.side) * Math.cos(Math.PI / 8)), mz / (octagonCircumradius(P.side) * Math.cos(Math.PI / 8))];
    const isGate = gateDirs.some((d) => Math.abs(midDir[0] - d[0]) < 0.2 && Math.abs(midDir[1] - d[1]) < 0.2);

    if (isGate) {
      // 门两侧的墙
      const half = len / 2 - P.gateWidth / 2;
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(P.wallThickness, P.wallHeight, half);
        g.rotateY(angle);
        const off = (half / 2 + P.gateWidth / 2) * s;
        const px = mx + Math.cos(angle + Math.PI / 2) * off;
        const pz = mz + Math.sin(angle + Math.PI / 2) * off;
        g.translate(px, floorY + P.wallHeight / 2, pz);
        wallGeoms.push(g);
      }
      // 木栅栏门
      const gate = new THREE.BoxGeometry(P.gateWidth, P.gateHeight, 0.06);
      gate.rotateY(angle);
      gate.translate(mx, floorY + P.gateHeight / 2, mz);
      fenceGeoms.push(gate);
      // 栅条
      const bars = 7;
      for (let b = 0; b < bars; b += 1) {
        const t2 = (b + 0.5) / bars;
        const g = new THREE.BoxGeometry(0.05, P.gateHeight * 0.9, 0.08);
        g.rotateY(angle);
        const along = (t2 - 0.5) * (P.gateWidth - 0.1);
        const px = mx + Math.cos(angle) * along;
        const pz = mz - Math.sin(angle) * along;
        g.translate(px, floorY + P.gateHeight * 0.45, pz);
        fenceGeoms.push(g);
      }
    } else {
      const g = new THREE.BoxGeometry(P.wallThickness, P.wallHeight, len);
      g.rotateY(angle);
      g.translate(mx, floorY + P.wallHeight / 2, mz);
      wallGeoms.push(g);
    }

    // 望柱
    const posts = Math.max(2, Math.round(len / P.balusterSpacing));
    for (let k = 0; k <= posts; k += 1) {
      const t2 = k / posts;
      const px = a[0] + (c[0] - a[0]) * t2;
      const pz = a[2] + (c[2] - a[2]) * t2;
      const isCorner = k === 0 || k === posts;
      const h = isCorner ? P.cornerPostHeight : P.balusterHeight;
      const g = new THREE.BoxGeometry(0.14, h, 0.14);
      g.translate(px, floorY + h / 2, pz);
      postGeoms.push(g);
    }
  }
  const wall = new THREE.Mesh(mergeAll(wallGeoms), materials.tigerStone);
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.name = 'wall';
  wallGroup.add(wall);
  const fence = new THREE.Mesh(mergeAll(fenceGeoms), materials.fenceWood);
  fence.castShadow = true;
  fence.name = 'gates';
  wallGroup.add(fence);
  const posts = new THREE.Mesh(mergeAll(postGeoms), materials.tigerStone);
  posts.castShadow = true;
  posts.name = 'balusters';
  wallGroup.add(posts);
  root.add(wallGroup);
  parts.set('platform-wall', wallGroup);

  /* ---------------------------------------------------- 金砖地坪 */
  const floor = makeOctagonalPrism(config.footprint.side, 0.04, floorY + 0.01, materials.goldBrick);
  floor.name = 'gold-brick-floor';
  root.add(floor);
  parts.set('floor', floor);

  /* ---------------------------------------------------- 三圈 40 柱与柱础 */
  const columnGroup = new THREE.Group();
  columnGroup.name = 'columns';
  const columns = makeColumnLayout(config);
  const roundGeoms = [];
  const squareGeoms = [];
  const plinthGeoms = [];
  for (const col of columns) {
    if (col.kind === 'round') {
      const g = new THREE.CylinderGeometry(col.radius * 0.94, col.radius, col.height, 16, 1);
      g.translate(col.x, col.plinthTopY + col.height / 2, col.z);
      roundGeoms.push(g);
    } else {
      const g = new THREE.BoxGeometry(col.side * 0.94, col.side, col.height);
      g.rotateY(col.rotation);
      g.translate(col.x, col.plinthTopY + col.height / 2, col.z);
      squareGeoms.push(g);
    }
    // 八角柱础
    const pg = new THREE.CylinderGeometry(
      C.plinthOuterDiameter / 2,
      C.plinthOuterDiameter / 2 * 1.04,
      C.plinthHeight,
      8,
      1,
      false,
      -Math.PI / 8 + Math.PI / 2,
    );
    pg.translate(col.x, col.baseY + C.plinthHeight / 2, col.z);
    plinthGeoms.push(pg);
  }
  const roundCols = new THREE.Mesh(mergeAll(roundGeoms), materials.wood);
  roundCols.castShadow = true;
  roundCols.receiveShadow = true;
  roundCols.name = 'columns-round';
  columnGroup.add(roundCols);
  const squareCols = new THREE.Mesh(mergeAll(squareGeoms), materials.wood);
  squareCols.castShadow = true;
  squareCols.name = 'columns-square';
  columnGroup.add(squareCols);
  const plinths = new THREE.Mesh(mergeAll(plinthGeoms), materials.bluestone);
  plinths.castShadow = true;
  plinths.receiveShadow = true;
  plinths.name = 'plinths';
  columnGroup.add(plinths);
  root.add(columnGroup);
  parts.set('columns-three-rings', columnGroup);

  /* ---------------------------------------------------- 坐凳 */
  const benchGroup = new THREE.Group();
  benchGroup.name = 'benches';
  const benchGeoms = [];
  const b = config.floor;
  const benchRingR = config.footprint.circumradius - 0.35;
  for (let i = 0; i < 8; i += 1) {
    const a = makeOctagon(benchRingR, 0)[i];
    const c = makeOctagon(benchRingR, 0)[(i + 1) % 8];
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const g = new THREE.BoxGeometry(b.benchDepth, b.benchHeight, len * 0.34);
    g.rotateY(Math.atan2(c[0] - a[0], c[2] - a[2]));
    g.translate((a[0] + c[0]) / 2, floorY + b.benchHeight / 2, (a[2] + c[2]) / 2);
    benchGeoms.push(g);
  }
  const benches = new THREE.Mesh(mergeAll(benchGeoms), materials.wood);
  benches.castShadow = true;
  benches.name = 'benches';
  benchGroup.add(benches);
  root.add(benchGroup);
  parts.set('benches', benchGroup);

  /* ---------------------------------------------------- 木作 */
  const carpentry = new THREE.Group();
  carpentry.name = 'carpentry';
  const paintings = buildPaintings(config, materials);
  const purlins = buildPurlins(config, materials);
  const brackets = buildBrackets(config, materials);
  const decoration = buildBracketsDecoration(config, materials);
  carpentry.add(paintings, purlins, brackets, decoration);
  root.add(carpentry);
  parts.set('painting-xuanzi', paintings);
  parts.set('brackets-dougong', brackets);
  parts.set('que-ti', decoration);

  /* ---------------------------------------------------- 屋顶 */
  const roofGroup = new THREE.Group();
  roofGroup.name = 'roof';
  const lower = buildLowerRoof(config, materials, quality);
  const upper = buildUpperRoof(config, materials, quality);
  const finial = buildFinial(config, materials);
  roofGroup.add(lower.group, upper.group, finial);
  root.add(roofGroup);
  parts.set('roof-double-eave', roofGroup);
  parts.set('roof-lower', lower.group);
  parts.set('roof-upper', upper.group);
  parts.set('roof-finial', finial);
  parts.set('finial-and-beasts', upper.group);

  /* ---------------------------------------------------- 藻井与匾额 */
  const ceiling = buildCeiling(config, materials);
  root.add(ceiling);
  parts.set('ceiling-caojing', ceiling);

  const plaques = buildPlaques(config, materials);
  root.add(plaques);
  parts.set('plaques-inner', plaques);

  /* ---------------------------------------------------- 比例人形（1.70m，S 级） */
  const human = new THREE.Group();
  human.name = 'scale-human';
  const humanMat = materials.human;
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.95, 6, 12);
  const body = new THREE.Mesh(bodyGeo, humanMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), humanMat);
  head.position.y = 1.62;
  human.add(body, head);
  human.position.set(0, config.human.baseY, config.footprint.circumradius + 2.2);
  human.visible = false;
  root.add(human);
  parts.set('scale-human', human);

  const metrics = {
    tileCount: lower.tileCount + upper.tileCount,
    columnCount: columns.length,
    ridgeTopY: config.roof.finial.topY,
  };

  const dispose = () => {
    root.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    });
    root.clear();
    parts.clear();
    for (const m of pavilionMaterials) {
      if (m && typeof m.dispose === 'function') m.dispose();
    }
  };

  return { root, parts, metrics, dispose, columns, materials: pavilionMaterials };
}

/* ---------------------------------------------------------------- 工具 */

/** 合并几何（与 roof.js 中的实现一致，避免额外依赖）。 */
function mergeAll(geoms) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geoms) {
    vertexCount += g.getAttribute('position').count;
    indexCount += g.getIndex() ? g.getIndex().count : g.getAttribute('position').count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geoms) {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    positions.set(pos.array.subarray(0, pos.count * 3), vOff * 3);
    if (nor) normals.set(nor.array.subarray(0, nor.count * 3), vOff * 3);
    if (uv) uvs.set(uv.array.subarray(0, uv.count * 2), vOff * 2);
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i += 1) indices[iOff + i] = idx.getX(i) + vOff;
      iOff += idx.count;
    } else {
      for (let i = 0; i < pos.count; i += 1) indices[iOff + i] = i + vOff;
      iOff += pos.count;
    }
    vOff += pos.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}
