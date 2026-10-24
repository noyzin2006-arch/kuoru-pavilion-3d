/**
 * KRT-001 · 展厅状态机（纯函数）
 *
 * 规划案 §5.1 / §5.5：
 *  - 状态只有一个真源（ExhibitState），UI 不直接改 3D 构件位置。
 *  - reducer 纯函数，非法输入返回**原状态**并给出可读错误提示，不制造 NaN。
 *  - 分解与剖切夹在 [0,100]。
 *  - 未知热点 ID 回到无选择并给说明。
 *  - 不把未知字段写进 state。
 */

/** @typedef {'spring'|'summer'|'autumn'|'winter'} Season */
/** @typedef {'dawn'|'noon'|'dusk'|'night'} TimeOfDay */
/** @typedef {'overview'|'south'|'east'|'carpentry'|'ceiling'|'platform'} CameraPreset */

/**
 * @typedef {object} ExhibitState
 * @property {Season} season
 * @property {TimeOfDay} time
 * @property {CameraPreset} preset
 * @property {string|null} selectedPartId
 * @property {number} explode 0–100
 * @property {number} section 0–100
 * @property {boolean} sectionEnabled
 * @property {boolean} explodeEnabled
 * @property {boolean} showHuman
 * @property {boolean} helpOpen
 * @property {boolean} detailOpen
 * @property {'high'|'low'} quality
 * @property {'loading'|'ready'|'error'} phase
 * @property {string|null} failure
 */

/** @type {Readonly<Record<string, string>>} */
export const SEASON_VALUES = Object.freeze({
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
});

/** @type {Readonly<Record<string, string>>} */
export const TIME_VALUES = Object.freeze({
  dawn: '晨',
  noon: '午',
  dusk: '黄昏',
  night: '夜',
});

/** @type {Readonly<Record<string, string>>} */
export const PRESET_VALUES = Object.freeze({
  overview: '总览',
  south: '正南',
  east: '正东',
  carpentry: '梁架',
  ceiling: '藻井',
  platform: '台阶',
});

const VALID_SEASONS = new Set(Object.keys(SEASON_VALUES));
const VALID_TIMES = new Set(Object.keys(TIME_VALUES));
const VALID_PRESETS = new Set(Object.keys(PRESET_VALUES));

/**
 * @returns {ExhibitState} 初始状态
 */
export function createInitialState() {
  return {
    season: 'spring',
    time: 'noon',
    preset: 'overview',
    selectedPartId: null,
    explode: 0,
    section: 0,
    sectionEnabled: false,
    explodeEnabled: false,
    showHuman: false,
    helpOpen: false,
    detailOpen: false,
    quality: 'high',
    phase: 'loading',
    failure: null,
  };
}

/**
 * 数值夹取；非有限数返回 null（表示非法）。
 * @param {unknown} v
 * @param {number} lo
 * @param {number} hi
 */
function clampNumber(v, lo, hi) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 纯 reducer。
 *
 * @param {ExhibitState} state
 * @param {{type: string, [k: string]: unknown}} action
 * @returns {ExhibitState} 新的状态对象；输入非法时返回**原对象引用**
 */
