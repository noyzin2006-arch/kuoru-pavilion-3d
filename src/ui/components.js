/**
 * KRT-001 · 界面组件
 *
 * 规划案 §3.2 C01–C10 的结构、ARIA、键盘与四态文案。
 * 通用矩阵 M：默认 panel 底 + main 字 + 1px 边；hover 仅在 hover:hover 设备启用 soft 底；
 * 按下 accent-soft 底 + scale(.98)；:focus-visible 3px 蓝环 + 2px 外扩；
 * 不可交互态 aria-disabled=true 且阻止事件；工具点击目标 ≥44×44。
 * 不在界面提供任何没有响应逻辑的假按钮。
 */

import { icon } from './icons.js';
import { SEASON_VALUES, TIME_VALUES, PRESET_VALUES } from '../core/state.js';

/* ---------------------------------------------------------------- 通用工具 */

export function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, String(v));
  }
  return node;
}

/** 图标按钮（44×44 命中区）。 */
export function iconButton(name, label, onClick, extraClass = '') {
  const btn = el('button', `icon-button ${extraClass}`.trim(), {
    type: 'button',
    'aria-label': label,
    title: label,
  });
  btn.innerHTML = icon(name, 20);
  btn.addEventListener('click', onClick);
  return btn;
}

/** 分区标题 + 说明块。 */
export function section(title, hint) {
  const wrap = el('section', 'control-group');
  const head = el('div', 'control-group__head');
  head.appendChild(el('h3', 'control-group__title', { text: title }));
  wrap.appendChild(head);
  if (hint) wrap.appendChild(el('p', 'control-group__hint', { text: hint }));
  return wrap;
}

/* ---------------------------------------------------------------- C03 视角工具 */

/**
 * @param {{onRotate:(deg:number)=>void, onZoom:(f:number)=>void, onReset:()=>void}} handlers
 */
export function createViewTools(handlers) {
  const group = el('div', 'viewtools');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '视角工具');

  group.appendChild(iconButton('rotateLeft', '左转', () => handlers.onRotate(-10)));
  group.appendChild(iconButton('rotateRight', '右转', () => handlers.onRotate(10)));
  group.appendChild(iconButton('zoomIn', '放大', () => handlers.onZoom(1.12)));
  group.appendChild(iconButton('zoomOut', '缩小', () => handlers.onZoom(1 / 1.12)));
  group.appendChild(iconButton('reset', '复位', () => handlers.onReset()));
  return group;
}

/* ---------------------------------------------------------------- C04 时刻 / 季节 */

/**
 * 原生 radio 组的 fieldset。
 * @param {string} legend
 * @param {Record<string,string>} options
 * @param {string} current
 * @param {(value:string)=>void} onChange
 */
export function createRadioGroup(legend, options, current, onChange) {
  const fs = el('fieldset', 'radio-group');
  fs.appendChild(el('legend', 'radio-group__legend', { text: legend }));
  const wrap = el('div', 'radio-group__items');
  for (const [value, label] of Object.entries(options)) {
    const id = `radio-${legend}-${value}`;
    const input = el('input', 'radio-group__input', {
      type: 'radio',
      name: `group-${legend}`,
      id,
      value,
    });
    input.checked = value === current;
    input.addEventListener('change', () => {
      if (input.checked) onChange(value);
    });
    const labelNode = el('label', 'radio-group__label', { for: id, text: label });
    wrap.appendChild(input);
    wrap.appendChild(labelNode);
  }
  fs.appendChild(wrap);
  return fs;
}

/* ---------------------------------------------------------------- C05 构件目录 */

/**
 * @param {Array<{id:string,title:string,category:string,confidence:string}>} parts
 * @param {(id:string)=>void} onSelect
 */
