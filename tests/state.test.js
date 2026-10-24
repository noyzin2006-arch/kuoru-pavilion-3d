/**
 * KRT-001 · 状态机单测（规划案 §5.1 / §5.5）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  reduceState,
  actionError,
  serializeSafeState,
} from '../src/core/state.js';
import { isKnownPart } from '../src/core/catalog.js';

test('初始状态：春季 · 正午 · 总览，未选中任何构件', () => {
  const s = createInitialState();
  assert.equal(s.season, 'spring');
  assert.equal(s.time, 'noon');
  assert.equal(s.preset, 'overview');
  assert.equal(s.selectedPartId, null);
  assert.equal(s.explode, 0);
  assert.equal(s.section, 0);
  assert.equal(s.sectionEnabled, false);
  assert.equal(s.explodeEnabled, false);
  assert.equal(s.showHuman, false);
  assert.equal(s.helpOpen, false);
  assert.equal(s.detailOpen, false);
  assert.equal(s.quality, 'high');
  assert.equal(s.phase, 'loading');
  assert.equal(s.failure, null);
});

test('reduceState 是纯函数：同样的输入得到同样的输出且不改原对象', () => {
  const a = createInitialState();
  const b = createInitialState();
  const r1 = reduceState(a, { type: 'SET_SEASON', season: 'autumn' });
  const r2 = reduceState(b, { type: 'SET_SEASON', season: 'autumn' });
  assert.deepEqual(r1, r2);
  assert.equal(a.season, 'spring', '原状态不可被修改');
});

test('分解与剖切夹在 [0,100]', () => {
  let s = createInitialState();
  s = reduceState(s, { type: 'SET_EXPLODE', value: 150 });
  assert.equal(s.explode, 100);
  s = reduceState(s, { type: 'SET_EXPLODE', value: -20 });
  assert.equal(s.explode, 0);
  s = reduceState(s, { type: 'SET_SECTION', value: 999 });
  assert.equal(s.section, 100);
  s = reduceState(s, { type: 'SET_SECTION', value: -5 });
  assert.equal(s.section, 0);
});

test('非法数值返回原状态引用，不制造 NaN', () => {
  const s = createInitialState();
  const r = reduceState(s, { type: 'SET_EXPLODE', value: NaN });
  assert.equal(r, s);
  const r2 = reduceState(s, { type: 'SET_SECTION', value: undefined });
  assert.equal(r2, s);
  assert.ok(Number.isFinite(r2.explode));
});

test('非法枚举值返回原状态引用', () => {
  const s = createInitialState();
  assert.equal(reduceState(s, { type: 'SET_SEASON', season: 'monsoon' }), s);
  assert.equal(reduceState(s, { type: 'SET_TIME', time: 'noonish' }), s);
  assert.equal(reduceState(s, { type: 'SET_PRESET', preset: 'birdview' }), s);
  assert.equal(reduceState(s, { type: 'NOPE' }), s);
  assert.equal(reduceState(s, null), s);
});

test('选中构件会打开详情面板；未知 ID 给出可读提示', () => {
  const s = createInitialState();
  const r = reduceState(s, { type: 'SELECT_PART', id: 'roof-double-eave' });
  assert.equal(r.selectedPartId, 'roof-double-eave');
  assert.equal(r.detailOpen, true);

  const msg = actionError(s, { type: 'SELECT_PART', id: 'not-a-part' }, isKnownPart);
  assert.match(msg, /未找到该构件标记/);
  assert.equal(actionError(s, { type: 'SELECT_PART', id: 'roof-double-eave' }, isKnownPart), null);
});

test('SET_EXPLODE / SET_SECTION 会同时打开对应开关', () => {
  let s = createInitialState();
  s = reduceState(s, { type: 'SET_EXPLODE', value: 40 });
  assert.equal(s.explodeEnabled, true);
  s = reduceState(s, { type: 'SET_SECTION', value: 60 });
  assert.equal(s.sectionEnabled, true);
  s = reduceState(s, { type: 'TOGGLE_SECTION', enabled: false });
  assert.equal(s.sectionEnabled, false);
  assert.equal(s.section, 0);
});

test('TOGGLE_HUMAN 切换比例人形', () => {
  const s = createInitialState();
  const r = reduceState(s, { type: 'TOGGLE_HUMAN' });
  assert.equal(r.showHuman, true);
});

test('RESET 回到初始，但保留 phase 与 quality', () => {
  let s = reduceState(createInitialState(), { type: 'READY' });
  s = reduceState(s, { type: 'SET_SEASON', season: 'winter' });
  s = reduceState(s, { type: 'SET_EXPLODE', value: 80 });
  s = reduceState(s, { type: 'SET_QUALITY', quality: 'low' });
  const r = reduceState(s, { type: 'RESET' });
  assert.equal(r.season, 'spring');
  assert.equal(r.explode, 0);
  assert.equal(r.phase, 'ready');
  assert.equal(r.quality, 'low');
});

test('LOAD_FAIL 进入 error 阶段并保留可读信息', () => {
  const s = reduceState(createInitialState(), { type: 'LOAD_FAIL', message: '无法开启三维' });
  assert.equal(s.phase, 'error');
  assert.equal(s.failure, '无法开启三维');
  const s2 = reduceState(createInitialState(), { type: 'LOAD_FAIL' });
  assert.match(s2.failure, /未能启动/);
});

test('serializeSafeState：非有限数归零，不写入未知类型字段', () => {
  const s = { ...createInitialState(), explode: NaN, section: Infinity, extra: () => {}, obj: { a: 1 } };
  const out = serializeSafeState(s);
  assert.equal(out.explode, 0);
  assert.equal(out.section, 0);
  assert.ok(!('extra' in out));
  assert.ok(!('obj' in out));
  assert.doesNotThrow(() => JSON.stringify(out));
});

test('CLOSE_OVERLAY 同时关闭详情与引导', () => {
  let s = reduceState(createInitialState(), { type: 'SELECT_PART', id: 'ceiling-caojing' });
  s = reduceState(s, { type: 'TOGGLE_HELP', open: true });
  s = reduceState(s, { type: 'CLOSE_OVERLAY' });
  assert.equal(s.detailOpen, false);
  assert.equal(s.helpOpen, false);
});
