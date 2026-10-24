/**
 * KRT-001 · 木作（斗栱、枋檩、雀替、笼花板、藻井、匾额、彩画）
 *
 * 规划案 §5.2 的木作条目：
 *  - 斗栱：每根外檐柱头一组（共 24 主组），柱间跨距 > 2.6m 时补一组；
 *    简化三层（坐斗、昂、挑檐枋），出挑 0.38m、每层增高 0.14m、总高 0.42m，斗底 y≈5.06；上檐另 8 组。
 *  - 雀替：下檐每跨两侧 1 片，共 48 片；厚 0.065m、沿梁 0.65m、垂高 0.45m。
 *  - 笼花板：每面 3 片共 24 片，镂空用几何孔，不靠假透明贴图。
 *  - 藻井：八边内切半径 3.65m、中心 y=7.85m，三层递进八角斗形轮廓，每圈向内缩 0.32m，彩绘中心莲纹。
 *  - 匾额：8 块沿内圈八方向，宽 1.90、高 0.48、厚 0.07，离地约 4.30m；外侧东向「廓如亭」匾 1 块。
 *  - 彩画：程序化 CanvasTexture（见 materials.js），先做到跨梁对齐，再添加纹饰。
 */

import * as THREE from 'three';
import { makeOctagon, roofProfile } from '../core/geometry.js';
import { mergeGeometries } from './roof.js';

/* ---------------------------------------------------------------- 斗栱 */

function makeDouBlock(w = 0.3, h = 0.14, d = 0.3) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/** 昂：由内向外出挑的斜臂。 */
function makeAng(length = 0.52, w = 0.12, h = 0.12) {
  const g = new THREE.BoxGeometry(w, h, length);
  g.translate(0, 0, length / 2);
  g.rotateX(-0.18); // 起翘
  return g;
}

/** 挑檐枋：水平出挑臂。 */
function makeQiaoYanFang(length = 0.44, w = 0.12, h = 0.12) {
  const g = new THREE.BoxGeometry(w, h, length);
  g.translate(0, 0, length / 2);
  return g;
}