export function reduceState(state, action) {
  if (!action || typeof action.type !== 'string') return state;

  switch (action.type) {
    case 'SELECT_PART': {
      const id = action.id;
      if (typeof id !== 'string' || id.length === 0) return state;
      // 未知 ID 由调用方通过 actionError 给出说明；这里保持「无选择」
      return { ...state, selectedPartId: id, detailOpen: true };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedPartId: null, detailOpen: false };

    case 'SET_SEASON': {
      if (!VALID_SEASONS.has(action.season)) return state;
      return { ...state, season: action.season };
    }

    case 'SET_TIME': {
      if (!VALID_TIMES.has(action.time)) return state;
      return { ...state, time: action.time };
    }

    case 'SET_PRESET': {
      if (!VALID_PRESETS.has(action.preset)) return state;
      return { ...state, preset: action.preset };
    }

    case 'SET_EXPLODE': {
      const v = clampNumber(action.value, 0, 100);
      if (v === null) return state;
      return { ...state, explode: v, explodeEnabled: v > 0 };
    }

    case 'TOGGLE_EXPLODE': {
      const on = typeof action.enabled === 'boolean' ? action.enabled : !state.explodeEnabled;
      return { ...state, explodeEnabled: on, explode: on ? Math.max(state.explode, 1) : 0 };
    }

    case 'SET_SECTION': {
      const v = clampNumber(action.value, 0, 100);
      if (v === null) return state;
      return { ...state, section: v, sectionEnabled: true };
    }

    case 'TOGGLE_SECTION': {
      const on = typeof action.enabled === 'boolean' ? action.enabled : !state.sectionEnabled;
      return { ...state, sectionEnabled: on, section: on ? Math.max(state.section, 1) : 0 };
    }

    case 'TOGGLE_HUMAN': {
      const on = typeof action.enabled === 'boolean' ? action.enabled : !state.showHuman;
      return { ...state, showHuman: on };
    }

    case 'SET_QUALITY': {
      if (action.quality !== 'high' && action.quality !== 'low') return state;
      return { ...state, quality: action.quality };
    }

    case 'TOGGLE_HELP': {
      const on = typeof action.open === 'boolean' ? action.open : !state.helpOpen;
      return { ...state, helpOpen: on };
    }

    case 'CLOSE_OVERLAY': {
      let next = state;
      if (state.helpOpen) next = { ...next, helpOpen: false };
      if (state.detailOpen) next = { ...next, detailOpen: false };
      return next;
    }

    case 'RESET':
      return { ...createInitialState(), phase: state.phase, quality: state.quality };

    case 'READY':
      return { ...state, phase: 'ready', failure: null };

    case 'LOAD_FAIL': {
      const message =
        typeof action.message === 'string' && action.message.trim()
          ? action.message
          : '展厅未能启动，请刷新页面';
      return { ...state, phase: 'error', failure: message };
    }

    default:
      return state;
  }
}

/**
 * 动作的可读错误说明（纯函数）。返回 null 表示动作合法。
 * @param {ExhibitState} state
 * @param {{type: string, [k: string]: unknown}} action
 * @param {(id: string) => boolean} [isKnownPart]
 * @returns {string|null}
 */
export function actionError(state, action, isKnownPart = null) {
  if (!action || typeof action.type !== 'string') return '无法识别的操作';
  switch (action.type) {
    case 'SELECT_PART': {
      if (typeof action.id !== 'string' || !action.id) return '构件标识无效';
      if (isKnownPart && !isKnownPart(action.id)) {
        return '未找到该构件标记，请从构件目录中重新选择';
      }
      return null;
    }
    case 'SET_SEASON':
      return VALID_SEASONS.has(action.season) ? null : '季节取值无效';
    case 'SET_TIME':
      return VALID_TIMES.has(action.time) ? null : '时刻取值无效';
    case 'SET_PRESET':
      return VALID_PRESETS.has(action.preset) ? null : '镜头预设无效';
    case 'SET_EXPLODE':
      return clampNumber(action.value, 0, 100) === null ? '分解比例无效' : null;
    case 'SET_SECTION':
      return clampNumber(action.value, 0, 100) === null ? '剖切位置无效' : null;
    default:
      return null;
  }
}

/**
 * 序列化为可安全持久化的普通对象（不含 NaN / Infinity / 函数）。
 * @param {ExhibitState} state
 * @returns {Record<string, unknown>}
 */
export function serializeSafeState(state) {
  const out = {};
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'number') {
      out[key] = Number.isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean' || value === null || typeof value === 'string') {
      out[key] = value;
    }
    // 其余类型（对象/函数/undefined）一律不落盘
  }
  return out;
}
