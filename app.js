/* Employee & DRS Manager
   All data lives in IndexedDB on THIS device only (see db.js). Nothing is uploaded or synced anywhere. */
'use strict';
(() => {
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isDate = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d && y >= 1990 && y <= 2100; };
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');
const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const monthOf = iso => iso.slice(0, 7);
const monthDays = key => { const [y, m] = key.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${key}-${pad(i + 1)}`); };
const monthLabel = key => new Date(+key.slice(0, 4), +key.slice(5) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dow = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const fmtStamp = ts => ts ? new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

const STATUSES = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'];
const CODE = { Present: 'P', Absent: 'A', 'Half Day': 'H', Leave: 'L', Holiday: 'HD' };
const SCLS = { Present: 'ok', Absent: 'bad', 'Half Day': 'warn', Leave: 'info', Holiday: 'mute' };
const MAX_FILE = 25 * 1024 * 1024;
const DEFAULTS = { key: 'app', appName: 'Employee & DRS Manager', company: '', adminName: '', adminEmail: '', dateFormat: 'DD/MM/YYYY', theme: 'light' };
const S = { settings: { ...DEFAULTS } };

function fmtDate(iso) {
  if (!isDate(iso)) return iso || '—';
  const [y, m, d] = iso.split('-'), f = S.settings.dateFormat;
  return f === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : f === 'YYYY-MM-DD' ? iso : `${d}/${m}/${y}`;
}
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.4 3.5 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>', check: '<path d="M5 12l5 5 9-10"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  restore: '<path d="M4 12a8 8 0 108-8M4 4v5h5"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- toasts, modals, errors ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, type === 'bad' ? 5500 : 3200);
}
function fail(e, ctx) {
  console.error(ctx, e);
  const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
  toast(quota ? 'This device is out of storage. Delete old DRS files or free space, then try again.' : `${ctx}: ${(e && e.message) || e}`, 'bad');
}
function modal(title, body, opts = {}) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></header><div class="mbody">${body}</div></div>`;
  document.body.appendChild(ov); document.body.classList.add('noscroll');
  ov.close = () => { if (!ov.isConnected) return; ov.remove(); if (!$('.overlay')) document.body.classList.remove('noscroll'); if (opts.onClose) opts.onClose(); };
  ov.addEventListener('mousedown', e => { if (e.target === ov && !opts.sticky) ov.close(); });
  $('[data-close]', ov).onclick = ov.close;
  const first = $('input:not([type=file]),select,textarea', ov); if (first && !opts.noFocus && matchMedia('(pointer:fine)').matches) first.focus();
  return ov;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const o = $$('.overlay').pop(); if (o) o.close(); } });
function confirmBox({ title, message, ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    const m = modal(title, `<p>${message}</p><div class="actions"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`, { sticky: true, onClose: () => res(false), noFocus: true });
    m.classList.add('top');
    $('[data-no]', m).onclick = () => m.close();
    $('[data-yes]', m).onclick = () => { res(true); m.close(); };
  });
}
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('edm-changes') : null;
function changed() { if (bc) bc.postMessage('changed'); return render(); }
if (bc) bc.onmessage = () => { if (!$('.overlay') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) render(); };

/* ---------- authentication ----------
   FRONTEND-ONLY. The credential check below runs in the browser and is NOT secure for a public,
   multi-user system: anyone who can open DevTools on a device can read or bypass it.
   To add real security later, replace the bodies of Auth.login / logout / isLoggedIn / changeCredentials
   with calls to your server (session cookie or JWT) and move the data layer (db.js) to an API.
   The rest of the app only talks to the Auth object. */
const Auth = {
  cfg: null,
  async hash(pw, salt) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Secure hashing needs HTTPS (or localhost). Open the app over https://.');
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pw));
    return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
  },
  async make(username, pw) { const salt = uid(); return { key: 'auth', username, salt, hash: await this.hash(pw, salt) }; },
  async init() {
    let a = await DB.get('settings', 'auth');
    if (!a) { a = await this.make('admin', 'admin123'); a.isDefault = true; await DB.put('settings', a); }
    this.cfg = a;
  },
  async login(u, p) {
    const h = await this.hash(p, this.cfg.salt);
    if (u.trim().toLowerCase() === this.cfg.username.toLowerCase() && h === this.cfg.hash) { sessionStorage.setItem('edm_session', '1'); return true; }
    return false;
  },
  isLoggedIn() { return sessionStorage.getItem('edm_session') === '1'; },
  logout() { sessionStorage.removeItem('edm_session'); },
  async changeCredentials(username, pw) { const a = await this.make(username, pw); await DB.put('settings', a); this.cfg = a; }
};

function showLogin() {
  const s = S.settings;
  $('#app').innerHTML = `<main class="login"><form class="login-card" id="lf" autocomplete="on">
    <div class="logo"><img src="icons/icon-192.png" alt=""><div><h2>${esc(s.appName)}</h2><div class="muted small">${esc(s.company || 'Administrator sign in')}</div></div></div>
    <div class="fields"><label class="f">Username<input type="text" id="lu" autocomplete="username" required autocapitalize="none"></label>
    <label class="f">Password<input type="password" id="lp" autocomplete="current-password" required></label></div>
    <div class="err" id="le" role="alert"></div>
    <button class="btn primary" style="width:100%;margin-top:6px">Sign in</button>
    ${Auth.cfg && Auth.cfg.isDefault ? '<p class="note" style="margin-top:14px">First time here? Sign in with <b>admin</b> / <b>admin123</b>, then change the password in Settings.</p>' : ''}
    <p class="muted small" style="margin-top:14px">This login only protects the screen on this device. It is not server-side security, so don\u2019t treat it as protection for a shared or public deployment.</p>
  </form></main>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const err = $('#le'); err.textContent = '';
    const btn = $('button', e.target); btn.disabled = true;
    try {
      if (await Auth.login($('#lu').value, $('#lp').value)) { location.hash = '#/dashboard'; await render(); }
      else { await new Promise(r => setTimeout(r, 700)); err.textContent = 'Wrong username or password.'; $('#lp').select(); }
    } catch (x) { err.textContent = x.message; }
    btn.disabled = false;
  };
}

/* ---------- shell + router ---------- */
const NAV = [['dashboard', 'Dashboard', 'home'], ['employees', 'Employees', 'users'], ['attendance', 'Attendance', 'calendar'], ['drs', 'DRS Copies', 'file'], ['reports', 'Reports', 'chart'], ['settings', 'Settings', 'settings']];
const PAGES = {
  dashboard: ['Dashboard', viewDashboard], employees: ['Employees', viewEmployees], employee: ['Employee profile', viewEmployee],
  attendance: ['Attendance', viewAttendance], drs: ['DRS Copy Management', viewDrs], reports: ['Reports', viewReports], settings: ['Settings', viewSettings]
};
let renderSeq = 0, deferredPrompt = null;

function buildShell() {
  const s = S.settings;
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><img src="icons/icon-192.png" alt=""><div><span>${esc(s.appName)}</span><small>${esc(s.company || 'Admin console')}</small></div></div>
  <nav>${NAV.map(n => `<a href="#/${n[0]}" data-nav="${n[0]}">${ic(n[2])}${n[1]}</a>`).join('')}</nav>
  <button class="linkbtn" data-act="install" hidden>${ic('download')}Install app</button><button class="linkbtn" data-act="logout">${ic('logout')}Log out</button></aside>
  <div class="main"><header class="topbar"><div class="brand-mini"><img src="icons/icon-192.png" alt=""></div><div class="ttl" id="ttl"></div>
  <span class="pill-off" id="off" hidden>Offline</span><button class="btn sm" data-act="install" hidden>${ic('download')}Install</button>
  <a class="icon-btn only-mobile" href="#/settings" aria-label="Settings">${ic('settings')}</a><button class="icon-btn only-mobile" data-act="logout" aria-label="Log out">${ic('logout')}</button></header>
  <main class="view" id="view"></main></div></div>
  <nav class="bottomnav">${NAV.slice(0, 5).map(n => `<a href="#/${n[0]}" data-nav="${n[0]}">${ic(n[2])}${n[1].replace(' Copies', '')}</a>`).join('')}</nav>`;
  syncInstall(); syncOnline();
}
function syncInstall() { $$('[data-act=install]').forEach(b => b.hidden = !deferredPrompt); }
function syncOnline() { const o = $('#off'); if (o) o.hidden = navigator.onLine; }
window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; syncInstall(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; syncInstall(); toast('App installed.'); });

function paint(seq, html) { if (seq !== renderSeq) return false; $('#view').innerHTML = html; return true; }

async function render() {
  if (!Auth.isLoggedIn()) return showLogin();
  if (!$('#view')) buildShell();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let page = parts[0] || 'dashboard'; if (!PAGES[page]) page = 'dashboard';
  const seq = ++renderSeq;
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === (page === 'employee' ? 'employees' : page)));
  $('#ttl').textContent = PAGES[page][0];
  try { await PAGES[page][1](decodeURIComponent(parts[1] || ''), seq); }
  catch (e) { console.error(e); paint(seq, `<div class="card empty"><b>Something went wrong</b>${esc(e.message || e)}<br><button class="btn primary" onclick="location.reload()">Reload</button></div>`); }
}

