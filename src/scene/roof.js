/**
 * KRT-001 · 屋顶（上下重檐八脊攒尖）
 *
 * 规划案 §5.2：
 *  - 上下檐以每个八角扇区的径向分段带生成 BufferGeometry；
 *    法线按顶点三角形顺序统一，外表方向朝上；双面材质仅用于藻井可见背面。
 *  - 屋面曲线：height(r)=lerp(eaveY,ridgeY,pow(clamp(1-r/rmax),1.15))
 *               -0.16*(r/rmax)^8 +0.08*exp(-((r-0.8*rmax)/(0.11*rmax))^2)
 *    （已在 core/geometry.js 的 roofProfile 中做端点归一）
 *  - 瓦不以大平面单贴图冒充：沿每面内的径向瓦陇用 InstancedMesh 布置半圆筒样瓦件；
 *    每陇沿径向 0.28m 节距，参考半径 0.095m、瓦搭接 0.045m；高 LOD ≤18,000 瓦片实例。
 *  - 八脊：上檐 8 主脊（对准八方顶点），下檐另 8 条放射脊；吻兽上檐 8 + 下檐 8 = 16。
 *  - 圆宝顶：底半径 0.62、顶半径 0.10，高 0.95m，顶部 y≈10.45m。
 */

import * as THREE from 'three';
import { roofProfile, makeOctagon } from '../core/geometry.js';

const TILE_RADIUS = 0.095;
const TILE_PITCH = 0.28;
const TILE_OVERLAP = 0.045;
const ARC_SEGMENTS = 6; // 每片瓦的截面分段
const MAX_TILES_HIGH = 18000;

/* ---------------------------------------------------------------- 半圆筒瓦几何 */

/**
 * 半圆筒瓦：截面为半圆（凸面朝 +Y），沿 +Z 延伸。
 * @param {number} radius
 * @param {number} length
 */
