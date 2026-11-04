import QRCode from 'qrcode';
import { isConfigured } from '@shared/config.js';
import {
  DEFAULT_CATEGORIES, normalizeCode, suggestCategory, extractUrl, isSavableUrl,
  cleanUrl, getDomain, faviconFor, timeAgo, slugify, dateGroup, sanitizeImported,
} from '@shared/core.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['viewSetup', 'viewLoading', 'viewWelcome', 'viewApp'];
const show = (id) => VIEWS.forEach((v) => ($(v).hidden = v !== id));

// Storage keys keep the old "checklater" prefix so existing users stay signed in after the rename.
const SESSION_KEY = 'checklater.session';
const PENDING_SHARE_KEY = 'checklater.pendingShare';
const THEME_KEY = 'checklater.theme';

// Demo mode: /?demo runs on in-memory sample data. /?demo=add|item|account|done|search|welcome
// opens a specific screen (used by `npm run screenshots`).
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const DEMO_SCREEN = params.get('demo') || '';

/** @type {typeof import('./db.js')} */
let db;

const state = {
  session: null, // { code, username }
  categories: DEFAULT_CATEGORIES,
  items: [],
  filter: 'all',
  view: 'unread',
  q: '',
  unsubs: [],
};

// ---------- Helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const safeHref = (url) => (isSavableUrl(url) ? url : '#');
const UNCATEGORIZED = { id: '__none', name: 'Uncategorized', emoji: '❔' };
const catOf = (item) => state.categories.find((c) => c.id === item.category) || UNCATEGORIZED;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

let memorySession = null; // demo mode never touches the real saved session
function loadSession() {
  if (DEMO) return memorySession;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}
function saveSession(s) {
  if (DEMO) memorySession = s;
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

let toastTimer;
function toast(msg, { action, error = false } = {}) {
  const el = $('toast');
  $('toastMsg').textContent = msg;
  $('toastIcon').innerHTML = `<use href="#i-${error ? 'x' : action?.icon || 'check'}"/>`;
  el.classList.toggle('err', error);
  const btn = $('toastAction');
  btn.hidden = !action;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => {
      el.hidden = true;
      action.run();
    };
  }
  el.hidden = true; // restart the entrance animation
  void el.offsetWidth;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 5000 : 2600);
}

function friendly(e) {
  const m = String(e?.code || e?.message || e);
  if (/permission/i.test(m)) return 'Permission denied. Check that firestore.rules are deployed.';
  if (/unavailable|offline|network/i.test(m)) return 'You seem to be offline. Try again when connected.';
  if (/admin-restricted|operation-not-allowed/i.test(m)) return 'Enable Anonymous sign-in in Firebase Authentication.';
  return e?.message || m;
}
const fail = (e) => toast(friendly(e), { error: true });

// ---------- Theme ----------
function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}
function setTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  renderThemeSeg();
}
function renderThemeSeg() {
  const current = document.documentElement.dataset.theme || 'system';
  document.querySelectorAll('[data-theme-opt]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOpt === current)));
}

// ---------- Share target & deep links ----------
// Android "Share → Laterbeam" opens /share?title=&text=&url= (see manifest.webmanifest).
function captureIncoming() {
  const url = new URL(location.href);
  let pendingCode = null;
  if (url.pathname === '/share') {
    const shared = {
      title: url.searchParams.get('title') || '',
      text: url.searchParams.get('text') || '',
      url: url.searchParams.get('url') || '',
    };
    sessionStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(shared));
  }
  if (url.searchParams.get('code')) pendingCode = normalizeCode(url.searchParams.get('code'));
  if (url.pathname !== '/' || url.search) history.replaceState(null, '', '/');
  return pendingCode;
}

function takePendingShare() {
  const raw = sessionStorage.getItem(PENDING_SHARE_KEY);
  sessionStorage.removeItem(PENDING_SHARE_KEY);
  if (!raw) return null;
  const s = JSON.parse(raw);
  const link = (isSavableUrl(s.url) && s.url) || extractUrl(s.text) || extractUrl(s.title) || '';
  // Apps often send "Some caption https://link". The caption (minus the link) becomes the note.
  const rest = s.text.replace(link, '').trim();
  return {
    url: link,
    title: s.title && s.title !== link ? s.title : '',
    note: rest && rest !== s.title ? rest : '',
  };
}