/* ---------- shared data helpers ---------- */
async function loadEmps() { return (await DB.all('employees')).sort((a, b) => natural(a.code, b.code)); }
const emap = list => new Map(list.map(e => [e.id, e]));
const statusBadge = st => `<span class="badge ${SCLS[st] || 'mute'}">${esc(st)}</span>`;
const avatar = (e, lg) => e && e.photo ? `<img class="avatar ${lg ? 'lg' : ''}" src="${e.photo}" alt="">` : `<span class="avatar ${lg ? 'lg' : ''}">${esc(initials(e && e.name))}</span>`;
const who = e => e ? `<div class="who">${avatar(e)}<div style="min-width:0"><b><a href="#/employee/${esc(e.id)}">${esc(e.name)}</a></b><span>${esc(e.code)}${e.status === 'archived' ? ' · archived' : ''}</span></div></div>` : '<span class="muted">Unknown employee</span>';
const empStatusBadge = e => `<span class="badge ${e.status === 'active' ? 'ok' : e.status === 'archived' ? 'mute' : 'warn'}">${e.status === 'active' ? 'Active' : e.status === 'archived' ? 'Archived' : 'Inactive'}</span>`;
function summarize(recs) {
  const s = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0, Holiday: 0 };
  recs.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
  const counted = s.Present + s.Absent + s['Half Day'] + s.Leave;
  s.pct = counted ? Math.round(((s.Present + s['Half Day'] * 0.5) / counted) * 100) : 0; s.counted = counted;
  return s;
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const safeName = s => String(s || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
function toCSV(cols, rows) {
  const q = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return '\ufeff' + [cols, ...rows].map(r => r.map(q).join(',')).join('\r\n');
}
function exportCSV(name, cols, rows) { download(new Blob([toCSV(cols, rows)], { type: 'text/csv;charset=utf-8' }), `${safeName(name)}-${todayISO()}.csv`); }

/* ---------- dashboard ---------- */
async function viewDashboard(_, seq) {
  const [emps, att, drs] = await Promise.all([loadEmps(), DB.all('attendance'), DB.all('drs')]);
  const em = emap(emps), active = emps.filter(e => e.status === 'active'), ids = new Set(active.map(e => e.id)), today = todayISO();
  const ta = att.filter(a => a.date === today && ids.has(a.empId));
  const n = st => ta.filter(a => a.status === st).length;
  const present = n('Present') + n('Half Day'), pct = active.length ? Math.round(present / active.length * 100) : 0;
  const recentA = [...att].filter(a => em.has(a.empId)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 7);
  const recentD = [...drs].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0)).slice(0, 6);
  const longDate = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  paint(seq, `<div class="page-head"><div><h1>${esc(S.settings.company || 'Dashboard')}</h1><p class="sub">${longDate}</p></div></div>
  <div class="grid stats">
    <div class="stat"><div class="n">${emps.filter(e => e.status !== 'archived').length}</div><div class="l">Total employees</div><div class="s">${active.length} active</div></div>
    <div class="stat"><div class="n">${present}</div><div class="l">Present today</div><div class="s">${n('Half Day') ? `incl. ${n('Half Day')} half day` : ''}</div></div>
    <div class="stat"><div class="n">${n('Absent')}</div><div class="l">Absent today</div><div class="s">${Math.max(0, active.length - ta.length)} not marked yet</div></div>
    <div class="stat"><div class="n">${n('Leave')}</div><div class="l">On leave</div><div class="s"></div></div>
    <div class="stat"><div class="n">${drs.length}</div><div class="l">Total DRS copies</div><div class="s">${new Set(drs.map(d => d.empId)).size} employees</div></div>
    <div class="stat hero"><div class="n">${pct}%</div><div class="l">Attendance today</div><div class="bar"><i style="width:${pct}%"></i></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Quick actions</h2><div class="quick">
    <a class="btn" href="#/attendance">${ic('calendar')}Mark attendance</a>
    <button class="btn" data-act="empAdd">${ic('plus')}Add employee</button>
    <button class="btn" data-act="drsAdd">${ic('upload')}Upload DRS</button>
    <a class="btn" href="#/reports/monthly">${ic('chart')}Monthly report</a></div></div>
  <div class="grid two" style="margin-top:14px">
    <div class="card"><h2>Recent attendance activity</h2>${recentA.length ? recentA.map(a => { const e = em.get(a.empId); return `<div class="list-row">${avatar(e)}<div class="grow"><div class="t">${esc(e.name)}</div><div class="muted small">${fmtDate(a.date)} · ${fmtStamp(a.updatedAt)}</div></div>${statusBadge(a.status)}</div>`; }).join('') : '<div class="empty">No attendance marked yet.<br><a class="btn primary" href="#/attendance">Mark attendance</a></div>'}</div>
    <div class="card"><h2>Recently uploaded DRS copies</h2>${recentD.length ? recentD.map(d => { const e = em.get(d.empId); return `<div class="list-row"><span class="avatar" style="background:var(--blue)">${ic('file')}</span><div class="grow"><div class="t">DRS ${esc(d.drsNumber)} · ${esc(e ? e.name : 'Unknown')}</div><div class="muted small">${fmtDate(d.drsDate)} · uploaded ${fmtStamp(d.uploadedAt)}</div></div><button class="icon-btn" data-act="drsView" data-id="${esc(d.id)}" aria-label="View">${ic('eye')}</button></div>`; }).join('') : '<div class="empty">No DRS copies uploaded yet.<br><button class="btn primary" data-act="drsAdd">Upload first DRS</button></div>'}</div>
  </div>
  <p class="note" style="margin-top:14px">Your data is saved on <b>this device only</b>. It does not sync to other phones or computers. Use <a href="#/settings">Settings \u2192 Backup</a> regularly.</p>`);
}

/* ---------- employees ---------- */
const FIL = { q: '', st: 'live' };

async function viewEmployees(_, seq) {
  const emps = await loadEmps();
  if (!paint(seq, `<div class="page-head"><div><h1>Employees</h1><p class="sub">${emps.filter(e => e.status !== 'archived').length} on the team${emps.some(e => e.status === 'archived') ? `, ${emps.filter(e => e.status === 'archived').length} archived` : ''}</p></div><button class="btn primary" data-act="empAdd">${ic('plus')}Add employee</button></div>
  <div class="toolbar"><div class="search">${ic('search')}<input id="q" type="search" placeholder="Search by name or employee ID" value="${esc(FIL.q)}" aria-label="Search employees"></div>
  <select id="st" aria-label="Status filter"><option value="live">Active and inactive</option><option value="active">Active only</option><option value="inactive">Inactive only</option><option value="archived">Archived</option><option value="all">Everyone</option></select></div>
  <div class="card" id="list"></div>`)) return;
  $('#st').value = FIL.st;
  const draw = () => {
    const q = FIL.q.trim().toLowerCase();
    const rows = emps.filter(e => (FIL.st === 'all' || (FIL.st === 'live' ? e.status !== 'archived' : e.status === FIL.st)) && (!q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)));
    $('#list').innerHTML = rows.length ? `<table class="tbl cards"><thead><tr><th>Employee</th><th>ID</th><th>Designation</th><th>Mobile</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(e => `<tr>
      <td class="nolabel">${who(e)}</td><td data-label="ID">${esc(e.code)}</td><td data-label="Designation">${esc(e.designation || '—')}</td>
      <td data-label="Mobile">${e.mobile ? `<a href="tel:${esc(e.mobile)}">${esc(e.mobile)}</a>` : '—'}</td><td data-label="Status">${empStatusBadge(e)}</td>
      <td class="acts-td"><div class="row-acts"><a class="icon-btn" href="#/employee/${esc(e.id)}" aria-label="Open profile">${ic('eye')}</a>
      <button class="icon-btn" data-act="empEdit" data-id="${esc(e.id)}" aria-label="Edit">${ic('edit')}</button>
      ${e.status === 'archived' ? `<button class="icon-btn" data-act="empRestore" data-id="${esc(e.id)}" aria-label="Restore">${ic('restore')}</button>` : ''}
      <button class="icon-btn danger" data-act="empDelete" data-id="${esc(e.id)}" aria-label="Delete or archive">${ic('trash')}</button></div></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty"><b>${emps.length ? 'No employees match' : 'No employees yet'}</b>${emps.length ? 'Try a different name, ID or status filter.' : 'Add your first employee to start marking attendance and storing DRS copies.'}${emps.length ? '' : '<br><button class="btn primary" data-act="empAdd">Add employee</button>'}</div>`;
  };
  $('#q').oninput = e => { FIL.q = e.target.value; draw(); };
  $('#st').onchange = e => { FIL.st = e.target.value; draw(); };
  draw();
}

