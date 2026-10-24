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

  /** 每帧推进镜头动画。 */
  function update(now) {
    if (!animation) return false;
    const t = Math.min(1, (now - animation.start) / animation.duration);
    const e = EASE(t);
    camera.position.lerpVectors(animation.fromEye, animation.toEye, e);
    controls.target.lerpVectors(animation.fromTarget, animation.toTarget, e);
    controls.update();
    if (t >= 1) animation = null;
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