// ---------- Welcome ----------
function selectAuthTab(tab) {
  document.querySelectorAll('#authTabs .seg').forEach((x) => {
    x.classList.toggle('active', x.dataset.tab === tab);
    x.setAttribute('aria-selected', String(x.dataset.tab === tab));
  });
  $('formSignin').hidden = tab !== 'signin';
  $('formSignup').hidden = tab !== 'signup';
  setAuthError('');
}

function initWelcome() {
  document.querySelectorAll('#authTabs .seg').forEach((t) => t.addEventListener('click', () => selectAuthTab(t.dataset.tab)));

  $('codeInput').addEventListener('input', (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    e.target.value = raw.match(/.{1,4}/g)?.join('-') || '';
  });

  $('formSignin').addEventListener('submit', (e) => {
    e.preventDefault();
    signIn($('codeInput').value, e.submitter);
  });

  $('formSignup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      const { code, username } = await db.createSpace($('nameInput').value);
      saveSession({ code, username });
      $('formSignup').hidden = true;
      $('authTabs').hidden = true;
      $('newCodeValue').textContent = code;
      $('newCode').hidden = false;
      setAuthError('');
    } catch (err) {
      setAuthError(friendly(err));
    } finally {
      btn.disabled = false;
    }
  });

  $('newCodeCopy').addEventListener('click', () => copy($('newCodeValue').textContent, 'Code copied'));
  $('newCodeDone').addEventListener('click', enterApp);
}

function setAuthError(msg) {
  $('authError').textContent = msg;
  $('authError').hidden = !msg;
}

