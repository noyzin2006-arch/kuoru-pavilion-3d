/**
 * KRT-001 · 展厅应用（状态 ↔ 场景 ↔ DOM 单向流）
 *
 * 规划案 §4 / §5.1：
 *  - UI 事件 → reducer → 单向渲染；UI 不直接修改 3D 构件位置，只由 scene 视图从 state 驱动。
 *  - 默认不永久记用户偏好，刷新恢复确定初始状态；只有引导完成标记写 sessionStorage。
 *  - 键盘全路径：Tab 依次到 跳转主内容 → 帮助 → 时段 → 季节 → 镜头 → 构件目录 → 分解 → 剖切 → 画布控件；
 *    画布聚焦时 ←/→ 转 10°、↑/↓ 改极角 6°、+/- 缩放 1.12 倍、Shift+方向键平移 0.5m、R 恢复默认；
 *    Esc 关闭详情/引导并还原焦点。快捷键仅在画布聚焦时生效。
 */

import * as THREE from 'three';
import { createInitialState, reduceState, actionError } from '../core/state.js';
import { listParts, getPart, isKnownPart, listSources } from '../core/catalog.js';
import { PAVILION_CONFIG, CAMERA_PRESETS, SEASONS } from '../core/geometry.js';
import { makeProceduralMaterials, disposeMaterials } from '../scene/materials.js';
import { buildPavilion } from '../scene/buildPavilion.js';
import { buildLandscape } from '../scene/buildLandscape.js';
import { mountRenderer } from '../scene/renderer.js';
import { makeAtmosphere, setSolarLighting, rebuildPMREM, makeLampLight } from '../scene/sky.js';
import { raycastPart, projectHotspots, applyExplode, applySection } from '../scene/interaction.js';
import {
  createViewTools,
  createRadioGroup,
  createPartCatalog,
  createDetailPanel,
  createStructureControls,
  createCameraPresets,
  createGuide,
  createToast,
  el,
} from './components.js';
import { icon } from './icons.js';

const LOAD_STEPS = ['环境', '柱网', '檐顶', '光照'];

