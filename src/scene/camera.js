/**
 * KRT-001 · 相机机位与约束
 *
 * 规划案 §4：
 *  - 默认相机 eye(28,16,29) → target(0,5,0)，FOV 35°。
 *  - 普通模式 distance [8,85]、polar [.15,1.48]、target XZ ±18 且 Y∈[1,10.5]；
 *    藻井模式 distance[1.5,12]、允许仰视、禁用破坏视角的 pan，退出时恢复普通限制。
 *  - 镜头动画 800ms cubic-bezier(.2,.8,.2,1)；用户拖动立即取消预设过渡，不得二次跳跃。
 *  - 手写镜头移动后必须调用 controls.update()。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS } from '../core/geometry.js';

const PRESET_MS = 800;
const EASE = (t) => 1 - (1 - t) ** 3; // 与 cubic-bezier(.2,.8,.2,1) 接近的缓出

/**
 * 创建相机机位。
 * @param {THREE.WebGLRenderer} renderer
 * @param {HTMLElement} domElement
 */
export function createCameraRig(renderer, domElement) {
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
  const p = CAMERA_PRESETS.overview;
  camera.position.set(p.eye[0], p.eye[1], p.eye[2]);

  const controls = new OrbitControls(camera, domElement);
  controls.target.set(p.target[0], p.target[1], p.target[2]);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.6;
  controls.minDistance = 8;
  controls.maxDistance = 85;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.48;
  controls.update();

  let animation = null;
  let mode = 'normal';
  /** 上一次确认有效的相机与目标，用于异常回滚。 */
  let lastGood = {
    eye: new THREE.Vector3(...CAMERA_PRESETS.overview.eye),
    target: new THREE.Vector3(...CAMERA_PRESETS.overview.target),
  };

  /**
   * 相机状态守卫（规划案 §8：OrbitControls.update() 后检查 camera/target 非 NaN、bounds 未超）。
   * 任何手写镜头操作或阻尼插值产生非有限值时，回滚到上一次确认有效的状态。
   * @returns {boolean} 是否发生了回滚
   */
  function sanitize() {
    const p = camera.position;
    const t = controls.target;
    const bad =
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) ||
      !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z) ||
      p.distanceTo(t) < 0.05; // 相机与目标重合时轨道会退化
    if (!bad) {
      lastGood.eye.copy(p);
      lastGood.target.copy(t);
      return false;
    }
    p.copy(lastGood.eye);
    t.copy(lastGood.target);
    controls.update();
    return true;
  }

  const cancelAnimation = () => {
    animation = null;
  };
  controls.addEventListener('start', cancelAnimation);

  /**
   * 应用镜头预设。
   * @param {keyof typeof CAMERA_PRESETS} preset
   * @param {boolean} [animate]
   * @param {number} [durationMs]
   */
  function applyPreset(preset, animate = true, durationMs = PRESET_MS) {
    const cfg = CAMERA_PRESETS[preset];
    if (!cfg) return;
    setMode(preset === 'ceiling' ? 'ceiling' : 'normal');

    const fromEye = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toEye = new THREE.Vector3(cfg.eye[0], cfg.eye[1], cfg.eye[2]);
    const toTarget = new THREE.Vector3(cfg.target[0], cfg.target[1], cfg.target[2]);

    if (!animate) {
      camera.position.copy(toEye);
      controls.target.copy(toTarget);
      controls.update();
      return;
    }
    animation = { fromEye, fromTarget, toEye, toTarget, start: performance.now(), duration: durationMs };
  }

  /**
   * 每帧推进镜头动画。
   *
   * 时钟说明：用 `performance.now()` 而不是 rAF 帧时间戳。
   * rAF 的时间戳是**该帧开始**的时刻，可能早于 applyPreset 被调用的时刻
   * （慢渲染时更明显），导致 `now - start` 为负、过渡进度恒为 0，
   * 镜头会卡在起点。两个时钟同源，用 performance.now() 才能保证进度单调。
   */
  function update() {
    if (!animation) return false;
    const t = Math.min(1, Math.max(0, (performance.now() - animation.start) / animation.duration));
    const e = EASE(t);
    camera.position.lerpVectors(animation.fromEye, animation.toEye, e);
    controls.target.lerpVectors(animation.fromTarget, animation.toTarget, e);
    controls.update();
    if (t >= 1) animation = null;
    sanitize();
    return true;
  }

  /**
   * 切换约束模式。
   * @param {'normal'|'ceiling'} next
   */
  function setMode(next) {
    mode = next;
    if (mode === 'ceiling') {
      controls.minDistance = 1.5;
      controls.maxDistance = 12;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI - 0.15;
      controls.enablePan = false;
    } else {
      controls.minDistance = 8;
      controls.maxDistance = 85;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = 1.48;
      controls.enablePan = true;
    }
  }

  /**
   * 约束 target 在允许范围内（手写镜头移动后调用）。
   */
  function constrainCamera() {
    const t = controls.target;
    if (mode === 'normal') {
      t.x = THREE.MathUtils.clamp(t.x, -18, 18);
      t.z = THREE.MathUtils.clamp(t.z, -18, 18);
      t.y = THREE.MathUtils.clamp(t.y, 1, 10.5);
    } else {
      t.x = THREE.MathUtils.clamp(t.x, -6, 6);
      t.z = THREE.MathUtils.clamp(t.z, -6, 6);
      t.y = THREE.MathUtils.clamp(t.y, 3, 9.5);
    }
    controls.update();
  }

  return {
    camera,
    controls,
    applyPreset,
    update,
    setMode,
    constrainCamera,
    sanitize,
    get mode() {
      return mode;
    },
    get animating() {
      return animation !== null;
    },
    dispose() {
      controls.removeEventListener('start', cancelAnimation);
      controls.dispose();
    },
  };
}