async function signIn(input, btn) {
  const code = DEMO ? input : normalizeCode(input);
  if (!code) return setAuthError('That code doesn’t look right. It has 12 letters and numbers, like ABCD-EFGH-JKMN.');
  if (btn) btn.disabled = true;
  try {
    const space = await db.fetchSpace(code);
    if (!space) return setAuthError('No space found for that code. Check for typos.');
    saveSession({ code, username: space.username });
    await enterApp();
  } catch (err) {
    setAuthError(friendly(err));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- App ----------
async function enterApp() {
  state.session = loadSession();
  if (!state.session) return show('viewWelcome');
  show('viewApp');
  $('demoBanner').hidden = !DEMO;
  $('accountBtn').textContent = (state.session.username || '?').charAt(0).toUpperCase();

  state.unsubs.forEach((u) => u());
  state.unsubs = [
    db.watchSpace(state.session.code, (space) => {
      if (!space) return; // offline first load: keep defaults
      state.categories = space.categories?.length ? space.categories : DEFAULT_CATEGORIES;
      if (space.username && space.username !== state.session.username) {
        state.session.username = space.username;
        saveSession(state.session);
      }
      render();
    }, fail),
    db.watchItems(state.session.code, (items, meta) => {
      state.items = items;
      renderSync(meta);
      render();
    }, fail),
  ];

  const share = takePendingShare();
  if (share) openAdd(share, null, 'share');
}

function renderSync(meta = {}) {
  const el = $('sync');
  const pending = state.items.some((i) => i.pendingSync);
  const offline = !navigator.onLine || meta.fromCache;
  el.className = `sync${offline ? ' offline' : pending ? ' pending' : ''}`;
  const label = DEMO ? 'Demo' : offline ? 'Offline' : pending ? 'Syncing' : 'Synced';
  $('syncLabel').textContent = label;
  el.title = offline ? 'Offline. Changes will sync when you reconnect.' : pending ? 'Syncing…' : 'All changes synced';
}

const inView = (i) => (state.view === 'done' ? i.status === 'done' : i.status !== 'done');

function visibleItems() {
  const q = state.q.trim().toLowerCase();
  return state.items
    .filter(inView)
    .filter((i) => state.filter === 'all' || catOf(i).id === state.filter)
    .filter((i) => !q || `${i.title} ${i.url} ${i.note} ${catOf(i).name}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

function renderFilters() {
  const items = state.items.filter(inView);
  const count = (id) => items.filter((i) => catOf(i).id === id).length;
  const cats = [...state.categories];
  if (items.some((i) => catOf(i) === UNCATEGORIZED)) cats.push(UNCATEGORIZED);
  if (state.filter !== 'all' && !cats.some((c) => c.id === state.filter)) state.filter = 'all';

  $('filters').innerHTML = [
    `<button class="chip" data-filter="all" aria-pressed="${state.filter === 'all'}">${ic('layers')}<span class="name">All</span><span class="count">${items.length}</span></button>`,
    ...cats.map(
      (c) =>
        `<button class="chip" data-filter="${esc(c.id)}" aria-pressed="${state.filter === c.id}"><span class="emoji">${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span><span class="count">${count(c.id)}</span></button>`,
    ),
  ].join('');

  $('countUnread').textContent = state.items.filter((i) => i.status !== 'done').length;
  $('countDone').textContent = state.items.filter((i) => i.status === 'done').length;
  document.querySelectorAll('.view-tab').forEach((x) => x.classList.toggle('active', x.dataset.view === state.view));
}

function itemHtml(i) {
  const cat = catOf(i);
  const done = i.status === 'done';
  return `<li class="item${done ? ' done' : ''}${i.pinned ? ' pinned' : ''}" data-id="${esc(i.id)}">
    <button class="check" data-act="toggle" aria-label="${done ? 'Mark as not done' : 'Mark as done'}" title="${done ? 'Mark as not done' : 'Mark as done'}"><span>${ic('check')}</span></button>
    <a class="body" href="${esc(safeHref(i.url))}" target="_blank" rel="noopener noreferrer">
      <span class="title">${esc(i.title || i.url)}</span>
      ${i.note ? `<span class="note">${esc(i.note)}</span>` : ''}
      <span class="meta">
        ${i.favicon ? `<img src="${esc(i.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ''}
        <span class="domain">${esc(i.domain || getDomain(i.url))}</span>
        <span aria-hidden="true">·</span>
        <span class="when">${esc(timeAgo(i.createdAt))}</span>
        ${state.filter === 'all' ? `<span class="tag">${esc(cat.emoji)} ${esc(cat.name)}</span>` : ''}
      </span>
    </a>
    <div class="tools">
      <button class="tool hover-only pin-tool${i.pinned ? ' on' : ''}" data-act="pin" aria-label="${i.pinned ? 'Unpin' : 'Pin to top'}" title="${i.pinned ? 'Unpin' : 'Pin to top'}">${ic('pin')}</button>
      <button class="tool hover-only" data-act="copy" aria-label="Copy link" title="Copy link">${ic('copy')}</button>
      <button class="tool" data-act="more" aria-label="More actions" title="More">${ic('more')}</button>
    </div>
  </li>`;
}

function renderList() {
  const items = visibleItems();
  const searching = Boolean(state.q.trim());

  // Group: Pinned first, then by day (only when not searching).
  const groups = [];
  const push = (label, icon, item) => {
    let g = groups.at(-1);
    if (!g || g.label !== label) groups.push((g = { label, icon, items: [] }));
    g.items.push(item);
  };
  for (const i of items) {
    if (searching) push(`${plural(items.length, 'result')}`, 'search', i);
    else if (i.pinned) push('Pinned', 'pin', i);
    else push(dateGroup(i.createdAt), '', i);
  }

  $('list').innerHTML = groups
    .map((g) => `<section class="group"><h3 class="group-label">${g.icon ? ic(g.icon) : ''}${esc(g.label)}</h3><ul class="list">${g.items.map(itemHtml).join('')}</ul></section>`)
    .join('');

  const cat = state.filter === 'all' ? null : state.categories.find((c) => c.id === state.filter) || UNCATEGORIZED;
  $('listHeading').textContent = cat ? `${cat.emoji} ${cat.name}` : state.view === 'done' ? 'Done' : 'To check';
  const today = items.filter((i) => dateGroup(i.createdAt) === 'Today').length;
  $('listSub').textContent = `${plural(items.length, 'link')}${state.view !== 'done' && today ? ` · ${today} saved today` : ''}`;

  const empty = $('empty');
  empty.hidden = items.length > 0;
  if (!items.length) {
    const art = (name) => `<div class="empty-art">${ic(name)}</div>`;
    empty.innerHTML = searching
      ? `${art('search')}<strong>No matches</strong><p>Nothing matches “${esc(state.q)}”. Try a site name or a word from your note.</p>`
      : state.view === 'done'
        ? `${art('done')}<strong>Nothing done yet</strong><p>Tick the circle next to a link once you've checked it. It moves here.</p>`
        : state.filter !== 'all'
          ? `${art('inbox')}<strong>All clear in this category</strong><p>Links you save to it will show up here.</p>`
          : `${art('inbox')}<strong>Nothing to check yet</strong>
             <p>Save a link here, share one from any app on your phone, or use the Chrome extension.</p>
             <button class="btn primary" data-act="add">${ic('plus')}Save your first link</button>`;
  }
}

function render() {
  renderFilters();
  renderList();
  if ($('accountDialog').open) renderAccount();
}

// ---------- Item actions ----------
const findItem = (id) => state.items.find((i) => i.id === id);

// Writes are not awaited: Firestore applies them locally at once (works offline)
// and syncs in the background. We only surface failures.
function toggleDone(item) {
  const status = item.status === 'done' ? 'unread' : 'done';
  db.updateItem(state.session.code, item.id, { status }).catch(fail);
  if (status === 'done') {
    toast('Marked as done', { action: { label: 'Undo', run: () => db.updateItem(state.session.code, item.id, { status: 'unread' }).catch(fail) } });
  } else {
    toast('Moved back to To check');
  }
}

function togglePin(item) {
  db.updateItem(state.session.code, item.id, { pinned: !item.pinned }).catch(fail);
  toast(item.pinned ? 'Unpinned' : 'Pinned to top');
}

function removeItem(item) {
  db.deleteItem(state.session.code, item.id).catch(fail);
  toast('Link deleted', { action: { label: 'Undo', run: () => db.restoreItem(state.session.code, item).catch(fail) } });
}

function sheetButton(className, html, run, dialog) {
  const b = document.createElement('button');
  b.className = className;
  b.innerHTML = html;
  b.addEventListener('click', () => {
    dialog.close();
    Promise.resolve(run()).catch(fail);
  });
  return b;
}

function openItem(item) {
  const d = $('itemDialog');
  $('itemTitle').textContent = item.title || item.url;
  $('itemFav').src = item.favicon || faviconFor(item.url);
  const source = { extension: 'Chrome', share: 'phone share', import: 'import', web: 'web' }[item.source] || 'web';
  $('itemMeta').textContent = `${item.domain || getDomain(item.url)} · saved ${timeAgo(item.createdAt)} from ${source}`;
  $('itemNote').hidden = !item.note;
  $('itemNote').textContent = item.note || '';

  const done = item.status === 'done';
  const quick = [
    ['open', 'Open', () => window.open(safeHref(item.url), '_blank', 'noopener')],
    navigator.share
      ? ['share', 'Share', () => navigator.share({ title: item.title, url: item.url }).catch(() => {})]
      : ['copy', 'Copy', () => copy(item.url)],
    ['pin', item.pinned ? 'Unpin' : 'Pin', () => togglePin(item), item.pinned],
    [done ? 'undo' : 'done', done ? 'Not done' : 'Done', () => toggleDone(item)],
  ];
  $('itemQuick').replaceChildren(
    ...quick.map(([icon, label, run, on]) => sheetButton(`quick-btn${on ? ' on' : ''}`, `${ic(icon)}<span>${label}</span>`, run, d)),
  );

  const rows = [
    ['edit', 'Edit title, link or note', () => openAdd(item, item.id)],
    navigator.share && ['copy', 'Copy link', () => copy(item.url)],
    ['trash', 'Delete', () => removeItem(item), 'danger'],
  ].filter(Boolean);
  $('itemMenu').replaceChildren(
    ...rows.map(([icon, label, run, cls]) => sheetButton(`menu-row ${cls || ''}`, `${ic(icon)}<span>${esc(label)}</span>`, run, d)),
  );

  $('itemCats').replaceChildren(
    ...state.categories.map((c) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.setAttribute('aria-checked', String(c.id === item.category));
      b.textContent = `${c.emoji} ${c.name}`;
      b.addEventListener('click', () => {
        d.close();
        if (c.id === item.category) return;
        db.updateItem(state.session.code, item.id, { category: c.id }).catch(fail);
        toast(`Moved to ${c.name}`);
      });
      return b;
    }),
  );
  d.showModal();
}

// ---------- Add / edit sheet ----------
let addState = { editId: null, category: null, categoryTouched: false, source: 'web' };

function renderAddCats() {
  $('addCats').replaceChildren(
    ...state.categories.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(c.id === addState.category));
      b.textContent = `${c.emoji} ${c.name}`;
      b.addEventListener('click', () => {
        addState.category = c.id;
        addState.categoryTouched = true;
        renderAddCats();
      });
      return b;
    }),
  );
}

function onAddUrlChange() {
  const url = $('addUrl').value.trim();
  if (!addState.categoryTouched && !addState.editId) {
    addState.category = suggestCategory(url, state.categories);
    renderAddCats();
  }
  const clean = isSavableUrl(url) ? cleanUrl(url) : null;
  const dup = clean && state.items.find((i) => i.url === clean && i.id !== addState.editId);
  $('addDup').hidden = !dup;
  if (dup) $('addDup').textContent = `You already saved this ${timeAgo(dup.createdAt)}${dup.status === 'done' ? ' and marked it done' : ''}. Saving again adds a second copy.`;
}

function openAdd(prefill = {}, editId = null, source = 'web') {
  addState = {
    editId,
    source,
    category: prefill.category || suggestCategory(prefill.url || '', state.categories),
    categoryTouched: Boolean(editId),
  };
  $('addTitle').textContent = editId ? 'Edit link' : 'Save a link';
  $('addSubmit').textContent = editId ? 'Save changes' : 'Save link';
  $('addUrl').value = prefill.url || '';
  $('addTitleInput').value = prefill.title || '';
  $('addNote').value = prefill.note || '';
  $('addError').hidden = true;
  $('pasteBtn').hidden = !navigator.clipboard?.readText;
  renderAddCats();
  onAddUrlChange();
  $('addDialog').showModal();
  if (!prefill.url) $('addUrl').focus();
}

function submitAdd(e) {
  e.preventDefault();
  let url = $('addUrl').value.trim();
  if (url && !/^https?:\/\//i.test(url) && /^[\w-]+(\.[\w-]+)+/.test(url)) url = `https://${url}`;
  if (!isSavableUrl(url)) {
    $('addError').textContent = 'Please enter a valid link, starting with http:// or https://.';
    $('addError').hidden = false;
    return;
  }
  const fields = {
    url,
    title: $('addTitleInput').value.trim(),
    note: $('addNote').value.trim(),
    category: addState.category,
    source: addState.source,
  };
  $('addDialog').close();
  if (addState.editId) {
    const clean = cleanUrl(url);
    db.updateItem(state.session.code, addState.editId, {
      url: clean,
      title: fields.title || getDomain(clean),
      note: fields.note,
      category: fields.category,
      domain: getDomain(clean),
      favicon: faviconFor(clean),
    }).catch(fail);
    toast('Changes saved');
  } else {
    db.addItem(state.session.code, fields).catch(fail);
    const cat = state.categories.find((c) => c.id === fields.category);
    toast(`Saved to ${cat ? cat.name : 'Laterbeam'}${navigator.onLine ? '' : '. It will sync when you’re online'}`);
  }
}

// ---------- Account sheet ----------
async function renderAccount() {
  const { code, username } = state.session;
  $('accName').textContent = `Hi, ${username}`;
  $('accAvatar').textContent = (username || '?').charAt(0).toUpperCase();
  $('accCode').textContent = code;
  $('accQr').src = await QRCode.toDataURL(`${location.origin}/?code=${code}`, { margin: 1, width: 240 });
  renderThemeSeg();

  $('catList').replaceChildren(
    ...state.categories.map((c) => {
      const li = document.createElement('li');
      const n = state.items.filter((i) => i.category === c.id).length;
      li.innerHTML = `<span class="emoji">${esc(c.emoji)}</span><span class="grow">${esc(c.name)}</span><span class="muted small">${n}</span>`;
      const del = document.createElement('button');
      del.className = 'icon-btn';
      del.innerHTML = ic('trash');
      del.setAttribute('aria-label', `Delete ${c.name}`);
      del.title = `Delete ${c.name}`;
      del.disabled = state.categories.length <= 1;
      del.addEventListener('click', () => deleteCategory(c));
      li.append(del);
      return li;
    }),
  );
  $('installBtn').hidden = !installPrompt;
}

async function addCategory(e) {
  e.preventDefault();
  const name = $('catName').value.trim().slice(0, 30);
  if (!name) return;
  if (state.categories.length >= 50) return toast('You can have up to 50 categories.', { error: true });
  let id = slugify(name);
  while (state.categories.some((c) => c.id === id)) id = `${id}-${Math.floor(Math.random() * 1000)}`;
  const emoji = $('catEmoji').value.trim() || '🏷️';
  try {
    await db.setCategories(state.session.code, [...state.categories, { id, name, emoji }]);
    $('catName').value = '';
    $('catEmoji').value = '';
    toast(`Added ${name}`);
  } catch (err) {
    fail(err);
  }
}

async function deleteCategory(cat) {
  const rest = state.categories.filter((c) => c.id !== cat.id);
  const target = rest.find((c) => c.id === 'other') || rest[0];
  const affected = state.items.filter((i) => i.category === cat.id).map((i) => i.id);
  const msg = affected.length
    ? `Delete “${cat.name}”? Its ${plural(affected.length, 'link')} will move to ${target.name}.`
    : `Delete “${cat.name}”?`;
  if (!confirm(msg)) return;
  try {
    if (affected.length) await db.moveItems(state.session.code, affected, target.id);
    await db.setCategories(state.session.code, rest);
  } catch (err) {
    fail(err);
  }
}

function exportJson() {
  const data = {
    app: 'laterbeam',
    version: 1,
    exportedAt: new Date().toISOString(),
    username: state.session.username,
    categories: state.categories,
    items: state.items.map(({ pendingSync, ...i }) => i),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `laterbeam-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${plural(state.items.length, 'link')}`);
}

async function importJson(file) {
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('That file is too big (over 10 MB).');
    const data = JSON.parse(await file.text());
    const raw = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(raw)) throw new Error('That doesn’t look like a Laterbeam export.');
    const have = new Set(state.items.map((i) => i.url));
    const fresh = [];
    for (const r of raw.slice(0, 5000)) {
      const item = sanitizeImported(r, state.categories);
      if (item && !have.has(item.url)) {
        have.add(item.url);
        fresh.push(item);
      }
    }
    const skipped = raw.length - fresh.length;
    if (!fresh.length) return toast(`Nothing new to import${skipped ? ` (${skipped} already saved or invalid)` : ''}.`);
    await db.importItems(state.session.code, fresh);
    toast(`Imported ${plural(fresh.length, 'link')}${skipped ? `, skipped ${skipped}` : ''}`);
  } catch (err) {
    toast(err instanceof SyntaxError ? 'That file isn’t valid JSON.' : friendly(err), { error: true });
  }
}