export function createExhibit(dom) {
  let state = createInitialState();
  const dispatch = (action) => {
    const err = actionError(state, action, isKnownPart);
    if (err) {
      toast.show(err, 'alert');
      if (action.type === 'SELECT_PART') {
        state = reduceState(state, { type: 'CLEAR_SELECTION' });
      }
      return;
    }
    const next = reduceState(state, action);
    if (next === state) return;
    state = next;
    render();
  };

  /* ------------------------------------------------------------ 场景装配 */
  const canvas = dom.canvas;
  const stage = mountRenderer(canvas);
  const { renderer, scene, rig } = stage;

  const resources = makeProceduralMaterials({ quality: state.quality });
  const pavilion = buildPavilion(PAVILION_CONFIG, resources, { quality: state.quality });
  const landscape = buildLandscape(PAVILION_CONFIG, resources, { quality: state.quality });
  const atmos = makeAtmosphere(renderer);

  scene.add(
    landscape.root,
    pavilion.root,
    atmos.sky,
    atmos.sun,
    atmos.sun.target,
    atmos.ambient,
    atmos.fill,
  );
  scene.fog = landscape.root.userData.fog || null;

  let lamp = null;
  let envTexture = null;
  let envTarget = null;

  const applyEnvironment = () => {
    const result = setSolarLighting(atmos, state.time, state.season);
    renderer.toneMappingExposure = result.exposure;
    if (lamp) {
      scene.remove(lamp);
      lamp.dispose();
      lamp = null;
    }
    if (result.lamp > 0) {
      lamp = makeLampLight(result.lamp);
      scene.add(lamp);
    }
    const seasonCfg = SEASONS[state.season];
    if (scene.fog) {
      // 线性雾：规划案以「密度」描述季节雾，映射为近/远端缩放（基准 0.009 → 100/450m）
      const k = 0.009 / seasonCfg.fog;
      scene.fog.near = 100 * k;
      scene.fog.far = 450 * k;
    }
    if (resources.materials.water) {
      resources.materials.water.color.setHex(seasonCfg.water);
      resources.materials.foliage.color.setHex(seasonCfg.leaf);
    }
    try {
      const next = rebuildPMREM(renderer, atmos.skyScene, envTexture, envTarget);
      envTexture = next.texture;
      envTarget = next.target;
      scene.environment = envTexture;
    } catch (err) {
      // 切换失败保持旧环境，不出现黑场
      console.warn('IBL 重建失败，保留旧环境', err);
    }
    stage.requestRender('environment');
  };

  applyEnvironment();

  /* ------------------------------------------------------------ DOM 引用 */
  const detailPanel = document.getElementById('detail-panel');
  const detailBody = document.getElementById('detail-body');
  const hotspotLayer = document.getElementById('hotspot-layer');
  const overlay = document.getElementById('stage-overlay');
  const statusEl = document.getElementById('stage-status');
  const controlsRoot = document.getElementById('controls-root');
  const sourceBody = document.getElementById('source-body');
  const guideDialog = document.getElementById('guide-dialog');
  const guideScrim = document.getElementById('guide-scrim');
  const toastEl = document.getElementById('toast');

  const toast = createToast(toastEl);

  /* ------------------------------------------------------------ 构件目录与详情 */
  const parts = listParts();
  const detail = createDetailPanel(detailPanel, detailBody, () => dispatch({ type: 'CLEAR_SELECTION' }));

  const catalog = createPartCatalog(parts, (id) => dispatch({ type: 'SELECT_PART', id }));
  controlsRoot.appendChild(catalog);

  /* ------------------------------------------------------------ 时刻与季节 */
  const timeGroup = createRadioGroup('时段', { dawn: '晨', noon: '午', dusk: '黄昏', night: '夜' }, state.time, (v) =>
    dispatch({ type: 'SET_TIME', time: v }),
  );
  const seasonGroup = createRadioGroup('季节', { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }, state.season, (v) =>
    dispatch({ type: 'SET_SEASON', season: v }),
  );
  const timeWrap = el('section', 'control-group');
  timeWrap.appendChild(el('h3', 'control-group__title', { text: '时刻与季节' }));
  timeWrap.appendChild(timeGroup);
  timeWrap.appendChild(seasonGroup);
  controlsRoot.appendChild(timeWrap);

  /* ------------------------------------------------------------ 结构拆解 */
  const structure = createStructureControls({
    onExplode: (v) => dispatch({ type: 'SET_EXPLODE', value: v }),
    onSection: (v) => dispatch({ type: 'SET_SECTION', value: v }),
    onExplodeToggle: (on) => dispatch({ type: 'TOGGLE_EXPLODE', enabled: on }),
    onSectionToggle: (on) => dispatch({ type: 'TOGGLE_SECTION', enabled: on }),
    onHumanToggle: (on) => dispatch({ type: 'TOGGLE_HUMAN', enabled: on }),
  });
  controlsRoot.appendChild(structure.el);

  /* ------------------------------------------------------------ 镜头预设 */
  const presets = createCameraPresets((preset) => dispatch({ type: 'SET_PRESET', preset }));
  controlsRoot.appendChild(presets.el);

  /* ------------------------------------------------------------ 视角工具 */
  const viewTools = createViewTools({
    onRotate: (deg) => rotateCamera(deg),
    onZoom: (factor) => zoomCamera(factor),
    onReset: () => dispatch({ type: 'SET_PRESET', preset: 'overview' }),
  });
  dom.viewtools.appendChild(viewTools);

  /* ------------------------------------------------------------ 热点 */
  const hotspotButtons = new Map();
  for (const rec of parts) {
    const btn = el('button', 'hotspot', {
      type: 'button',
      'aria-label': `查看${rec.title}`,
      text: rec.title.length > 6 ? `${rec.title.slice(0, 5)}…` : rec.title,
      title: rec.title,
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dispatch({ type: 'SELECT_PART', id: rec.id });
    });
    hotspotLayer.appendChild(btn);
    hotspotButtons.set(rec.id, btn);
  }

  /* ------------------------------------------------------------ 首次引导 */
  const guide = createGuide(guideDialog, guideScrim, () => {
    try {
      sessionStorage.setItem('kuoru-guide-seen', '1');
    } catch {
      /* 写失败只影响再次出现，不阻断模型 */
    }
  });

  const helpButton = document.getElementById('help-button');
  helpButton.innerHTML = icon('help', 20);
  helpButton.addEventListener('click', () => guide.open());

  /* ------------------------------------------------------------ 资料来源 */
  for (const s of listSources()) {
    const p = el('p');
    p.appendChild(el('b', null, { text: `${s.label}：` }));
    p.appendChild(document.createTextNode(s.text));
    sourceBody.appendChild(p);
  }

  /* ------------------------------------------------------------ 相机操作 */
  function rotateCamera(deg) {
    const t = rig.controls.target;
    const cam = rig.camera;
    const off = new THREE.Vector3().subVectors(cam.position, t);
    const a = (deg * Math.PI) / 180;
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    cam.position.copy(t).add(off);
    rig.controls.update();
    stage.requestRender('rotate');
  }

  function zoomCamera(factor) {
    const t = rig.controls.target;
    const cam = rig.camera;
    const off = new THREE.Vector3().subVectors(cam.position, t);
    const d = THREE.MathUtils.clamp(off.length() * factor, rig.controls.minDistance, rig.controls.maxDistance);
    off.setLength(d);
    cam.position.copy(t).add(off);
    rig.controls.update();
    stage.requestRender('zoom');
  }

  /* ------------------------------------------------------------ 画布交互 */
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const id = raycastPart(e.clientX, e.clientY, rig.camera, pavilion.parts, canvas);
    if (id && isKnownPart(id)) dispatch({ type: 'SELECT_PART', id });
  });

  canvas.addEventListener('keydown', (e) => {
    // 快捷键仅在画布聚焦时生效
    const step = 6 * (Math.PI / 180);
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        if (e.shiftKey) panCamera(-0.5, 0);
        else rotateCamera(-10);
        break;
      case 'ArrowRight':
        if (e.shiftKey) panCamera(0.5, 0);
        else rotateCamera(10);
        break;
      case 'ArrowUp':
        if (e.shiftKey) panCamera(0, -0.5);
        else tiltCamera(-step);
        break;
      case 'ArrowDown':
        if (e.shiftKey) panCamera(0, 0.5);
        else tiltCamera(step);
        break;
      case '+':
      case '=':
        zoomCamera(1.12);
        break;
      case '-':
      case '_':
        zoomCamera(1 / 1.12);
        break;
      case 'r':
      case 'R':
        dispatch({ type: 'SET_PRESET', preset: 'overview' });
        break;
      case 'Escape':
        dispatch({ type: 'CLOSE_OVERLAY' });
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  });

  function tiltCamera(delta) {
    const t = rig.controls.target;
    const cam = rig.camera;
    const off = new THREE.Vector3().subVectors(cam.position, t);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.phi = THREE.MathUtils.clamp(sph.phi + delta, rig.controls.minPolarAngle, rig.controls.maxPolarAngle);
    off.setFromSpherical(sph);
    cam.position.copy(t).add(off);
    rig.controls.update();
    stage.requestRender('tilt');
  }

  function panCamera(dx, dz) {
    const t = rig.controls.target;
    const cam = rig.camera;
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    t.addScaledVector(right, dx);
    t.addScaledVector(forward, dz);
    rig.constrainCamera();
    stage.requestRender('pan');
  }

  /* ------------------------------------------------------------ 每帧更新热点 */
  stage.onFrame(() => {
    const projected = projectHotspots(rig.camera, parts, canvas);
    for (const p of projected) {
      const btn = hotspotButtons.get(p.id);
      if (!btn) continue;
      if (!p.visible) {
        btn.hidden = true;
        continue;
      }
      btn.hidden = false;
      btn.style.left = `${p.x}px`;
      btn.style.top = `${p.y}px`;
      btn.setAttribute('aria-pressed', String(state.selectedPartId === p.id));
    }
  });

  /* ------------------------------------------------------------ 渲染 */
  let lastPreset = null;

  function render() {
    // 镜头：仅在预设变化时重新过渡，避免其它状态变化时二次跳跃
    if (state.preset && state.preset !== lastPreset) {
      lastPreset = state.preset;
      rig.applyPreset(state.preset, true);
    }

    // 分解
    applyExplode(pavilion.parts, state.explodeEnabled ? state.explode : 0);
    const human = pavilion.parts.get('scale-human');
    if (human) human.visible = state.showHuman;

    // 剖切
    applySection(renderer, pavilion.materials, state.section, state.sectionEnabled);

    // 详情
    const rec = state.selectedPartId ? getPart(state.selectedPartId) : null;
    detailPanel.hidden = !(rec && state.detailOpen);
    detail.render(rec);

    // 控件同步
    structure.sync(state);
    presets.sync(state);
    for (const input of timeGroup.querySelectorAll('input')) {
      input.checked = input.value === state.time;
    }
    for (const input of seasonGroup.querySelectorAll('input')) {
      input.checked = input.value === state.season;
    }
    for (const btn of catalog.querySelectorAll('.catalog__button')) {
      const label = btn.getAttribute('aria-label') || '';
      const isCurrent = rec && label === `定位${rec.title}`;
      btn.setAttribute('aria-current', String(Boolean(isCurrent)));
    }

    // 状态文案
    if (state.phase === 'ready') {
      overlay.hidden = true;
      statusEl.hidden = false;
      statusEl.textContent = '廓如亭模型就绪，拖动旋转、滚轮缩放';
    } else if (state.phase === 'error') {
      overlay.hidden = false;
      overlay.textContent = '';
      const card = el('div', 'stage__card');
      card.appendChild(el('h2', null, { text: '无法开启三维' }));
      card.appendChild(el('p', null, { text: state.failure || '你的浏览器没有成功启动实时三维，请刷新或阅读文字结构说明' }));
      const btn = el('button', 'button', { type: 'button', text: '重试' });
      btn.addEventListener('click', () => window.location.reload());
      card.appendChild(btn);
      overlay.appendChild(card);
      statusEl.hidden = true;
    }

    stage.requestRender('state');
  }

  /* ------------------------------------------------------------ 引导与就绪 */
  let seen = false;
  try {
    seen = sessionStorage.getItem('kuoru-guide-seen') === '1';
  } catch {
    seen = false;
  }
  if (!seen) {
    window.setTimeout(() => guide.open(), 400);
  }
  dispatch({ type: 'READY' });
  toast.show('廓如亭模型就绪，拖动旋转、滚轮缩放');

  /* ------------------------------------------------------------ 暴露给测试 */
  const api = {
    get state() {
      return state;
    },
    dispatch,
    renderer,
    scene,
    rig,
    pavilion,
    landscape,
    parts,
    rotateCamera,
    zoomCamera,
    toggleHelp: () => guide.open(),
    destroy() {
      pavilion.dispose();
      landscape.dispose();
      disposeMaterials(resources);
      stage.destroy();
    },
  };
  window.__exhibit = api;
  return api;
}

export { LOAD_STEPS };
