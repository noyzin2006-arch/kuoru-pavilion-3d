/**
 * KRT-001 · 启动入口
 *
 * 规划案 §1 / §5.5：
 *  - WebGL2 不支持时必须给文本替代（而不是白屏）。
 *  - 任何启动失败都进入 error 阶段并给出可读的恢复路径。
 *  - 冷启动交互目标 ≤ 2.5s（本机实测记录在执行报告）。
 */

import { createExhibit } from './ui/app.js';

function webgl2Supported() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function showFallback(message) {
  const overlay = document.getElementById('stage-overlay');
  const status = document.getElementById('stage-status');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.textContent = '';
  const card = document.createElement('div');
  card.className = 'stage__card';
  const h = document.createElement('h2');
  h.textContent = '无法开启三维';
  const p = document.createElement('p');
  p.textContent = message;
  const note = document.createElement('p');
  note.textContent =
    '廓如亭为颐和园东堤上的八角重檐攒尖亭：平面呈八边形、每面显三间，' +
    '内外三圈共 40 根柱（24 圆柱、16 方柱），柱高 4.29 米，亭周为八方月台（边长 11.1 米）。';
  card.append(h, p, note);
  overlay.appendChild(card);
  if (status) status.hidden = true;
}

function boot() {
  if (!webgl2Supported()) {
    showFallback('你的浏览器没有成功启动实时三维，请刷新或阅读文字结构说明');
    return;
  }

  try {
    const canvas = document.getElementById('scene-canvas');
    const viewtools = document.getElementById('viewtools');
    createExhibit({ canvas, viewtools });
  } catch (err) {
    console.error(err);
    showFallback('展厅未能启动，请刷新页面');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