async function copy(text, done = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, { action: null });
  } catch {
    prompt('Copy this:', text);
  }
}

function signOut() {
  if (DEMO) return (location.href = '/');
  if (!confirm('Sign out of this device? Your links stay saved under your code.')) return;
  state.unsubs.forEach((u) => u());
  state.unsubs = [];
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

function openAccount() {
  renderAccount();
  $('accountDialog').showModal();
}

// ---------- PWA install ----------
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

// ---------- Wire up ----------
function wire() {
  $('fab').addEventListener('click', () => openAdd());
  $('addBtn').addEventListener('click', () => openAdd());
  $('accountBtn').addEventListener('click', openAccount);
  $('searchInput').addEventListener('input', (e) => {
    state.q = e.target.value;
    renderList();
  });
  document.querySelectorAll('.view-tab').forEach((b) =>
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      render();
    }),
  );
  $('filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    render();
  });
  $('empty').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="add"]')) openAdd();
  });
  $('list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const item = findItem(btn.closest('.item').dataset.id);
    if (!item) return;
    const act = btn.dataset.act;
    if (act === 'toggle') toggleDone(item);
    if (act === 'pin') togglePin(item);
    if (act === 'copy') copy(item.url);
    if (act === 'more') openItem(item);
  });

  $('addForm').addEventListener('submit', submitAdd);
  $('addUrl').addEventListener('input', onAddUrlChange);
  $('addNote').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('addForm').requestSubmit();
  });
  $('pasteBtn').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('addUrl').value = extractUrl(text) || text.trim();
      onAddUrlChange();
    } catch {
      toast('Clipboard access was blocked. Long-press the field to paste.', { error: true });
    }
  });

  $('accCopy').addEventListener('click', () => copy(state.session.code, 'Code copied'));
  $('catForm').addEventListener('submit', addCategory);
  $('exportBtn').addEventListener('click', exportJson);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importJson(file);
  });
  $('signOutBtn').addEventListener('click', signOut);
  document.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeOpt)));
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('installBtn').hidden = true;
  });

  // Close buttons + tap-outside-to-close for every sheet.
  document.querySelectorAll('dialog').forEach((d) => {
    d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
  });

  // Keyboard shortcuts: "/" search, "n" new link.
  document.addEventListener('keydown', (e) => {
    if ($('viewApp').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === '/') {
      e.preventDefault();
      $('searchInput').focus();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openAdd();
    }
  });
  $('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      state.q = '';
      renderList();
      e.target.blur();
    }
  });

  window.addEventListener('online', () => renderSync());
  window.addEventListener('offline', () => renderSync());
}

