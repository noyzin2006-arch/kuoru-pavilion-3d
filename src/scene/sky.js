/**
 * KRT-001 · 大气、IBL 与太阳光照
 *
 * 规划案 §5.3「光照准确流程」：
 *  - visible sky 与 IBL 严格分离：显示天空与「物体受天空照亮」不是一回事。
 *  - 无建筑物的独立 skyScene 经 `PMREMGenerator.fromScene(skyScene, 0, 0.1, 100, {size:256})`
 *    生成 environment；`scene.environment = pmrem.texture`。
 *  - 更新季节/时刻在动画完成时释放旧 WebGLRenderTarget 再生成新贴图（单时刻最多一次）。
 *  - 切换失败保持旧环境并恢复 time 状态，不能出现黑场。
 *  - 太阳参数为艺术定向，不声称天文精确。
 */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { TIME_OF_DAY, SEASONS } from '../core/geometry.js';

/** 太阳色温 → RGB 近似（预先写定，不调用远程服务）。 */
const KELVIN_RGB = {
  3000: [1.0, 0.72, 0.48],
  3400: [1.0, 0.78, 0.58],
  5500: [1.0, 0.97, 0.92],
  6500: [0.86, 0.92, 1.0],
};

/**
 * 创建可见天空与独立的天空场景（供 PMREM 使用）。
 * @param {THREE.WebGLRenderer} renderer
 */
export function makeAtmosphere(renderer) {
  const skyScene = new THREE.Scene();
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const u = sky.material.uniforms;
  u.turbidity.value = 7.5;
  u.rayleigh.value = 2.1;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  skyScene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.025;

  const ambient = new THREE.HemisphereLight(0xbcd6ff, 0x6b6255, 0.85);

  // 补光：朝向默认机位一侧的低强度无阴影平行光，避免檐下全黑（艺术照明）
  const fill = new THREE.DirectionalLight(0xdce8f2, 0.45);
  fill.position.set(40, 22, 34);
  fill.castShadow = false;

  return { skyScene, sky, sun, ambient, fill, renderer };
}

/**
 * 由时刻/季节计算太阳方向。
 *
 * 方位换算：规划案给的 azimuth 是艺术定向值，本实现固定映射为
 *   罗盘方位 = (azimuth + 200°) mod 360   （0=北、90=东、180=南、270=西）
 * 于是 dawn(-110°) → 东（旭日东升）、noon(-155°) → 东北（高照）、
 * dusk(+105°) → 西北偏西（夕照）、night(+160°) → 北（地平线下）。
 * 默认机位在东南，因此正午时刻主体受光面朝向镜头。
 *
 * @param {keyof typeof TIME_OF_DAY} time
 * @returns {{x:number,y:number,z:number,color:number,intensity:number,lamp:number}}
 */
export function solarFor(time) {
  const t = TIME_OF_DAY[time] || TIME_OF_DAY.noon;
  const az = (t.azimuth * Math.PI) / 180;
  const el = (t.elevation * Math.PI) / 180;
  const bearing = az + (200 * Math.PI) / 180; // 罗盘方位（自北顺时针）
  const r = 100;
  const horiz = Math.cos(el) * r;
  return {
    x: horiz * Math.sin(bearing), // 东为 +X
    y: Math.sin(el) * r,
    z: -horiz * Math.cos(bearing), // 北为 -Z
    color: t.color,
    intensity: t.intensity,
    lamp: t.lamp,
  };
}

/**
 * 应用太阳光照与天空参数。
 * @param {{sky: Sky, sun: THREE.DirectionalLight, ambient: THREE.HemisphereLight}} atmos
 * @param {keyof typeof TIME_OF_DAY} time
 * @param {keyof typeof SEASONS} season
 */
export function setSolarLighting(atmos, time, season) {
  const s = solarFor(time);
  const seasonCfg = SEASONS[season] || SEASONS.spring;

  atmos.sun.position.set(s.x, Math.max(s.y, 2), s.z);
  atmos.sun.intensity = s.intensity;
  atmos.sun.color.setHex(s.color);
  atmos.sun.target.position.set(0, 0, 0);
  atmos.sun.target.updateMatrixWorld();

  // 各时刻的环境强度：夜景必须明显区别于白天（否则 PMREM 的亮天空会把场景照成白天）
  const ambientByTime = { dawn: 0.42, noon: 0.85, dusk: 0.36, night: 0.18 };
  const fillByTime = { dawn: 0.3, noon: 0.45, dusk: 0.26, night: 0.08 };
  const envByTime = { dawn: 0.72, noon: 1.0, dusk: 0.6, night: 0.3 };
  atmos.ambient.intensity = ambientByTime[time] ?? 0.85;
  if (atmos.fill) atmos.fill.intensity = fillByTime[time] ?? 0.45;
  const envIntensity = envByTime[time] ?? 1.0;
  atmos.ambient.color.setHex(seasonCfg.leaf).lerp(new THREE.Color(0xbcd6ff), 0.55);

  const u = atmos.sky.material.uniforms;
  u.turbidity.value = time === 'dusk' || time === 'dawn' ? 9.5 : 7.5;
  u.rayleigh.value = time === 'dusk' || time === 'dawn' ? 3.0 : 2.1;
  u.mieCoefficient.value = time === 'dusk' || time === 'dawn' ? 0.008 : 0.005;
  u.sunPosition.value.set(s.x, s.y, s.z);
  // 夜空：大气模型在太阳落到地平线下时仍给出亮天空，改为不显示 Sky（由场景暗色背景接管）
  atmos.sky.visible = time !== 'night';

  return {
    exposure: TIME_OF_DAY[time].exposure,
    lamp: s.lamp,
    fog: seasonCfg.fog,
    envIntensity,
  };
}

/**
 * 重建 IBL 环境贴图。
 * 旧 target 在生成成功后释放；失败时保留旧环境（调用方负责回退）。
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} skyScene
 * @param {THREE.Texture|null} previousTexture
 * @param {THREE.WebGLRenderTarget|null} previousTarget
 * @returns {{texture: THREE.Texture, target: THREE.WebGLRenderTarget}}
 */
export function rebuildPMREM(renderer, skyScene, previousTexture = null, previousTarget = null) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(skyScene, 0, 0.1, 100, { size: 256 });
  pmrem.dispose();
  if (previousTexture) previousTexture.dispose();
  if (previousTarget) previousTarget.dispose();
  return { texture: target.texture, target };
}

/**
 * 檐下暖色灯（夜景**艺术照明**，不声称历史装灯）。
 *
 * 按「檐下灯」做成檐下一圈多盏，而不是中心一盏：
 * 单盏中心灯只能照亮地面，檐下的柱网与斗栱仍是黑的；
 * 环形布灯才能让夜间仍能读出八角双檐的结构。
 *
 * @param {number} intensity 单盏强度
 * @param {number} [radius] 灯环半径
 * @returns {THREE.Group|null}
 */
export function makeLampLight(intensity, radius = 10.5) {
  if (!intensity) return null;
  const group = new THREE.Group();
  group.name = 'eave-lamps';
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.PI / 8;
    const light = new THREE.PointLight(0xffb877, intensity * 2.4, 24, 2);
    light.position.set(Math.sin(a) * radius, 5.0, Math.cos(a) * radius);
    group.add(light);
  }
  return group;
}
