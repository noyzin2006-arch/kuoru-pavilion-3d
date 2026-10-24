/**
 * KRT-001 · 构件目录单测（规划案 §3.2 C05 / §4 文博解释）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { listParts, getPart, isKnownPart, listSources } from '../src/core/catalog.js';

test('恰好 8 个热点构件，ID 唯一', () => {
  const parts = listParts();
  assert.equal(parts.length, 8);
  const ids = parts.map((p) => p.id);
  assert.equal(new Set(ids).size, 8);
});

test('每条记录字段齐备且锚点是 3 个有限数', () => {
  for (const p of listParts()) {
    assert.equal(typeof p.id, 'string');
    assert.ok(p.id.length > 0);
    assert.equal(typeof p.category, 'string');
    assert.ok(['H', 'I', 'S'].includes(p.confidence), `${p.id} 置信标签非法`);
    assert.ok(p.title.length > 0);
    assert.ok(p.description.length > 20);
    assert.ok(p.source.length > 0);
    assert.equal(p.anchor.length, 3);
    for (const v of p.anchor) assert.ok(Number.isFinite(v));
  }
});

test('每条讲解都声明了「非专业测绘成果」', () => {
  for (const p of listParts()) {
    assert.match(p.description, /非.*测绘|不是文物测绘/, `${p.id} 缺少免责声明`);
  }
});

test('讲解中不得出现未经核对的匾文正文', () => {
  for (const p of listParts()) {
    assert.ok(!/原道|证圣|宗经|史传|神思|通变/.test(p.description), `${p.id} 不得虚构匾文正文`);
  }
});

test('getPart / isKnownPart 行为正确', () => {
  const first = listParts()[0];
  assert.equal(getPart(first.id).title, first.title);
  assert.equal(getPart('__nope__'), undefined);
  assert.equal(isKnownPart(first.id), true);
  assert.equal(isKnownPart('__nope__'), false);
});

test('资料来源分 H / I / S 三级', () => {
  const sources = listSources();
  assert.ok(sources.length >= 3);
  assert.ok(sources.some((s) => s.level === 'H'));
  assert.ok(sources.some((s) => s.level === 'I'));
  assert.ok(sources.some((s) => s.level === 'S'));
});