// Demo screenshots: open a specific screen once the sample data has rendered.
function openDemoScreen() {
  const first = () => visibleItems()[0];
  const screens = {
    add: () => openAdd({ url: 'https://www.youtube.com/watch?v=aircAruvnKk', title: 'But what is a neural network?', note: 'Watch before the ML meetup' }),
    item: () => openItem(state.items.find((i) => i.note && i.status !== 'done') || first()),
    account: openAccount,
    done: () => { state.view = 'done'; render(); },
    search: () => { $('searchInput').value = state.q = 'read'; renderList(); },
    watch: () => { state.filter = 'watch'; render(); },
  };
  setTimeout(() => screens[DEMO_SCREEN]?.(), 50);
}

// ---------- Boot ----------
(async function boot() {
  $('appVersion').textContent = `Laterbeam v${__APP_VERSION__}`;
  if ('serviceWorker' in navigator && import.meta.env.PROD && !DEMO) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  if (!DEMO && !isConfigured()) return show('viewSetup');

  db = DEMO ? await import('./demo-db.js') : await import('./db.js');
  const pendingCode = DEMO ? null : captureIncoming();
  wire();
  initWelcome();

  try {
    await db.initFirebase();
  } catch (e) {
    show('viewWelcome');
    return setAuthError(friendly(e));
  }

  if (DEMO) {
    if (DEMO_SCREEN === 'welcome') return show('viewWelcome');
    if (DEMO_SCREEN === 'signup') { show('viewWelcome'); return selectAuthTab('signup'); }
    saveSession({ code: db.DEMO_CODE, username: 'Alex' });
    await enterApp();
    return openDemoScreen();
  }

  const session = loadSession();
  if (pendingCode && pendingCode !== session?.code) {
    show('viewWelcome');
    $('codeInput').value = pendingCode;
    return signIn(pendingCode);
  }
  if (session) return enterApp();
  show('viewWelcome');
  if (sessionStorage.getItem(PENDING_SHARE_KEY)) setAuthError('Sign in first. Your shared link will be saved right after.');
})();