/**
 * 斗栱组。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildBrackets(config, materials) {
  const b = config.brackets;
  const group = new THREE.Group();
  group.name = 'brackets';

  const outer = makeOctagon(config.footprint.side, 0);
  const outerPoints = [];
  for (let i = 0; i < 8; i += 1) {
    const a = outer[i];
    const c = outer[(i + 1) % 8];
    for (let k = 0; k < 3; k += 1) {
      const t = k / 3;
      outerPoints.push({
        x: a[0] + (c[0] - a[0]) * t,
        z: a[2] + (c[2] - a[2]) * t,
      });
    }
  }

  /** 组装位置：外檐柱头 + 跨中补间 */
  const spots = [];
  for (const p of outerPoints) spots.push({ x: p.x, z: p.z, main: true });
  // 柱间跨度：相邻柱位距离（八边形边长 / 3）
  const sideLen = config.footprint.side;
  const gap = sideLen / 3;
  if (gap > b.extraWhenGapOver) {
    for (let i = 0; i < 8; i += 1) {
      const a = outer[i];
      const c = outer[(i + 1) % 8];
      for (let k = 0; k < 3; k += 1) {
        const t = (k + 0.5) / 3;
        spots.push({ x: a[0] + (c[0] - a[0]) * t, z: a[2] + (c[2] - a[2]) * t, main: false });
      }
    }
  }

  const baseY = b.baseY;
  const total = spots.length;
  const dou = new THREE.InstancedMesh(makeDouBlock(), materials.painting, total);
  const ang = new THREE.InstancedMesh(makeAng(), materials.painting, total);
  const fang = new THREE.InstancedMesh(makeQiaoYanFang(), materials.painting, total);
  for (const m of [dou, ang, fang]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  const dummy = new THREE.Object3D();
  spots.forEach((s, i) => {
    const angle = Math.atan2(s.x, s.z);
    dummy.position.set(s.x, baseY, s.z);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    dou.setMatrixAt(i, dummy.matrix);

    // 昂：出挑 0.38m，位于坐斗之上
    const angGeoms = makeAng();
    dummy.position.set(s.x, baseY + b.layerRise, s.z);
    dummy.updateMatrix();
    ang.setMatrixAt(i, dummy.matrix);
    angGeoms.dispose();

    // 挑檐枋：最上层，出挑 0.38m
    dummy.position.set(s.x, baseY + b.layerRise * 2, s.z);
    dummy.updateMatrix();
    fang.setMatrixAt(i, dummy.matrix);
  });
  dou.instanceMatrix.needsUpdate = true;
  ang.instanceMatrix.needsUpdate = true;
  fang.instanceMatrix.needsUpdate = true;
  group.add(dou, ang, fang);

  /* 上檐另 8 组：对准八方顶点 */
  const upperOct = makeOctagon(config.roof.levels.upper.rmax * 0.82, 0);
  const uDou = new THREE.InstancedMesh(makeDouBlock(), materials.painting, 8);
  const uAng = new THREE.InstancedMesh(makeAng(), materials.painting, 8);
  const uFang = new THREE.InstancedMesh(makeQiaoYanFang(), materials.painting, 8);
  for (const m of [uDou, uAng, uFang]) {
    m.castShadow = true;
    m.name = 'brackets-upper';
  }
  const upperBaseY = config.roof.levels.upper.eaveY - 0.5;
  upperOct.forEach((p, i) => {
    const angle = Math.atan2(p[0], p[2]);
    dummy.position.set(p[0], upperBaseY, p[2]);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    uDou.setMatrixAt(i, dummy.matrix);
    dummy.position.y = upperBaseY + b.layerRise;
    dummy.updateMatrix();
    uAng.setMatrixAt(i, dummy.matrix);
    dummy.position.y = upperBaseY + b.layerRise * 2;
    dummy.updateMatrix();
    uFang.setMatrixAt(i, dummy.matrix);
  });
  uDou.instanceMatrix.needsUpdate = true;
  uAng.instanceMatrix.needsUpdate = true;
  uFang.instanceMatrix.needsUpdate = true;
  group.add(uDou, uAng, uFang);

  group.userData.bracketGroupCount = total + 8;
  return group;
}

/* ---------------------------------------------------------------- 枋檩与彩画 */

/**
 * 檐枋环（外圈与内圈），承载彩画贴图。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildPaintings(config, materials) {
  const group = new THREE.Group();
  group.name = 'paintings';
  const f = config.framing;

  const beamRing = (radius, y, sectionW, sectionH, mat, name) => {
    const oct = makeOctagon(radius, y);
    const geoms = [];
    for (let i = 0; i < 8; i += 1) {
      const a = oct[i];
      const c = oct[(i + 1) % 8];
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[2] + c[2]) / 2;
      const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
      const g = new THREE.BoxGeometry(sectionW, sectionH, len);
      g.rotateY(Math.atan2(c[0] - a[0], c[2] - a[2]));
      g.translate(mx, y, mz);
      geoms.push(g);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geoms), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    return mesh;
  };

  // 外檐枋（彩画主要载体）
  group.add(beamRing(config.footprint.circumradius, config.columns.height + config.platform.topY + config.columns.plinthHeight + 0.12, f.eaveFangSection[0], f.eaveFangSection[1], materials.painting, 'fang-outer'));
  // 内圈额枋
  group.add(beamRing(config.footprint.circumradius * config.columns.middleRingScale, config.columns.height + config.platform.topY + config.columns.plinthHeight + 0.12, f.innerFangSection[0], f.innerFangSection[1], materials.painting, 'fang-middle'));

  return group;
}

/**
 * 大木六檩（示意）：8 个径向各 3 根水平抬梁。
 * 每根跨越相邻两道檩位，梁面贴住上檐屋面 underside，梁架镜头下可辨认层叠关系。
 *
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildPurlins(config, materials) {
  const group = new THREE.Group();
  group.name = 'purlins';
  const size = config.framing.purlinSize;
  const lower = config.roof.levels.lower;
  const upper = config.roof.levels.upper;
  const oct = makeOctagon(1, 0);
  const geoms = [];

  // 三道檩位：自下檐内沿向宝顶递减
  const radii = [lower.innerR, lower.innerR * 0.72, lower.innerR * 0.44];

  for (let i = 0; i < 8; i += 1) {
    const dir = new THREE.Vector2(oct[i][0], oct[i][2]).normalize();
    for (let k = 0; k < config.framing.purlinsPerRadial; k += 1) {
      const r0 = radii[k];
      const r1 = k + 1 < radii.length ? radii[k + 1] : upper.innerR;
      const len = r0 - r1;
      if (len <= 0) continue;
      const mid = (r0 + r1) / 2;
      const y = roofProfile(r0, 'upper', config) - size * 1.6;
      const g = new THREE.BoxGeometry(size, size, len);
      g.rotateY(Math.atan2(dir.x, dir.y));
      g.translate(dir.x * mid, y, dir.y * mid);
      geoms.push(g);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geoms), materials.wood);
  mesh.castShadow = true;
  mesh.name = 'purlin-rafters';
  group.add(mesh);
  return group;
}

/* ---------------------------------------------------------------- 雀替与笼花板 */

