/**
 * KRT-001 · WCAG 对比度计算（纯函数）
 *
 * 规划案 §3.1：「由 `src/ui/contrast.js` 的 `contrastRatio(fg,bg)` 按 sRGB 标准公式算；
 * 对令牌的**真实使用配对**作单测，不合格改令牌而非改测试。」
 */

/**
 * @param {string} hex #rgb / #rrggbb
 * @returns {{r:number,g:number,b:number}}
 */
export function hexToRgb(hex) {
  const s = String(hex).trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`非法 hex: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * WCAG 2.x 相对亮度。
 * @param {{r:number,g:number,b:number}} rgb
 */
export function relativeLuminance(rgb) {
  const channel = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

/**
 * 对比度（1–21）。
 * @param {string} fg
 * @param {string} bg
 * @returns {number}
 */
export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 是否达到最小对比度。
 * @param {string} fg
 * @param {string} bg
 * @param {number} min
 * @returns {boolean}
 */
export function meetsContrast(fg, bg, min) {
  return contrastRatio(fg, bg) >= min - 1e-9;
}

/**
 * 读取 tokens.css 里声明的令牌值（用于单测真实配对）。
 * @param {string} cssText
 * @param {string} name
 * @returns {string|null}
 */
export function readToken(cssText, name) {
  const m = cssText.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,6})`));
  return m ? m[1] : null;
}
