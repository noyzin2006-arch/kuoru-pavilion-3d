/**
 * KRT-001 · 渲染器挂载与生命周期
 *
 * 规划案 §5.3 / §5.5：
 *  - WebGLRenderer({antialias:true, powerPreference:'high-performance'})
 *  - outputColorSpace = SRGBColorSpace；toneMapping = ACESFilmicToneMapping；exposure 1.05
 *  - shadowMap.enabled = true，PCFSoftShadowMap
 *  - requestRender(reason)：标记脏，最多调度一次 RAF
 *  - ResizeObserver 遇 0 宽高不重设 aspect；节流到 RAF；旋转手机同理
 *  - webglcontextlost → preventDefault，暂停 RAF，显示「图形环境中断，正在恢复」；
 *    webglcontextrestored → 重建材质环境/资源、重播当前状态
 *  - window.blur / visibilitychange 取消拖拽与镜头动画，返回时不能跳动
 */

import * as THREE from 'three';
import { createCameraRig } from './camera.js';

export function mountRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const rig = createCameraRig(renderer, canvas);

  let dirty = true;
  let rafId = 0;
  let destroyed = false;
  let contextLost = false;
  const frameCallbacks = new Set();
  let lastWidth = 0;
  let lastHeight = 0;

  /** 标记为需要重绘，最多调度一次 RAF。 */
  function requestRender(reason = 'unspecified') {
    if (destroyed || contextLost) return;
    dirty = true;
    if (rafId) return;
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return; // 0 宽高不重设 aspect
    if (w === lastWidth && h === lastHeight) return;
    lastWidth = w;
    lastHeight = h;
    renderer.setSize(w, h, false);
    rig.camera.aspect = w / h;
    rig.camera.updateProjectionMatrix();
    requestRender('resize');
  }

  function frame(now) {
    rafId = 0;
    if (destroyed || contextLost) return;
    const animated = rig.update(now);
    for (const cb of frameCallbacks) cb(now);
    if (dirty || animated) {
      dirty = false;
      renderer.render(scene, rig.camera);
    }
    rafId = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const onBlur = () => {
    rig.controls.enabled = false;
  };
  const onFocus = () => {
    rig.controls.enabled = true;
    requestRender('focus');
  };
  const onVisibility = () => {
    if (document.hidden) rig.controls.enabled = false;
    else {
      rig.controls.enabled = true;
      requestRender('visibility');
    }
  };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);

  const onContextLost = (e) => {
    e.preventDefault();
    contextLost = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
  const onContextRestored = () => {
    contextLost = false;
    requestRender('context-restored');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    rig.dispose();
    renderer.dispose();
  }

  resize();
  rafId = requestAnimationFrame(frame);

  return {
    renderer,
    scene,
    rig,
    requestRender,
    resize,
    destroy,
    onFrame(cb) {
      frameCallbacks.add(cb);
      return () => frameCallbacks.delete(cb);
    },
    get contextLost() {
      return contextLost;
    },
  };
}