/**
 * 雀替（48 片）与笼花板（24 片，镂空用几何孔）。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildBracketsDecoration(config, materials) {
  const group = new THREE.Group();
  group.name = 'que-ti-and-long-hua';
  const q = config.brackets2;
  const oct = makeOctagon(config.footprint.side, 0);
  const beamY = config.platform.topY + config.columns.plinthHeight + config.columns.height + 0.12;

  const queGeoms = [];
  for (let i = 0; i < 8; i += 1) {
    const a = oct[i];
    const c = oct[(i + 1) % 8];
    for (let k = 0; k < 3; k += 1) {
      const t0 = k / 3;
      const t1 = (k + 0.5) / 3;
      for (const t of [t0, t1]) {
        const x = a[0] + (c[0] - a[0]) * t;
        const z = a[2] + (c[2] - a[2]) * t;
        const angle = Math.atan2(c[0] - a[0], c[2] - a[2]);
        const g = new THREE.BoxGeometry(q.queTiThickness, q.queTiDrop, q.queTiLength);
        g.translate(0, -q.queTiDrop / 2, 0);
        g.rotateY(angle);
        g.translate(x, beamY - q.queTiDrop / 2 + 0.02, z);
        queGeoms.push(g);
      }
    }
  }
  const que = new THREE.Mesh(mergeGeometries(queGeoms), materials.wood);
  que.castShadow = true;
  que.name = 'que-ti';
  group.add(que);

  // 笼花板：每面 3 片，用几何孔洞（不靠透明贴图）
  const lhGeoms = [];
  for (let i = 0; i < 8; i += 1) {
    const a = oct[i];
    const c = oct[(i + 1) % 8];
    const angle = Math.atan2(c[0] - a[0], c[2] - a[2]);
    for (let k = 0; k < q.longhuaPerSide; k += 1) {
      const t = (k + 0.5) / q.longhuaPerSide;
      const x = a[0] + (c[0] - a[0]) * t;
      const z = a[2] + (c[2] - a[2]) * t;
      const panel = makePiercedPanel(0.42, 0.34, 0.035);
      panel.rotateY(angle);
      panel.translate(x, beamY - 0.42, z);
      lhGeoms.push(panel);
    }
  }
  const lh = new THREE.Mesh(mergeGeometries(lhGeoms), materials.wood);
  lh.castShadow = true;
  lh.name = 'long-hua-ban';
  group.add(lh);

  return group;
}

/** 镂空板：用四条边框 + 中间十字格拼出几何孔。 */
function makePiercedPanel(w, h, t) {
  const parts = [];
  const bar = (bw, bh, x, y) => {
    const g = new THREE.BoxGeometry(bw, bh, t);
    g.translate(x, y, 0);
    return g;
  };
  parts.push(bar(w, 0.06, 0, h / 2 - 0.03));
  parts.push(bar(w, 0.06, 0, -h / 2 + 0.03));
  parts.push(bar(0.06, h, -w / 2 + 0.03, 0));
  parts.push(bar(0.06, h, w / 2 - 0.03, 0));
  parts.push(bar(0.045, h * 0.72, 0, 0));
  parts.push(bar(w * 0.72, 0.045, 0, 0));
  return mergeGeometries(parts);
}

