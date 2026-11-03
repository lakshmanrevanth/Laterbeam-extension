// Demo mode (open the app with ?demo): same API as db.js, but in memory with sample data.
// Nothing touches Firebase, so anyone can try the app and screenshots are reproducible.
import { DEFAULT_CATEGORIES, buildItem } from '@shared/core.js';

export const DEMO_CODE = 'DEMO-K7QM-2HXP';
const H = 3600e3;
const ago = (ms) => new Date(Date.now() - ms);

const SAMPLE = [
  ['https://www.youtube.com/watch?v=aircAruvnKk', 'But what is a neural network? | Deep learning, chapter 1', 'watch', 0.4 * H, { note: 'Recommended by Priya. Watch before the ML meetup.', source: 'share' }],
  ['https://github.com/vitejs/vite', 'vitejs/vite: Next generation frontend tooling', 'work', 2 * H, { pinned: true, source: 'extension' }],
  ['https://www.amazon.in/dp/B0CHX1W1XY', 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 'shopping', 5 * H, { note: 'Wait for the Diwali sale price.', source: 'share' }],
  ['https://paulgraham.com/greatwork.html', 'How to Do Great Work', 'read', 26 * H, { source: 'extension' }],
  ['https://docs.google.com/document/d/1x', 'Q4 product roadmap (draft)', 'docs', 30 * H, { pinned: true, note: 'Comments due Friday.' }],
  ['https://web.dev/articles/offline-cookbook', 'The Offline Cookbook', 'read', 3 * 24 * H, { source: 'extension' }],
  ['https://www.figma.com/community/file/1', 'Mobile UI kit: bottom sheets & lists', 'docs', 4 * 24 * H, {}],
  ['https://news.ycombinator.com/item?id=1', 'Show HN: A tiny link saver that syncs everywhere', 'read', 9 * 24 * H, { source: 'share' }],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Conference keynote: the future of the web platform', 'watch', 12 * 24 * H, { status: 'done' }],
  ['https://stackoverflow.com/questions/1', 'How do I share data between a service worker and a page?', 'work', 40 * 24 * H, { status: 'done', source: 'extension' }],
];

let space = { username: 'Alex', categories: DEFAULT_CATEGORIES };
let items = SAMPLE.map(([url, title, category, age, extra], i) => ({
  id: `demo-${i}`,
  ...buildItem({ url, title, category, note: extra.note, source: extra.source || 'web' }),
  status: extra.status || 'unread',
  pinned: Boolean(extra.pinned),
  createdAt: ago(age),
}));

const spaceSubs = new Set();
const itemSubs = new Set();
const emit = () => {
  spaceSubs.forEach((cb) => cb({ ...space }));
  itemSubs.forEach((cb) => cb(items.map((i) => ({ ...i })), { fromCache: false }));
};
const later = (fn) => Promise.resolve().then(fn);
let seq = 100;

export const initFirebase = async () => {};
export const fetchSpace = async () => ({ ...space });
export const createSpace = async (username) => {
  space = { ...space, username };
  return { code: DEMO_CODE, username };
};

export function watchSpace(code, cb) {
  spaceSubs.add(cb);
  later(() => cb({ ...space }));
  return () => spaceSubs.delete(cb);
}

export function watchItems(code, cb) {
  itemSubs.add(cb);
  later(() => cb(items.map((i) => ({ ...i })), { fromCache: false }));
  return () => itemSubs.delete(cb);
}

export const setCategories = async (code, categories) => later(() => { space = { ...space, categories }; emit(); });
export const addItem = async (code, fields) =>
  later(() => { items = [{ id: `demo-${seq++}`, ...buildItem(fields), createdAt: new Date() }, ...items]; emit(); });
export const updateItem = async (code, id, patch) =>
  later(() => { items = items.map((i) => (i.id === id ? { ...i, ...patch } : i)); emit(); });
export const deleteItem = async (code, id) => later(() => { items = items.filter((i) => i.id !== id); emit(); });
export const restoreItem = async (code, item) =>
  later(() => { items = [...items.filter((i) => i.id !== item.id), item]; emit(); });
export const importItems = async (code, list) =>
  later(() => { items = [...list.map((i) => ({ id: `demo-${seq++}`, ...i })), ...items]; emit(); });
export const moveItems = async (code, ids, category) =>
  later(() => { items = items.map((i) => (ids.includes(i.id) ? { ...i, category } : i)); emit(); });
