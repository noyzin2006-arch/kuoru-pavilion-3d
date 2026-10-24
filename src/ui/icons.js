/**
 * KRT-001 · 图标（单一内联 SVG 集）
 *
 * 规划案 §3.1：viewBox 0 0 24 24，stroke-width 1.75，线帽/折点 round；
 * 尺寸 16 / 20 / 24；**不用 emoji**。
 */

const PATHS = {
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4"/><path d="M12 17.2h.01"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotateLeft: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 5v4h4"/>',
  rotateRight: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 5v4h-4"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M11 8.5v5M8.5 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M8.5 11h5"/>',
  reset: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  leaf: '<path d="M5 19c0-7 5-12 14-12 0 9-5 13-11 13"/><path d="M5 19c2-4 5-6 9-7"/>',
  layers: '<path d="M12 3.5l8 4.2-8 4.3-8-4.3z"/><path d="M4 12.2l8 4.3 8-4.3"/><path d="M4 16.4l8 4.3 8-4.3"/>',
  slice: '<path d="M4 12h16"/><path d="M8 4.5v15M16 4.5v15" stroke-dasharray="2.5 2.5"/>',
  person: '<circle cx="12" cy="6" r="2.4"/><path d="M12 8.4v7M12 15.4l-3 4.6M12 15.4l3 4.6M8.5 11.5h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
};

/**
 * 生成图标 SVG 字符串。
 * @param {keyof typeof PATHS} name
 * @param {number} [size]
 * @param {string} [className]
 */
export function icon(name, size = 20, className = '') {
  const d = PATHS[name];
  if (!d) throw new Error(`未知图标: ${name}`);
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${d}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