/* ---------------------------------------------------------------- 藻井 */

/**
 * 藻井：三层递进八角斗形 + 中心莲纹。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildCeiling(config, materials) {
  const group = new THREE.Group();
  group.name = 'caojing';
  const c = config.ceiling;

  const ringSpec = [];
  for (let i = 0; i < c.rings; i += 1) {
    ringSpec.push({
      apothem: c.apothem - i * c.shrinkPerRing,
      y: c.centerY - (c.rings - 1 - i) * 0.22,
    });
  }

  const bandGeoms = [];
  for (let i = 0; i < ringSpec.length - 1; i += 1) {
    const outer = ringSpec[i];
    const inner = ringSpec[i + 1];
    const o = makeOctagon(outer.apothem * 2 * Math.tan(Math.PI / 8), outer.y);
    const n = makeOctagon(inner.apothem * 2 * Math.tan(Math.PI / 8), inner.y);
    const geoms = [];
    for (let k = 0; k < 8; k += 1) {
      const a = o[k];
      const b2 = o[(k + 1) % 8];
      const c2 = n[k];
      const d = n[(k + 1) % 8];
      const quad = new THREE.BufferGeometry();
      const positions = new Float32Array([
        a[0], a[1], a[2], b2[0], b2[1], b2[2], c2[0], c2[1], c2[2],
        b2[0], b2[1], b2[2], d[0], d[1], d[2], c2[0], c2[1], c2[2],
      ]);
      quad.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      quad.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]), 2));
      quad.setIndex([0, 1, 2, 1, 3, 2]);
      quad.computeVertexNormals();
      geoms.push(quad);
    }
    bandGeoms.push(...geoms);
  }

  const band = new THREE.Mesh(mergeGeometries(bandGeoms), materials.painting);
  band.name = 'caojing-bands';
  band.receiveShadow = true;
  group.add(band);

  // 中心莲纹圆盘
  const inner = ringSpec[ringSpec.length - 1];
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(inner.apothem * 0.92, 32),
    materials.painting,
  );
  disc.rotation.x = Math.PI / 2; // 面向下
  disc.position.y = inner.y - 0.01;
  disc.name = 'caojing-lotus';
  group.add(disc);

  return group;
}

/* ---------------------------------------------------------------- 匾额 */

/**
 * 匾额：内圈 8 块 + 东向外檐「廓如亭」1 块。
 * @param {object} config
 * @param {Record<string, THREE.Material>} materials
 */
export function buildPlaques(config, materials) {
  const group = new THREE.Group();
  group.name = 'plaques';
  const c = config.ceiling;

  const ringR = config.footprint.circumradius * config.columns.middleRingScale;
  const oct = makeOctagon(ringR, c.plaqueY);

  const plaqueGeo = new THREE.BoxGeometry(c.plaqueWidth, c.plaqueHeight, c.plaqueThickness);
  for (let i = 0; i < c.innerPlaqueCount; i += 1) {
    const p = oct[i];
    const angle = Math.atan2(p[0], p[2]);
    const m = new THREE.Mesh(plaqueGeo, materials.wood);
    m.position.set(p[0], c.plaqueY, p[2]);
    m.rotation.y = angle;
    m.castShadow = true;
    m.name = `plaque-inner-${i + 1}`;
    group.add(m);
  }

  // 东向外檐匾（+X 为东）
  const east = new THREE.Mesh(plaqueGeo, materials.wood);
  east.position.set(config.footprint.circumradius + 0.12, c.plaqueY + 0.3, 0);
  east.rotation.y = Math.PI / 2;
  east.castShadow = true;
  east.name = 'plaque-east';
  group.add(east);

  return group;
}
