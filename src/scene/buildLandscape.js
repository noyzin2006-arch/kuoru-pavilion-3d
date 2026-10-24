/**
 * KRT-001 · 远景环境（东堤、昆明湖、十七孔桥、南湖岛、万寿山与佛香阁、植被）
 *
 * 规划案 §5.4：与真实 GIS 未核对，**世界坐标只用于审美对景**，明确 S 级标签；
 * 远景桥只要可辨 17 券洞轮廓、避免抢主亭；远景三角数不超过主亭 20%。
 */

import * as THREE from 'three';
import { makeFbm, makeRandom, SEED } from './materials.js';

const LANDSCAPE_COLORS = {
  hill: 0x6f7358,
  hillRock: 0x8a8779,
  pavilionFar: 0x8a8f6a, // 佛香阁意象：黄绿瓦（仅远景提示）
  bridge: 0xa9a396,
  trunk: 0x5b4a3a,
};

/**
 * @param {object} config PAVILION_CONFIG
 * @param {{materials: Record<string, THREE.Material>}} resources
 * @param {{quality?: 'high'|'low'}} [opts]
 */
export function buildLandscape(config, resources, opts = {}) {
  const { materials } = resources;
  const quality = opts.quality || 'high';
  const L = config.landscape;
  const root = new THREE.Group();
  root.name = 'landscape';

  /* ---------------------------------------------------- 湖面 */
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(L.lakeExtent, L.lakeExtent, 64, 64), materials.water);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-L.lakeExtent / 2 - 10, 0, 0);
  lake.receiveShadow = false;
  lake.name = 'kunming-lake';
  root.add(lake);

  /* ---------------------------------------------------- 东堤 */
  const dike = new THREE.Mesh(
    new THREE.BoxGeometry(L.dikeWidth, 0.7, L.dikeLength * 2),
    materials.tigerStone,
  );
  dike.position.set(L.dikeWidth / 2 - 6, 0.35, 0);
  dike.receiveShadow = true;
  dike.castShadow = true;
  dike.name = 'east-dike';
  root.add(dike);

  // 堤上石栏
  const railGeoms = [];
  const railLen = L.dikeLength * 2;
  const postCount = Math.floor(railLen / 3);
  for (let i = 0; i <= postCount; i += 1) {
    const z = -railLen / 2 + (i * railLen) / postCount;
    const g = new THREE.BoxGeometry(0.16, 0.9, 0.16);
    g.translate(L.dikeWidth / 2 - 6.2, 0.7 + 0.45, z);
    railGeoms.push(g);
  }
  const rail = new THREE.Mesh(mergeSimple(railGeoms), materials.tigerStone);
  rail.castShadow = true;
  rail.name = 'dike-rail';
  root.add(rail);

  /* ---------------------------------------------------- 十七孔桥（17 券洞） */
  const bridge = buildBridge(L, materials);
  root.add(bridge);

  /* ---------------------------------------------------- 南湖岛 */
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(L.islandDiameter / 2, L.islandDiameter / 2 + 6, 3.4, 40),
    materials.ground,
  );
  island.position.set(L.islandCenter[0], 1.2, L.islandCenter[2]);
  island.receiveShadow = true;
  island.name = 'nanhu-island';
  root.add(island);

  /* ---------------------------------------------------- 万寿山与佛香阁 */
  const hillGroup = new THREE.Group();
  hillGroup.name = 'wanshou-hill';
  const hillGeo = makeHillGeometry(L.hillHeight, 90);
  const hill = new THREE.Mesh(hillGeo, materials.ground);
  hill.position.set(L.hillCenter[0], 0, L.hillCenter[2]);
  hill.receiveShadow = true;
  hillGroup.add(hill);

  const foxiangge = buildFarPavilion(L, materials);
  foxiangge.position.set(L.foxiangge[0], L.foxiangge[1], L.foxiangge[2]);
  hillGroup.add(foxiangge);
  root.add(hillGroup);

  /* ---------------------------------------------------- 植被（instanced） */
  const treeCount = quality === 'low' ? 40 : 120;
  const trees = buildTrees(treeCount, materials, L);
  root.add(trees);

  /* ---------------------------------------------------- 雾 */
  // 规划案 §5.3：远景雾距离 100–450m（线性雾）
  const fog = new THREE.Fog(0xcfd8d2, 100, 450);
  root.userData.fog = fog;

  const dispose = () => {
    root.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    });
    root.clear();
  };

  return { root, dispose, lake, trees };
}

/* ---------------------------------------------------------------- 十七孔桥 */

/**
 * 连拱石桥：17 个券洞，中央最大向两端递减。
 */