function makeHalfTubeGeometry(radius = TILE_RADIUS, length = TILE_PITCH + TILE_OVERLAP) {
  const segs = ARC_SEGMENTS;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s <= segs; s += 1) {
    const a = (s / segs) * Math.PI;
    const cx = Math.cos(a) * radius;
    const cy = Math.sin(a) * radius;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    for (let e = 0; e < 2; e += 1) {
      const z = e === 0 ? -length / 2 : length / 2;
      positions.push(cx, cy, z);
      normals.push(nx, ny, 0);
      uvs.push(s / segs, e);
    }
  }
  for (let s = 0; s < segs; s += 1) {
    const a = s * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/* ---------------------------------------------------------------- 屋面曲面 */

/**
 * 单层屋面的壳体：上表面（朝外）+ 下表面（朝内）+ 檐口封边，法线方向正确。
 * @param {'lower'|'upper'} level
 * @param {object} config
 * @param {number} [radialSteps]
 * @param {number} [angularSteps]
 */
function makeRoofShellGeometry(level, config, radialSteps = 16, angularSteps = 96) {
  const L = config.roof.levels[level];
  const thickness = L.tileThickness;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const angleAt = (i) => (2 * Math.PI * i) / angularSteps;

  // 半径序列：自檐口向内
  const radii = [];
  for (let i = 0; i <= radialSteps; i += 1) {
    const t = i / radialSteps;
    radii.push(L.rmax + (L.innerR - L.rmax) * t);
  }

  const pushSurface = (flip) => {
    const base = positions.length / 3;
    for (let ri = 0; ri < radii.length; ri += 1) {
      const r = radii[ri];
      const h = roofProfile(r, level, config);
      // 曲面上的法线：数值梯度
      const dr = 0.05;
      const hR = roofProfile(Math.min(r + dr, L.rmax), level, config);
      const slope = (hR - h) / dr;
      for (let ai = 0; ai <= angularSteps; ai += 1) {
        const a = angleAt(ai % angularSteps);
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        // 曲面法线 ≈ (-sinθ·dh/dr·?, ...) 用水平径向 + 高度梯度近似
        const nx = Math.sin(a) * slope;
        const nz = Math.cos(a) * slope;
        const ny = 1;
        const len = Math.hypot(nx, ny, nz);
        const sign = flip ? -1 : 1;
        positions.push(x, h - (flip ? thickness : 0), z);
        normals.push((nx / len) * sign, (ny / len) * sign, (nz / len) * sign);
        uvs.push(ai / angularSteps, ri / radialSteps);
      }
    }
    for (let ri = 0; ri < radii.length - 1; ri += 1) {
      for (let ai = 0; ai < angularSteps; ai += 1) {
        const a = base + ri * (angularSteps + 1) + ai;
        const b = a + 1;
        const c = a + angularSteps + 1;
        const d = c + 1;
        if (flip) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  };

  pushSurface(false);
  pushSurface(true);

  // 檐口封边（连接上下两层）
  {
    const base = positions.length / 3;
    const r = L.rmax;
    const h = roofProfile(r, level, config);
    for (let ai = 0; ai <= angularSteps; ai += 1) {
      const a = angleAt(ai % angularSteps);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      positions.push(x, h, z);
      normals.push(Math.sin(a), 0.25, Math.cos(a));
      uvs.push(ai / angularSteps, 0);
      positions.push(x, h - thickness, z);
      normals.push(Math.sin(a), 0.25, Math.cos(a));
      uvs.push(ai / angularSteps, 1);
    }
    for (let ai = 0; ai < angularSteps; ai += 1) {
      const a = base + ai * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/* ---------------------------------------------------------------- 瓦垄实例 */

/**
 * 径向瓦垄的半圆筒瓦实例。
 * @param {'lower'|'upper'} level
 * @param {object} config
 * @param {THREE.Material} material
 * @param {number} qualityScale 1 = 高 LOD，4 = 低 LOD（降 4 倍）
 */
function makeTileInstances(level, config, material, qualityScale = 1) {
  const L = config.roof.levels[level];
  const sideLengthAtRmax = 2 * L.rmax * Math.sin(Math.PI / 8);
  const cols = Math.max(3, Math.round(sideLengthAtRmax / (TILE_RADIUS * 2)));
  const run = L.rmax - L.innerR;
  const rows = Math.max(2, Math.round(run / TILE_PITCH));

  const count = 8 * cols * rows;
  const geo = makeHalfTubeGeometry();
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `tiles-${level}`;

  const dummy = new THREE.Object3D();
  const oct = makeOctagon(1, 0); // 单位外接圆八边形（角度序）
  const m4 = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  let i = 0;

  const step = qualityScale; // 低 LOD：抽样瓦垄

  for (let s = 0; s < 8; s += 1) {
    const a0 = oct[s];
    const a1 = oct[(s + 1) % 8];
    for (let j = 0; j < cols; j += 1) {
      if (j % step !== 0) continue;
      const u = (j + 0.5) / cols;
      // 瓦垄在单位八边形上的横向位置
      const lx = a0[0] + (a1[0] - a0[0]) * u;
      const lz = a0[2] + (a1[2] - a0[2]) * u;
      const latLen = Math.hypot(lx, lz);

      for (let k = 0; k < rows; k += 1) {
        if (k % step !== 0) continue;
        const t = (k + 0.5) / rows;
        const r = L.rmax + (L.innerR - L.rmax) * t;
        const x = (lx / latLen) * r;
        const z = (lz / latLen) * r;
        const y = roofProfile(r, level, config);

        // 切向（沿瓦垄，向内）、横向、法向
        const tx = -lx / latLen;
        const tz = -lz / latLen;
        const dr = 0.05;
        const hR = roofProfile(Math.min(r + dr, L.rmax), level, config);
        const slope = (hR - y) / dr;
        const nx = (lx / latLen) * slope;
        const nz = (lz / latLen) * slope;
        const ny = 1;
        const nl = Math.hypot(nx, ny, nz);
        const N = new THREE.Vector3(nx / nl, ny / nl, nz / nl);
        const T = new THREE.Vector3(tx, slope * 0.0, tz).normalize();
        const B = new THREE.Vector3().crossVectors(N, T).normalize();

        dummy.position.set(x + N.x * TILE_RADIUS * 0.35, y + N.y * TILE_RADIUS * 0.35, z + N.z * TILE_RADIUS * 0.35);
        dummy.quaternion.setFromRotationMatrix(
          basis.makeBasis(B, N, T),
        );
        dummy.updateMatrix();
        m4.copy(dummy.matrix);
        mesh.setMatrixAt(i, m4);
        i += 1;
      }
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, count: i };
}

/* ---------------------------------------------------------------- 垂脊与吻兽 */

/**
 * 一条垂脊：从顶点（角部）沿半径方向延伸到宝顶/内圈端。
 * 用扫掠的管条几何（不是贴图）。
 */
function makeRidgeGeometry(level, config, cornerIndex) {
  const L = config.roof.levels[level];
  const oct = makeOctagon(1, 0);
  const dir = new THREE.Vector2(oct[cornerIndex][0], oct[cornerIndex][2]).normalize();
  const steps = 24;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const ridgeWidth = 0.16;
  const ridgeHeight = 0.14;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const r = L.rmax + (L.innerR - L.rmax) * t;
    const h = roofProfile(r, level, config);
    const x = dir.x * r;
    const z = dir.y * r;
    // 脊的两侧在水平面展开
    const px = -dir.y;
    const pz = dir.x;
    for (let s = 0; s < 4; s += 1) {
      const side = s < 2 ? -1 : 1;
      const top = s === 0 || s === 3 ? 1 : 0;
      const ox = px * side * ridgeWidth * 0.5;
      const oz = pz * side * ridgeWidth * 0.5;
      positions.push(x + ox, h + (top ? ridgeHeight : 0), z + oz);
      normals.push(px * side * 0.7, top ? 0.7 : 0.2, pz * side * 0.7);
      uvs.push(t * 6, s / 3);
    }
  }
  for (let i = 0; i < steps; i += 1) {
    const a = i * 4;
    const b = a + 4;
    for (let s = 0; s < 3; s += 1) {
      const p = a + s;
      const q = p + 1;
      const r = b + s;
      const rr = r + 1;
      indices.push(p, q, r, q, rr, r);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 抽象吻兽：底座 + 兽身 + 兽首（简化轮廓，不冒充特定写实造型）。 */
function makeBeastGeometry() {
  const parts = [];
  const base = new THREE.CylinderGeometry(0.13, 0.16, 0.1, 8);
  base.translate(0, 0.05, 0);
  parts.push(base);
  const body = new THREE.BoxGeometry(0.16, 0.2, 0.28);
  body.translate(0, 0.2, -0.02);
  parts.push(body);
  const head = new THREE.ConeGeometry(0.11, 0.24, 8);
  head.rotateX(-Math.PI / 2);
  head.translate(0, 0.24, 0.2);
  parts.push(head);
  const tail = new THREE.ConeGeometry(0.07, 0.2, 6);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0.28, -0.22);
  parts.push(tail);

  // 合并
  const merged = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  for (const p of parts) {
    const pos = p.getAttribute('position');
    const nor = p.getAttribute('normal');
    const uv = p.getAttribute('uv');
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    const idx = p.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i += 1) indices.push(idx.getX(i) + offset);
    } else {
      for (let i = 0; i < pos.count; i += 1) indices.push(i + offset);
    }
    offset += pos.count;
    p.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

/* ---------------------------------------------------------------- 宝顶 */

/** 圆宝顶：Lathe 轮廓（底半径 0.62 → 顶半径 0.10，高 0.95）。 */
function makeFinialGeometry(config) {
  const f = config.roof.finial;
  const pts = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = t * f.height;
    // 宝瓶形：底部外鼓、中部收腰、顶部收尖
    const r = f.topRadius + (f.baseRadius - f.topRadius) * Math.cos((t * Math.PI) / 2) ** 1.6;
    pts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------- 公开接口 */

/**
 * 下檐屋面。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 * @param {'high'|'low'} quality
 */
export function buildLowerRoof(config, materials, quality = 'high') {
  return buildRoofLevel('lower', config, materials, quality);
}

/**
 * 上檐屋面。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 * @param {'high'|'low'} quality
 */
export function buildUpperRoof(config, materials, quality = 'high') {
  return buildRoofLevel('upper', config, materials, quality);
}

function buildRoofLevel(level, config, materials, quality) {
  const L = config.roof.levels[level];
  const group = new THREE.Group();
  group.name = `roof-${level}`;

  const shell = new THREE.Mesh(
    makeRoofShellGeometry(level, config, quality === 'low' ? 10 : 16, quality === 'low' ? 64 : 96),
    materials.tile,
  );
  shell.castShadow = true;
  shell.receiveShadow = true;
  shell.name = `roof-shell-${level}`;
  group.add(shell);

  const tiles = makeTileInstances(level, config, materials.tile, quality === 'low' ? 4 : 1);
  group.add(tiles.mesh);

  // 八条垂脊
  const ridgeGeoms = [];
  for (let i = 0; i < 8; i += 1) ridgeGeoms.push(makeRidgeGeometry(level, config, i));
  const ridgeMesh = new THREE.Mesh(mergeGeometries(ridgeGeoms), materials.tile);
  ridgeMesh.castShadow = true;
  ridgeMesh.name = `ridges-${level}`;
  group.add(ridgeMesh);

  // 吻兽：每条脊端 1 只
  const beastGeo = makeBeastGeometry();
  const beasts = new THREE.InstancedMesh(beastGeo, materials.tile, 8);
  beasts.castShadow = true;
  const dummy = new THREE.Object3D();
  const oct = makeOctagon(1, 0);
  for (let i = 0; i < 8; i += 1) {
    const dir = new THREE.Vector2(oct[i][0], oct[i][2]).normalize();
    const r = L.rmax + 0.1;
    const h = roofProfile(L.rmax, level, config);
    dummy.position.set(dir.x * r, h + 0.06, dir.y * r);
    dummy.rotation.set(0, Math.atan2(dir.x, dir.y), 0);
    dummy.updateMatrix();
    beasts.setMatrixAt(i, dummy.matrix);
  }
  beasts.instanceMatrix.needsUpdate = true;
  group.add(beasts);

  return { group, tiles: tiles.mesh, tileCount: tiles.count, shell };
}

/**
 * 圆宝顶。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildFinial(config, materials) {
  const group = new THREE.Group();
  group.name = 'finial';
  const L = config.roof.levels.upper;
  const baseY = roofProfile(L.innerR, 'upper', config);
  const mesh = new THREE.Mesh(makeFinialGeometry(config), materials.tile);
  mesh.position.y = baseY;
  mesh.castShadow = true;
  group.add(mesh);
  // 宝顶下的宝座
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(config.roof.finial.baseRadius * 1.05, config.roof.finial.baseRadius * 1.15, 0.18, 24),
    materials.tile,
  );
  base.position.y = baseY - 0.09;
  base.castShadow = true;
  group.add(base);
  return group;
}

/**
 * 合并同属性几何体（避免依赖 BufferGeometryUtils 的额外导入路径）。
 * @param {THREE.BufferGeometry[]} geoms
 */
export function mergeGeometries(geoms) {
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

export { MAX_TILES_HIGH, TILE_RADIUS, TILE_PITCH };