function readPhoto(file) {
  return new Promise((res, rej) => {
    if (!/^image\/(jpeg|png)$/.test(file.type)) return rej(new Error('The photo must be a JPG or PNG image.'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That photo could not be read.')); };
    img.src = url;
  });
}

async function empForm(id) {
  const list = await loadEmps(), cur = id ? list.find(e => e.id === id) : null;
  if (id && !cur) return toast('That employee no longer exists.', 'bad');
  const e = cur || {};
  const nums = list.map(x => +((/(\d+)$/.exec(x.code) || [])[1])).filter(Number.isFinite);
  const code = e.code || 'EMP' + pad(Math.max(0, ...nums) + 1).padStart(3, '0');
  const m = modal(cur ? 'Edit employee' : 'Add employee', `<form id="ef" novalidate><div class="fields c2">
    <label class="f">Employee ID *<input type="text" id="f-code" value="${esc(code)}" maxlength="20" required></label>
    <label class="f">Full name *<input type="text" id="f-name" value="${esc(e.name || '')}" maxlength="80" required autocomplete="off"></label>
    <label class="f">Mobile number *<input type="tel" id="f-mobile" value="${esc(e.mobile || '')}" maxlength="20" inputmode="tel"></label>
    <label class="f">Designation<input type="text" id="f-desig" value="${esc(e.designation || '')}" maxlength="60"></label>
    <label class="f">Joining date<input type="date" id="f-join" value="${esc(e.joiningDate || todayISO())}"></label>
    <label class="f">Status<select id="f-status"><option value="active">Active</option><option value="inactive">Inactive</option>${e.status === 'archived' ? '<option value="archived">Archived</option>' : ''}</select></label>
    <label class="f span2">Address<textarea id="f-addr" maxlength="300">${esc(e.address || '')}</textarea></label>
    <label class="f span2">Photograph (optional, JPG or PNG)<input type="file" id="f-photo" accept="image/jpeg,image/png"></label>
    ${e.photo ? `<label class="f span2" style="flex-direction:row;align-items:center;gap:10px">${avatar(e)}<span><input type="checkbox" id="f-rmphoto"> Remove current photo</span></label>` : ''}
  </div><div class="err" id="ferr" role="alert"></div><div class="actions"><button type="button" class="btn" data-close2>Cancel</button><button class="btn primary">${cur ? 'Save changes' : 'Add employee'}</button></div></form>`);
  $('#f-status', m).value = e.status || 'active';
  $('[data-close2]', m).onclick = m.close;
  $('#ef', m).onsubmit = async ev => {
    ev.preventDefault();
    const v = k => $('#' + k, m).value.trim(), err = t => { $('#ferr', m).textContent = t; };
    const c = v('f-code'), name = v('f-name'), mobile = v('f-mobile'), join = $('#f-join', m).value;
    if (!/^[A-Za-z0-9._-]{1,20}$/.test(c)) return err('Employee ID can only use letters, numbers, dot, dash and underscore.');
    if (list.some(x => x.code.toLowerCase() === c.toLowerCase() && x.id !== (cur && cur.id))) return err(`Employee ID ${c} is already used. Pick another.`);
    if (name.length < 2) return err('Enter the employee\u2019s full name.');
    if (!/^\+?[\d\s-]{7,16}$/.test(mobile) || mobile.replace(/\D/g, '').length < 7) return err('Enter a valid mobile number (7 to 15 digits).');
    if (join && !isDate(join)) return err('The joining date is not a valid date.');
    const btn = $('button.primary', m); btn.disabled = true;
    try {
      let photo = e.photo || '';
      const f = $('#f-photo', m).files[0];
      if (f) photo = await readPhoto(f); else if ($('#f-rmphoto', m) && $('#f-rmphoto', m).checked) photo = '';
      const now = Date.now();
      await DB.put('employees', { id: cur ? cur.id : uid(), code: c, name, mobile, designation: v('f-desig'), joiningDate: join, address: v('f-addr'), photo, status: $('#f-status', m).value, createdAt: e.createdAt || now, updatedAt: now });
      m.close(); toast(cur ? 'Employee updated.' : 'Employee added.'); changed();
    } catch (x) { btn.disabled = false; err(x.message); if (x.name === 'QuotaExceededError') fail(x, 'Save failed'); }
  };
}

async function empDelete(id) {
  const [e, drs, att] = await Promise.all([DB.get('employees', id), DB.byIndex('drs', 'empId', id), DB.byIndex('attendance', 'empId', id)]);
  if (!e) return toast('That employee no longer exists.', 'bad');
  const m = modal(`Remove ${e.name}?`, `<p><b>Archive</b> hides ${esc(e.name)} from attendance and lists but <b>keeps</b> ${drs.length} DRS ${drs.length === 1 ? 'copy' : 'copies'} and ${att.length} attendance ${att.length === 1 ? 'record' : 'records'}. You can restore anytime.</p>
  <p><b>Delete permanently</b> erases the employee, all attendance records and all DRS documents. This cannot be undone.</p>
  <label class="f">To enable permanent delete, type the employee ID <b>${esc(e.code)}</b><input type="text" id="cc" autocomplete="off"></label>
  <div class="actions"><button class="btn" data-no>Cancel</button><button class="btn navy" data-arch>${ic('archive')}Archive</button><button class="btn danger" data-del disabled>${ic('trash')}Delete permanently</button></div>`, { noFocus: true });
  $('[data-no]', m).onclick = m.close;
  $('#cc', m).oninput = ev => { $('[data-del]', m).disabled = ev.target.value.trim().toLowerCase() !== e.code.toLowerCase(); };
  $('[data-arch]', m).onclick = async () => { try { await DB.put('employees', { ...e, status: 'archived', updatedAt: Date.now() }); m.close(); toast('Employee archived. DRS copies were kept.'); if (location.hash.startsWith('#/employee/')) location.hash = '#/employees'; changed(); } catch (x) { fail(x, 'Archive failed'); } };
  $('[data-del]', m).onclick = async () => { try { await DB.deleteEmployeeCascade(id); m.close(); toast('Employee and their records were deleted.'); if (location.hash.startsWith('#/employee/')) location.hash = '#/employees'; changed(); } catch (x) { fail(x, 'Delete failed'); } };
}

const P = { tab: 'attendance', month: todayISO().slice(0, 7) };

async function viewEmployee(id, seq) {
  const e = await DB.get('employees', id);
  if (!e) return paint(seq, `<div class="card empty"><b>Employee not found</b>This employee may have been deleted.<br><a class="btn primary" href="#/employees">Back to employees</a></div>`);
  const [att, drs] = await Promise.all([DB.byIndex('attendance', 'empId', id), DB.byIndex('drs', 'empId', id)]);
  const mrecs = att.filter(a => monthOf(a.date) === P.month);
  let body = '';
  if (P.tab === 'attendance') {
    const list = (isMonth(P.month) ? mrecs : att).sort((a, b) => b.date.localeCompare(a.date));
    body = `<div class="toolbar no-print"><label class="f">Month<input type="month" id="pm" value="${esc(P.month)}"></label></div>` + (list.length ? `<div class="scroll"><table class="tbl cards"><thead><tr><th>Date</th><th>Day</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Remarks</th><th class="no-print"></th></tr></thead><tbody>${list.map(a => `<tr><td data-label="Date">${fmtDate(a.date)}</td><td data-label="Day">${DOW[dow(a.date)]}</td><td data-label="Status">${statusBadge(a.status)}</td><td data-label="Check-in">${esc(a.checkIn || '—')}</td><td data-label="Check-out">${esc(a.checkOut || '—')}</td><td data-label="Remarks">${esc(a.remarks || '—')}</td><td class="acts-td no-print"><button class="icon-btn" data-act="attEdit" data-emp="${esc(id)}" data-date="${a.date}" aria-label="Edit">${ic('edit')}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>No attendance in ${isMonth(P.month) ? monthLabel(P.month) : 'this period'}</b>Marked days will appear here.<br><a class="btn primary" href="#/attendance">Mark attendance</a></div>`);
  } else if (P.tab === 'summary') {
    const s = summarize(mrecs), map = new Map(mrecs.map(a => [a.date, a]));
    body = `<div class="toolbar no-print"><label class="f">Month<input type="month" id="pm" value="${esc(P.month)}"></label></div>
    <h2>${isMonth(P.month) ? monthLabel(P.month) : ''}</h2><div class="sumgrid"><div><b>${s.Present}</b><span>Present</span></div><div><b>${s.Absent}</b><span>Absent</span></div><div><b>${s['Half Day']}</b><span>Half day</span></div><div><b>${s.Leave}</b><span>Leave</span></div><div><b>${s.Holiday}</b><span>Holiday</span></div><div><b>${s.pct}%</b><span>Attendance</span></div></div>
    <div style="margin-top:16px">${calendarHTML(id, P.month, map)}</div>`;
  } else {
    body = `<div class="no-print" style="margin-bottom:12px"><button class="btn primary" data-act="drsAdd" data-emp="${esc(id)}">${ic('upload')}Upload DRS for ${esc(e.name.split(' ')[0])}</button></div>` + (drs.length ? drsTable(drs.sort((a, b) => b.drsDate.localeCompare(a.drsDate)), new Map([[id, e]]), false) : `<div class="empty"><b>No DRS copies for ${esc(e.name)}</b>Uploaded copies stay in this employee\u2019s own folder.</div>`);
  }
  if (!paint(seq, `<a class="btn ghost sm no-print" href="#/employees">${ic('back')}All employees</a>
  <div class="card" style="margin-top:8px"><div class="prof">${avatar(e, true)}<div style="flex:1;min-width:200px"><h1>${esc(e.name)}</h1><p class="sub">${esc(e.designation || 'No designation')} · ${esc(e.code)} ${empStatusBadge(e)}</p></div>
    <div class="acts no-print" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="empEdit" data-id="${esc(id)}">${ic('edit')}Edit</button><button class="btn" onclick="window.print()">${ic('print')}Print</button><button class="btn danger" data-act="empDelete" data-id="${esc(id)}">${ic('trash')}Remove</button></div></div>
    <div class="kv"><div><span>Employee ID</span>${esc(e.code)}</div><div><span>Mobile</span>${e.mobile ? `<a href="tel:${esc(e.mobile)}">${esc(e.mobile)}</a>` : '—'}</div><div><span>Joining date</span>${fmtDate(e.joiningDate)}</div><div><span>DRS copies</span>${drs.length}</div><div style="grid-column:1/-1"><span>Address</span>${esc(e.address || '—')}</div></div></div>
  <div class="card"><div class="tabs no-print">${[['attendance', 'Attendance history'], ['summary', 'Monthly summary'], ['drs', `DRS copies (${drs.length})`]].map(t => `<button class="${P.tab === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>${body}</div>`)) return;
  $$('[data-tab]').forEach(b => b.onclick = () => { P.tab = b.dataset.tab; render(); });
  const pm = $('#pm'); if (pm) pm.onchange = () => { P.month = pm.value || todayISO().slice(0, 7); render(); };
}

/* ---------- attendance ---------- */
const A = { tab: 'daily', date: todayISO(), emp: '', cmonth: todayISO().slice(0, 7), cemp: '', from: addDays(todayISO(), -30), to: todayISO(), remp: '', rst: '' };

function buildRec(d, date) {
  if (!STATUSES.includes(d.status)) return { err: 'Choose a status.' };
  const timed = d.status === 'Present' || d.status === 'Half Day';
  const ci = timed ? d.checkIn : '', co = timed ? d.checkOut : '';
  if ((ci && !isTime(ci)) || (co && !isTime(co))) return { err: 'Enter times like 09:30.' };
  if (ci && co && co <= ci) return { err: 'Check-out must be after check-in.' };
  if (!isDate(date)) return { err: 'That date is not valid.' };
  return { rec: { id: uid(), empId: d.empId, date, status: d.status, checkIn: ci, checkOut: co, remarks: (d.remarks || '').slice(0, 200), updatedAt: Date.now() } };
}

function calendarHTML(empId, month, map) {
  if (!isMonth(month)) return '<p class="muted">Pick a month to see the calendar.</p>';
  const days = monthDays(month), today = todayISO();
  let h = '<div class="cal">' + DOW.map(d => `<div class="dow">${d}</div>`).join('') + '<div class="day blank"></div>'.repeat(dow(days[0]));
  days.forEach(d => { const r = map.get(d); h += `<button class="day ${r ? SCLS[r.status] : ''} ${d === today ? 'today' : ''}" data-act="attEdit" data-emp="${esc(empId)}" data-date="${d}" aria-label="${fmtDate(d)}: ${r ? r.status : 'not marked'}">${+d.slice(8)}<small>${r ? CODE[r.status] : ''}</small></button>`; });
  return h + '</div><div class="legend">' + STATUSES.map(s => `<span class="badge ${SCLS[s]}">${CODE[s]} = ${s}</span>`).join('') + '</div>';
}

async function viewAttendance(_, seq) {
  const emps = await loadEmps();
  const tabs = [['daily', 'Mark attendance'], ['calendar', 'Monthly calendar'], ['records', 'Records']];
  if (!paint(seq, `<div class="page-head"><div><h1>Attendance</h1><p class="sub">Mark, review and edit attendance.</p></div><a class="btn" href="#/reports/monthly">${ic('chart')}Monthly report</a></div>
  <div class="tabs">${tabs.map(t => `<button class="${A.tab === t[0] ? 'on' : ''}" data-atab="${t[0]}">${t[1]}</button>`).join('')}</div><div id="abody"></div>`)) return;
  $$('[data-atab]').forEach(b => b.onclick = () => { A.tab = b.dataset.atab; render(); });
  if (!emps.some(e => e.status !== 'archived')) { $('#abody').innerHTML = `<div class="card empty"><b>Add an employee first</b>Attendance is marked per employee.<br><button class="btn primary" data-act="empAdd">Add employee</button></div>`; return; }
  if (A.tab === 'daily') await attDaily(emps, seq); else if (A.tab === 'calendar') await attCalendar(emps, seq); else await attRecords(emps, seq);
}

async function attDaily(emps, seq) {
  if (!isDate(A.date)) A.date = todayISO();
  const recs = await DB.byIndex('attendance', 'date', A.date); if (seq !== renderSeq) return;
  const rm = new Map(recs.map(r => [r.empId, r]));
  const active = emps.filter(e => e.status === 'active'), rows = A.emp ? active.filter(e => e.id === A.emp) : active;
  const marked = active.filter(e => rm.has(e.id)).length;
  $('#abody').innerHTML = `<div class="toolbar"><label class="f">Date<input type="date" id="ad" value="${A.date}"></label>
    <label class="f">Employee<select id="ae"><option value="">All active employees</option>${active.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select></label>
    <button class="btn" id="atoday" style="flex:0 0 auto">Today</button></div>
  <p class="sub" style="margin-bottom:10px">${fmtDate(A.date)} · ${DOW[dow(A.date)]} · ${marked} of ${active.length} marked</p>
  ${rows.length ? `<div class="bulk"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="all"> Select all</label>
    <select id="bst" aria-label="Status for selected"><option value="">Mark selected as…</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select><button class="btn primary sm" data-act="attBulk">Apply to selected</button></div>
  <div class="card scroll"><table class="tbl cards"><thead><tr><th></th><th>Employee</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Remarks</th><th></th></tr></thead><tbody>${rows.map(e => { const r = rm.get(e.id) || {}; return `<tr data-emp="${esc(e.id)}"><td class="nolabel"><input type="checkbox" class="sel" aria-label="Select ${esc(e.name)}" style="width:20px;min-height:20px"></td><td class="nolabel">${who(e)}</td>
    <td data-label="Status"><select class="st"><option value="">Not marked</option>${STATUSES.map(s => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    <td data-label="Check-in"><input type="time" class="tin" value="${esc(r.checkIn || '')}"></td><td data-label="Check-out"><input type="time" class="tout" value="${esc(r.checkOut || '')}"></td>
    <td data-label="Remarks"><input type="text" class="rem" maxlength="200" value="${esc(r.remarks || '')}" placeholder="Optional"></td>
    <td class="acts-td"><button class="btn sm primary" data-act="attRow">${ic('check')}Save</button></td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="card empty"><b>No active employees</b>Activate or add an employee to mark attendance.</div>'}`;
  $('#ae').value = A.emp;
  $('#ad').onchange = e => { if (!isDate(e.target.value)) { toast('Pick a valid date.', 'bad'); e.target.value = A.date; return; } A.date = e.target.value; render(); };
  $('#atoday').onclick = () => { A.date = todayISO(); render(); };
  $('#ae').onchange = e => { A.emp = e.target.value; render(); };
  const all = $('#all'); if (all) all.onchange = () => $$('.sel').forEach(c => c.checked = all.checked);
}

const rowData = tr => ({ empId: tr.dataset.emp, status: $('.st', tr).value, checkIn: $('.tin', tr).value, checkOut: $('.tout', tr).value, remarks: $('.rem', tr).value.trim() });

async function attRow(btn) {
  const tr = btn.closest('tr'), d = rowData(tr);
  try {
    if (!d.status) {
      const ex = await DB.getAttendance(d.empId, A.date);
      if (!ex) return toast('Choose a status first.', 'bad');
      await DB.del('attendance', ex.id); toast('Attendance cleared.'); return changed();
    }
    const b = buildRec(d, A.date); if (b.err) return toast(b.err, 'bad');
    await DB.saveAttendance(b.rec); toast('Attendance saved.'); changed();
  } catch (e) { fail(e, 'Save failed'); }
}
async function attBulk() {
  const st = $('#bst').value, sel = $$('.sel:checked').map(c => c.closest('tr'));
  if (!sel.length) return toast('Select at least one employee.', 'bad');
  if (!st) return toast('Choose a status to apply.', 'bad');
  const recs = [];
  for (const tr of sel) { const b = buildRec({ ...rowData(tr), status: st }, A.date); if (b.err) return toast(`${$('b', tr).textContent}: ${b.err}`, 'bad'); recs.push(b.rec); }
  try { await DB.saveAttendance(recs); toast(`${recs.length} ${recs.length === 1 ? 'employee' : 'employees'} marked ${st}.`); changed(); } catch (e) { fail(e, 'Save failed'); }
}

async function attCalendar(emps, seq) {
  const list = emps.filter(e => e.status !== 'archived');
  if (!list.some(e => e.id === A.cemp)) A.cemp = list[0].id;
  if (!isMonth(A.cmonth)) A.cmonth = todayISO().slice(0, 7);
  const recs = (await DB.byIndex('attendance', 'empId', A.cemp)).filter(r => monthOf(r.date) === A.cmonth); if (seq !== renderSeq) return;
  const s = summarize(recs);
  $('#abody').innerHTML = `<div class="toolbar"><label class="f">Employee<select id="ce">${list.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select></label><label class="f">Month<input type="month" id="cm" value="${A.cmonth}"></label></div>
  <div class="card"><h2>${monthLabel(A.cmonth)}</h2><p class="muted small">Tap a day to add or edit attendance.</p>${calendarHTML(A.cemp, A.cmonth, new Map(recs.map(r => [r.date, r])))}
  <div class="sumgrid"><div><b>${s.Present}</b><span>Present</span></div><div><b>${s.Absent}</b><span>Absent</span></div><div><b>${s['Half Day']}</b><span>Half day</span></div><div><b>${s.Leave}</b><span>Leave</span></div><div><b>${s.Holiday}</b><span>Holiday</span></div><div><b>${s.pct}%</b><span>Attendance</span></div></div></div>`;
  $('#ce').value = A.cemp;
  $('#ce').onchange = e => { A.cemp = e.target.value; render(); };
  $('#cm').onchange = e => { A.cmonth = e.target.value || todayISO().slice(0, 7); render(); };
}

async function attRecords(emps, seq) {
  const [all] = await Promise.all([DB.all('attendance')]); if (seq !== renderSeq) return;
  $('#abody').innerHTML = `<div class="toolbar"><label class="f">From<input type="date" id="rf" value="${A.from}"></label><label class="f">To<input type="date" id="rt" value="${A.to}"></label>
  <label class="f">Employee<select id="re"><option value="">All employees</option>${emps.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select></label>
  <label class="f">Status<select id="rs"><option value="">Any status</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></label></div><div class="card" id="rl"></div>`;
  $('#re').value = A.remp; $('#rs').value = A.rst;
  const em = emap(emps);
  const draw = () => {
    const rows = all.filter(r => em.has(r.empId) && (!A.from || r.date >= A.from) && (!A.to || r.date <= A.to) && (!A.remp || r.empId === A.remp) && (!A.rst || r.status === A.rst)).sort((a, b) => b.date.localeCompare(a.date) || natural(em.get(a.empId).code, em.get(b.empId).code));
    $('#rl').innerHTML = rows.length ? `<p class="muted small">${rows.length} record${rows.length === 1 ? '' : 's'}${rows.length > 500 ? ' (showing the latest 500)' : ''}</p><div class="scroll"><table class="tbl cards"><thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Remarks</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr><td data-label="Date">${fmtDate(r.date)}</td><td class="nolabel">${who(em.get(r.empId))}</td><td data-label="Status">${statusBadge(r.status)}</td><td data-label="In">${esc(r.checkIn || '—')}</td><td data-label="Out">${esc(r.checkOut || '—')}</td><td data-label="Remarks">${esc(r.remarks || '—')}</td><td class="acts-td"><button class="icon-btn" data-act="attEdit" data-emp="${esc(r.empId)}" data-date="${r.date}" aria-label="Edit">${ic('edit')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No attendance records</b>Nothing matches these filters.</div>';
  };
  const bind = (id, k, valid) => $('#' + id).onchange = e => { if (valid && e.target.value && !isDate(e.target.value)) { toast('That date is not valid.', 'bad'); return; } A[k] = e.target.value; draw(); };
  bind('rf', 'from', true); bind('rt', 'to', true); bind('re', 'remp'); bind('rs', 'rst');
  draw();
}

async function attEdit(empId, date) {
  const [e, ex] = await Promise.all([DB.get('employees', empId), DB.getAttendance(empId, date)]);
  if (!e) return toast('That employee no longer exists.', 'bad');
  const r = ex || {};
  const m = modal(`${e.name} · ${fmtDate(date)}`, `<form id="af" novalidate><div class="fields c2"><label class="f span2">Status<select id="a-st"><option value="">Choose…</option>${STATUSES.map(s => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f">Check-in<input type="time" id="a-in" value="${esc(r.checkIn || '')}"></label><label class="f">Check-out<input type="time" id="a-out" value="${esc(r.checkOut || '')}"></label>
    <label class="f span2">Remarks<input type="text" id="a-rem" maxlength="200" value="${esc(r.remarks || '')}"></label></div><div class="err" id="aerr" role="alert"></div>
    <div class="actions">${ex ? `<button type="button" class="btn danger" data-rm style="margin-right:auto">${ic('trash')}Delete</button>` : ''}<button type="button" class="btn" data-no>Cancel</button><button class="btn primary">Save</button></div></form>`);
  $('[data-no]', m).onclick = m.close;
  if (ex) $('[data-rm]', m).onclick = async () => { if (!await confirmBox({ title: 'Delete attendance?', message: `Remove ${esc(e.name)}\u2019s record for ${fmtDate(date)}?`, ok: 'Delete', danger: true })) return; try { await DB.del('attendance', ex.id); m.close(); toast('Record deleted.'); changed(); } catch (x) { fail(x, 'Delete failed'); } };
  $('#af', m).onsubmit = async ev => {
    ev.preventDefault();
    const b = buildRec({ empId, status: $('#a-st', m).value, checkIn: $('#a-in', m).value, checkOut: $('#a-out', m).value, remarks: $('#a-rem', m).value.trim() }, date);
    if (b.err) { $('#aerr', m).textContent = b.err; return; }
    try { await DB.saveAttendance(b.rec); m.close(); toast('Attendance saved.'); changed(); } catch (x) { fail(x, 'Save failed'); }
  };
}

/* ---------- DRS copy management ---------- */
const D = { q: '', emp: '', from: '', to: '', group: true };
const extOf = d => ((d.fileName || '').split('.').pop() || '').toLowerCase();

async function checkFile(f) {
  if (!f) throw new Error('Choose a file to upload.');
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) throw new Error('Only PDF, JPG, JPEG and PNG files can be uploaded.');
  if (f.size === 0) throw new Error('That file is empty.');
  if (f.size > MAX_FILE) throw new Error(`That file is ${fmtBytes(f.size)}. The limit is 25 MB.`);
  const b = new Uint8Array(await f.slice(0, 8).arrayBuffer());
  const pdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  if (!(pdf || jpg || png)) throw new Error('This file is not a real PDF, JPG or PNG \u2014 its contents don\u2019t match.');
  return pdf ? 'application/pdf' : jpg ? 'image/jpeg' : 'image/png';
}

function drsTable(list, em, showEmp) {
  return `<div class="scroll"><table class="tbl cards"><thead><tr>${showEmp ? '<th>Employee</th>' : ''}<th>DRS no.</th><th>DRS date</th><th>Uploaded</th><th>File</th><th>Remarks</th><th class="no-print"></th></tr></thead><tbody>${list.map(d => `<tr>${showEmp ? `<td class="nolabel">${who(em.get(d.empId))}</td>` : ''}
    <td data-label="DRS no."><b>${esc(d.drsNumber)}</b></td><td data-label="DRS date">${fmtDate(d.drsDate)}</td><td data-label="Uploaded">${fmtDate(d.uploadDate)}</td>
    <td data-label="File">${esc((d.fileType || '').split('/')[1] || '—').toUpperCase()} · ${fmtBytes(d.fileSize || 0)}</td><td data-label="Remarks">${esc(d.remarks || '—')}</td>
    <td class="acts-td no-print"><div class="row-acts"><button class="icon-btn" data-act="drsView" data-id="${esc(d.id)}" aria-label="View">${ic('eye')}</button><button class="icon-btn" data-act="drsDl" data-id="${esc(d.id)}" aria-label="Download">${ic('download')}</button><button class="icon-btn" data-act="drsEdit" data-id="${esc(d.id)}" aria-label="Edit">${ic('edit')}</button><button class="icon-btn danger" data-act="drsDel" data-id="${esc(d.id)}" aria-label="Delete">${ic('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function filterDrs(all) {
  const q = D.q.trim().toLowerCase();
  return all.filter(d => (!q || String(d.drsNumber).toLowerCase().includes(q)) && (!D.emp || d.empId === D.emp) && (!D.from || d.drsDate >= D.from) && (!D.to || d.drsDate <= D.to));
}

async function viewDrs(_, seq) {
  const [emps, all] = await Promise.all([loadEmps(), DB.all('drs')]);
  const em = emap(emps), withDrs = emps.filter(e => e.status !== 'archived' || all.some(d => d.empId === e.id));
  if (!paint(seq, `<div class="page-head"><div><h1>DRS Copy Management</h1><p class="sub">${all.length} ${all.length === 1 ? 'copy' : 'copies'} stored for ${new Set(all.map(d => d.empId)).size} employees. Each employee has a separate folder.</p></div>
  <div class="acts"><button class="btn" data-act="drsExport">${ic('download')}Export CSV</button><button class="btn primary" data-act="drsAdd">${ic('upload')}Upload DRS</button></div></div>
  <div class="toolbar"><div class="search">${ic('search')}<input id="dq" type="search" placeholder="Search by DRS number" value="${esc(D.q)}" aria-label="Search DRS number"></div>
  <select id="de" aria-label="Employee"><option value="">All employees</option>${withDrs.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select>
  <label class="f">From<input type="date" id="df" value="${D.from}"></label><label class="f">To<input type="date" id="dt" value="${D.to}"></label>
  <label class="f" style="flex:0 0 auto;flex-direction:row;align-items:center;gap:8px;min-height:40px"><input type="checkbox" id="dg" ${D.group ? 'checked' : ''} style="width:18px;min-height:18px"> Group by employee</label></div><div id="dl"></div>`)) return;
  $('#de').value = D.emp;
  const draw = () => {
    const rows = filterDrs(all).sort((a, b) => b.drsDate.localeCompare(a.drsDate) || natural(b.drsNumber, a.drsNumber));
    if (!all.length) { $('#dl').innerHTML = `<div class="card empty"><b>No DRS copies yet</b>Upload a PDF or photo of a DRS and it will be filed under the employee.<br><button class="btn primary" data-act="drsAdd">Upload first DRS</button></div>`; return; }
    if (!rows.length) { $('#dl').innerHTML = '<div class="card empty"><b>No DRS copies match</b>Change the search, employee or date filters.</div>'; return; }
    if (!D.group) { $('#dl').innerHTML = `<div class="card">${drsTable(rows, em, true)}</div>`; return; }
    const groups = new Map(); rows.forEach(d => { if (!groups.has(d.empId)) groups.set(d.empId, []); groups.get(d.empId).push(d); });
    $('#dl').innerHTML = [...groups.keys()].sort((a, b) => natural(em.get(a)?.code || '~', em.get(b)?.code || '~')).map(id => { const e = em.get(id), l = groups.get(id); return `<div class="card"><div class="group-h">${who(e)}<span class="badge info">${l.length} ${l.length === 1 ? 'copy' : 'copies'}</span></div>${drsTable(l, em, false)}</div>`; }).join('');
  };
  const dv = (id, k, date) => $('#' + id)[date || id === 'dq' ? 'oninput' : 'onchange'] = e => { if (date && e.target.value && !isDate(e.target.value)) return; D[k] = e.target.value; draw(); };
  dv('dq', 'q'); dv('de', 'emp'); dv('df', 'from', true); dv('dt', 'to', true);
  $('#dg').onchange = e => { D.group = e.target.checked; draw(); };
  draw();
}

async function drsForm({ id, empId } = {}) {
  const [emps, all] = await Promise.all([loadEmps(), DB.all('drs')]);
  const cur = id ? all.find(d => d.id === id) : null;
  if (id && !cur) return toast('That DRS record no longer exists.', 'bad');
  const pickable = emps.filter(e => e.status !== 'archived' || (cur && cur.empId === e.id));
  if (!pickable.length) { toast('Add an employee before uploading a DRS.', 'bad'); location.hash = '#/employees'; return; }
  const selId = cur ? cur.empId : (empId && pickable.some(e => e.id === empId) ? empId : '');
  const suggest = eid => { const mine = all.filter(d => d.empId === eid).map(d => String(d.drsNumber).toLowerCase()); let n = mine.length + 1; while (mine.includes(String(n).padStart(3, '0'))) n++; return String(n).padStart(3, '0'); };
  const m = modal(cur ? 'Edit DRS details' : 'Upload DRS copy', `<form id="df2" novalidate><div class="fields c2">
    <label class="f span2">Employee *<select id="d-emp" ${cur || empId ? 'disabled' : ''}>${selId ? '' : '<option value="">Choose employee…</option>'}${pickable.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select></label>
    <label class="f">DRS number *<input type="text" id="d-num" maxlength="40" value="${esc(cur ? cur.drsNumber : (selId ? suggest(selId) : ''))}"></label>
    <label class="f">DRS date *<input type="date" id="d-date" value="${esc(cur ? cur.drsDate : todayISO())}"></label>
    <label class="f span2">Description / remarks<textarea id="d-rem" maxlength="400">${esc(cur ? cur.remarks : '')}</textarea></label>
    <label class="f span2">${cur ? 'Replace file (optional)' : 'Document *'} \u2014 PDF, JPG, JPEG or PNG, up to 25 MB<input type="file" id="d-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label>
    ${cur ? `<p class="muted small span2">Current file: ${esc(cur.fileName)} (${fmtBytes(cur.fileSize || 0)})</p>` : ''}</div>
    <div class="err" id="derr" role="alert"></div><div class="actions"><button type="button" class="btn" data-no>Cancel</button><button class="btn primary">${cur ? 'Save changes' : 'Upload'}</button></div></form>`);
  if (selId) $('#d-emp', m).value = selId;
  let touched = !!cur; $('#d-num', m).oninput = () => touched = true;
  $('#d-emp', m).onchange = e => { if (!touched && e.target.value) $('#d-num', m).value = suggest(e.target.value); };
  $('[data-no]', m).onclick = m.close;
  $('#df2', m).onsubmit = async ev => {
    ev.preventDefault();
    const err = t => { $('#derr', m).textContent = t; };
    const eid = cur ? cur.empId : $('#d-emp', m).value, num = $('#d-num', m).value.trim(), date = $('#d-date', m).value, f = $('#d-file', m).files[0];
    if (!eid) return err('Choose the employee this DRS belongs to.');
    if (!num) return err('Enter the DRS number.');
    if (all.some(d => d.empId === eid && d.id !== (cur && cur.id) && String(d.drsNumber).toLowerCase() === num.toLowerCase())) return err(`This employee already has DRS ${num}. Use a different number.`);
    if (!isDate(date)) return err('The DRS date is not a valid date.');
    const btn = $('button.primary', m); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const now = Date.now(); let type = cur && cur.fileType, fileRec = null;
      if (f || !cur) {
        type = await checkFile(f);
        fileRec = { id: cur ? cur.id : null, blob: new Blob([await f.arrayBuffer()], { type }), name: f.name, type, size: f.size };
      }
      const rec = { id: cur ? cur.id : uid(), empId: eid, drsNumber: num, drsDate: date, uploadDate: cur ? cur.uploadDate : todayISO(), uploadedAt: cur ? cur.uploadedAt : now, remarks: $('#d-rem', m).value.trim(), fileName: fileRec ? fileRec.name : cur.fileName, fileType: type, fileSize: fileRec ? fileRec.size : cur.fileSize, updatedAt: now };
      if (fileRec) fileRec.id = rec.id;
      await DB.saveDrs(rec, fileRec);
      m.close(); toast(cur ? 'DRS details saved.' : 'DRS copy uploaded.'); changed();
    } catch (x) { btn.disabled = false; btn.textContent = cur ? 'Save changes' : 'Upload'; err(x.name === 'QuotaExceededError' ? 'This device is out of storage. Free some space and try again.' : x.message); }
  };
}

async function drsView(id) {
  const [d, f] = await Promise.all([DB.get('drs', id), DB.get('files', id)]);
  if (!d) return toast('That DRS record no longer exists.', 'bad');
  const e = await DB.get('employees', d.empId);
  const title = `DRS ${d.drsNumber} \u00b7 ${e ? e.name : 'Unknown employee'}`;
  if (!f || !f.blob) {
    const m = modal(title, `<div class="empty"><b>The file for this record is missing</b>The details were saved but the document isn\u2019t in this device\u2019s storage (it may have been cleared by the browser). Upload it again to repair this record.</div><div class="actions"><button class="btn" data-no>Close</button><button class="btn primary" data-fix>Upload file again</button></div>`);
    $('[data-no]', m).onclick = m.close; $('[data-fix]', m).onclick = () => { m.close(); drsForm({ id }); }; return;
  }
  const url = URL.createObjectURL(f.blob), isPdf = f.type === 'application/pdf';
  const m = modal(title, `<div class="vbar"><button class="btn sm" data-dl>${ic('download')}Download</button><a class="btn sm" href="${url}" target="_blank" rel="noopener">${ic('eye')}Open in new tab</a>
    <span class="muted small" style="align-self:center">${fmtDate(d.drsDate)} \u00b7 ${esc(f.name)} \u00b7 ${fmtBytes(f.size || 0)}${d.remarks ? ' \u00b7 ' + esc(d.remarks) : ''}</span></div>
    <div class="vframe">${isPdf ? `<object data="${url}" type="application/pdf" aria-label="PDF preview"><div class="empty"><b>PDF preview isn\u2019t available in this browser</b>Use Open in new tab or Download to read it.</div></object>` : `<img src="${url}" alt="${esc(title)}" id="vimg">`}</div>`, { cls: 'viewer', onClose: () => URL.revokeObjectURL(url), noFocus: true });
  $('[data-dl]', m).onclick = () => drsDownload(id);
  const img = $('#vimg', m); if (img) img.onclick = () => img.classList.toggle('zoom');
}

async function drsDownload(id) {
  const [d, f] = await Promise.all([DB.get('drs', id), DB.get('files', id)]);
  if (!d || !f || !f.blob) return toast('This file is missing from device storage.', 'bad');
  const e = await DB.get('employees', d.empId);
  download(f.blob, `${safeName(e ? e.code : 'EMP')}_DRS-${safeName(d.drsNumber)}.${extOf(d) || (f.type === 'application/pdf' ? 'pdf' : 'jpg')}`);
}

async function drsDelete(id) {
  const d = await DB.get('drs', id); if (!d) return;
  const e = await DB.get('employees', d.empId);
  if (!await confirmBox({ title: 'Delete DRS copy?', message: `Permanently delete DRS <b>${esc(d.drsNumber)}</b> for ${esc(e ? e.name : 'this employee')}? The uploaded document will be erased from this device.`, ok: 'Delete', danger: true })) return;
  try { await DB.deleteDrs(id); toast('DRS copy deleted.'); changed(); } catch (x) { fail(x, 'Delete failed'); }
}

/* ---------- reports ---------- */
const RTYPES = [['daily', 'Daily attendance', 'Attendance'], ['weekly', 'Weekly attendance', 'Attendance'], ['monthly', 'Monthly attendance (all employees)', 'Attendance'], ['employee', 'Employee-wise attendance', 'Attendance'], ['presentabsent', 'Present / Absent summary', 'Attendance'],
  ['drs-summary', 'Total DRS copies', 'DRS'], ['drs-employee', 'Employee-wise DRS count', 'DRS'], ['drs-date', 'Date-wise DRS records', 'DRS'], ['drs-history', 'Searchable DRS history', 'DRS']];
const RFIELDS = { daily: ['date'], weekly: ['date'], monthly: ['month'], employee: ['emp', 'month'], presentabsent: ['from', 'to'], 'drs-summary': [], 'drs-employee': [], 'drs-date': ['from', 'to'], 'drs-history': ['q'] };
const R = { type: 'monthly', date: todayISO(), month: todayISO().slice(0, 7), emp: '', from: todayISO().slice(0, 8) + '01', to: todayISO(), q: '' };
let lastReport = null;

async function gridReport(dates, weekly) {
  const emps = (await loadEmps()).filter(e => e.status !== 'archived');
  const recs = (await DB.all('attendance')).filter(r => r.date >= dates[0] && r.date <= dates[dates.length - 1]);
  const map = new Map(recs.map(r => [r.empId + '|' + r.date, r]));
  const cols = ['ID', 'Employee', ...dates.map(d => weekly ? `${DOW[dow(d)]} ${+d.slice(8)}` : String(+d.slice(8))), 'P', 'A', 'Half', 'Leave', 'Hol', '%'];
  const rows = emps.map(e => {
    const mine = [];
    const cells = dates.map(d => { const r = map.get(e.id + '|' + d); if (r) mine.push(r); return r ? CODE[r.status] : '\u00b7'; });
    const s = summarize(mine);
    return [e.code, e.name, ...cells, s.Present, s.Absent, s['Half Day'], s.Leave, s.Holiday, s.pct + '%'];
  });
  return { cols, rows, dense: true, sub: 'P present · A absent · H half day · L leave · HD holiday · · not marked. % = (present + half × 0.5) ÷ working days marked.' };
}

async function buildReport() {
  const t = R.type;
  if (t === 'daily') {
    if (!isDate(R.date)) return { error: 'Pick a valid date.' };
    const [emps, recs] = await Promise.all([loadEmps(), DB.byIndex('attendance', 'date', R.date)]); const rm = new Map(recs.map(r => [r.empId, r]));
    const list = emps.filter(e => e.status === 'active'), s = summarize(list.map(e => rm.get(e.id)).filter(Boolean));
    return { title: 'Daily attendance report', sub: `${fmtDate(R.date)} (${DOW[dow(R.date)]}) · Present ${s.Present} · Half day ${s['Half Day']} · Absent ${s.Absent} · Leave ${s.Leave} · Holiday ${s.Holiday} · Not marked ${list.filter(e => !rm.has(e.id)).length}`, cols: ['ID', 'Employee', 'Status', 'Check-in', 'Check-out', 'Remarks'], rows: list.map(e => { const r = rm.get(e.id) || {}; return [e.code, e.name, r.status || 'Not marked', r.checkIn || '', r.checkOut || '', r.remarks || '']; }) };
  }
  if (t === 'weekly') {
    if (!isDate(R.date)) return { error: 'Pick a valid date.' };
    const mon = addDays(R.date, -((dow(R.date) + 6) % 7)), dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i)), g = await gridReport(dates, true);
    return { title: 'Weekly attendance report', ...g, sub: `${fmtDate(dates[0])} to ${fmtDate(dates[6])}. ${g.sub}` };
  }
  if (t === 'monthly') {
    if (!isMonth(R.month)) return { error: 'Pick a valid month.' };
    const g = await gridReport(monthDays(R.month), false); return { title: 'Monthly attendance report', ...g, sub: `${monthLabel(R.month)}. ${g.sub}` };
  }
  if (t === 'employee') {
    if (!isMonth(R.month)) return { error: 'Pick a valid month.' };
    const emps = (await loadEmps()).filter(e => e.status !== 'archived'); if (!emps.length) return { error: 'Add an employee first.' };
    const e = emps.find(x => x.id === R.emp) || emps[0]; R.emp = e.id;
    const recs = (await DB.byIndex('attendance', 'empId', e.id)).filter(r => monthOf(r.date) === R.month), rm = new Map(recs.map(r => [r.date, r])), s = summarize(recs);
    return { title: `Attendance report: ${e.name} (${e.code})`, sub: `${monthLabel(R.month)} · Present ${s.Present} · Absent ${s.Absent} · Half day ${s['Half Day']} · Leave ${s.Leave} · Holiday ${s.Holiday} · Attendance ${s.pct}%`, cols: ['Date', 'Day', 'Status', 'Check-in', 'Check-out', 'Remarks'], rows: monthDays(R.month).map(d => { const r = rm.get(d) || {}; return [fmtDate(d), DOW[dow(d)], r.status || 'Not marked', r.checkIn || '', r.checkOut || '', r.remarks || '']; }) };
  }
  if (t === 'presentabsent') {
    if (!isDate(R.from) || !isDate(R.to) || R.from > R.to) return { error: 'Pick a valid date range (From must not be after To).' };
    const [emps, all] = await Promise.all([loadEmps(), DB.all('attendance')]); const recs = all.filter(r => r.date >= R.from && r.date <= R.to);
    return { title: 'Present / Absent report', sub: `${fmtDate(R.from)} to ${fmtDate(R.to)}`, cols: ['ID', 'Employee', 'Present', 'Absent', 'Half day', 'Leave', 'Holiday', 'Attendance %'], rows: emps.filter(e => e.status !== 'archived').map(e => { const s = summarize(recs.filter(r => r.empId === e.id)); return [e.code, e.name, s.Present, s.Absent, s['Half Day'], s.Leave, s.Holiday, s.pct + '%']; }) };
  }
  const [emps, drs] = await Promise.all([loadEmps(), DB.all('drs')]), em = emap(emps), nm = id => em.get(id) ? em.get(id).name : 'Unknown', cd = id => em.get(id) ? em.get(id).code : '';
  if (t === 'drs-summary') {
    const mk = todayISO().slice(0, 7), size = drs.reduce((a, d) => a + (d.fileSize || 0), 0);
    return { title: 'DRS summary', sub: `As of ${fmtDate(todayISO())}`, cols: ['Measure', 'Value'], rows: [['Total DRS copies', drs.length], ['Employees with DRS copies', new Set(drs.map(d => d.empId)).size], ['DRS dated this month', drs.filter(d => monthOf(d.drsDate) === mk).length], ['Uploaded this month', drs.filter(d => (d.uploadDate || '').startsWith(mk)).length], ['PDF files', drs.filter(d => d.fileType === 'application/pdf').length], ['Image files', drs.filter(d => (d.fileType || '').startsWith('image/')).length], ['Storage used by DRS files', fmtBytes(size)]] };
  }
  if (t === 'drs-employee') {
    return { title: 'Employee-wise DRS count', sub: `${drs.length} copies in total`, cols: ['ID', 'Employee', 'DRS copies', 'Latest DRS date'], rows: emps.filter(e => e.status !== 'archived' || drs.some(d => d.empId === e.id)).map(e => { const l = drs.filter(d => d.empId === e.id); return [e.code, e.name + (e.status === 'archived' ? ' (archived)' : ''), l.length, l.length ? fmtDate(l.map(d => d.drsDate).sort().pop()) : '—']; }) };
  }
  if (t === 'drs-date') {
    if ((R.from && !isDate(R.from)) || (R.to && !isDate(R.to)) || (R.from && R.to && R.from > R.to)) return { error: 'Pick a valid date range (From must not be after To).' };
    const l = drs.filter(d => (!R.from || d.drsDate >= R.from) && (!R.to || d.drsDate <= R.to)).sort((a, b) => b.drsDate.localeCompare(a.drsDate) || natural(cd(a.empId), cd(b.empId)));
    return { title: 'Date-wise DRS records', sub: `${R.from ? fmtDate(R.from) : 'Start'} to ${R.to ? fmtDate(R.to) : 'today'} · ${l.length} records`, cols: ['DRS date', 'ID', 'Employee', 'DRS no.', 'Uploaded', 'Remarks'], rows: l.map(d => [fmtDate(d.drsDate), cd(d.empId), nm(d.empId), d.drsNumber, fmtDate(d.uploadDate), d.remarks || '']) };
  }
  const q = R.q.trim().toLowerCase();
  const l = drs.filter(d => !q || [d.drsNumber, d.remarks, d.fileName, nm(d.empId), cd(d.empId)].some(x => String(x || '').toLowerCase().includes(q))).sort((a, b) => b.drsDate.localeCompare(a.drsDate));
  return { title: 'DRS history', sub: `${l.length} of ${drs.length} records${q ? ` matching \u201c${R.q.trim()}\u201d` : ''}`, cols: ['DRS date', 'ID', 'Employee', 'DRS no.', 'File', 'Uploaded', 'Remarks'], rows: l.map(d => [fmtDate(d.drsDate), cd(d.empId), nm(d.empId), d.drsNumber, d.fileName || '', fmtDate(d.uploadDate), d.remarks || '']) };
}

async function viewReports(arg, seq) {
  if (RTYPES.some(t => t[0] === arg)) R.type = arg;
  const emps = (await loadEmps()).filter(e => e.status !== 'archived');
  const F = RFIELDS[R.type];
  const field = (k, h) => F.includes(k) ? h : '';
  if (!paint(seq, `<div class="page-head"><div><h1>Reports</h1><p class="sub">View on screen, export to CSV, or print / save as PDF.</p></div><div class="acts"><button class="btn" data-act="repCsv">${ic('download')}Export CSV</button><button class="btn primary" data-act="repPrint">${ic('print')}Print / PDF</button></div></div>
  <div class="toolbar"><label class="f">Report<select id="rt">${['Attendance', 'DRS'].map(g => `<optgroup label="${g}">${RTYPES.filter(t => t[2] === g).map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</optgroup>`).join('')}</select></label>
  ${field('date', `<label class="f">Date<input type="date" id="r-date" value="${R.date}"></label>`)}${field('month', `<label class="f">Month<input type="month" id="r-month" value="${R.month}"></label>`)}
  ${field('emp', `<label class="f">Employee<select id="r-emp">${emps.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.code)})</option>`).join('')}</select></label>`)}
  ${field('from', `<label class="f">From<input type="date" id="r-from" value="${R.from}"></label>`)}${field('to', `<label class="f">To<input type="date" id="r-to" value="${R.to}"></label>`)}
  ${field('q', `<label class="f">Search<input type="search" id="r-q" value="${esc(R.q)}" placeholder="DRS number, employee, remarks"></label>`)}</div><div class="card" id="rout"><div class="boot" style="min-height:120px"><div class="spinner"></div></div></div>`)) return;
  $('#rt').value = R.type;
  $('#rt').onchange = e => { R.type = e.target.value; render(); };
  const draw = async () => {
    let rep; try { rep = await buildReport(); } catch (e) { rep = { error: e.message }; }
    if (seq !== renderSeq) return;
    lastReport = rep.error ? null : rep;
    $('#rout').innerHTML = rep.error ? `<div class="empty"><b>${esc(rep.error)}</b></div>` : `<div class="rep-head"><h2>${esc(S.settings.company || S.settings.appName)}</h2></div><h2>${esc(rep.title)}</h2><p class="muted small">${esc(rep.sub || '')}</p><p class="rep-head small">Generated ${new Date().toLocaleString()}</p>` + (rep.rows.length ? `<div class="scroll"><table class="tbl ${rep.dense ? 'dense' : 'cards'}"><thead><tr>${rep.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rep.rows.map(r => `<tr>${r.map((v, i) => { const cl = rep.dense && i > 1 ? Object.entries(CODE).find(x => x[1] === v) : null; return `<td data-label="${esc(rep.cols[i])}" ${cl ? `class="cell-${v}"` : ''}>${esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No data for this report</b>Nothing matches these settings yet.</div>');
  };
  const bind = (k, valid) => { const el = $('#r-' + k); if (el) el[k === 'q' ? 'oninput' : 'onchange'] = e => { if (valid && e.target.value && !valid(e.target.value)) return toast('That value is not valid.', 'bad'); R[k] = e.target.value; draw(); }; };
  bind('date', isDate); bind('month', isMonth); bind('emp'); bind('from', isDate); bind('to', isDate); bind('q');
  const re = $('#r-emp'); if (re) re.value = R.emp || (emps[0] && emps[0].id) || '';
  draw();
}
function repCsv() { if (!lastReport) return toast('There is no report to export.', 'bad'); exportCSV(lastReport.title, lastReport.cols, lastReport.rows); }
function repPrint() { if (!lastReport) return toast('There is no report to print.', 'bad'); document.title = lastReport.title; window.print(); setTimeout(applySettings, 500); }
async function drsExportCsv() {
  const [emps, all] = await Promise.all([loadEmps(), DB.all('drs')]), em = emap(emps), l = filterDrs(all).sort((a, b) => b.drsDate.localeCompare(a.drsDate));
  if (!l.length) return toast('No DRS records to export.', 'bad');
  exportCSV('DRS-records', ['Employee ID', 'Employee', 'DRS no.', 'DRS date', 'Upload date', 'File', 'Remarks'], l.map(d => [em.get(d.empId)?.code || '', em.get(d.empId)?.name || 'Unknown', d.drsNumber, fmtDate(d.drsDate), fmtDate(d.uploadDate), d.fileName || '', d.remarks || '']));
}

/* ---------- backup & restore ---------- */
async function doBackup() {
  const [employees, attendance, drs, files, app] = await Promise.all([DB.all('employees'), DB.all('attendance'), DB.all('drs'), DB.all('files'), DB.get('settings', 'app')]);
  const fm = new Map(files.map(f => [f.id, f])), em = emap(employees), entries = []; let missing = 0;
  const drsOut = drs.map(d => {
    const f = fm.get(d.id);
    if (!f || !f.blob) { missing++; return { ...d, file: null }; }
    const path = `drs-files/${safeName(em.get(d.empId)?.code || 'unknown')}/${d.id}-${safeName(f.name)}`;
    entries.push({ name: path, data: f.blob });
    return { ...d, file: { path, name: f.name, type: f.type, size: f.size } };
  });
  const data = { app: 'employee-drs-manager', version: 1, exportedAt: new Date().toISOString(), counts: { employees: employees.length, attendance: attendance.length, drs: drs.length }, employees, attendance, drs: drsOut, settings: app || null };
  entries.unshift({ name: 'data.json', data: JSON.stringify(data) });
  entries.push({ name: 'README.txt', data: 'Backup made by Employee & DRS Manager.\r\ndata.json holds employees, attendance and DRS details. drs-files/ holds the uploaded documents (one folder per employee ID).\r\nRestore it from Settings > Data > Restore backup.\r\n' });
  const blob = await Zip.createZip(entries);
  download(blob, `EDM-backup-${todayISO()}.zip`);
  S.settings.lastBackup = new Date().toISOString(); await DB.put('settings', S.settings);
  toast(missing ? `Backup saved. ${missing} DRS record(s) had no file to include.` : 'Backup saved to your downloads.');
  return blob;
}

function validateBackup(d) {
  if (!d || d.app !== 'employee-drs-manager') throw new Error('This is not a backup made by Employee & DRS Manager.');
  if (d.version !== 1) throw new Error('This backup was made by a different version of the app and can\u2019t be read here.');
  if (!Array.isArray(d.employees) || !Array.isArray(d.attendance) || !Array.isArray(d.drs)) throw new Error('The backup is missing employee, attendance or DRS data.');
  const ids = new Set(), codes = new Set();
  d.employees.forEach((e, i) => {
    if (!e || !e.id || !e.code || !e.name) throw new Error(`Employee #${i + 1} in the backup is incomplete.`);
    if (ids.has(e.id)) throw new Error('The backup contains a duplicate employee.');
    if (codes.has(String(e.code).toLowerCase())) throw new Error(`The backup contains employee ID ${e.code} twice.`);
    ids.add(e.id); codes.add(String(e.code).toLowerCase());
  });
  const keys = new Set();
  d.attendance.forEach((a, i) => {
    if (!a || !a.id || !ids.has(a.empId) || !isDate(a.date) || !STATUSES.includes(a.status)) throw new Error(`Attendance record #${i + 1} in the backup is invalid.`);
    const k = a.empId + '|' + a.date; if (keys.has(k)) throw new Error('The backup contains duplicate attendance for one employee on one date.'); keys.add(k);
  });
  d.drs.forEach((r, i) => { if (!r || !r.id || !ids.has(r.empId) || !r.drsNumber || !isDate(r.drsDate)) throw new Error(`DRS record #${i + 1} in the backup is invalid.`); });
}

async function handleRestore(file) {
  try {
    if (!file) return;
    const z = await Zip.readZip(file), raw = await z.get('data.json');
    if (!raw) throw new Error('This ZIP has no data.json, so it is not a backup from this app.');
    let data; try { data = JSON.parse(new TextDecoder().decode(raw)); } catch (_) { throw new Error('The backup\u2019s data.json is damaged.'); }
    validateBackup(data);
    const files = [];
    for (const d of data.drs) {
      if (!d.file) continue;
      const bytes = await z.get(d.file.path);
      if (!bytes) throw new Error(`The file for DRS ${d.drsNumber} is missing from the ZIP.`);
      files.push({ id: d.id, blob: new Blob([bytes], { type: d.file.type }), name: d.file.name, type: d.file.type, size: bytes.length });
    }
    const drs = data.drs.map(({ file: _f, ...r }) => r);
    const m = modal('Restore this backup?', `<p>The backup holds <b>${data.employees.length}</b> employees, <b>${data.attendance.length}</b> attendance records and <b>${drs.length}</b> DRS copies${data.exportedAt ? ` (saved ${new Date(data.exportedAt).toLocaleString()})` : ''}.</p>
      <p class="note warn"><b>Restoring replaces everything currently stored on this device.</b> If anything fails, your current data stays as it is.</p>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="rsafe" checked style="width:18px;min-height:18px">Download a backup of the current data first</label>
      <div class="actions"><button class="btn" data-no>Cancel</button><button class="btn danger" data-go>Replace with this backup</button></div>`, { sticky: true, noFocus: true });
    $('[data-no]', m).onclick = m.close;
    $('[data-go]', m).onclick = async () => {
      const b = $('[data-go]', m); b.disabled = true; b.textContent = 'Restoring…';
      try {
        if ($('#rsafe', m).checked) await doBackup();
        const app = { ...DEFAULTS, ...(data.settings || {}), key: 'app' };
        await DB.replaceAll({ employees: data.employees, attendance: data.attendance, drs, files, settings: [app, Auth.cfg] });
        S.settings = app; applySettings(); m.close(); toast('Backup restored.'); changed();
      } catch (e) { m.close(); restoreFailed(e); }
    };
  } catch (e) { restoreFailed(e); }
}
function restoreFailed(e) {
  console.error(e);
  const m = modal('Restore failed', `<p>${esc(e.name === 'QuotaExceededError' ? 'This device does not have enough free storage for the backup.' : e.message || e)}</p><p class="muted">Your current data was not changed.</p><div class="actions"><button class="btn primary" data-no>OK</button></div>`);
  $('[data-no]', m).onclick = m.close;
}

/* ---------- settings ---------- */
function applySettings() {
  const t = S.settings.theme, dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.title = S.settings.appName || DEFAULTS.appName;
  if ($('#view')) { const b = $('.brand span'), c = $('.brand small'); if (b) b.textContent = S.settings.appName; if (c) c.textContent = S.settings.company || 'Admin console'; }
}
async function saveSettings(patch) { S.settings = { ...S.settings, ...patch }; await DB.put('settings', S.settings); applySettings(); }

async function viewSettings(_, seq) {
  const s = S.settings;
  const [emps, att, drs] = await Promise.all([DB.all('employees'), DB.all('attendance'), DB.all('drs')]);
  let est = ''; try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); est = `${fmtBytes(e.usage || 0)} used of about ${fmtBytes(e.quota || 0)} available`; } } catch (_) {}
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  if (!paint(seq, `<div class="page-head"><div><h1>Settings</h1></div></div>
  <div class="card"><h2>Application</h2><form id="sf1"><div class="fields c2"><label class="f">Application name<input type="text" id="s-app" value="${esc(s.appName)}" maxlength="60" required></label><label class="f">Company name<input type="text" id="s-co" value="${esc(s.company)}" maxlength="80"></label></div><div class="actions"><button class="btn primary">Save</button></div></form></div>
  <div class="card"><h2>Appearance and format</h2><div class="fields c2"><label class="f">Theme<select id="s-theme"><option value="light">Light (white and navy)</option><option value="dark">Dark navy</option><option value="auto">Match my device</option></select></label>
  <label class="f">Date format<select id="s-df"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label></div></div>
  <div class="card"><h2>Administrator</h2><form id="sf2" autocomplete="off"><div class="fields c2"><label class="f">Administrator name<input type="text" id="s-an" value="${esc(s.adminName)}" maxlength="80"></label><label class="f">Email<input type="email" id="s-ae" value="${esc(s.adminEmail)}" maxlength="120"></label>
  <label class="f">Login username<input type="text" id="s-user" value="${esc(Auth.cfg.username)}" maxlength="40" autocomplete="off"></label><span></span>
  <label class="f">New password (leave blank to keep)<input type="password" id="s-pw" autocomplete="new-password"></label><label class="f">Confirm new password<input type="password" id="s-pw2" autocomplete="new-password"></label>
  <label class="f span2">Current password (needed to change username or password)<input type="password" id="s-cur" autocomplete="current-password"></label></div><div class="err" id="s-err" role="alert"></div><div class="actions"><button class="btn primary">Save administrator</button></div></form>
  <p class="note warn" style="margin-top:10px"><b>Security note:</b> this login runs entirely in the browser. It keeps casual users out of the screen but is <b>not secure</b> for a public or multi-user business system \u2014 anyone with access to the device can read the data. Use it only on devices you control, and add server-side authentication before sharing it widely (the app is structured around a single Auth object for that purpose).</p></div>
  <div class="card"><h2>Data and backup</h2><p><b>${emps.length}</b> employees · <b>${att.length}</b> attendance records · <b>${drs.length}</b> DRS copies${est ? ` · ${esc(est)}` : ''}</p>
  <p class="note">All data and DRS files are stored <b>only in this browser on this device</b> (IndexedDB). It is <b>not synced</b> to other phones or computers, and clearing browser data or uninstalling can erase it. ${persisted ? 'The browser has marked this storage as persistent.' : 'The browser has not marked storage as persistent, so keep regular backups.'}</p>
  <p class="muted small">Last backup: ${s.lastBackup ? new Date(s.lastBackup).toLocaleString() : 'never'}</p>
  <div class="actions" style="justify-content:flex-start"><button class="btn primary" data-act="backup">${ic('download')}Download backup (ZIP)</button><button class="btn" data-act="restore">${ic('upload')}Restore backup…</button><input type="file" id="rfile" accept=".zip,application/zip" hidden></div></div>
  <div class="card"><h2>Install on your phone</h2><p>${deferredPrompt ? '' : 'On Android Chrome open the \u22ee menu and choose <b>Install app</b> (or <b>Add to Home screen</b>). '}The app then opens full screen and works offline.</p>${deferredPrompt ? `<button class="btn primary" data-act="install">${ic('download')}Install app</button>` : ''}</div>`)) return;
  $('#s-theme').value = s.theme; $('#s-df').value = s.dateFormat;
  $('#sf1').onsubmit = async e => { e.preventDefault(); const n = $('#s-app').value.trim(); if (!n) return toast('Enter an application name.', 'bad'); try { await saveSettings({ appName: n, company: $('#s-co').value.trim() }); toast('Settings saved.'); } catch (x) { fail(x, 'Save failed'); } };
  $('#s-theme').onchange = async e => { try { await saveSettings({ theme: e.target.value }); } catch (x) { fail(x, 'Save failed'); } };
  $('#s-df').onchange = async e => { try { await saveSettings({ dateFormat: e.target.value }); toast('Date format updated.'); } catch (x) { fail(x, 'Save failed'); } };
  $('#rfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; handleRestore(f); };
  $('#sf2').onsubmit = async e => {
    e.preventDefault(); const err = t => { $('#s-err').textContent = t; }; err('');
    const user = $('#s-user').value.trim(), pw = $('#s-pw').value, pw2 = $('#s-pw2').value, cur = $('#s-cur').value;
    try {
      const credChange = pw || user.toLowerCase() !== Auth.cfg.username.toLowerCase();
      if (!user) return err('Enter a login username.');
      if (credChange) {
        if (pw && pw.length < 6) return err('The new password must be at least 6 characters.');
        if (pw !== pw2) return err('The new passwords do not match.');
        if (await Auth.hash(cur, Auth.cfg.salt) !== Auth.cfg.hash) return err('The current password is not correct.');
        await Auth.changeCredentials(user, pw || cur);
      }
      await saveSettings({ adminName: $('#s-an').value.trim(), adminEmail: $('#s-ae').value.trim() });
      toast('Administrator details saved.'); $('#s-pw').value = $('#s-pw2').value = $('#s-cur').value = '';
    } catch (x) { fail(x, 'Save failed'); }
  };
}

/* ---------- actions + boot ---------- */
const ACT = {
  empAdd: () => empForm(), empEdit: el => empForm(el.dataset.id), empDelete: el => empDelete(el.dataset.id),
  empRestore: async el => { try { const e = await DB.get('employees', el.dataset.id); if (e) { await DB.put('employees', { ...e, status: 'active', updatedAt: Date.now() }); toast('Employee restored.'); changed(); } } catch (x) { fail(x, 'Restore failed'); } },
  drsAdd: el => drsForm({ empId: el.dataset.emp || undefined }), drsView: el => drsView(el.dataset.id), drsDl: el => drsDownload(el.dataset.id),
  drsEdit: el => drsForm({ id: el.dataset.id }), drsDel: el => drsDelete(el.dataset.id), drsExport: drsExportCsv,
  attEdit: el => attEdit(el.dataset.emp, el.dataset.date), attRow: el => attRow(el), attBulk,
  repCsv, repPrint, backup: () => doBackup(), restore: () => $('#rfile').click(),
  logout: () => { Auth.logout(); $('#app').innerHTML = ''; showLogin(); },
  install: async () => { if (!deferredPrompt) return toast('Use the browser menu \u22ee \u2192 Install app.'); deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; syncInstall(); }
};
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || !ACT[el.dataset.act]) return;
  e.preventDefault();
  try { await ACT[el.dataset.act](el); } catch (x) { fail(x, 'Action failed'); }
});

async function boot() {
  try {
    await DB.open();
    const saved = await DB.get('settings', 'app');
    S.settings = { ...DEFAULTS, ...(saved || {}) };
    await Auth.init(); applySettings();
  } catch (e) {
    console.error(e);
    $('#app').innerHTML = `<main class="login"><div class="login-card"><h2>Storage isn\u2019t available</h2><p>${esc(e.message)}</p><p class="muted small">This app saves data in your browser. Private/incognito windows or strict privacy settings can block that. Open it in a normal Chrome window and reload.</p><button class="btn primary" onclick="location.reload()">Reload</button></div></main>`;
    return;
  }
  window.addEventListener('hashchange', render);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applySettings);
  await render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('Service worker not registered', err));
}
boot();
})();