function buildBridge(L, materials) {
  const group = new THREE.Group();
  group.name = 'seventeen-arch-bridge';
  const start = new THREE.Vector3(L.bridgeStart[0], 0, L.bridgeStart[2]);
  const end = new THREE.Vector3(L.bridgeEnd[0], 0, L.bridgeEnd[2]);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  dir.normalize();
  const arches = L.bridgeArches;

  const deckGeoms = [];
  const pierGeoms = [];
  const archGeoms = [];

  // 桥面（微微起拱）
  const deck = new THREE.BoxGeometry(8, 1.6, len);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  deck.applyQuaternion(q);
  deck.translate((start.x + end.x) / 2, 5.4, (start.z + end.z) / 2);
  deckGeoms.push(deck);

  for (let i = 0; i < arches; i += 1) {
    const t = (i + 0.5) / arches;
    const mid = start.clone().addScaledVector(dir, len * t);
    // 中央最大，向两端递减
    const centerFactor = 1 - Math.abs(t - 0.5) * 1.55;
    const span = 3.0 + centerFactor * 2.6;
    const height = 2.6 + centerFactor * 2.4;

    // 券洞：用半圆环几何（真实开孔）
    const segs = 14;
    const positions = [];
    const indices = [];
    const uvs = [];
    for (let s = 0; s <= segs; s += 1) {
      const a = Math.PI * (s / segs);
      const x = Math.cos(a) * span;
      const y = Math.sin(a) * height;
      positions.push(x, y, -4, x, y, 4);
      uvs.push(s / segs, 0, s / segs, 1);
    }
    for (let s = 0; s < segs; s += 1) {
      const a = s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const arch = new THREE.BufferGeometry();
    arch.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    arch.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    arch.setIndex(indices);
    arch.computeVertexNormals();
    const m = new THREE.Matrix4()
      .makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir))
      .setPosition(mid.x, 3.4, mid.z);
    arch.applyMatrix4(m);
    archGeoms.push(arch);
  }

  const deckMesh = new THREE.Mesh(mergeSimple(deckGeoms), materials.tigerStone);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  group.add(deckMesh);
  const archMesh = new THREE.Mesh(mergeSimple(archGeoms), materials.tigerStone);
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  group.add(archMesh);

  // 望柱
  const postGeoms = [];
  const postCount = Math.floor(len / 4);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= postCount; i += 1) {
      const t = i / postCount;
      const p = start.clone().addScaledVector(dir, len * t);
      const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(3.7 * side);
      const g = new THREE.BoxGeometry(0.3, 1.1, 0.3);
      g.translate(p.x + off.x, 6.6, p.z + off.z);
      postGeoms.push(g);
    }
  }
  const posts = new THREE.Mesh(mergeSimple(postGeoms), materials.tigerStone);
  posts.castShadow = true;
  group.add(posts);

  return group;
}

/* ---------------------------------------------------------------- 万寿山 */

/** 起伏山体：噪声驱动的环状网格。 */
function makeHillGeometry(height, radius) {
  const fbm = makeFbm(SEED + 71);
  const rings = 14;
  const segs = 40;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rings; r += 1) {
    const rt = r / rings;
    for (let s = 0; s <= segs; s += 1) {
      const a = (s / segs) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 2 + 4, Math.sin(a) * 2 + rt * 3, 4);
      const rr = radius * (1 - rt * 0.62) * (0.82 + n * 0.36);
      const y = height * rt * (0.55 + n * 0.7) * (1 - rt * 0.28);
      positions.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uvs.push(s / segs, rt);
    }
  }
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < segs; s += 1) {
      const a = r * (segs + 1) + s;
      const b = a + 1;
      const c = a + segs + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 佛香阁意象：三层八角塔，简化体量（远景提示）。 */
function buildFarPavilion(L, materials) {
  const group = new THREE.Group();
  group.name = 'foxiangge-far';
  const h = L.foxianggeHeight;
  const mat = new THREE.MeshStandardMaterial({ color: LANDSCAPE_COLORS.pavilionFar, roughness: 0.6, metalness: 0.05 });
  const tiers = [
    { r: 9, y: 0, h: h * 0.34 },
    { r: 7, y: h * 0.34, h: h * 0.3 },
    { r: 5, y: h * 0.64, h: h * 0.26 },
  ];
  for (const t of tiers) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r * 1.05, t.h, 8), mat);
    body.position.y = t.y + t.h / 2;
    body.castShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.5, t.h * 0.42, 8), mat);
    roof.position.y = t.y + t.h + t.h * 0.2;
    roof.castShadow = true;
    group.add(roof);
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), mat);
  finial.position.y = h * 1.02;
  group.add(finial);
  return group;
}

/* ---------------------------------------------------------------- 植被 */

/** 实例化树木：树干 + 球状树冠。 */
function buildTrees(count, materials, L) {
  const group = new THREE.Group();
  group.name = 'trees';
  const rand = makeRandom(SEED + 81);
  const fbm = makeFbm(SEED + 82);

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.5, 1);
  crownGeo.translate(0, 3.4, 0);

  const trunks = new THREE.InstancedMesh(trunkGeo, materials.foliage, count);
  const crowns = new THREE.InstancedMesh(crownGeo, materials.foliage, count);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i += 1) {
    // 只种在东堤的陆地一侧，且必须避开亭身与月台（半径 22m 内不种树）
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 40; tries += 1) {
      const eastSide = rand() < 0.6;
      x = eastSide ? 12.5 + rand() * 6 : -5.5 + rand() * 17;
      z = (rand() - 0.5) * L.dikeLength * 1.9;
      if (Math.hypot(x, z) > 22) break;
    }
    const scale = 0.6 + fbm(x * 0.02, z * 0.02, 2) * 0.7;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks, crowns);
  return group;
}

/* ---------------------------------------------------------------- 工具 */

function mergeSimple(geoms) {
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