export function createPartCatalog(parts, onSelect) {
  const wrap = section('构件目录', '当前视角没有可见标记时，可从这里直接定位');
  const list = el('ul', 'catalog');
  for (const p of parts) {
    const li = el('li', 'catalog__item');
    const btn = el('button', 'catalog__button', {
      type: 'button',
      'aria-label': `定位${p.title}`,
    });
    btn.appendChild(el('span', 'catalog__title', { text: p.title }));
    btn.appendChild(el('span', `badge badge--${p.confidence.toLowerCase()}`, { text: p.confidence }));
    btn.addEventListener('click', () => onSelect(p.id));
    li.appendChild(btn);
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

/* ---------------------------------------------------------------- C06 详情面板 */

/**
 * @param {HTMLElement} body
 * @param {HTMLElement} panel
 * @param {()=>void} onClose
 */
export function createDetailPanel(panel, body, onClose) {
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.innerHTML = icon('close', 20);
    closeBtn.addEventListener('click', onClose);
  }

  /**
   * @param {object|null} record
   */
  function render(record) {
    if (!record) {
      body.textContent = '';
      body.appendChild(el('p', 'detail__empty', { text: '请选择一个构件了解形制' }));
      return;
    }
    body.textContent = '';
    body.appendChild(el('p', 'detail__category', { text: record.category }));
    body.appendChild(el('h3', 'detail__title', { text: record.title }));
    body.appendChild(
      el('p', 'detail__confidence', {
        text:
          record.confidence === 'H'
            ? '置信度 H · 史料交叉核实'
            : record.confidence === 'I'
              ? '置信度 I · 依营造则例推算'
              : '置信度 S · 示意性构图',
      }),
    );
    const desc = el('p', 'detail__description');
    // 分段：第一段名称与作用，其余为依据与偏差
    for (const seg of record.description.split('。').filter(Boolean)) {
      desc.appendChild(el('span', 'detail__paragraph', { text: `${seg}。` }));
    }
    body.appendChild(desc);
    body.appendChild(el('p', 'detail__source', { text: `资料来源：${record.source}` }));
  }

  return { render };
}

/* ---------------------------------------------------------------- C07 分解 / 剖切 */

/**
 * @param {{onExplode:(v:number)=>void, onSection:(v:number)=>void,
 *   onExplodeToggle:(on:boolean)=>void, onSectionToggle:(on:boolean)=>void}} handlers
 */
export function createStructureControls(handlers) {
  const wrap = section('结构拆解', '分解观察分层，剖切查看内部结构（非测绘剖面）');

  const explodeWrap = el('div', 'control');
  const explodeBtn = el('button', 'button', {
    type: 'button',
    'aria-pressed': 'false',
    text: '分解结构',
  });
  const explodeRange = el('input', 'range', {
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: '0',
    'aria-label': '分解比例',
    'aria-valuetext': '分解 0%',
  });
  explodeBtn.addEventListener('click', () => {
    const on = explodeBtn.getAttribute('aria-pressed') !== 'true';
    explodeBtn.setAttribute('aria-pressed', String(on));
    handlers.onExplodeToggle(on);
  });
  explodeRange.addEventListener('input', () => {
    const v = Number(explodeRange.value);
    explodeRange.setAttribute('aria-valuetext', `分解 ${v}%`);
    handlers.onExplode(v);
  });
  explodeWrap.appendChild(explodeBtn);
  explodeWrap.appendChild(explodeRange);
  wrap.appendChild(explodeWrap);

  const sectionWrap = el('div', 'control');
  const sectionBtn = el('button', 'button', {
    type: 'button',
    'aria-pressed': 'false',
    text: '平面剖切',
  });
  const sectionRange = el('input', 'range', {
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: '0',
    'aria-label': '剖切位置',
    'aria-valuetext': '剖切 0%',
  });
  sectionBtn.addEventListener('click', () => {
    const on = sectionBtn.getAttribute('aria-pressed') !== 'true';
    sectionBtn.setAttribute('aria-pressed', String(on));
    handlers.onSectionToggle(on);
  });
  sectionRange.addEventListener('input', () => {
    const v = Number(sectionRange.value);
    sectionRange.setAttribute('aria-valuetext', `剖切 ${v}%`);
    handlers.onSection(v);
  });
  sectionWrap.appendChild(sectionBtn);
  sectionWrap.appendChild(sectionRange);
  wrap.appendChild(sectionWrap);

  const humanBtn = el('button', 'button', {
    type: 'button',
    'aria-pressed': 'false',
    text: '显示 1.70m 比例人',
  });
  humanBtn.addEventListener('click', () => {
    const on = humanBtn.getAttribute('aria-pressed') !== 'true';
    humanBtn.setAttribute('aria-pressed', String(on));
    handlers.onHumanToggle(on);
  });
  wrap.appendChild(humanBtn);

  return {
    el: wrap,
    sync(state) {
      explodeBtn.setAttribute('aria-pressed', String(state.explodeEnabled));
      explodeRange.value = String(state.explode);
      explodeRange.setAttribute('aria-valuetext', `分解 ${state.explode}%`);
      sectionBtn.setAttribute('aria-pressed', String(state.sectionEnabled));
      sectionRange.value = String(state.section);
      sectionRange.setAttribute('aria-valuetext', `剖切 ${state.section}%`);
      humanBtn.setAttribute('aria-pressed', String(state.showHuman));
    },
  };
}

/* ---------------------------------------------------------------- C08 六镜头 */

/**
 * @param {(preset:string)=>void} onSelect
 */
export function createCameraPresets(onSelect) {
  const wrap = section('镜头预设', '切换到常用观察位置');
  const grid = el('div', 'preset-grid');
  const buttons = new Map();
  for (const [key, label] of Object.entries(PRESET_VALUES)) {
    const btn = el('button', 'preset', {
      type: 'button',
      'aria-pressed': 'false',
      text: label,
    });
    btn.addEventListener('click', () => onSelect(key));
    buttons.set(key, btn);
    grid.appendChild(btn);
  }
  wrap.appendChild(grid);
  return {
    el: wrap,
    sync(state) {
      for (const [key, btn] of buttons) {
        btn.setAttribute('aria-pressed', String(key === state.preset));
      }
    },
  };
}

/* ---------------------------------------------------------------- C09 首次引导 */

const GUIDE_STEPS = [
  {
    title: '拖动即转，滚轮即缩',
    body: '在三维画面上按住左键拖动可环绕观察，滚轮缩放，右键平移。画面获得焦点后，方向键也能转视角，加减号缩放，R 键复位。',
  },
  {
    title: '八个标记，八处构件',
    body: '画面上的标记对应斗栱、彩画、藻井、匾额、柱网等八处构件。点标记会聚焦并展开说明；没有可见标记时，可从右侧「构件目录」直接定位。',
  },
  {
    title: '拆开看结构',
    body: '「分解结构」把屋面、枋梁、坐凳逐层拉开；「平面剖切」切开一个竖直面看内部柱网。剖切只是展示内部结构，不是测绘剖面。',
  },
];

/**
 * @param {HTMLElement} dialog
 * @param {HTMLElement} scrim
 * @param {()=>void} onClose
 */
export function createGuide(dialog, scrim, onClose) {
  let index = 0;
  let lastFocus = null;

  function render() {
    dialog.textContent = '';
    const step = GUIDE_STEPS[index];
    const head = el('div', 'dialog__head');
    head.appendChild(el('p', 'dialog__eyebrow', { text: `导览 ${index + 1} / ${GUIDE_STEPS.length}` }));
    head.appendChild(el('h2', 'dialog__title', { id: 'guide-title', text: step.title }));
    dialog.appendChild(head);
    dialog.appendChild(el('p', 'dialog__body', { text: step.body }));

    const actions = el('div', 'dialog__actions');
    const skip = el('button', 'button button--quiet', { type: 'button', text: '跳过' });
    skip.addEventListener('click', close);
    const next = el('button', 'button', {
      type: 'button',
      text: index === GUIDE_STEPS.length - 1 ? '开始探索' : '下一步',
    });
    next.addEventListener('click', () => {
      if (index === GUIDE_STEPS.length - 1) {
        close();
        return;
      }
      index += 1;
      render();
      dialog.querySelector('.button')?.focus();
    });
    actions.appendChild(skip);
    actions.appendChild(next);
    dialog.appendChild(actions);
  }

  function open() {
    lastFocus = document.activeElement;
    index = 0;
    render();
    dialog.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => dialog.querySelector('.button')?.focus());
  }

  function close() {
    dialog.hidden = true;
    scrim.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    onClose();
  }

  function onKeydown(e) {
    if (dialog.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // 焦点陷阱
      const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKeydown);
  scrim.addEventListener('click', close);

  return { open, close, isOpen: () => !dialog.hidden };
}

/* ---------------------------------------------------------------- C10 toast */

/**
 * @param {HTMLElement} toast
 */
export function createToast(toast) {
  let timer = 0;
  /**
   * @param {string} message
   * @param {'status'|'alert'} [role]
   */
  function show(message, role = 'status') {
    toast.textContent = message;
    toast.setAttribute('role', role);
    toast.hidden = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }
  return { show };
}

/* ---------------------------------------------------------------- 时间 / 季节 / 镜头选项 */

export const TIME_OPTIONS = TIME_VALUES;
export const SEASON_OPTIONS = SEASON_VALUES;
export const PRESET_OPTIONS = PRESET_VALUES;
