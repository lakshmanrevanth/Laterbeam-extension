import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCode, normalizeCode, isValidCode, suggestCategory, extractUrl,
  cleanUrl, buildItem, timeAgo, DEFAULT_CATEGORIES,
} from '../shared/core.js';
import { toFields, fromFields } from '../extension/lib/api.js';

test('generated codes are valid and unique', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = generateCode();
    assert.ok(isValidCode(c), c);
    seen.add(c);
  }
  assert.equal(seen.size, 2000);
});

test('normalizeCode accepts messy input and rejects bad codes', () => {
  assert.equal(normalizeCode('abcd efgh jkmn'), 'ABCD-EFGH-JKMN');
  assert.equal(normalizeCode('ABCD-EFGH-JKMN'), 'ABCD-EFGH-JKMN');
  assert.equal(normalizeCode('ABCD-EFGH-JKM'), null); // too short
  assert.equal(normalizeCode('ABCD-EFGH-JKM0'), null); // 0 is not in the alphabet
  assert.equal(normalizeCode(''), null);
});

test('suggestCategory uses domain rules and falls back safely', () => {
  assert.equal(suggestCategory('https://www.youtube.com/watch?v=1'), 'watch');
  assert.equal(suggestCategory('https://www.amazon.in/dp/x'), 'shopping');
  assert.equal(suggestCategory('https://docs.google.com/document/d/1'), 'docs');
  assert.equal(suggestCategory('https://example.com/file.pdf'), 'docs');
  assert.equal(suggestCategory('https://github.com/a/b'), 'work');
  assert.equal(suggestCategory('https://someblog.example'), 'read');
  // Category list without the guessed id → first category
  assert.equal(suggestCategory('https://youtube.com', [{ id: 'x', name: 'X', emoji: '' }]), 'x');
});

test('extractUrl pulls a link out of shared text', () => {
  assert.equal(extractUrl('Look at this https://youtu.be/abc123, so good!'), 'https://youtu.be/abc123');
  assert.equal(extractUrl('no link here'), null);
});

test('cleanUrl strips tracking params only', () => {
  assert.equal(cleanUrl('https://a.com/p?utm_source=x&id=7&fbclid=1'), 'https://a.com/p?id=7');
});

test('buildItem fills defaults', () => {
  const it = buildItem({ url: 'https://www.github.com/x?utm_medium=y', category: 'work' });
  assert.equal(it.url, 'https://www.github.com/x');
  assert.equal(it.title, 'github.com');
  assert.equal(it.status, 'unread');
  assert.equal(it.remindAt, null);
});

test('timeAgo', () => {
  assert.equal(timeAgo(new Date()), 'just now');
  assert.equal(timeAgo(new Date(Date.now() - 5 * 60e3)), '5m ago');
  assert.equal(timeAgo(new Date(Date.now() - 3 * 3600e3)), '3h ago');
  assert.equal(timeAgo(new Date(Date.now() - 2 * 86400e3)), '2d ago');
});

test('Firestore REST encoding round-trips', () => {
  const d = new Date('2026-01-02T03:04:05.000Z');
  const obj = { s: 'x', n: 3, f: 1.5, b: true, z: null, d, arr: DEFAULT_CATEGORIES.slice(0, 2), m: { a: 'b' } };
  const back = fromFields(toFields(obj));
  assert.deepEqual(back, obj);
});

test('sanitizeImported keeps valid items and rejects junk', async () => {
  const { sanitizeImported } = await import('../shared/core.js');
  assert.equal(sanitizeImported({ url: 'javascript:alert(1)' }), null);
  assert.equal(sanitizeImported(null), null);
  const it = sanitizeImported({
    url: 'https://youtube.com/watch?v=1&utm_source=x', title: 'T', category: 'nope',
    status: 'done', pinned: true, createdAt: '2026-01-01T00:00:00Z', evil: 'x',
  });
  assert.equal(it.url, 'https://youtube.com/watch?v=1');
  assert.equal(it.category, 'watch'); // unknown category → smart guess
  assert.equal(it.status, 'done');
  assert.equal(it.pinned, true);
  assert.equal(it.source, 'import');
  assert.equal(it.createdAt.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal('evil' in it, false);
});

test('dateGroup buckets by calendar day', async () => {
  const { dateGroup } = await import('../shared/core.js');
  const now = new Date(2026, 10, 3, 9, 0);
  assert.equal(dateGroup(new Date(2026, 10, 3, 1, 0), now), 'Today');
  assert.equal(dateGroup(new Date(2026, 10, 2, 23, 0), now), 'Yesterday');
  assert.equal(dateGroup(new Date(2026, 9, 31), now), 'This week');
  assert.equal(dateGroup(new Date(2026, 9, 20), now), 'This month');
  assert.equal(dateGroup(new Date(2025, 0, 1), now), 'Earlier');
});
