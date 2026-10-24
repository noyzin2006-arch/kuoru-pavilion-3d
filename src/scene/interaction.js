/**
 * KRT-001 · 交互：热点拾取、分解、剖切
 *
 * 规划案 §5.5：
 *  - 剖切：固定法向 (+1,0,0) 的垂直平面，X 由 -15m 平移到 +15m（0–100）；
 *    仅在 sectionEnabled 时应用 THREE.Plane + renderer.localClippingEnabled + 材质 clippingPlanes；
 *    关闭立刻移除裁剪以避免材质共享污染；文案说明「展示内部结构，非测绘剖面」。
 *  - 分解：台基/柱网不动；坐凳 +0.15m·t；下檐与枋梁 +1.4m·t；上檐 +3.0m·t；宝顶 +3.8m·t（t=explode/100）。
 *  - 热点锚点跟随实例组 matrixWorld 更新，避免光标漂浮。
 *  - 人物不参与剖切。
 */

import * as THREE from 'three';

/** 分解位移表（米，按 t=explode/100 缩放）。 */
export const EXPLODE_OFFSETS = Object.freeze({
  'platform-terrace': 0,
  stairs: 0,
  'platform-wall': 0,
  floor: 0,
  'columns-three-rings': 0,
  benches: 0.15,
  'painting-xuanzi': 1.4,
  'brackets-dougong': 1.4,
  'que-ti': 1.4,
  'roof-lower': 1.4,
  'roof-upper': 3.0,
  'roof-finial': 3.8,
  'ceiling-caojing': 3.0,
  'plaques-inner': 1.4,
});

const SECTION_MIN_X = -15;
const SECTION_MAX_X = 15;

/**
 * 拾取构件。
 * @param {number} x 画布内坐标
 * @param {number} y
 * @param {THREE.Camera} camera
 * @param {Map<string, THREE.Object3D>} parts
 * @param {HTMLElement} canvas
 * @returns {string|null} 构件 id
 */
export function raycastPart(x, y, camera, parts, canvas) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((x - rect.left) / rect.width) * 2 - 1,
    -((y - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const targets = [...parts.values()];
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj) {
    for (const [id, group] of parts) {
      if (group === obj) return id;
      let p = obj.parent;
      while (p) {
        if (p === group) return id;
        p = p.parent;
      }
    }
    obj = obj.parent;
    if (!obj) break;
  }
  return null;
}

/**
 * 把热点投影到屏幕坐标。
 * @param {THREE.Camera} camera
 * @param {Array<{id:string, anchor:number[]}>} records
 * @param {HTMLElement} canvas
 * @returns {Array<{id:string, x:number, y:number, visible:boolean}>}
 */
export function projectHotspots(camera, records, canvas) {
  const rect = canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  const out = [];
  for (const rec of records) {
    v.set(rec.anchor[0], rec.anchor[1], rec.anchor[2]);
    v.project(camera);
    const visible = v.z < 1 && v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1;
    out.push({
      id: rec.id,
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
      visible,
    });
  }
  return out;
}

/**
 * 应用分解位移。
 * @param {Map<string, THREE.Object3D>} parts
 * @param {number} explode 0–100
 */
export function applyExplode(parts, explode) {
  const t = Math.max(0, Math.min(100, explode)) / 100;
  for (const [id, obj] of parts) {
    const offset = EXPLODE_OFFSETS[id];
    if (offset === undefined) continue;
    obj.position.y = offset * t;
    obj.updateMatrixWorld(true);
  }
}

/**
 * 应用剖切平面。
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Material[]} clippedMaterials 仅亭体材质
 * @param {number} section 0–100
 * @param {boolean} enabled
 * @returns {THREE.Plane|null}
 */
export function applySection(renderer, clippedMaterials, section, enabled) {
  if (!enabled) {
    renderer.localClippingEnabled = false;
    for (const m of clippedMaterials) {
      if (m && m.clippingPlanes) {
        m.clippingPlanes = null;
        m.needsUpdate = true;
      }
    }
    return null;
  }
  const t = Math.max(0, Math.min(100, section)) / 100;
  const x = SECTION_MIN_X + (SECTION_MAX_X - SECTION_MIN_X) * t;
  const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -x);
  renderer.localClippingEnabled = true;
  for (const m of clippedMaterials) {
    if (!m) continue;
    m.clippingPlanes = [plane];
    m.needsUpdate = true;
  }
  return plane;
}
