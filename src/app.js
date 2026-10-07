(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POSTER = { electric: '#2036FF', flare: '#EE1F6E', violet: '#6A1FFF', ember: '#F04A12' };
const PVAR = { electric: 'var(--pe)', flare: 'var(--pf)', violet: 'var(--pv)', ember: 'var(--pm)' };
const TONE_NAMES = { electric: 'Electric blue', flare: 'Hot pink', violet: 'Violet', ember: 'Ember orange' };
const OLD_TONE = { marigold: 'ember', rose: 'flare', sky: 'electric', mint: 'violet' };
const FOIL = ['#2036FF', '#00A3FF', '#00BFA5', '#7A2BFF', '#FF2E7E', '#FF7A1A', '#2036FF'];
const INK = '#0A0E2A', MUTED = '#555A7B';
const ADMIN_CODE = '2026';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GW = {
  paystack: { name: 'Paystack', blurb: 'Cards, bank transfer and USSD', color: '#0AA5DB', methods: ['Card', 'Bank transfer', 'USSD'], card: '4084 0840 8408 4081', exp: '12/30', cvv: '408', ref: 'PSK' },
  flutterwave: { name: 'Flutterwave', blurb: 'Cards, bank transfer and mobile money', color: '#E8890C', methods: ['Card', 'Bank transfer', 'Mobile money'], card: '5531 8866 5214 2950', exp: '09/32', cvv: '564', ref: 'FLW' },
  stripe: { name: 'Stripe', blurb: 'International cards', color: '#635BFF', methods: ['Card'], card: '4242 4242 4242 4242', exp: '12/34', cvv: '123', ref: 'STR' }
};
const rnd = (n, a = ALPHA) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => a[x % a.length]).join('');
const uid = p => p + rnd(10).toLowerCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const naira = n => '₦' + Number(n || 0).toLocaleString('en-NG');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDay = ms => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const fmtFull = ms => `${fmtDay(ms)}, ${fmtTime(ms)}`;
const until = ms => { const s = Math.max(0, ms - Date.now()) / 1000, d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)}m`; };
const fmtCode = c => String(c || '').replace(/^(.{4})(.{4})$/, '$1-$2');
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const toLocalInput = ms => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800); }

/* ---------- store: shared database when available, this device otherwise ---------- */
const COLS = ['events', 'tickets', 'orders', 'passes', 'users', 'hosts'];
const blank = () => ({ events: {}, tickets: {}, orders: {}, passes: {}, users: {}, hosts: {} });
const S = { ready: false, mode: 'loading', db: null, data: blank() };
let rq = 0;
function onStoreChange() { if (rq) return; rq = setTimeout(() => { rq = 0; render(false); }, 40); }
function mapDocs(snap) { const m = {}; snap.docs.forEach(d => { const v = d.data(); if (v) m[d.id] = { ...v, id: d.id }; }); return m; }
async function initStore() {
  let db = null;
  try { if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db'); } catch {}
  if (db) {
    S.db = db; S.mode = 'cloud';
    let pending = COLS.length;
    const settle = () => { if (--pending <= 0) { S.ready = true; onStoreChange(); } };
    COLS.forEach(c => {
      let first = true;
      db.collection(c).limit(1000).onSnapshot(
        snap => { S.data[c] = mapDocs(snap); if (first) { first = false; settle(); } else onStoreChange(); },
        () => { if (first) { first = false; settle(); } }
      );
    });
  } else {
    S.mode = 'local';
    S.data = Object.assign(blank(), ls.get('sg:data', {}));
    S.ready = true;
    window.addEventListener('storage', e => { if (e.key === 'sg:data') { S.data = Object.assign(blank(), ls.get('sg:data', {})); onStoreChange(); } });
    onStoreChange();
  }
}
const saveLocal = () => ls.set('sg:data', S.data);
async function resync(col) { if (S.mode !== 'cloud') return; try { S.data[col] = mapDocs(await S.db.collection(col).limit(1000).get()); } catch {} }
async function put(col, id, doc) {
  const clean = JSON.parse(JSON.stringify(doc)); delete clean.id;
  S.data[col] = { ...S.data[col], [id]: { ...clean, id } };
  if (S.mode === 'cloud') { try { await S.db.collection(col).doc(id).set(clean); } catch (e) { await resync(col); throw e; } } else saveLocal();
  onStoreChange();
}
async function patch(col, id, part) {
  const cur = S.data[col][id]; if (!cur) throw new Error('missing');
  S.data[col] = { ...S.data[col], [id]: { ...cur, ...part } };
  if (S.mode === 'cloud') { try { await S.db.collection(col).doc(id).update(part); } catch (e) { await resync(col); throw e; } } else saveLocal();
  onStoreChange();
}
async function del(col, id) {
  const next = { ...S.data[col] }; delete next[id]; S.data[col] = next;
  if (S.mode === 'cloud') { try { await S.db.collection(col).doc(id).delete(); } catch (e) { await resync(col); throw e; } } else saveLocal();
  onStoreChange();
}
async function run(fn) {
  try { await fn(); }
  catch (e) { console.error(e); U.pay = null; toast(S.mode === 'cloud' ? "That didn't save. You may have view-only access to this page." : "That didn't save. Try again."); render(true); }
}

/* ---------- derived data ---------- */
const events = () => Object.values(S.data.events).sort((a, b) => a.startsAt - b.startsAt);
const ticketsOf = eid => Object.values(S.data.tickets).filter(t => t.eventId === eid);
const passesOf = eid => Object.values(S.data.passes).filter(p => p.eventId === eid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.label).localeCompare(String(b.label)));
const tone = e => POSTER[e.tone] ? e.tone : (OLD_TONE[e.tone] || 'electric');
const pc = e => PVAR[tone(e)];
const tiersOf = e => Array.isArray(e.tiers) ? e.tiers : [];
const tierOf = (e, id) => tiersOf(e).find(t => t.id === id) || { name: 'Ticket', price: 0, qty: 0 };
const sold = (eid, tierId) => ticketsOf(eid).filter(t => !t.voided && (!tierId || t.tierId === tierId)).length;
const hoursBefore = e => Number(e.releaseHours) || 12;
const releaseAt = e => e.startsAt - hoursBefore(e) * 3600e3;
const released = e => !!e.releasedEarly || Date.now() >= releaseAt(e);
const started = e => Date.now() >= e.startsAt;
const ended = e => Date.now() > e.startsAt + 8 * 3600e3;
const boughtBy = (eid, email) => ticketsOf(eid).filter(t => !t.voided && t.buyerEmail === email).length;
const maxTransfers = e => e.maxTransfers == null ? 1 : Number(e.maxTransfers);
const canTransfer = (t, e) => !t.voided && !t.checkedInAt && (t.transfers || 0) < maxTransfers(e) && !started(e);
const qrText = t => `EN1:${t.code}:${t.secret}`;
const sigOf = t => { const h = cyrb53(`${t.id}|${t.secret}|showgate`).toUpperCase(); return h.slice(0, 4) + '-' + h.slice(4, 8); };
function stats(e) {
  const ts = ticketsOf(e.id).filter(t => !t.voided);
  return { ts, cap: tiersOf(e).reduce((a, t) => a + Number(t.qty || 0), 0), revenue: ts.reduce((a, t) => a + Number(t.price || 0), 0), inCount: ts.filter(t => t.checkedInAt).length, transfers: ts.reduce((a, t) => a + (t.transfers || 0), 0) };
}

/* ---------- ui state ---------- */
const FEE = 5;
// Which site this page is: set by <html data-site="...">, or by a real subdomain (host.*, checkin.*). Unset = prototype with the switcher bar.
const LOCK = (() => { const d = document.documentElement.dataset.site, h = location.hostname; return ['main', 'host', 'gate'].includes(d) ? d : /^host\./.test(h) ? 'host' : /^checkin\./.test(h) ? 'gate' : null; })();
const U = { site: LOCK || (['main', 'host', 'gate'].includes(ls.get('en:site', 'main')) ? ls.get('en:site', 'main') : 'main'), view: 'shows', eventId: null, cart: {}, pay: null, me: ls.get('en:me', null), mineTab: 'tickets', gate: ls.get('sg:gate', null), scan: null, hostId: ls.get('en:host', null), hview: 'shows', staff: !!ls.get('en:staff', false), auth: { mode: 'in' }, adminEvent: null, adminTab: 'overview', q: '', tq: '' };
function go(view, o = {}) { Object.assign(U, o, { view }); render(true); window.scrollTo(0, 0); }
function hgo(hview, o = {}) { Object.assign(U, o, { hview }); render(true); window.scrollTo(0, 0); }
const pwHash = (email, pw) => cyrb53(`${email}|${pw}|entrava-demo`, 7);
const findBy = (col, email) => Object.values(S.data[col]).find(x => x.email === email) || null;
const host = () => (U.hostId && S.data.hosts[U.hostId]) || null;
const hostOf = e => (e.hostId && S.data.hosts[e.hostId]) || null;
const hostEvents = h => events().filter(e => e.hostId === h.id);
const onSale = () => events().filter(e => !ended(e) && (!e.hostId || (hostOf(e) && hostOf(e).status === 'active')));
const planText = h => h.plan === 'paid' ? `Paid tickets, ${FEE}% management fee per sale` : h.plan === 'free' ? `Free tickets${h.agreedFee ? `, management fee of ${naira(h.agreedFee)} agreed` : ', management fee to be agreed'}` : 'No tickets on sale yet';
function hostStats(h) {
  const evs = hostEvents(h); let sold = 0, gross = 0, inCount = 0;
  evs.forEach(e => { const st = stats(e); sold += st.ts.length; gross += st.revenue; inCount += st.inCount; });
  const fee = h.plan === 'paid' ? Math.round(gross * FEE / 100) : 0;
  return { evs, sold, gross, fee, payout: gross - fee, inCount };
}

/* ---------- theme ---------- */
const ICON = {
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>`,
  tick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
};
const themeNow = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function themeSync() { const d = themeNow() === 'dark', b = $('#theme-btn'); b.innerHTML = d ? ICON.sun : ICON.moon; b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); }

/* ---------- seal of authenticity: a rosette drawn from each ticket's secret ---------- */
function sealPaths(sig) {
  const h = cyrb53(sig, 11), b = i => parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
  const n = 7 + Math.floor(b(0) * 8), m = 2 + Math.floor(b(1) * 4), k = 5 + Math.floor(b(2) * 3), out = [];
  const ring = (steps, fn) => { let d = ''; for (let i = 0; i <= steps; i++) { const th = i / steps * Math.PI * 2, r = fn(th); d += (i ? 'L' : 'M') + (100 + r * Math.cos(th)).toFixed(1) + ' ' + (100 + r * Math.sin(th)).toFixed(1); } return d + 'Z'; };
  for (let L = 0; L < k; L++) { const ph = L / k * Math.PI * 2; out.push(ring(240, th => 59 + 17 * Math.cos(n * th + ph) * (.6 + .4 * Math.sin(m * th + b(3) * 6.283)))); }
  for (let L = 0; L < 3; L++) { const ph = L / 3 * Math.PI * 2; out.push(ring(180, th => 35 + 6 * Math.cos((n + 4) * th + ph))); }
  return out;
}
function sealHTML(sig, key, cls = '') {
  const id = 'sr' + String(key).replace(/[^a-zA-Z0-9_-]/g, ''), txt = `AUTHENTIC TICKET \u00B7 SEAL ${sig} \u00B7 `.repeat(2);
  return `<div class="seal ${cls}" role="img" aria-label="Seal of authenticity ${esc(sig)}"><svg viewBox="0 0 200 200" aria-hidden="true"><defs><path id="${id}" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"/></defs><g fill="none" stroke="#fff" stroke-width=".8" opacity=".92">${sealPaths(sig).map(d => `<path d="${d}"/>`).join('')}</g><text fill="#fff" font-size="8.6" font-weight="700" letter-spacing="1.5"><textPath href="#${id}">${esc(txt)}</textPath></text><circle cx="100" cy="100" r="25" fill="#fff"/><path d="M88.5 100.5l8 8 15.5-17" fill="none" stroke="#2036FF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}
(() => { let p = []; for (let i = 0; i < 180; i++) { const th = i / 180 * Math.PI * 2, r = 48.4 + 1.6 * Math.cos(30 * th); p.push(`${(50 + r * Math.cos(th)).toFixed(2)}% ${(50 + r * Math.sin(th)).toFixed(2)}%`); } document.documentElement.style.setProperty('--scallop', `polygon(${p.join(',')})`); })();

/* ---------- posters: beams drawn from each show's id ---------- */
function posterArt(e) {
  const h = cyrb53(String(e.id || e.title)), b = i => parseInt(h.slice((i % 8) * 2, (i % 8) * 2 + 2), 16) / 255;
  let s = '';
  for (let i = 0; i < 6; i++) s += `<i class="bm" style="left:${(6 + b(i) * 88).toFixed(1)}%;--w:${(14 + b(i + 1) * 22).toFixed(1)}%;--r:${((b(i + 2) - .5) * 46).toFixed(1)}deg;--o:${(.07 + b(i + 3) * .12).toFixed(2)};--d:${(4.5 + b(i + 4) * 5).toFixed(1)}s;--dl:-${(b(i + 5) * 6).toFixed(1)}s"></i>`;
  s += `<i class="gl" style="left:${(15 + b(6) * 70).toFixed(0)}%;top:${(72 + b(7) * 24).toFixed(0)}%"></i>`;
  return `<div class="beams" aria-hidden="true">${s}</div>`;
}

/* ---------- hero: an arena rendered live in 3D ---------- */
const Arena = (() => {
  let st = null, wanted = false, raf = 0, loading = false, failed = false, inView = true, clock = 7, last = 0, qn = 0, qt = 0, qlevel = 0, skip = 0;
  const pref = ls.get('sg:motion', null);
  let paused = pref ? pref === 'off' : matchMedia('(prefers-reduced-motion: reduce)').matches;
  function make() {
    const T = window.THREE, cv = $('#arena');
    const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    const scene = new T.Scene(); scene.background = new T.Color(0x04051a); scene.fog = new T.FogExp2(0x04051a, 0.0105);
    const cam = new T.PerspectiveCamera(52, 2, 0.1, 320);
    const lite = Math.min(window.innerWidth, window.innerHeight) < 620 ? .6 : 1, R = Math.random;
    const add = m => (scene.add(m), m);
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
    const glowTex = new T.CanvasTexture(gc);
    // floor and light spill
    const floor = add(new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshBasicMaterial({ color: 0x05071f }))); floor.rotation.x = -Math.PI / 2;
    const wash = add(new T.Mesh(new T.PlaneGeometry(70, 48), new T.MeshBasicMaterial({ map: glowTex, color: 0x2a44ff, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false }))); wash.rotation.x = -Math.PI / 2; wash.position.set(0, .05, -2);
    // stage, runway, truss
    const dark = new T.MeshBasicMaterial({ color: 0x0a0d2e }), edge = new T.MeshBasicMaterial({ color: 0x7388ff, fog: false });
    const box = (w, h, d, x, y, z, m = dark) => { const b = add(new T.Mesh(new T.BoxGeometry(w, h, d), m)); b.position.set(x, y, z); return b; };
    box(27, 1.8, 9, 0, .9, -15.5); box(27, .16, .16, 0, 1.84, -10.95, edge);
    box(8, 1.3, 12, 0, .65, -5.5); box(.14, .14, 12, -4, 1.34, -5.5, edge); box(.14, .14, 12, 4, 1.34, -5.5, edge); box(8, .14, .14, 0, 1.34, .5, edge);
    box(31, .5, .5, 0, 15.2, -11); box(31, .5, .5, 0, 15.2, -18.5);
    [-15.2, 15.2].forEach(x => { box(.5, 15.2, .5, x, 7.6, -11); box(.5, 15.2, .5, x, 7.6, -18.5); });
    // LED walls
    const wallMat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform float uTime;varying vec2 vUv;
        void main(){vec2 uv=vUv;float cols=56.0;float cx=floor(uv.x*cols)/cols;
        float h=0.18+0.7*abs(sin(cx*41.0+uTime*1.7)*sin(cx*13.0-uTime*1.1));
        float bar=smoothstep(h,h-0.04,uv.y);
        float cell=step(0.14,fract(uv.x*cols))*step(0.16,fract(uv.y*26.0));
        vec3 blue=vec3(0.13,0.22,1.0),pink=vec3(1.0,0.18,0.5);
        vec3 col=mix(blue,pink,smoothstep(0.15,0.95,uv.y+0.25*sin(uTime*0.6+uv.x*3.0)));
        float pulse=0.75+0.25*sin(uTime*3.2);
        gl_FragColor=vec4(col*(0.10+1.25*bar*pulse)*cell,1.0);}`
    });
    add(new T.Mesh(new T.PlaneGeometry(27, 11.5), wallMat)).position.set(0, 7.8, -19.8);
    [-1, 1].forEach(s => { const m = add(new T.Mesh(new T.PlaneGeometry(8.5, 10), wallMat)); m.position.set(s * 20.5, 8.2, -17.2); m.rotation.y = -s * .55; });
    // halo ring above the floor
    const halo = add(new T.Mesh(new T.TorusGeometry(15, .11, 8, 120), edge)); halo.rotation.x = Math.PI / 2; halo.position.set(0, 21, 8);
    // crowd: floor standing, two tiers of seats, roof lights
    const P = [], C = [], PH = [], SZ = [];
    const dot = (x, y, z, s) => { P.push(x, y, z); const r = R(); const c = r < .74 ? [.86, .9, 1] : r < .9 ? [.3, .45, 1] : [1, .28, .58]; C.push(c[0], c[1], c[2]); PH.push(R()); SZ.push(s || .6 + R() * 1.1); };
    for (let i = 0; i < 2800 * lite; i++) { const x = (R() * 2 - 1) * 18, z = -9 + R() * 30; if (Math.abs(x) < 4.6 && z < 1.2) continue; dot(x, .8 + R() * .5, z); }
    for (let i = 0; i < 7800 * lite; i++) {
      const a = R() * Math.PI * 2, dz = Math.sin(a), dx = Math.cos(a); if (dz < -.8) continue;
      const tier = R() < .42 ? 0 : 1, u = Math.floor(R() * 12) / 12, r = tier ? 35 + u * 13 : 22.5 + u * 9.5, y = tier ? 9.5 + u * 10 : 1.8 + u * 5.8;
      dot(dx * r, y, dz * r + 4);
    }
    for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; dot(Math.cos(a) * 36, 25, Math.sin(a) * 34 + 4, 2.4); }
    const cg = new T.BufferGeometry();
    cg.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    cg.setAttribute('aColor', new T.BufferAttribute(new Float32Array(C), 3));
    cg.setAttribute('aPhase', new T.BufferAttribute(new Float32Array(PH), 1));
    cg.setAttribute('aSize', new T.BufferAttribute(new Float32Array(SZ), 1));
    const crowdMat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `attribute vec3 aColor;attribute float aPhase;attribute float aSize;uniform float uTime;uniform float uScale;varying vec3 vCol;varying float vA;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);
        float tw=0.5+0.5*sin(uTime*(1.1+aPhase*2.2)+aPhase*40.0);
        float wave=0.5+0.5*sin(position.x*0.16+position.z*0.07-uTime*0.9);
        float k=0.35+0.4*tw+0.45*wave*wave;
        vCol=aColor;vA=k*smoothstep(1.5,7.0,-mv.z)*exp(-0.00028*mv.z*mv.z);
        gl_PointSize=min(aSize*uScale*(150.0/-mv.z)*(0.7+0.5*k),26.0*uScale);
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vCol;varying float vA;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.05,d);gl_FragColor=vec4(vCol,a*vA);}`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    add(new T.Points(cg, crowdMat));
    // haze behind the stage
    [[0x2a44ff, 0, 9, -21, 74, .5], [0xff2e7e, -16, 12, -22, 44, .22], [0xff2e7e, 17, 13, -22, 44, .2]].forEach(([c, x, y, z, s, o]) => { const h = add(new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, fog: false }))); h.position.set(x, y, z); h.scale.set(s, s * .6, 1); });
    // light beams
    const beamMat = (color, len) => new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uI: { value: .4 }, uLen: { value: len } },
      vertexShader: `uniform float uLen;varying float vH;varying vec3 vN;varying vec3 vV;void main(){vH=clamp(-position.y/uLen,0.0,1.0);vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 uColor;uniform float uI;varying float vH;varying vec3 vN;varying vec3 vV;void main(){float rim=pow(abs(dot(normalize(vN),normalize(vV))),1.6);float a=pow(1.0-vH,1.7)*rim*uI;gl_FragColor=vec4(uColor,a);}`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    const cone = (r, len) => { const g = new T.ConeGeometry(r, len, 28, 1, true); g.translate(0, -len / 2, 0); return g; };
    const gFront = cone(3.4, 52), gBack = cone(2.6, 44), cols = [0xffffff, 0x4d6bff, 0xff3d8a], beams = [];
    const beam = (geo, len, x, y, z, color, bx, bz, ax, az, i) => {
      const m = add(new T.Mesh(geo, beamMat(color, len))); m.position.set(x, y, z);
      const g = add(new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }))); g.position.set(x, y, z); g.scale.set(3.2, 3.2, 1);
      beams.push({ m, g, bx, bz, ax, az, sp: .22 + R() * .2, ph: R() * 6.283, i });
    };
    for (let k = 0; k < 9; k++) { const x = -13 + k * 3.25; beam(gFront, 52, x, 14.8, -11, cols[k % 3], -.95, x * -.012, .3, .36, .62); }
    for (let k = 0; k < 6; k++) { const x = -11 + k * 4.4; beam(gBack, 44, x, 2.2, -18, cols[(k + 1) % 3], Math.PI + .32, (k - 2.5) * .2, .2, .22, .52); }
    function draw(t) {
      crowdMat.uniforms.uTime.value = t; wallMat.uniforms.uTime.value = t;
      beams.forEach(b => {
        b.m.rotation.x = b.bx + Math.sin(t * b.sp + b.ph) * b.ax; b.m.rotation.z = b.bz + Math.sin(t * b.sp * .73 + b.ph * 1.9) * b.az;
        const k = .62 + .38 * Math.sin(t * 1.1 + b.ph * 3.1); b.m.material.uniforms.uI.value = b.i * k; b.g.material.opacity = .5 + .5 * k;
      });
      const p = t / 48 * Math.PI * 2;
      cam.position.set(Math.sin(p) * 13, 11 + Math.sin(p * 2 + 1) * 2.2, 35 - (1 - Math.cos(p)) * 5);
      cam.lookAt(Math.sin(p) * 4, 6.6, -14);
      renderer.render(scene, cam);
    }
    function quality() { renderer.setPixelRatio(1); }
    function size(w, h) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1 ? 72 : 56; cam.updateProjectionMatrix(); crowdMat.uniforms.uScale.value = renderer.getPixelRatio() * Math.max(.7, h / 760); }
    return { draw, size, quality };
  }
  function label() { $('#hero-pause').textContent = paused ? 'Play motion' : 'Pause motion'; }
  function size() { if (!st) return; const h = $('#hero'), w = h.clientWidth, hh = h.clientHeight; if (!w || !hh) return; st.size(w, hh); st.draw(clock); }
  function loop(now) {
    raf = 0; if (!st || !wanted || paused || !inView || document.hidden) return;
    const gap = now - last; clock += Math.min(.05, gap / 1000 || 0); last = now; st.draw(clock);
    if (skip > 0) skip--; else { qn++; qt += gap; }
    if (qn >= 16 || qt > 2400) {
      const avg = qt / Math.max(1, qn); qn = 0; qt = 0;
      if (avg > 46 && qlevel === 0) { qlevel = 1; st.quality(); size(); skip = 3; }
      else if (avg > 80 && qlevel === 1) { paused = true; label(); return; }
    }
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (st && !raf && wanted && !paused && inView && !document.hidden) { last = performance.now(); skip = 4; qn = 0; qt = 0; raf = requestAnimationFrame(loop); } }
  function boot() {
    if (st || failed) return;
    try { st = make(); } catch (e) { failed = true; console.warn('3D arena unavailable', e); return; }
    $('#hero').classList.add('arena-on'); $('#hero-pause').hidden = false; label(); size(); kick();
  }
  function load() {
    if (st) return kick(); if (failed || loading) return; if (window.THREE) return boot();
    loading = true; const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
    s.onload = () => { loading = false; boot(); }; s.onerror = () => { loading = false; failed = true; }; document.head.append(s);
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe($('#hero')); else window.addEventListener('resize', size);
  if (window.IntersectionObserver) new IntersectionObserver(es => { inView = es[0].isIntersecting; kick(); }).observe($('#hero'));
  document.addEventListener('visibilitychange', kick);
  return { want(v) { wanted = v; if (v) load(); }, toggle() { paused = !paused; ls.set('sg:motion', paused ? 'off' : 'on'); label(); kick(); } };
})();
const isHome = () => U.site === 'main' && (!U.me || U.view === 'shows');
function topSync() { const hero = $('#hero'); $('#top').classList.toggle('over', isHome() && window.scrollY < hero.offsetHeight - 40); }
function heroSync() {
  const home = isHome(), n = $('#hero-next'), cta = $('#hero-cta'), key = U.me ? 'in' : 'out';
  $('#hero').hidden = !home;
  if (home) {
    if (cta.dataset.k !== key) {
      cta.dataset.k = key;
      cta.innerHTML = U.me ? `<button class="btn btn-lg" data-act="scrollTo" data-to="onsale">See what's on</button><button class="btn btn-lg btn-line" data-act="scrollTo" data-to="secure">How tickets are secured</button>` : `<button class="btn btn-lg" data-act="auth" data-mode="up">Create your account</button><button class="btn btn-lg btn-line" data-act="auth" data-mode="in">Sign in</button>`;
      $('#hero-sub').textContent = U.me ? 'Every ticket carries its own seal and a QR code that opens once. Buy in a minute, walk in with one scan.' : 'Every ticket carries its own seal and a QR code that opens once. Sign in to see what is on and keep your tickets in one account.';
    }
    const up = S.ready && U.me ? onSale().filter(e => !started(e))[0] : null;
    n.hidden = !up;
    if (up) n.innerHTML = `<small>Next show, starts in ${until(up.startsAt)}</small><h2>${esc(up.title)}</h2><p>${fmtFull(up.startsAt)}</p><p>${esc(up.venue)}, ${esc(up.city)}</p><button class="btn" data-act="event" data-id="${esc(up.id)}">Get tickets</button>`;
  }
  Arena.want(home); topSync();
}

/* ---------- scroll reveal: each block pops in whenever it scrolls into view ---------- */
const Seen = new Set(), Dir = new Map();
const rvCls = key => Seen.has(key) ? ' in' : Dir.get(key) === 'up' ? ' up' : '';
const RV = window.IntersectionObserver ? new IntersectionObserver(es => es.forEach(en => {
  const el = en.target, k = el.dataset.rv, box = en.boundingClientRect, vis = en.intersectionRect;
  if (en.isIntersecting) {
    if (vis.height < box.height - 2) Dir.set(k, vis.top > box.top + 1 ? 'up' : 'down');
    if (en.intersectionRatio >= .12 || vis.height > 260) { el.classList.add('in'); Seen.add(k); }
  } else {
    const up = Dir.has(k) ? Dir.get(k) === 'up' : box.bottom < 0;
    Dir.set(k, up ? 'up' : 'down'); el.classList.toggle('up', up); el.classList.remove('in'); Seen.delete(k);
  }
}), { threshold: [0, .04, .12, .3, .6] }) : null;
const SL = window.IntersectionObserver ? new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('run', en.isIntersecting))) : null;
function watchReveals() {
  const els = $$('[data-rv]'), seals = $$('.seal');
  if (!RV) { els.forEach(el => el.classList.add('in')); seals.forEach(el => el.classList.add('run')); return; }
  RV.disconnect(); els.forEach(el => RV.observe(el));
  SL.disconnect(); seals.forEach(el => SL.observe(el));
}

/* ---------- the ticket ---------- */
function passHTML(e, t, stub, cls = '') {
  const tier = tierOf(e, t.tierId), sig = sigOf(t), micro = `Entrava authentic ticket \u00B7 seal ${sig} \u00B7 `.repeat(9);
  return `<div class="pass-wrap"><article class="pass ${cls}" style="--pc:${pc(e)}">
    <div class="pass-main">
      <div class="pass-band"><span>Entrava</span><span>${esc(tier.name)} / Admit one</span></div>
      <div class="pass-body"><div><h3 class="pass-title">${esc(e.title)}</h3>
        <div class="pass-facts"><div><span>Name</span><b>${esc(t.holderName)}</b></div><div><span>When</span><b>${fmtFull(e.startsAt)}</b></div><div><span>Where</span><b>${esc(e.venue)}, ${esc(e.city)}</b></div><div><span>Seal</span><b>${sig}</b></div></div></div>
        ${sealHTML(sig, t.id)}</div>
      <div class="micro" aria-hidden="true">${esc(micro)}</div>
    </div>
    <div class="pass-stub">${stub}</div>
  </article></div>`;
}
const liveClock = `<span class="live" data-live></span>`;

/* ---------- shows ---------- */
function eventCard(e, big, i) {
  const st = stats(e), left = st.cap - st.ts.length, prices = tiersOf(e).map(t => Number(t.price)), closed = started(e), out = left <= 0;
  return `<article class="card rv${big ? ' big' : ''}${rvCls('ev:' + e.id)}" data-rv="ev:${esc(e.id)}" style="--i:${Math.min(i, 3)}">
    ${closed || out ? '' : `<button class="card-hit" data-act="event" data-id="${esc(e.id)}" aria-label="Get tickets for ${esc(e.title)}"></button>`}
    <div class="poster" style="--pc:${pc(e)}">${posterArt(e)}<span class="poster-day"><b>${new Date(e.startsAt).getDate()}</b>${new Date(e.startsAt).toLocaleDateString('en-GB', { month: 'short' })}</span><span class="poster-title">${esc(e.title)}</span></div>
    <div class="card-body"><p class="card-date">${fmtFull(e.startsAt)}</p><p>${esc(e.venue)}, ${esc(e.city)}</p><p>${esc(e.artist)}</p>
      <div class="card-foot"><span class="price"><small>${prices.length && Math.min(...prices) ? 'From' : 'Entry'}</small><b>${prices.length && Math.min(...prices) ? naira(Math.min(...prices)) : 'Free'}</b></span>${closed ? `<span class="chip">Sales closed</span>` : out ? `<span class="chip bad">Sold out</span>` : `<span class="btn" aria-hidden="true">Get tickets</span>`}</div>
    </div>
  </article>`;
}
function secureHTML(up) {
  const se = up[0] || { id: 'specimen', title: 'Your show', venue: 'Main arena', city: 'Abuja', startsAt: Date.now() + 9 * 864e5, tone: 'electric', tiers: [{ id: 't1', name: 'Regular' }] };
  const st = { id: 'specimen', tierId: tiersOf(se)[0] ? tiersOf(se)[0].id : 't1', holderName: 'Your name here', code: 'SPECIMEN', secret: 'SPECIMEN0000' };
  return `<section class="sec" id="secure" aria-labelledby="secure-h"><div class="secure">
    <div class="specimen rv soft${rvCls('specimen')}" data-rv="specimen">${passHTML(se, st, `<div class="qr" data-qr="ENTRAVA SPECIMEN"></div><span class="code">SPEC-IMEN</span>${liveClock}`)}</div>
    <div class="rv soft${rvCls('facts')}" data-rv="facts" style="--i:1"><h2 class="h-sec" id="secure-h">Built so a fake never gets through</h2>
      <ul class="facts" style="margin-top:28px">
        <li><b>A seal nobody else can print</b><span>Each ticket carries a seal drawn from its own secret key. The gate scanner draws the same seal, so staff match the two at a glance.</span></li>
        <li><b>A QR code that opens once</b><span>It is sent 12 hours before the show and admits one person. A copy scanned second is refused, with the time and lane of the first scan.</span></li>
        <li><b>Transfers cancel the old code</b><span>Send a ticket to a friend and it is issued again in their name. The original stops working at that moment.</span></li>
        <li><b>A live ticket, not a screenshot</b><span>On screen the foil moves and the clock runs. A still image is easy to spot.</span></li>
      </ul></div>
  </div></section>
  <section class="payband rv soft${rvCls('payband')}" data-rv="payband" aria-label="Payments and wallets">
    <div><h2>Pay the way you already pay</h2><p>Checkout runs on the gateway you choose, in naira or by international card.</p><div class="tags"><span>Paystack</span><span>Flutterwave</span><span>Stripe</span></div></div>
    <div><h2>Keep it in your phone's wallet</h2><p>Add your ticket to your phone so it is ready at the gate.</p><div class="tags"><span>Apple Wallet</span><span>Google Wallet</span></div></div>
  </section>`;
}
function showsView() {
  const up = onSale();
  return `<section id="onsale" aria-labelledby="onsale-h">
    <div class="sec-head"><h2 class="h-sec" id="onsale-h">On sale now</h2>${up.length ? `<p class="sub" style="margin:0">${plural(up.length, 'show')} with tickets available</p>` : ''}</div>
    ${up.length ? `<div class="grid">${up.map((e, i) => eventCard(e, i === 0, i)).join('')}</div>` : `<div class="panel empty"><p>No shows are on sale yet. New shows appear here as soon as a host puts them up.</p></div>`}
  </section>` + secureHTML(up);
}
function landingView() {
  return `<section id="onsale" class="rv soft${rvCls('wall')}" data-rv="wall" aria-labelledby="wall-h">
    <h2 class="h-sec" id="wall-h">Sign in to see what's on</h2>
    <p class="sub">Shows, prices and every ticket you buy live inside your account.</p>
    <div class="bar-r" style="margin-top:24px"><button class="btn btn-lg" data-act="auth" data-mode="up">Create your account</button><button class="btn btn-lg btn-quiet" data-act="auth" data-mode="in">Sign in</button></div>
  </section>` + secureHTML([]);
}
const GMARK = `<span class="gmark" aria-hidden="true">G</span>`;
const googleBtn = who => `<button type="button" class="btn btn-quiet gbtn" data-act="google" data-who="${who}">${GMARK}Continue with Google</button><div class="or"><span>or</span></div>`;
function authDlg(mode) {
  const up = mode === 'up';
  openDlg(`<h2>${up ? 'Create your account' : 'Sign in'}</h2><p class="sub" style="margin-bottom:16px">${up ? 'One account holds every ticket you buy or receive.' : 'Welcome back.'}</p>
    ${googleBtn('user')}
    <form data-form="${up ? 'userUp' : 'userIn'}">
      ${up ? `<label for="u-name">Full name</label><input id="u-name" name="name" autocomplete="name" required>` : ''}
      <label for="u-email">Email</label><input id="u-email" name="email" type="email" autocomplete="email" required>
      <label for="u-pw">Password</label><input id="u-pw" name="pw" type="password" ${up ? 'minlength="8"' : ''} required>
      ${up ? `<p class="help">At least 8 characters. Prototype sign-in: use a made-up password, not a real one.</p>` : ''}
      <p class="form-err" id="dlg-err" role="alert"></p>
      <button class="btn btn-lg" style="width:100%">${up ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="help" style="margin-top:14px">${up ? `Already have an account? <button class="link" data-act="auth" data-mode="in">Sign in</button>` : `New here? <button class="link" data-act="auth" data-mode="up">Create an account</button>`}</p>`);
}
function googleDlg(who) {
  openDlg(`<form data-form="googleGo"><h2>Continue with Google</h2><input type="hidden" name="who" value="${who === 'host' ? 'host' : 'user'}">
    <p class="sub">A demo of Google sign-in. On the live site Google's own account window opens here.</p>
    <label for="g-mail">Google account email</label><input id="g-mail" name="email" type="email" required autocomplete="email">
    <label for="g-name">Name on the account</label><input id="g-name" name="name" required autocomplete="name">
    <p class="form-err" id="dlg-err" role="alert"></p>
    <div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Cancel</button><button class="btn">Continue</button></div></form>`);
}
function accountDlg() {
  if (!U.me) return;
  openDlg(`<h2>Your account</h2><dl class="kv"><dt>Name</dt><dd>${esc(U.me.name || '')}</dd><dt>Email</dt><dd>${esc(U.me.email)}</dd></dl>
    <div class="dlg-act"><button class="btn btn-quiet" data-act="signOut">Sign out</button><button class="btn" data-act="closeDlg">Done</button></div>`);
}
function loginUser(u) { U.me = { id: u.id, name: u.name, email: u.email }; ls.set('en:me', U.me); closeDlg(); go('shows', { cart: {}, pay: null }); toast(`Signed in as ${u.email}.`); }

/* ---------- show page ---------- */
const cartQty = () => Object.values(U.cart).reduce((a, n) => a + n, 0);
const cartTotal = e => tiersOf(e).reduce((a, t) => a + (U.cart[t.id] || 0) * Number(t.price), 0);
function eventView() {
  const e = S.data.events[U.eventId];
  if (!e) return `<div class="narrow-page"><button class="back" data-act="go" data-view="shows">‹ All shows</button><p>This show is no longer available.</p></div>`;
  const had = U.me ? boughtBy(e.id, U.me.email) : 0, allow = Math.max(0, Number(e.maxPerBuyer) - had), qty = cartQty(), closed = started(e);
  return `<button class="back" data-act="go" data-view="shows">‹ All shows</button>
  <section class="showhead" style="--pc:${pc(e)}">${posterArt(e)}
    <p>${fmtFull(e.startsAt)}</p><h1>${esc(e.title)}</h1><p>${esc(e.artist)}</p><p>${esc(e.venue)}, ${esc(e.city)}</p>
  </section>
  <div class="cols">
    <section class="panel" aria-labelledby="choose"><h2 id="choose">Choose tickets</h2>
      <p class="sub" style="margin-bottom:14px">${closed ? 'Sales closed when the show started.' : `Up to ${plural(Number(e.maxPerBuyer), 'ticket')} per person.${had ? ` You have already bought ${had}.` : ''}`}</p>
      ${tiersOf(e).map(t => { const left = Number(t.qty) - sold(e.id, t.id), n = U.cart[t.id] || 0; return `<div class="tier">
        <div><div class="tier-name">${esc(t.name)}</div><div>${Number(t.price) ? naira(t.price) : 'Free'} ${left <= 0 ? `<span class="chip bad">Sold out</span>` : left <= 20 ? `<span class="chip warn">Only ${left} left</span>` : ''}</div></div>
        <div class="stepper"><button data-act="qty" data-tier="${esc(t.id)}" data-d="-1" aria-label="Remove one ${esc(t.name)} ticket" ${n <= 0 ? 'disabled' : ''}>−</button><output aria-label="${esc(t.name)} tickets">${n}</output><button data-act="qty" data-tier="${esc(t.id)}" data-d="1" aria-label="Add one ${esc(t.name)} ticket" ${closed || n >= left || qty >= allow ? 'disabled' : ''}>+</button></div>
      </div>`; }).join('')}
      <div class="total"><div><span class="sub">Total</span><br><b>${qty && !cartTotal(e) ? 'Free' : naira(cartTotal(e))}</b></div><button class="btn btn-lg" data-act="pay" ${qty && !closed ? '' : 'disabled'}>${qty && !cartTotal(e) ? 'Reserve tickets' : 'Continue to payment'}</button></div>
    </section>
    <aside class="panel" aria-labelledby="how"><h2 id="how">How entry works</h2>
      <ul class="facts" style="margin-top:14px">
        <li><b>${released(e) ? 'QR tickets are out now' : `QR tickets go out ${fmtFull(releaseAt(e))}`}</b><span>${released(e) ? 'Buy now and your ticket appears straight away.' : `That is ${hoursBefore(e)} hours before the show. Until then you hold a confirmed order.`}</span></li>
        <li><b>${maxTransfers(e) ? 'You can send tickets to friends' : 'Tickets cannot be transferred'}</b><span>${maxTransfers(e) ? `Each ticket can be transferred ${maxTransfers(e) === 1 ? 'once' : maxTransfers(e) + ' times'}, to a named email. The old QR code stops working.` : 'The name on the ticket is the person who gets in.'}</span></li>
        <li><b>One scan per ticket</b><span>The gate sees the name, the email, the time of purchase and the seal. A second scan is refused.</span></li>
      </ul>
    </aside>
  </div>`;
}

/* ---------- checkout with gateway demos ---------- */
function cartError(e, name, email) {
  const want = cartQty();
  if (!name) return 'Enter your full name. It is printed on your ticket.';
  if (!validEmail(email)) return 'Enter a full email address, like ada@example.com.';
  if (!want) return 'Add at least one ticket first.';
  if (started(e)) return 'Sales closed when the show started.';
  const had = boughtBy(e.id, email);
  if (had + want > Number(e.maxPerBuyer)) return had ? `This email has already bought ${plural(had, 'ticket')}. The limit for this show is ${e.maxPerBuyer} per person, so you can add ${Math.max(0, e.maxPerBuyer - had)} more.` : `The limit for this show is ${e.maxPerBuyer} tickets per person.`;
  for (const t of tiersOf(e)) { const n = U.cart[t.id] || 0, left = Number(t.qty) - sold(e.id, t.id); if (n > left) return `Only ${left} ${t.name} ticket${left === 1 ? ' is' : 's are'} left. Lower the quantity and try again.`; }
  return '';
}
function checkoutDlg() {
  const e = S.data.events[U.eventId]; if (!e || !U.me) return;
  const p = U.pay || {}, total = cartTotal(e), lines = tiersOf(e).filter(t => U.cart[t.id]).map(t => `<li><span>${U.cart[t.id]} × ${esc(t.name)}</span><b>${t.price ? naira(U.cart[t.id] * t.price) : 'Free'}</b></li>`).join('');
  openDlg(`<form data-form="payDetails"><h2>Checkout</h2>
    <ul class="sum">${lines}<li><span>Total</span><b>${total ? naira(total) : 'Free'}</b></li></ul>
    <label for="c-name">Name on the tickets</label><input id="c-name" name="name" autocomplete="name" required value="${esc(p.name || U.me.name || '')}">
    <label for="c-email">Account email</label><input id="c-email" name="email" type="email" readonly value="${esc(U.me.email)}">
    <p class="help">Your confirmation and QR tickets go to this account.</p>
    ${total ? `<fieldset><legend>Pay with</legend><div class="gw-pick">${Object.entries(GW).map(([k, g], i) => `<label class="gw-opt" style="--gw:${g.color}"><input type="radio" name="gw" value="${k}" ${(p.gw ? p.gw === k : i === 0) ? 'checked' : ''}><span><b>${g.name}</b><small>${g.blurb}</small></span><i aria-hidden="true"></i></label>`).join('')}</div></fieldset>` : ''}
    <p class="form-err" id="dlg-err" role="alert"></p>
    <div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Cancel</button><button class="btn">${total ? 'Continue to payment' : 'Reserve free tickets'}</button></div>
  </form>`);
}
async function placeOrder(e, p, gwKey, method) {
  const now = Date.now(), total = cartTotal(e), g = GW[gwKey], h = hostOf(e), fee = h && h.plan === 'paid' ? Math.round(total * FEE / 100) : 0;
  const order = { id: uid('o_'), ref: 'EN-' + rnd(6), eventId: e.id, hostId: e.hostId || null, buyerId: U.me.id, buyerName: p.name, buyerEmail: p.email, at: now, total, fee, gateway: gwKey, method, txRef: g ? `${g.ref}_test_${rnd(10).toLowerCase()}` : '', items: tiersOf(e).filter(t => U.cart[t.id]).map(t => ({ tierId: t.id, name: t.name, qty: U.cart[t.id], price: Number(t.price) })) };
  await put('orders', order.id, order);
  for (const t of tiersOf(e)) for (let i = 0; i < (U.cart[t.id] || 0); i++) await put('tickets', uid('t_'), newTicket(e, t, order, p.name, p.email, now));
  return order;
}
async function orderDone(msg, sub, email) {
  openDlg(`<div class="gw-wait"><div class="tick">${ICON.tick}</div><div><h2>${msg}</h2><p class="sub">${sub}</p></div></div>`);
  await sleep(1300);
  U.pay = null; closeDlg(); go('mine', { cart: {}, mineTab: 'tickets' }); toast(`Confirmation sent to ${email}.`);
}
function gatewayDlg() {
  const e = S.data.events[U.eventId], p = U.pay; if (!e || !p) return;
  const g = GW[p.gw], method = g.methods[p.method] || g.methods[0], total = cartTotal(e);
  let body, cta = `Pay ${naira(total)}`;
  if (method === 'Card') body = `<label for="g-card">Card number</label><input id="g-card" name="card" inputmode="numeric" autocomplete="off" value="${g.card}">
    <div class="f2"><div><label for="g-exp">Expiry</label><input id="g-exp" name="exp" autocomplete="off" placeholder="MM/YY" value="${g.exp}"></div><div><label for="g-cvv">CVV</label><input id="g-cvv" name="cvv" inputmode="numeric" autocomplete="off" value="${g.cvv}"></div></div>
    <p class="help">${g.name}'s test card is filled in for you.</p>
    <label class="gw-check"><input type="checkbox" name="decline"> Simulate a declined card</label>`;
  else if (method === 'Bank transfer') { body = `<div class="gw-box"><b>Transfer exactly ${naira(total)} to</b><dl><dt>Bank</dt><dd>Demo Bank</dd><dt>Account number</dt><dd>0123456789</dd><dt>Account name</dt><dd>Entrava Checkout</dd></dl></div><p class="help">This account is for the demo. Nothing needs to be sent.</p>`; cta = 'I have sent the money'; }
  else if (method === 'USSD') { body = `<div class="gw-box"><b>Dial this code on your phone</b><dl><dt>Code</dt><dd>*000*000*${total}#</dd></dl></div><p class="help">A demo code. On the live site your bank's real code appears here.</p>`; cta = 'I have completed the payment'; }
  else body = `<label for="g-phone">Mobile money number</label><input id="g-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="0803 000 0000"><p class="help">Demo only. No prompt is sent to this number.</p>`;
  openDlg(`<div style="--gw:${g.color}"><div class="gw-head"><div><span class="gw-name">${g.name}</span><span class="chip warn gw-test">Test mode</span></div><button class="btn btn-quiet btn-sm" data-act="payBack">Back</button></div>
    <div class="gw-amt"><span>${esc(p.email)}</span><b>${naira(total)}</b></div>
    ${g.methods.length > 1 ? `<div class="tabs" role="tablist" style="margin:8px 0 4px">${g.methods.map((m, i) => `<button role="tab" aria-selected="${m === method}" data-act="gwMethod" data-i="${i}">${m}</button>`).join('')}</div>` : ''}
    <form data-form="gwPay">${body}<p class="form-err" id="dlg-err" role="alert"></p><button class="btn btn-lg gw-btn">${cta}</button></form>
    <p class="help" style="margin-top:14px">A demo of the ${g.name} checkout. No money moves. On the live site ${g.name}'s own secure payment window opens here.</p></div>`);
}
function newTicket(e, tier, order, name, email, now) {
  return { eventId: e.id, tierId: tier.id, price: Number(tier.price), orderId: order.id, orderRef: order.ref, buyerName: name, buyerEmail: email, purchasedAt: now, holderName: name, holderEmail: email, code: rnd(8), secret: rnd(12), transfers: 0, history: [], oldCodes: [], checkedInAt: null, checkedInLane: null, checkedInPass: null, voided: false };
}

/* ---------- my tickets ---------- */
const walletOf = id => (ls.get('sg:wallet', {})[id]) || {};
function myTicket(t) {
  const e = S.data.events[t.eventId]; if (!e) return '';
  const rel = released(e), live = !t.voided && !t.checkedInAt, w = walletOf(t.id);
  let stub;
  if (t.voided) stub = `<div class="lock"><b>Cancelled</b><span>This ticket is no longer valid.</span></div>`;
  else if (t.checkedInAt) stub = `<div class="lock"><b>Used</b><span>Checked in ${fmtTime(t.checkedInAt)}${t.checkedInLane ? `, ${esc(t.checkedInLane)}` : ''}</span></div>`;
  else if (rel) stub = `<div class="qr" data-qr="${esc(qrText(t))}"></div><span class="code">${esc(fmtCode(t.code))}</span>${liveClock}`;
  else stub = `<div class="lock">${ICON.lock}<b>QR arrives in ${until(releaseAt(e))}</b><span>${fmtFull(releaseAt(e))}</span></div>`;
  return passHTML(e, t, stub, live && rel ? '' : 'noqr') + `<div class="pass-actions">
    ${live && rel ? `<button class="btn btn-sm" data-act="pdf" data-id="${esc(t.id)}">Download PDF ticket</button><button class="btn btn-sm btn-wallet" data-act="wallet" data-id="${esc(t.id)}" data-kind="apple">${w.apple ? 'In Apple Wallet' : 'Add to Apple Wallet'}</button><button class="btn btn-sm btn-wallet" data-act="wallet" data-id="${esc(t.id)}" data-kind="google">${w.google ? 'In Google Wallet' : 'Add to Google Wallet'}</button>` : ''}
    ${canTransfer(t, e) ? `<button class="btn btn-sm btn-quiet" data-act="transfer" data-id="${esc(t.id)}">Transfer to someone</button>` : live && (t.transfers || 0) >= maxTransfers(e) && maxTransfers(e) > 0 ? `<span class="chip">Transferred to you, cannot be passed on</span>` : ''}</div>`;
}
function inbox(me) {
  const out = [];
  Object.values(S.data.orders).filter(o => o.buyerEmail === me.email).forEach(o => {
    const e = S.data.events[o.eventId]; if (!e) return;
    const n = (o.items || []).reduce((a, i) => a + i.qty, 0), g = GW[o.gateway];
    out.push({ at: o.at, sub: `Payment confirmed for ${e.title}`, body: `Order ${o.ref}: ${plural(n, 'ticket')}, ${naira(o.total)}${g ? `, paid with ${g.name}` : ''}. Your QR ticket${n > 1 ? 's go' : ' goes'} out ${fmtFull(releaseAt(e))}.` });
  });
  Object.values(S.data.tickets).forEach(t => {
    const e = S.data.events[t.eventId]; if (!e) return;
    (t.history || []).forEach(h => {
      if (h.toEmail === me.email) out.push({ at: h.at, sub: `${h.fromName} sent you a ticket for ${e.title}`, body: `It now sits in your account under ${me.email}.` });
      if (h.fromEmail === me.email) out.push({ at: h.at, sub: `You sent a ticket to ${h.toName}`, body: `${e.title}. The ticket has left your account and its old QR code no longer works.` });
    });
    if (t.holderEmail === me.email && !t.voided && released(e)) {
      const at = Math.max(e.releasedEarly ? (e.releasedAt || 0) : releaseAt(e), t.purchasedAt || 0, ...(t.history || []).map(h => h.at));
      out.push({ at, sub: `Your ticket for ${e.title} is ready`, body: `PDF ticket attached, with your QR code and seal ${sigOf(t)}. Show it at the gate on ${fmtFull(e.startsAt)}.`, tid: t.id });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}
function mineView() {
  const mine = Object.values(S.data.tickets).filter(t => t.holderEmail === U.me.email && S.data.events[t.eventId]).sort((a, b) => S.data.events[a.eventId].startsAt - S.data.events[b.eventId].startsAt || (a.purchasedAt - b.purchasedAt));
  const sent = Object.values(S.data.tickets).filter(t => t.holderEmail !== U.me.email && (t.history || []).some(h => h.fromEmail === U.me.email) && S.data.events[t.eventId]);
  const mail = inbox(U.me);
  const body = U.mineTab === 'inbox'
    ? `<div class="panel"><p class="help" style="margin:0 0 16px">These are the emails the live system sends to ${esc(U.me.email)}.</p>${mail.length ? mail.map(m => `<div class="mail"><time>${fmtFull(m.at)}</time><div><b>${esc(m.sub)}</b></div><div>${esc(m.body)}</div>${m.tid ? `<button class="btn btn-sm btn-quiet" style="margin-top:8px" data-act="pdf" data-id="${esc(m.tid)}">Open attached PDF</button>` : ''}</div>`).join('') : `<p>No emails yet.</p>`}</div>`
    : (mine.length ? mine.map(myTicket).join('') : `<div class="panel empty"><p>You have no tickets yet. Tickets you buy, and tickets friends send to ${esc(U.me.email)}, appear here.</p><button class="btn" data-act="go" data-view="shows">See what's on</button></div>`)
      + (sent.length ? `<h2 style="margin:10px 0 12px">Tickets you sent on</h2><div class="panel">${sent.map(t => { const e = S.data.events[t.eventId], h = [...t.history].reverse().find(h => h.fromEmail === U.me.email); return `<div class="row"><div><b>${esc(e.title)}</b><small>${esc(tierOf(e, t.tierId).name)}</small></div><div><small>Sent to ${esc(h.toName)} (${esc(h.toEmail)})</small></div><div><small>${fmtDay(h.at)}</small></div></div>`; }).join('')}</div>` : '');
  return `<div class="narrow-page"><div class="bar"><div><h1 class="h-page">My tickets</h1><p class="sub">${esc(U.me.name || '')}${U.me.name ? ', ' : ''}${esc(U.me.email)}</p></div></div>
  <div class="tabs" role="tablist"><button role="tab" aria-selected="${U.mineTab !== 'inbox'}" data-act="mineTab" data-tab="tickets">Tickets (${mine.length})</button><button role="tab" aria-selected="${U.mineTab === 'inbox'}" data-act="mineTab" data-tab="inbox">Inbox (${mail.length})</button></div>${body}</div>`;
}
function transferDlg(id) {
  const t = S.data.tickets[id], e = t && S.data.events[t.eventId]; if (!t || !e) return;
  openDlg(`<form data-form="transfer"><h2>Transfer this ticket</h2><input type="hidden" name="id" value="${esc(id)}">
    <p class="sub">${esc(tierOf(e, t.tierId).name)} for ${esc(e.title)}. The ticket leaves your account, gets a new QR code and a new seal, and ${maxTransfers(e) - (t.transfers || 0) <= 1 ? 'cannot be transferred again' : 'can be passed on once more'}.</p>
    <label for="t-name">Their full name</label><input id="t-name" name="name" required autocomplete="off">
    <label for="t-email">Their email</label><input id="t-email" name="email" type="email" required autocomplete="off">
    <p class="form-err" id="dlg-err" role="alert"></p>
    <div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Keep ticket</button><button class="btn">Transfer ticket</button></div></form>`);
}
function walletDlg(id, kind) {
  const t = S.data.tickets[id], e = t && S.data.events[t.eventId]; if (!t || !e || !released(e)) return;
  const name = kind === 'apple' ? 'Apple Wallet' : 'Google Wallet', has = walletOf(id)[kind], tier = tierOf(e, t.tierId).name;
  const fields = `<div class="wp-fields"><div><small>Name</small>${esc(t.holderName)}</div><div><small>Ticket</small>${esc(tier)}</div><div><small>Starts</small>${fmtTime(e.startsAt)}</div><div><small>Venue</small>${esc(e.venue)}</div></div>`;
  const code = `<div class="wp-code"><div class="qr" data-qr="${esc(qrText(t))}"></div><b>${esc(fmtCode(t.code))}</b><span style="font-size:13px;color:${MUTED}">Seal ${sigOf(t)}</span></div>`;
  const pass = kind === 'apple'
    ? `<div class="wpass wp-apple" style="--pc:${pc(e)}"><div class="wp-top"><span style="text-align:left;font-weight:800">Entrava</span><span><small>Date</small>${fmtDay(e.startsAt)}</span></div><div class="wp-title">${esc(e.title)}</div>${fields}${code}</div>`
    : `<div class="wpass wp-google" style="--pc:${pc(e)}"><div class="wp-bar"></div><div class="wp-in"><div class="wp-top"><span style="text-align:left;font-weight:800">Entrava</span><span><small>Date</small>${fmtDay(e.startsAt)}</span></div><div class="wp-title">${esc(e.title)}</div>${fields}${code}</div></div>`;
  openDlg(`<h2>${has ? `In ${name}` : `Add to ${name}`}</h2><p class="sub">A preview of the pass. On the live site this button hands a signed pass to ${name}, which brings the ticket up on the lock screen near showtime.</p>${pass}
    <div class="dlg-act" style="margin-top:18px"><button class="btn btn-quiet" data-act="closeDlg">${has ? 'Close' : 'Not now'}</button>${has ? '' : `<button class="btn btn-wallet" data-act="walletAdd" data-id="${esc(id)}" data-kind="${kind}">Add pass (demo)</button>`}</div>`);
}

/* ---------- QR drawing, PDF ticket ---------- */
function qrMatrix(text) { if (typeof qrcode !== 'function') return null; const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
function drawQRs(root) {
  $$('[data-qr]', root).forEach(el => {
    const q = qrMatrix(el.dataset.qr); if (!q) { el.textContent = 'QR could not load'; return; }
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    el.innerHTML = `<svg viewBox="0 0 ${n + 4} ${n + 4}" role="img" aria-label="Ticket QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  });
}
function fitText(x, text, maxW, weight, size, min, family) {
  let s = size; text = String(text);
  do { x.font = `${weight} ${s}px ${family}`; if (x.measureText(text).width <= maxW) return text; s -= 2; } while (s >= min);
  while (text.length > 3 && x.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text + '…';
}
function drawSeal(x, cx, cy, r, sig) {
  x.save(); x.translate(cx - r, cy - r); x.scale(r / 100, r / 100);
  x.beginPath(); for (let i = 0; i <= 180; i++) { const th = i / 180 * Math.PI * 2, rad = 96.8 + 3.2 * Math.cos(30 * th), px = 100 + rad * Math.cos(th), py = 100 + rad * Math.sin(th); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath();
  let g; if (x.createConicGradient) g = x.createConicGradient(-.6, 100, 100); else g = x.createLinearGradient(0, 0, 200, 200);
  FOIL.forEach((c, i) => g.addColorStop(i / (FOIL.length - 1), c)); x.fillStyle = g; x.fill();
  x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = .8; sealPaths(sig).forEach(d => x.stroke(new Path2D(d)));
  const txt = `AUTHENTIC TICKET \u00B7 SEAL ${sig} \u00B7 `.repeat(2); x.fillStyle = '#fff'; x.font = '700 8.4px Archivo,Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  for (let i = 0; i < txt.length; i++) { const a = i / txt.length * Math.PI * 2 - Math.PI / 2; x.save(); x.translate(100 + 81 * Math.cos(a), 100 + 81 * Math.sin(a)); x.rotate(a + Math.PI / 2); x.fillText(txt[i], 0, 0); x.restore(); }
  x.beginPath(); x.arc(100, 100, 25, 0, 7); x.fillStyle = '#fff'; x.fill();
  x.strokeStyle = '#2036FF'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(88.5, 100.5); x.lineTo(96.5, 108.5); x.lineTo(112, 91.5); x.stroke();
  x.restore();
}
async function ticketCanvas(t, e) {
  const F = 'Archivo,Arial,sans-serif';
  try { await Promise.all([document.fonts.load('800 80px Archivo'), document.fonts.load('600 40px Archivo'), document.fonts.load('400 30px Archivo')]); } catch {}
  const W = 1800, H = 800, SX = 1290, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), sig = sigOf(t), tier = tierOf(e, t.tierId).name;
  const wide = on => { try { x.fontStretch = on ? 'expanded' : 'normal'; } catch {} };
  const rr = (a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.save(); rr(3, 3, W - 6, H - 6, 44); x.clip();
  x.lineWidth = 1.5;
  for (let i = 0; i < 34; i++) { x.strokeStyle = i % 2 ? 'rgba(32,54,255,.11)' : 'rgba(255,46,126,.09)'; x.beginPath(); for (let px = 0; px <= SX; px += 8) { const y = 168 + i * 19 + Math.sin(px / 52 + i * .9) * 16 * (i % 2 ? 1 : -1); px ? x.lineTo(px, y) : x.moveTo(px, y); } x.stroke(); }
  x.fillStyle = POSTER[tone(e)]; x.fillRect(0, 0, W, 150);
  x.fillStyle = 'rgba(255,255,255,.12)'; [[200, 120], [620, -180], [980, 160], [1520, -140]].forEach(([ox, lean]) => { x.beginPath(); x.moveTo(ox - 6, 0); x.lineTo(ox + 6, 0); x.lineTo(ox + lean + 70, 150); x.lineTo(ox + lean - 70, 150); x.fill(); });
  x.restore();
  x.strokeStyle = '#CFD5EA'; x.lineWidth = 3; rr(3, 3, W - 6, H - 6, 44); x.stroke();
  [0, H].forEach(y => { x.beginPath(); x.arc(SX, y, 30, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.stroke(); });
  x.setLineDash([14, 14]); x.strokeStyle = 'rgba(10,14,42,.4)'; x.lineWidth = 4; x.beginPath(); x.moveTo(SX, 48); x.lineTo(SX, H - 48); x.stroke(); x.setLineDash([]);
  x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
  wide(1); x.font = `900 44px ${F}`; x.fillText('ENTRAVA', 72, 92); wide(0);
  x.textAlign = 'right'; x.fillText(fitText(x, `${tier} / Admit one`, 620, 700, 32, 24, F), SX - 60, 90); x.textAlign = 'left';
  // title, up to two lines, set wide
  x.fillStyle = INK; wide(1);
  const title = String(e.title), maxW = 900; let size = 96, lines = [title];
  for (; size >= 52; size -= 4) {
    x.font = `800 ${size}px ${F}`; lines = [''];
    title.split(/\s+/).forEach(w => { const cur = lines[lines.length - 1], next = cur ? cur + ' ' + w : w; if (x.measureText(next).width <= maxW || !cur) lines[lines.length - 1] = next; else lines.push(w); });
    if (lines.length <= 2 && lines.every(l => x.measureText(l).width <= maxW)) break;
  }
  lines = lines.slice(0, 2); let y = 178 + size;
  lines.forEach(l => { x.fillText(fitText(x, l, maxW, 800, size, size, F), 72, y); y += size * 1.02; });
  wide(0);
  x.fillStyle = MUTED; x.fillText(fitText(x, e.artist || '', maxW, 500, 34, 26, F), 72, y - size * 1.02 + 58);
  const field = (label, value, fx, fy, fw) => { x.fillStyle = MUTED; x.font = `400 26px ${F}`; x.fillText(label, fx, fy); x.fillStyle = INK; x.fillText(fitText(x, value, fw, 600, 40, 28, F), fx, fy + 48); };
  field('Date', fmtDay(e.startsAt), 72, 560, 320); field('Show starts', fmtTime(e.startsAt), 410, 560, 190); field('Venue', `${e.venue}, ${e.city}`, 620, 560, 610);
  field('Name', t.holderName, 72, 672, 520); field('Ticket', tier, 620, 672, 290); field('Order', t.orderRef || '', 930, 672, 300);
  x.fillStyle = 'rgba(10,14,42,.5)'; x.font = `700 12px ${F}`; const mp = `ENTRAVA AUTHENTIC TICKET  \u00B7  SEAL ${sig}  \u00B7  `; let mline = ''; while (x.measureText(mline + mp).width < SX - 130) mline += mp; x.fillText(mline, 72, 772);
  drawSeal(x, 1128, 352, 122, sig);
  // stub
  const q = qrMatrix(qrText(t)), boxS = 372, bx = SX + (W - SX - boxS) / 2, by = 186;
  if (q) { const n = q.getModuleCount(), cell = Math.floor(boxS / n), off = (boxS - cell * n) / 2; x.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(bx + off + k * cell, by + off + r * cell, cell, cell); }
  const cx = SX + (W - SX) / 2; x.textAlign = 'center'; x.fillStyle = INK;
  x.font = `800 52px ${F}`; x.fillText(fmtCode(t.code).split('').join('\u200A'), cx, 630);
  x.font = `600 27px ${F}`; x.fillText(`Seal ${sig}`, cx, 680);
  x.fillStyle = MUTED; x.font = `400 24px ${F}`; x.fillText('Scanned once at the gate. Keep it private.', cx, 724);
  x.textAlign = 'left';
  return c;
}
async function saveFile(filename, data, mime) {
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch {}
  if (dl) { try { await dl.save({ filename, data }); toast(`Saved ${filename}`); } catch (err) { if (!err || err.code !== 'declined') toast("This file couldn't be saved here."); } return; }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function downloadTicket(id) {
  const t = S.data.tickets[id], e = t && S.data.events[t.eventId];
  if (!t || !e || t.voided || !released(e)) return toast('This ticket is not available yet.');
  const c = await ticketCanvas(t, e), name = `ticket-${t.code}`;
  if (window.jspdf && window.jspdf.jsPDF) {
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [99, 210] });
    doc.addImage(c.toDataURL('image/jpeg', .94), 'JPEG', 5, 5, 200, 200 * c.height / c.width);
    return saveFile(name + '.pdf', doc.output('blob'), 'application/pdf');
  }
  c.toBlob(b => b && saveFile(name + '.png', b, 'image/png'), 'image/png');
}

/* ---------- gate ---------- */
const gatePass = () => { const p = U.gate && S.data.passes[U.gate]; return p && p.active !== false && S.data.events[p.eventId] ? p : null; };
function resolveScan(raw, pass) {
  raw = String(raw || '').trim(); let code, secret = null;
  const m = /^(?:EN1|SG1):([A-Z0-9]{8}):([A-Z0-9]{12})$/.exec(raw);
  if (m) { code = m[1]; secret = m[2]; } else { const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 8) return { status: 'unknown' }; code = c; }
  const all = Object.values(S.data.tickets), t = all.find(t => t.code === code);
  if (!t) { const old = all.find(t => (t.oldCodes || []).includes(code)); return old && old.eventId === pass.eventId ? { status: 'reissued', t: old } : { status: 'unknown' }; }
  if (secret && t.secret !== secret) return { status: 'unknown' };
  if (t.eventId !== pass.eventId) return { status: 'wrong', t };
  if (t.voided) return { status: 'voided', t };
  if (t.checkedInAt) return { status: 'used', t };
  return { status: 'valid', t };
}
function scanHTML(p) {
  if (!U.scan) return `<div class="res-idle"><b>Ready for the next guest</b><br>Scan a ticket's QR code, or type the code printed under it.</div>`;
  const r = resolveScan(U.scan.raw, p), t = r.t, e = S.data.events[p.eventId];
  const who = t => `<div class="res-who">${sealHTML(sigOf(t), 'g' + t.id, 'sm')}<div><div class="res-name">${esc(t.holderName)}</div><small style="color:var(--muted)">Seal ${sigOf(t)}. It must match the seal on the ticket.</small></div></div>`;
  const details = t => `<dl><dt>Email</dt><dd>${esc(t.holderEmail)}</dd><dt>Ticket</dt><dd>${esc(tierOf(S.data.events[t.eventId] || e, t.tierId).name)}</dd><dt>Bought</dt><dd>${fmtFull(t.purchasedAt)}</dd>${t.buyerEmail !== t.holderEmail ? `<dt>Bought by</dt><dd>${esc(t.buyerName)} (${esc(t.buyerEmail)}), then transferred</dd>` : ''}<dt>Code</dt><dd>${esc(fmtCode(t.code))}</dd></dl>`;
  const next = `<button class="btn btn-quiet" data-act="scanClear">Next guest</button>`;
  if (t && U.scan.done === t.id && t.checkedInAt) return `<div class="res ok"><div class="res-head">Checked in</div><div class="res-body"><div class="res-name">${esc(t.holderName)}</div><p class="sub">Let them through. ${fmtTime(t.checkedInAt)}, ${esc(t.checkedInLane || '')}.</p><div style="margin-top:16px">${next}</div></div></div>`;
  if (r.status === 'valid') return `<div class="res ok"><div class="res-head">Valid ticket</div><div class="res-body">${who(t)}${details(t)}<button class="btn btn-go" data-act="checkin" data-id="${esc(t.id)}">Check in guest</button><div style="margin-top:10px"><button class="btn btn-quiet" data-act="scanClear">Cancel</button></div></div></div>`;
  if (r.status === 'used') return `<div class="res warn"><div class="res-head">Already checked in</div><div class="res-body"><div class="res-name">${esc(t.holderName)}</div><p class="sub">This ticket was used at ${fmtTime(t.checkedInAt)}${t.checkedInLane ? `, ${esc(t.checkedInLane)}` : ''}. Do not admit.</p>${details(t)}${next}</div></div>`;
  const bad = (h, msg) => `<div class="res bad"><div class="res-head">${h}</div><div class="res-body"><p>${msg}</p><div style="margin-top:16px">${next}</div></div></div>`;
  if (r.status === 'wrong') return bad('Wrong show', `This ticket is for ${esc(S.data.events[t.eventId]?.title || 'another show')}, not this one.`);
  if (r.status === 'voided') return bad('Cancelled ticket', `The organiser cancelled this ticket. Do not admit.`);
  if (r.status === 'reissued') return bad('Old code', `This ticket was transferred and given a new QR code. Ask to see the new ticket, held by ${esc(t.holderName)}.`);
  return bad('Not valid', `No ticket for this show matches that code.`);
}
function gateRefresh() {
  const p = gatePass(); if (!p || !$('#gate-shell')) return;
  const e = S.data.events[p.eventId], st = stats(e), mine = st.ts.filter(t => t.checkedInPass === p.id).length;
  $('#scan-result').innerHTML = scanHTML(p); $$('#scan-result .seal').forEach(el => el.classList.add('run'));
  $('#gate-stats').innerHTML = `<div class="two"><div class="tile"><span>Checked in, all gates</span><b>${st.inCount} <small style="font-size:18px">of ${st.ts.length}</small></b><div class="meter"><i style="width:${st.ts.length ? Math.round(st.inCount / st.ts.length * 100) : 0}%"></i></div></div><div class="tile"><span>${esc(p.label)}</span><b>${mine}</b></div></div>`;
  const recent = st.ts.filter(t => t.checkedInAt).sort((a, b) => b.checkedInAt - a.checkedInAt).slice(0, 6);
  $('#gate-feed').innerHTML = recent.length ? `<h2 style="margin:22px 0 10px">Latest check-ins</h2><div class="panel">${recent.map(t => `<div class="row"><div><b>${esc(t.holderName)}</b><small>${esc(tierOf(e, t.tierId).name)}</small></div><div><small>${esc(t.checkedInLane || '')}</small></div><div><small>${fmtTime(t.checkedInAt)}</small></div></div>`).join('')}</div>` : '';
}
function gateView() {
  const p = gatePass();
  if (!p) { if (U.gate && S.ready) { U.gate = null; ls.del('sg:gate'); }
    return `<div class="narrow-page"><section class="narrow"><h1 class="h-page">Gate check-in</h1><p class="sub">For door staff. Sign in with the gate login the organiser gave you.</p>
    <form class="panel" style="margin-top:20px" data-form="gateIn"><label for="g-id" style="margin-top:0">Gate ID</label><input id="g-id" name="gid" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="GATE-AB12" required><label for="g-pin">PIN</label><input id="g-pin" name="pin" inputmode="numeric" autocomplete="off" required><p class="form-err" id="gate-err" role="alert"></p><button class="btn">Sign in to gate</button></form></section></div>`; }
  const e = S.data.events[p.eventId];
  return `<div class="narrow-page" id="gate-shell"><div class="bar"><div><h1 class="h-page">${esc(e.title)}</h1><p class="sub">${esc(p.label)}, signed in as ${esc(p.loginId)}. ${fmtFull(e.startsAt)}.</p></div><button class="btn btn-quiet btn-sm" data-act="gateOut">Sign out of gate</button></div>
    <div class="gate-grid">
      <section aria-label="Scanner">
        <div class="cam-wrap" id="cam-wrap"><video id="cam" playsinline muted></video><div class="cam-frame"></div>
          <div class="cam-idle"><p id="cam-msg">Use this device's camera to scan tickets.</p><button class="btn" data-act="camStart">Start camera</button></div></div>
        <div class="scan-alt">
          <div class="bar-r"><button class="btn btn-quiet btn-sm" data-act="camStop" id="cam-stop" hidden>Stop camera</button><label class="btn btn-quiet btn-sm" style="margin:0">Scan from a photo<input class="vh" type="file" accept="image/*" capture="environment" id="scan-file"></label></div>
          <form class="manual" data-form="manual"><label for="m-code">Or type the ticket code</label><input id="m-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-2345"><button class="btn">Find ticket</button></form>
        </div>
      </section>
      <section aria-label="Result"><div id="scan-result" aria-live="assertive"></div><div id="gate-stats"></div><div id="gate-feed"></div></section>
    </div></div>`;
}
const Cam = { stream: null, on: false, raf: 0, last: 0, canvas: null };
function camFail(msg) { const m = $('#cam-msg'); if (m) m.textContent = msg; }
async function camStart() {
  const v = $('#cam'); if (!v) return;
  if (typeof jsQR === 'undefined') return camFail('The scanner did not load. Type the ticket code instead.');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camFail("This view can't open the camera. Use Scan from a photo, or type the ticket code.");
  try {
    Cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    v.srcObject = Cam.stream; await v.play();
    Cam.on = true; $('#cam-wrap').classList.add('cam-on'); $('#cam-stop').hidden = false; Cam.raf = requestAnimationFrame(camTick);
  } catch (err) {
    camStop();
    camFail(err && err.name === 'NotAllowedError' ? "The camera is blocked here. Allow camera access, or use Scan from a photo, or type the ticket code." : "No camera could be opened. Use Scan from a photo, or type the ticket code.");
  }
}
function camStop() {
  Cam.on = false; cancelAnimationFrame(Cam.raf);
  if (Cam.stream) { Cam.stream.getTracks().forEach(t => t.stop()); Cam.stream = null; }
  const w = $('#cam-wrap'); if (w) w.classList.remove('cam-on'); const b = $('#cam-stop'); if (b) b.hidden = true; const v = $('#cam'); if (v) v.srcObject = null;
}
function camTick(ts) {
  if (!Cam.on) return;
  const v = $('#cam'); if (!v) return camStop();
  if (ts - Cam.last > 140 && v.readyState >= 2 && v.videoWidth) {
    Cam.last = ts;
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
    const c = Cam.canvas || (Cam.canvas = document.createElement('canvas')); if (c.width !== w) { c.width = w; c.height = h; }
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, w, h);
    const r = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    if (r && r.data && (!U.scan || U.scan.raw !== r.data)) handleScan(r.data);
  }
  Cam.raf = requestAnimationFrame(camTick);
}
async function scanFile(file) {
  if (typeof jsQR === 'undefined') return toast('The scanner did not load. Type the ticket code instead.');
  let bmp; try { bmp = await createImageBitmap(file); } catch { return toast("That photo couldn't be read. Try another."); }
  for (const max of [1500, 1000, 600]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h);
    const r = jsQR(x.getImageData(0, 0, w, h).data, w, h);
    if (r && r.data) return handleScan(r.data);
  }
  toast('No QR code found in that photo. Move closer and try again.');
}
let AC;
function beep(ok) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), d = ok ? .18 : .4; o.connect(g); g.connect(AC.destination); o.type = ok ? 'sine' : 'square'; o.frequency.value = ok ? 880 : 200; g.gain.setValueAtTime(.12, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.start(); o.stop(AC.currentTime + d + .02); } catch {}
  try { navigator.vibrate && navigator.vibrate(ok ? 60 : [90, 60, 90]); } catch {}
}
function handleScan(raw) {
  const p = gatePass(); if (!p) return;
  U.scan = { raw }; beep(resolveScan(raw, p).status === 'valid'); gateRefresh();
  const el = $('#scan-result'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

/* ---------- host site: sign-up, shows, every ticket ---------- */
function ticketQuestions(a, askHas) {
  const opt = (name, val, title, small) => `<label class="gw-opt"><input type="radio" name="${name}" value="${val}" data-auth ${a[name] === val ? 'checked' : ''}><span><b>${title}</b><small>${small}</small></span></label>`;
  const has = askHas ? a.has : 'yes';
  return `${askHas ? `<fieldset><legend>Do you have tickets to sell?</legend><div class="gw-pick">${opt('has', 'yes', 'Yes', 'I have a show to put on sale')}${opt('has', 'no', 'Not yet', 'I am setting up for later')}</div></fieldset>` : ''}
    ${has === 'yes' ? `<fieldset><legend>Are your tickets free or paid?</legend><div class="gw-pick">${opt('plan', 'paid', 'Paid', 'Fans pay for each ticket')}${opt('plan', 'free', 'Free', 'Fans reserve tickets at no charge')}</div></fieldset>` : ''}
    ${has === 'yes' && a.plan === 'paid' ? `<div class="gw-box"><b>${FEE}% management fee on every ticket sold</b><p>Entrava keeps ${FEE}% of each paid ticket and pays you the rest. On a ₦10,000 ticket, ₦500 goes to Entrava and ₦9,500 to you.</p></div><label class="gw-check"><input type="checkbox" name="agree" data-auth ${a.agree ? 'checked' : ''}> I agree to the ${FEE}% management fee</label>` : ''}
    ${has === 'yes' && a.plan === 'free' ? `<div class="gw-box"><b>Free shows run on an agreed management fee</b><p>Entrava takes no cut of free tickets. Instead you agree a management fee with the Entrava team before your show goes live. Create your account, then tell us about the show.</p></div>` : ''}
    ${has === 'no' ? `<div class="gw-box"><p style="margin:0">You can look around now and tell us about your tickets when you create your first show.</p></div>` : ''}`;
}
function planFrom(a, askHas) {
  const has = askHas ? a.has : 'yes';
  if (!has) return { err: 'Tell us whether you have tickets to sell.' };
  if (has === 'no') return { plan: 'none', status: 'active' };
  if (!a.plan) return { err: 'Choose free or paid tickets.' };
  if (a.plan === 'paid' && !a.agree) return { err: `Tick the box to agree to the ${FEE}% management fee.` };
  return { plan: a.plan, status: a.plan === 'free' ? 'pending' : 'active' };
}
function hostAuthView() {
  const a = U.auth; let panel;
  if (a.mode === 'up2') panel = `<form data-form="hostUp2"><h2>Tell us about your tickets</h2><p class="sub">${esc(a.org)}, ${esc(a.email)}</p>${ticketQuestions(a, true)}<p class="form-err" id="h-err" role="alert"></p><div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="hostMode" data-mode="up">Back</button><button class="btn">Create host account</button></div></form>`;
  else if (a.mode === 'up') panel = `<h2>Create a host account</h2><p class="sub" style="margin-bottom:16px">Step 1 of 2. Your details.</p>${a.google ? `<p><span class="chip ok">Google account: ${esc(a.email)}</span></p>` : googleBtn('host')}
    <form data-form="hostUp1"><label for="h-org">Organisation or brand name</label><input id="h-org" name="org" required maxlength="60" value="${esc(a.org || '')}">
    <label for="h-name">Your name</label><input id="h-name" name="name" required autocomplete="name" value="${esc(a.name || '')}">
    ${a.google ? '' : `<label for="h-email">Email</label><input id="h-email" name="email" type="email" required autocomplete="email" value="${esc(a.email || '')}"><label for="h-pw">Password</label><input id="h-pw" name="pw" type="password" minlength="8" required><p class="help">At least 8 characters. Prototype sign-in: use a made-up password, not a real one.</p>`}
    <p class="form-err" id="h-err" role="alert"></p><button class="btn btn-lg" style="width:100%">Continue</button></form>
    <p class="help" style="margin-top:14px">Already a host? <button class="link" data-act="hostMode" data-mode="in">Sign in</button></p>`;
  else panel = `<h2>Host sign in</h2><p class="sub" style="margin-bottom:16px">Manage your shows and tickets.</p>${googleBtn('host')}
    <form data-form="hostIn"><label for="h-email">Email</label><input id="h-email" name="email" type="email" required autocomplete="email"><label for="h-pw">Password</label><input id="h-pw" name="pw" type="password" required>
    <p class="form-err" id="h-err" role="alert"></p><button class="btn btn-lg" style="width:100%">Sign in</button></form>
    <p class="help" style="margin-top:14px">New host? <button class="link" data-act="hostMode" data-mode="up">Create a host account</button></p>`;
  return `<div class="hostauth"><div><h1 class="h-sec">Put your show on sale. Keep the fakes out.</h1>
    <ul class="facts" style="margin-top:28px">
      <li><b>Your shows, your tickets</b><span>Upload a show, set ticket types and prices, and cap how many each fan can buy.</span></li>
      <li><b>${FEE}% on paid tickets</b><span>Entrava keeps ${FEE}% of each ticket sold. Free shows run on a management fee agreed with the team.</span></li>
      <li><b>Every ticket in view</b><span>See who bought, who holds each ticket now, and move a ticket to another person when you need to.</span></li>
      <li><b>Gate logins for your staff</b><span>Issue a login for each lane. Staff check guests in on the check-in site.</span></li>
    </ul><p class="help" style="margin-top:18px"><button class="link" data-act="staff">Entrava staff sign in</button></p></div>
    <div class="panel">${panel}</div></div>`;
}
function hostPending(h) {
  return `<h1 class="h-page" style="max-width:20ch">Your account opens once the management fee is agreed</h1>
    <p class="sub">Free shows run on a fee agreed with Entrava. Tell us about your show and the team will come back to ${esc(h.email)} with the fee.</p>
    <form class="panel" style="margin-top:24px;max-width:640px" data-form="hostMsg"><label for="h-msg" style="margin-top:0">About your show</label>
      <textarea id="h-msg" name="msg" rows="5" required placeholder="Show name, date, venue and how many tickets you expect to give out">${esc(h.contactNote || '')}</textarea>
      ${h.contactAt ? `<p class="help">Sent ${fmtFull(h.contactAt)}. The Entrava team has your message.</p>` : ''}
      <p class="form-err" id="h-err" role="alert"></p><button class="btn">${h.contactAt ? 'Send an update' : 'Send to Entrava'}</button></form>
    <div class="bar-r" style="margin-top:20px"><button class="btn btn-quiet" data-act="planPaid">My tickets are paid instead</button><button class="btn btn-quiet" data-act="hostOut">Sign out</button></div>`;
}
function hostShows(h) {
  const s = hostStats(h);
  return `<div class="bar"><div><h1 class="h-page">My shows</h1><p class="sub">${esc(h.org)}. ${planText(h)}.</p></div><button class="btn" data-act="newEvent">Create a show</button></div>
  <div class="tiles"><div class="tile"><span>Tickets sold</span><b>${s.sold}</b></div><div class="tile"><span>Gross sales</span><b>${naira(s.gross)}</b></div><div class="tile"><span>${h.plan === 'free' ? 'Management fee' : `Entrava fee (${FEE}%)`}</span><b>${naira(h.plan === 'free' ? (h.agreedFee || 0) : s.fee)}</b></div><div class="tile"><span>Your payout</span><b>${naira(s.payout)}</b></div></div>
  ${s.evs.length ? `<div class="panel" style="margin-top:20px">${s.evs.map(e => { const st = stats(e); return `<div class="row"><div><b>${esc(e.title)}</b><small>${fmtFull(e.startsAt)}, ${esc(e.venue)}</small></div><div><small>${st.ts.length} of ${st.cap} sold, ${st.inCount} checked in</small><small>${naira(st.revenue)}</small></div><div class="row-act"><button class="btn btn-sm" data-act="manage" data-id="${esc(e.id)}">Manage</button></div></div>`; }).join('')}</div>`
    : `<div class="panel empty" style="margin-top:20px"><h2>No shows yet</h2><p>Create your first show, or add three sample shows to try the whole flow from purchase to the gate.</p><div class="bar-r"><button class="btn" data-act="newEvent">Create a show</button><button class="btn btn-quiet" data-act="samples">Add sample shows</button></div></div>`}`;
}
const ticketStatus = t => t.voided ? `<span class="chip bad">Cancelled</span>` : t.checkedInAt ? `<span class="chip ok">In at ${fmtTime(t.checkedInAt)}${t.checkedInLane ? `, ${esc(t.checkedInLane)}` : ''}</span>` : `<span class="chip">Not arrived</span>`;
function ticketRow(t, withShow) {
  const e = S.data.events[t.eventId]; if (!e) return '';
  return `<div class="row"><div><b>${esc(t.holderName)}</b><small>${esc(t.holderEmail)}</small>${t.buyerEmail !== t.holderEmail ? `<small>Bought by ${esc(t.buyerName)}, transferred</small>` : ''}</div>
    <div>${withShow ? `<small>${esc(e.title)}</small>` : ''}<small>${esc(tierOf(e, t.tierId).name)}, ${esc(fmtCode(t.code))}</small>${ticketStatus(t)}</div>
    <div class="row-act"><button class="btn btn-sm btn-quiet" data-act="ticket" data-id="${esc(t.id)}">Details</button>${t.voided || t.checkedInAt ? '' : `<button class="btn btn-sm" data-act="guestIn" data-id="${esc(t.id)}">Check in</button>`}</div></div>`;
}
function ticketsPanel(all, q, withShow) {
  q = String(q || '').trim().toLowerCase();
  const list = q ? all.filter(t => [t.holderName, t.holderEmail, t.buyerName, t.buyerEmail, t.code, fmtCode(t.code), t.orderRef, (S.data.events[t.eventId] || {}).title].some(v => String(v || '').toLowerCase().includes(q))) : all;
  return `<div class="panel">${list.length ? list.map(t => ticketRow(t, withShow)).join('') : `<p class="sub" style="margin:0">${all.length ? 'No ticket matches that search.' : 'No tickets bought yet.'}</p>`}</div>`;
}
function hostTickets(h) {
  const ids = new Set(hostEvents(h).map(e => e.id)), all = Object.values(S.data.tickets).filter(t => ids.has(t.eventId)).sort((a, b) => b.purchasedAt - a.purchasedAt);
  return `<div class="bar"><div><h1 class="h-page">All tickets</h1><p class="sub">Every ticket bought for your shows. Open one to see its details or move it to another person.</p></div></div>
    <label for="tq" class="vh">Search tickets</label><input id="tq" type="search" placeholder="Search by name, email, code, order or show" value="${esc(U.tq)}" data-in="tq" style="margin-bottom:16px">${ticketsPanel(all, U.tq, true)}`;
}
function hostAccount(h) {
  return `<div class="bar"><h1 class="h-page">Account</h1></div>
    <div class="panel" style="max-width:640px"><dl class="kv" style="margin-top:0"><dt>Organisation</dt><dd>${esc(h.org)}</dd><dt>Contact</dt><dd>${esc(h.name)}</dd><dt>Email</dt><dd>${esc(h.email)}</dd><dt>Sign-in</dt><dd>${h.provider === 'google' ? 'Google' : 'Email and password'}</dd><dt>Tickets</dt><dd>${planText(h)}</dd></dl>
    <div class="bar-r">${h.plan === 'none' ? `<button class="btn" data-act="plan">Tell us about your tickets</button>` : ''}<button class="btn btn-quiet" data-act="hostOut">Sign out</button></div></div>`;
}
function ticketDlg(id) {
  const t = S.data.tickets[id], e = t && S.data.events[t.eventId]; if (!t || !e) return;
  const o = S.data.orders[t.orderId], g = o && GW[o.gateway], open = !t.voided && !t.checkedInAt;
  const hist = (t.history || []).map(h => `<li>${fmtFull(h.at)}: ${esc(h.fromName)} (${esc(h.fromEmail)}) to ${esc(h.toName)} (${esc(h.toEmail)})${h.by === 'host' ? ', moved by the host' : ''}</li>`).join('');
  openDlg(`<h2>Ticket ${esc(fmtCode(t.code))}</h2>
    <div class="res-who" style="margin-top:14px">${sealHTML(sigOf(t), 'd' + t.id, 'sm')}<div><div class="res-name" style="font-size:24px">${esc(t.holderName)}</div><small style="color:var(--muted)">${esc(t.holderEmail)}</small></div></div>
    <dl class="kv"><dt>Show</dt><dd>${esc(e.title)}, ${fmtFull(e.startsAt)}</dd><dt>Ticket</dt><dd>${esc(tierOf(e, t.tierId).name)}, ${t.price ? naira(t.price) : 'free'}</dd><dt>Status</dt><dd>${ticketStatus(t)}</dd>
      <dt>Bought by</dt><dd>${esc(t.buyerName)} (${esc(t.buyerEmail)})</dd><dt>Bought</dt><dd>${fmtFull(t.purchasedAt)}</dd>
      <dt>Order</dt><dd>${esc(t.orderRef || '')}${g ? `, ${g.name}${o.method ? `, ${esc(o.method)}` : ''}` : o && o.gateway === 'free' ? ', free reservation' : ''}</dd>${o && o.txRef ? `<dt>Payment ref</dt><dd>${esc(o.txRef)}</dd>` : ''}<dt>Seal</dt><dd>${sigOf(t)}</dd></dl>
    ${hist ? `<b>Transfer history</b><ul class="hist">${hist}</ul>` : ''}
    ${open ? `<form data-form="hostTransfer" class="gw-box"><input type="hidden" name="id" value="${esc(id)}"><b>Transfer to another person</b><div class="f2"><div><label for="x-name">Full name</label><input id="x-name" name="name" required autocomplete="off"></div><div><label for="x-email">Email</label><input id="x-email" name="email" type="email" required autocomplete="off"></div></div><p class="form-err" id="dlg-err" role="alert"></p><button class="btn btn-sm">Transfer ticket</button></form>` : ''}
    <div class="dlg-act" style="margin-top:16px">${t.voided ? '' : t.checkedInAt ? `<button class="btn btn-quiet" data-act="guestUndo" data-id="${esc(id)}">Undo check-in</button>` : `<button class="btn btn-danger" data-act="guestVoid" data-id="${esc(id)}">Cancel ticket</button>`}<button class="btn" data-act="closeDlg">Done</button></div>`);
}
function planDlg() {
  openDlg(`<form data-form="hostPlan"><h2>Tell us about your tickets</h2>${ticketQuestions(U.auth, false)}<p class="form-err" id="dlg-err" role="alert"></p><div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Cancel</button><button class="btn">Save</button></div></form>`);
}
function staffDlg() {
  openDlg(`<form data-form="staffIn"><h2>Entrava staff</h2><p class="sub">For the Entrava team: approve hosts and see every sale.</p><label for="s-code">Staff passcode</label><input id="s-code" name="code" type="password" autocomplete="off" required><p class="help">Prototype passcode: ${ADMIN_CODE}</p><p class="form-err" id="dlg-err" role="alert"></p><div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Cancel</button><button class="btn">Sign in</button></div></form>`);
}
function staffView() {
  const hs = Object.values(S.data.hosts).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.createdAt || 0) - (a.createdAt || 0));
  let sold = 0, gross = 0, fees = 0;
  const rows = hs.map(h => { const s = hostStats(h); sold += s.sold; gross += s.gross; fees += s.fee + (h.plan === 'free' && h.status === 'active' ? Number(h.agreedFee || 0) : 0); return { h, s }; });
  const all = Object.values(S.data.tickets).sort((a, b) => b.purchasedAt - a.purchasedAt);
  return `<div class="bar"><div><h1 class="h-page">Entrava staff</h1><p class="sub">Every host, every sale, and the management fees due to Entrava.</p></div></div>
  <div class="tiles"><div class="tile"><span>Hosts</span><b>${hs.length}</b></div><div class="tile"><span>Tickets sold</span><b>${sold}</b></div><div class="tile"><span>Gross sales</span><b>${naira(gross)}</b></div><div class="tile"><span>Fees to Entrava</span><b>${naira(fees)}</b></div></div>
  <h2 style="margin:32px 0 12px">Hosts</h2>
  <div class="panel">${rows.length ? rows.map(({ h, s }) => `<div class="row"><div><b>${esc(h.org)}</b><small>${esc(h.name)}, ${esc(h.email)}</small>${h.contactNote ? `<small>Message: ${esc(h.contactNote)}</small>` : ''}</div>
    <div><small>${planText(h)}</small><small>${plural(s.evs.length, 'show')}, ${plural(s.sold, 'ticket')}, ${naira(s.gross)} gross${h.plan === 'paid' ? `, ${naira(s.fee)} fee` : ''}</small>${h.status === 'pending' ? `<span class="chip warn">Waiting for fee</span>` : `<span class="chip ok">Active</span>`}</div>
    <div class="row-act">${h.status === 'pending' ? `<form data-form="staffApprove" class="manual" style="min-width:220px"><input type="hidden" name="id" value="${esc(h.id)}"><label for="fee-${esc(h.id)}">Agreed fee (₦)</label><input id="fee-${esc(h.id)}" name="fee" type="number" min="0" step="500" required><button class="btn btn-sm">Approve</button></form>` : ''}</div></div>`).join('') : `<p class="sub" style="margin:0">No hosts have signed up yet.</p>`}</div>
  <h2 style="margin:32px 0 12px">All tickets</h2>
  <label for="tq" class="vh">Search tickets</label><input id="tq" type="search" placeholder="Search by name, email, code, order or show" value="${esc(U.tq)}" data-in="tq" style="margin-bottom:16px">${ticketsPanel(all, U.tq, true)}`;
}
function hostView() {
  if (U.staff) return `<div class="narrow-page">${staffView()}</div>`;
  const h = host();
  if (!h) { if (U.hostId && S.ready) { U.hostId = null; ls.del('en:host'); } return hostAuthView(); }
  if (h.status !== 'active') return `<div class="narrow-page">${hostPending(h)}</div>`;
  const e = U.hview === 'event' && U.adminEvent && S.data.events[U.adminEvent];
  if (e && e.hostId === h.id) return `<div class="narrow-page">${adminEvent(e, h)}</div>`;
  if (U.hview === 'tickets') return `<div class="narrow-page">${hostTickets(h)}</div>`;
  if (U.hview === 'account') return `<div class="narrow-page">${hostAccount(h)}</div>`;
  return `<div class="narrow-page">${hostShows(h)}</div>`;
}
function adminEvent(e, h) {
  const st = stats(e), tab = U.adminTab, passes = passesOf(e.id), fee = h.plan === 'paid' ? Math.round(st.revenue * FEE / 100) : 0;
  const tabBtn = (k, l) => `<button role="tab" aria-selected="${tab === k}" data-act="adminTab" data-tab="${k}">${l}</button>`;
  let body = '';
  if (tab === 'overview') {
    const rel = released(e), orders = Object.values(S.data.orders).filter(o => o.eventId === e.id);
    body = `<div class="tiles six"><div class="tile"><span>Tickets sold</span><b>${st.ts.length}</b><span>of ${st.cap}</span></div><div class="tile"><span>Gross sales</span><b>${naira(st.revenue)}</b></div><div class="tile"><span>${h.plan === 'free' ? 'Management fee' : `Entrava fee (${FEE}%)`}</span><b>${h.plan === 'free' ? 'Agreed' : naira(fee)}</b></div><div class="tile"><span>Your payout</span><b>${naira(st.revenue - fee)}</b></div><div class="tile"><span>Checked in</span><b>${st.inCount}</b><span>of ${st.ts.length}</span></div><div class="tile"><span>Transfers</span><b>${st.transfers}</b></div></div>
    <div class="panel" style="margin-top:20px"><div class="bar" style="margin:0"><div><h2>QR tickets</h2><p class="sub">${e.releasedEarly ? 'You sent the QR tickets early. Every buyer can open theirs now.' : rel ? 'QR tickets are out. New buyers get theirs straight away.' : `Locked until ${fmtFull(releaseAt(e))}, ${hoursBefore(e)} hours before the show. That is ${until(releaseAt(e))} from now.`}</p></div>
      ${e.releasedEarly ? `<button class="btn btn-quiet" data-act="releaseUndo" data-id="${esc(e.id)}">Lock tickets again</button>` : rel ? '' : `<button class="btn" data-act="releaseNow" data-id="${esc(e.id)}">Send tickets now</button>`}</div></div>
    <div class="three"><div class="panel"><h2>By ticket type</h2>${tiersOf(e).map(t => { const s = sold(e.id, t.id); return `<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(t.name)}</b><span>${s} of ${Number(t.qty)}</span></div><div class="meter"><i style="width:${t.qty ? Math.min(100, Math.round(s / t.qty * 100)) : 0}%"></i></div></div>`; }).join('')}</div>
    <div class="panel"><h2>By gate</h2>${passes.length ? passes.map(p => `<div class="row"><div><b>${esc(p.label)}</b></div><div></div><div><b>${st.ts.filter(t => t.checkedInPass === p.id).length}</b> in</div></div>`).join('') : `<p class="sub">No gate logins yet.</p>`}${st.ts.some(t => t.checkedInAt && !t.checkedInPass) ? `<div class="row"><div><b>By the host</b></div><div></div><div><b>${st.ts.filter(t => t.checkedInAt && !t.checkedInPass).length}</b> in</div></div>` : ''}</div>
    <div class="panel"><h2>By payment gateway</h2>${Object.entries(GW).map(([k, g]) => { const os = orders.filter(o => (o.gateway || 'paystack') === k); return `<div class="row"><div><b>${g.name}</b><small>${plural(os.length, 'order')}</small></div><div></div><div><b>${naira(os.reduce((a, o) => a + Number(o.total || 0), 0))}</b></div></div>`; }).join('')}</div></div>`;
  } else if (tab === 'guests') {
    const all = ticketsOf(e.id).sort((a, b) => String(a.holderName).localeCompare(String(b.holderName)));
    body = `<div class="bar"><div style="flex:1;min-width:220px"><label for="gq" class="vh">Search tickets</label><input id="gq" type="search" placeholder="Search by name, email, code or order" value="${esc(U.q)}" data-in="q"></div><button class="btn btn-quiet" data-act="csv" data-id="${esc(e.id)}" ${all.length ? '' : 'disabled'}>Download ticket list (CSV)</button></div>${ticketsPanel(all, U.q, false)}`;
  } else if (tab === 'passes') {
    body = `<p class="sub" style="margin-bottom:16px">Give each gate its own login. Staff sign in on the check-in site and can only scan tickets for this show.</p>
    <div class="panel">${passes.length ? passes.map(p => `<div class="row"><div><b>${esc(p.label)}</b><small>${plural(st.ts.filter(t => t.checkedInPass === p.id).length, 'check-in')}</small></div><div><small>Gate ID</small><span class="creds">${esc(p.loginId)}</span><small style="margin-top:6px">PIN</small><span class="creds">${esc(p.pin)}</span></div><div class="row-act"><button class="btn btn-sm btn-quiet" data-act="passPin" data-id="${esc(p.id)}">New PIN</button><button class="btn btn-sm btn-danger" data-act="passDel" data-id="${esc(p.id)}">Remove</button></div></div>`).join('') : `<p class="sub" style="margin:0">No gate logins yet. Add one below.</p>`}</div>
    <form class="panel" style="margin-top:20px" data-form="passAdd"><input type="hidden" name="eventId" value="${esc(e.id)}"><div class="manual"><label for="p-label">Add a gate login</label><input id="p-label" name="label" placeholder="VIP entrance" required maxlength="40"><button class="btn">Add gate login</button></div></form>`;
  } else {
    body = `<div class="panel"><h2>Show details</h2><p class="sub">Up to ${plural(Number(e.maxPerBuyer), 'ticket')} per buyer. ${maxTransfers(e) ? `Each ticket can be transferred ${maxTransfers(e) === 1 ? 'once' : maxTransfers(e) + ' times'}.` : 'Transfers are off.'} QR tickets go out ${hoursBefore(e)} hours before the show.</p><div class="bar-r" style="margin-top:16px"><button class="btn" data-act="editEvent" data-id="${esc(e.id)}">Edit show</button><button class="btn btn-danger" data-act="delEvent" data-id="${esc(e.id)}">Delete show</button></div></div>`;
  }
  return `<button class="back" data-act="hgo" data-view="shows">‹ My shows</button>
  <div class="bar"><div><h1 class="h-page">${esc(e.title)}</h1><p class="sub">${fmtFull(e.startsAt)}, ${esc(e.venue)}, ${esc(e.city)}</p></div></div>
  <div class="tabs" role="tablist">${tabBtn('overview', 'Overview')}${tabBtn('guests', `Tickets (${ticketsOf(e.id).length})`)}${tabBtn('passes', `Gate logins (${passes.length})`)}${tabBtn('settings', 'Settings')}</div>${body}`;
}
function eventDlg(e) {
  const h0 = host(), free = !!h0 && h0.plan === 'free';
  const sat = new Date(); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7) + 7); sat.setHours(20, 0, 0, 0);
  const v = e || { title: '', artist: '', venue: '', city: 'Abuja', startsAt: sat.getTime(), tone: 'electric', tiers: free ? [{ id: 't1', name: 'General entry', price: 0, qty: 200 }] : [{ id: 't1', name: 'Regular', price: 10000, qty: 200 }, { id: 't2', name: 'VIP', price: 30000, qty: 50 }], maxPerBuyer: 4, maxTransfers: 1, releaseHours: 12 };
  const tier = i => tiersOf(v).find(t => t.id === 't' + i) || { name: '', price: '', qty: '' };
  const opt = (val, cur, label) => `<option value="${val}" ${String(val) === String(cur) ? 'selected' : ''}>${label}</option>`;
  openDlg(`<form data-form="eventSave"><h2>${e ? 'Edit show' : 'Create a show'}</h2><input type="hidden" name="id" value="${esc(e?.id || '')}">
    <label for="e-title">Show name</label><input id="e-title" name="title" required maxlength="60" value="${esc(v.title)}">
    <label for="e-artist">Line-up or host</label><input id="e-artist" name="artist" maxlength="90" value="${esc(v.artist)}">
    <div class="f2"><div><label for="e-venue">Venue</label><input id="e-venue" name="venue" required maxlength="60" value="${esc(v.venue)}"></div><div><label for="e-city">City</label><input id="e-city" name="city" required maxlength="40" value="${esc(v.city)}"></div></div>
    <div class="f2"><div><label for="e-when">Date and start time</label><input id="e-when" name="when" type="datetime-local" required value="${toLocalInput(v.startsAt)}"></div><div><label for="e-tone">Poster colour</label><select id="e-tone" name="tone">${Object.keys(POSTER).map(k => opt(k, tone(v), TONE_NAMES[k])).join('')}</select></div></div>
    <fieldset><legend>Ticket types (leave a row empty to skip it)${free ? '. Your tickets are free, so prices stay at 0' : ''}</legend>
      <div class="f3"><span>Name</span><span>Price (₦)</span><span>Quantity</span></div>
      ${[1, 2, 3].map(i => `<div class="f3"><input name="tn${i}" aria-label="Ticket type ${i} name" maxlength="30" value="${esc(tier(i).name)}"><input name="tp${i}" aria-label="Ticket type ${i} price" type="number" min="0" step="100" ${free ? 'value="0" readonly' : `value="${esc(tier(i).price)}"`}><input name="tq${i}" aria-label="Ticket type ${i} quantity" type="number" min="1" step="1" value="${esc(tier(i).qty)}"></div>`).join('')}
    </fieldset>
    <div class="f2"><div><label for="e-max">Most tickets one buyer can buy</label><input id="e-max" name="max" type="number" min="1" max="20" required value="${esc(v.maxPerBuyer)}"></div><div><label for="e-tr">Transfers per ticket</label><select id="e-tr" name="transfers">${opt(0, maxTransfers(v), 'Not allowed')}${opt(1, maxTransfers(v), 'Once')}${opt(2, maxTransfers(v), 'Twice')}</select></div></div>
    <div class="f2"><div><label for="e-rel">Send QR tickets</label><select id="e-rel" name="release">${[6, 12, 24, 48].map(h => opt(h, hoursBefore(v), `${h} hours before the show`)).join('')}</select></div>
    ${e ? '<div></div>' : `<div><label for="e-gates">Gate logins needed</label><input id="e-gates" name="gates" type="number" min="1" max="8" value="2"></div>`}</div>
    ${e ? '' : `<p class="help">Two gate logins are named Male lane and Female lane. You can rename, add or remove them after creating the show.</p>`}
    <p class="form-err" id="dlg-err" role="alert"></p>
    <div class="dlg-act"><button type="button" class="btn btn-quiet" data-act="closeDlg">Cancel</button><button class="btn">${e ? 'Save changes' : 'Create show'}</button></div></form>`);
}
const newPass = (eventId, label, at) => ({ eventId, label, loginId: 'GATE-' + rnd(4), pin: rnd(6, '0123456789'), active: true, createdAt: at });
function sampleShows() {
  const at = (days, h) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d.getTime(); };
  return [
    { title: 'Abuja Laugh Night', artist: 'Hosted by MC Tobi Rex, with five stand-up acts', venue: 'Garden Hall, Wuse 2', city: 'Abuja', startsAt: at(3, 20), tone: 'electric', maxPerBuyer: 4, tiers: [{ id: 't1', name: 'Regular', price: 10000, qty: 300 }, { id: 't2', name: 'VIP', price: 25000, qty: 80 }, { id: 't3', name: 'Table seat', price: 60000, qty: 30 }] },
    { title: 'Afrobeats After Dark', artist: 'Kemi Blaze, DJ Ozone and guests', venue: 'Lakeside Arena, Jabi', city: 'Abuja', startsAt: at(24, 21), tone: 'flare', maxPerBuyer: 4, tiers: [{ id: 't1', name: 'Regular', price: 15000, qty: 1500 }, { id: 't2', name: 'VIP', price: 50000, qty: 200 }] },
    { title: 'December Homecoming Concert', artist: 'The Marina All-Stars, live band and surprise acts', venue: 'Marina Yard, Victoria Island', city: 'Lagos', startsAt: at(73, 19), tone: 'violet', maxPerBuyer: 6, tiers: [{ id: 't1', name: 'Regular', price: 20000, qty: 3000 }, { id: 't2', name: 'VIP', price: 75000, qty: 400 }, { id: 't3', name: 'Gold table seat', price: 150000, qty: 100 }] }
  ].map(e => ({ ...e, maxTransfers: 1, releaseHours: 12, releasedEarly: false, createdAt: Date.now() }));
}
function csvFor(e) {
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = [['Name', 'Email', 'Ticket type', 'Price', 'Code', 'Seal', 'Order', 'Paid with', 'Bought by', 'Buyer email', 'Bought at', 'Transfers', 'Status', 'Checked in at', 'Gate']];
  ticketsOf(e.id).forEach(t => { const o = S.data.orders[t.orderId]; rows.push([t.holderName, t.holderEmail, tierOf(e, t.tierId).name, t.price, fmtCode(t.code), sigOf(t), t.orderRef, o && GW[o.gateway] ? GW[o.gateway].name : '', t.buyerName, t.buyerEmail, new Date(t.purchasedAt).toLocaleString('en-GB'), t.transfers || 0, t.voided ? 'Cancelled' : t.checkedInAt ? 'Checked in' : 'Not arrived', t.checkedInAt ? new Date(t.checkedInAt).toLocaleString('en-GB') : '', t.checkedInLane || '']); });
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/* ---------- dialog ---------- */
function openDlg(html) { const d = $('#dlg'); d.innerHTML = html; drawQRs(d); $$('.seal', d).forEach(el => el.classList.add('run')); if (!d.open) d.showModal(); d.scrollTop = 0; }
function closeDlg() { const d = $('#dlg'); if (d.open) d.close(); d.innerHTML = ''; }
function confirmDlg(title, body, label, act, id) {
  openDlg(`<h2>${esc(title)}</h2><p class="sub" style="margin:10px 0 18px">${esc(body)}</p><div class="dlg-act"><button class="btn btn-quiet" data-act="closeDlg">Go back</button><button class="btn" data-act="${act}" data-id="${esc(id)}">${esc(label)}</button></div>`);
}
const dlgErr = msg => { const el = $('#dlg-err'); if (el) el.textContent = msg; };

/* ---------- actions ---------- */
const ACT = {
  go: d => go(d.view),
  hgo: d => hgo(d.view, d.view === 'shows' ? { adminEvent: null } : {}),
  home() { if (U.site === 'host') hgo('shows', { adminEvent: null }); else if (U.site === 'main') go('shows'); },
  site(d) { if (LOCK || !['main', 'host', 'gate'].includes(d.site)) return; if (Cam.on) camStop(); U.pay = null; closeDlg(); U.site = d.site; ls.set('en:site', U.site); render(true); window.scrollTo(0, 0); },
  auth: d => authDlg(d.mode === 'up' ? 'up' : 'in'),
  google: d => googleDlg(d.who),
  account: () => accountDlg(),
  signOut() { U.me = null; ls.del('en:me'); closeDlg(); go('shows', { cart: {}, pay: null }); },
  hostMode(d) { U.auth = d.mode === 'up' ? { ...U.auth, mode: 'up' } : { mode: 'in' }; render(true); },
  hostOut() { U.hostId = null; ls.del('en:host'); U.auth = { mode: 'in' }; hgo('shows', { adminEvent: null }); },
  staff: () => staffDlg(),
  staffOut() { U.staff = false; ls.del('en:staff'); render(true); },
  plan() { U.auth = { mode: 'in' }; planDlg(); },
  planPaid() { U.auth = { mode: 'in', plan: 'paid' }; planDlg(); },
  ticket: d => ticketDlg(d.id),
  event: d => go('event', { eventId: d.id, cart: {}, pay: null }),
  scrollTo(d) { const el = document.getElementById(d.to); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
  theme() { const next = themeNow() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; ls.set('sg:theme', next); themeSync(); },
  arenaToggle: () => Arena.toggle(),
  qty(d) {
    const e = S.data.events[U.eventId]; if (!e) return;
    const t = tierOf(e, d.tier), n = (U.cart[d.tier] || 0) + Number(d.d), left = Number(t.qty) - sold(e.id, t.id);
    const allow = Number(e.maxPerBuyer) - (U.me ? boughtBy(e.id, U.me.email) : 0);
    if (n < 0 || n > left || (Number(d.d) > 0 && cartQty() >= allow)) return;
    U.cart = { ...U.cart, [d.tier]: n }; render(true);
    const out = $$('.stepper').find(el => el.querySelector('button')?.dataset.tier === d.tier)?.querySelector('output'); if (out) out.classList.add('bump'); const tot = $('.total b'); if (tot) tot.classList.add('bump');
  },
  pay() { U.pay = null; checkoutDlg(); },
  payBack: () => checkoutDlg(),
  gwMethod(d) { if (U.pay) { U.pay.method = Number(d.i); gatewayDlg(); } },
  closeDlg,
  mineTab(d) { U.mineTab = d.tab; render(true); },
  pdf: d => run(() => downloadTicket(d.id)),
  wallet: d => walletDlg(d.id, d.kind),
  walletAdd(d) { const w = ls.get('sg:wallet', {}); w[d.id] = { ...(w[d.id] || {}), [d.kind]: true }; ls.set('sg:wallet', w); closeDlg(); render(true); toast(`Added to ${d.kind === 'apple' ? 'Apple Wallet' : 'Google Wallet'} (demo).`); },
  transfer: d => transferDlg(d.id),
  camStart, camStop,
  scanClear() { U.scan = null; gateRefresh(); const i = $('#m-code'); if (i) i.value = ''; },
  checkin: d => run(async () => {
    const p = gatePass(), t = S.data.tickets[d.id]; if (!p || !t) return;
    if (S.mode === 'cloud') { try { const snap = await S.db.collection('tickets').doc(t.id).get(); const v = snap.exists && snap.data(); if (v) S.data.tickets = { ...S.data.tickets, [t.id]: { ...v, id: t.id } }; } catch {} }
    const cur = S.data.tickets[t.id];
    if (cur.checkedInAt || cur.voided) { beep(false); return gateRefresh(); }
    await patch('tickets', t.id, { checkedInAt: Date.now(), checkedInLane: p.label, checkedInPass: p.id });
    U.scan = { ...U.scan, done: t.id }; beep(true); gateRefresh();
  }),
  gateOut() { camStop(); U.gate = null; U.scan = null; ls.del('sg:gate'); render(true); },
  newEvent() { const h = host(); if (!h) return; if (h.plan === 'none') { U.auth = { mode: 'in' }; return planDlg(); } eventDlg(null); },
  editEvent: d => eventDlg(S.data.events[d.id]),
  manage: d => hgo('event', { adminEvent: d.id, adminTab: 'overview', q: '' }),
  adminTab(d) { U.adminTab = d.tab; render(true); },
  samples: () => run(async () => {
    const h = host(); if (!h) return;
    for (const s0 of sampleShows()) { const id = uid('e_'), s = { ...s0, hostId: h.id, tiers: h.plan === 'free' ? s0.tiers.map(t => ({ ...t, price: 0 })) : s0.tiers }; await put('events', id, s); await put('passes', uid('p_'), newPass(id, 'Male lane', Date.now())); await put('passes', uid('p_'), newPass(id, 'Female lane', Date.now() + 1)); }
    toast('Three sample shows added.');
  }),
  releaseNow: d => run(async () => { await patch('events', d.id, { releasedEarly: true, releasedAt: Date.now() }); toast('QR tickets sent to every buyer.'); }),
  releaseUndo: d => run(async () => { await patch('events', d.id, { releasedEarly: false }); toast('Tickets locked again.'); }),
  guestIn: d => run(async () => { await patch('tickets', d.id, { checkedInAt: Date.now(), checkedInLane: U.staff ? 'Entrava staff' : 'Host', checkedInPass: null }); }),
  guestUndo: d => run(async () => { closeDlg(); await patch('tickets', d.id, { checkedInAt: null, checkedInLane: null, checkedInPass: null }); toast('Check-in undone.'); }),
  guestVoid(d) { const t = S.data.tickets[d.id]; if (t) confirmDlg('Cancel this ticket?', `${t.holderName}'s ticket will stop working at the gate. Refund them separately.`, 'Cancel ticket', 'doVoid', d.id); },
  doVoid: d => run(async () => { closeDlg(); await patch('tickets', d.id, { voided: true }); toast('Ticket cancelled.'); }),
  csv: d => run(async () => { const e = S.data.events[d.id]; if (e) await saveFile(`guest-list-${String(e.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'show'}.csv`, '\uFEFF' + csvFor(e), 'text/csv'); }),
  passPin: d => run(async () => { await patch('passes', d.id, { pin: rnd(6, '0123456789') }); toast('New PIN set. The old one no longer works.'); }),
  passDel(d) { const p = S.data.passes[d.id]; if (p) confirmDlg('Remove this gate login?', `${p.label} will be signed out and can no longer scan tickets.`, 'Remove gate login', 'doPassDel', d.id); },
  doPassDel: d => run(async () => { closeDlg(); await del('passes', d.id); toast('Gate login removed.'); }),
  delEvent(d) { const e = S.data.events[d.id]; if (e) confirmDlg('Delete this show?', `${e.title}, its ${plural(ticketsOf(e.id).length, 'ticket')} and its gate logins will be deleted. This can't be undone.`, 'Delete show', 'doDelEvent', d.id); },
  doDelEvent: d => run(async () => {
    closeDlg(); const id = d.id;
    for (const t of ticketsOf(id)) await del('tickets', t.id);
    for (const p of passesOf(id)) await del('passes', p.id);
    for (const o of Object.values(S.data.orders).filter(o => o.eventId === id)) await del('orders', o.id);
    await del('events', id); U.adminEvent = null; U.hview = 'shows'; render(true); toast('Show deleted.');
  })
};
const FORMS = {
  payDetails(fd) {
    const e = S.data.events[U.eventId]; if (!e || !U.me) return closeDlg();
    const name = String(fd.get('name')).trim(), email = U.me.email, gw = GW[fd.get('gw')] ? String(fd.get('gw')) : 'paystack';
    const err = cartError(e, name, email); if (err) return dlgErr(err);
    if (!cartTotal(e)) return run(async () => {
      U.pay = { gw: 'free', name, email, method: 0, step: 'wait' };
      openDlg(`<div class="gw-wait"><div class="spin"></div><p>Reserving your tickets…</p></div>`);
      await sleep(900);
      const order = await placeOrder(e, U.pay, 'free', 'Free');
      await orderDone('Tickets reserved', `Order ${esc(order.ref)}. Nothing to pay.`, email);
    });
    U.pay = { gw, name, email, method: U.pay && U.pay.gw === gw ? U.pay.method : 0, step: 'pay' }; gatewayDlg();
  },
  gwPay: fd => run(async () => {
    const e = S.data.events[U.eventId], p = U.pay; if (!e || !p || p.step === 'wait') return;
    const g = GW[p.gw], method = g.methods[p.method] || g.methods[0];
    if (method === 'Card') {
      if (String(fd.get('card')).replace(/\D/g, '').length < 13) return dlgErr('Enter the full card number.');
      if (!/^\s*\d{2}\s*\/\s*\d{2}\s*$/.test(String(fd.get('exp')))) return dlgErr('Enter the expiry date as MM/YY.');
      if (!/^\d{3,4}$/.test(String(fd.get('cvv')).trim())) return dlgErr('Enter the 3-digit CVV from the back of the card.');
    }
    if (method === 'Mobile money' && String(fd.get('phone')).replace(/\D/g, '').length < 10) return dlgErr('Enter the mobile money phone number.');
    const decline = method === 'Card' && fd.get('decline');
    p.step = 'wait';
    openDlg(`<div class="gw-wait" style="--gw:${g.color}"><div class="spin"></div><p>Confirming your payment with ${g.name}…</p></div>`);
    await sleep(1400);
    if (decline) { p.step = 'pay'; gatewayDlg(); return dlgErr('Card declined by the bank. Try another card or another way to pay.'); }
    const err = cartError(e, p.name, p.email); if (err) { p.step = 'pay'; gatewayDlg(); return dlgErr(err); }
    const total = cartTotal(e), order = await placeOrder(e, p, p.gw, method);
    await orderDone('Payment successful', `${naira(total)} paid with ${g.name}. Reference ${esc(order.txRef)}.`, p.email);
  }),
  transfer: fd => run(async () => {
    const t = S.data.tickets[fd.get('id')], e = t && S.data.events[t.eventId]; if (!t || !e) return closeDlg();
    const name = String(fd.get('name')).trim(), email = String(fd.get('email')).trim().toLowerCase();
    if (!name) return dlgErr("Enter the person's full name. The gate will see it.");
    if (!validEmail(email)) return dlgErr('Enter a full email address, like tolu@example.com.');
    if (email === t.holderEmail) return dlgErr('This ticket is already under that email.');
    if (!canTransfer(t, e)) return dlgErr('This ticket can no longer be transferred.');
    await patch('tickets', t.id, { holderName: name, holderEmail: email, transfers: (t.transfers || 0) + 1, code: rnd(8), secret: rnd(12), oldCodes: [...(t.oldCodes || []), t.code], history: [...(t.history || []), { at: Date.now(), fromName: t.holderName, fromEmail: t.holderEmail, toName: name, toEmail: email }] });
    closeDlg(); toast(`Ticket transferred to ${email}.`);
  }),
  gateIn(fd) {
    const gid = String(fd.get('gid')).trim().toUpperCase(), pin = String(fd.get('pin')).trim();
    const p = Object.values(S.data.passes).find(p => String(p.loginId).toUpperCase() === gid && String(p.pin) === pin && p.active !== false && S.data.events[p.eventId]);
    if (!p) return void ($('#gate-err').textContent = 'That Gate ID and PIN do not match. Check them with the organiser.');
    U.gate = p.id; U.scan = null; ls.set('sg:gate', p.id); render(true);
  },
  manual(fd) { const code = String(fd.get('code')).trim(); if (code) handleScan(code); },
  userUp: fd => run(async () => {
    const name = String(fd.get('name')).trim(), email = String(fd.get('email')).trim().toLowerCase(), pw = String(fd.get('pw'));
    if (!name) return dlgErr('Enter your full name. It goes on your tickets.');
    if (!validEmail(email)) return dlgErr('Enter a full email address, like ada@example.com.');
    if (pw.length < 8) return dlgErr('Choose a password of at least 8 characters.');
    if (findBy('users', email)) return dlgErr('An account with this email already exists. Sign in instead.');
    const id = uid('u_'); await put('users', id, { name, email, pw: pwHash(email, pw), provider: 'password', createdAt: Date.now() });
    loginUser(S.data.users[id]);
  }),
  userIn(fd) {
    const email = String(fd.get('email')).trim().toLowerCase(), u = findBy('users', email);
    if (!u) return dlgErr('No account uses this email. Create an account first.');
    if (!u.pw) return dlgErr('This account signs in with Google. Use Continue with Google.');
    if (u.pw !== pwHash(email, String(fd.get('pw')))) return dlgErr('That password is not right.');
    loginUser(u);
  },
  googleGo: fd => run(async () => {
    const email = String(fd.get('email')).trim().toLowerCase(), name = String(fd.get('name')).trim(), who = fd.get('who');
    if (!validEmail(email)) return dlgErr('Enter the full Google account email.');
    if (!name) return dlgErr('Enter the name on the account.');
    if (who === 'host') {
      const h = findBy('hosts', email);
      if (h) { U.hostId = h.id; ls.set('en:host', h.id); U.auth = { mode: 'in' }; closeDlg(); return hgo('shows', { adminEvent: null }); }
      U.auth = { mode: 'up', google: true, email, name }; closeDlg(); return render(true);
    }
    let u = findBy('users', email);
    if (!u) { const id = uid('u_'); await put('users', id, { name, email, pw: null, provider: 'google', createdAt: Date.now() }); u = S.data.users[id]; }
    loginUser(u);
  }),
  hostIn(fd) {
    const email = String(fd.get('email')).trim().toLowerCase(), h = findBy('hosts', email), err = $('#h-err');
    if (!h) return void (err.textContent = 'No host account uses this email. Create a host account first.');
    if (!h.pw) return void (err.textContent = 'This host account signs in with Google. Use Continue with Google.');
    if (h.pw !== pwHash(email, String(fd.get('pw')))) return void (err.textContent = 'That password is not right.');
    U.hostId = h.id; ls.set('en:host', h.id); hgo('shows', { adminEvent: null });
  },
  hostUp1(fd) {
    const a = U.auth, org = String(fd.get('org')).trim(), name = String(fd.get('name')).trim(), err = $('#h-err');
    if (!org || !name) return void (err.textContent = 'Enter your organisation name and your own name.');
    let email = a.email, pwh = null;
    if (!a.google) {
      email = String(fd.get('email')).trim().toLowerCase(); const pw = String(fd.get('pw'));
      if (!validEmail(email)) return void (err.textContent = 'Enter a full email address, like bookings@example.com.');
      if (pw.length < 8) return void (err.textContent = 'Choose a password of at least 8 characters.');
      pwh = pwHash(email, pw);
    }
    if (findBy('hosts', email)) return void (err.textContent = 'A host account with this email already exists. Sign in instead.');
    U.auth = { ...a, mode: 'up2', org, name, email, pwh }; render(true); window.scrollTo(0, 0);
  },
  hostUp2: () => run(async () => {
    const a = U.auth, r = planFrom(a, true);
    if (r.err) return void ($('#h-err').textContent = r.err);
    if (findBy('hosts', a.email)) return void ($('#h-err').textContent = 'A host account with this email already exists. Sign in instead.');
    const id = uid('h_');
    await put('hosts', id, { org: a.org, name: a.name, email: a.email, pw: a.pwh || null, provider: a.google ? 'google' : 'password', plan: r.plan, status: r.status, agreedFee: null, contactNote: '', contactAt: null, createdAt: Date.now() });
    U.hostId = id; ls.set('en:host', id); U.auth = { mode: 'in' }; hgo('shows', { adminEvent: null });
    toast(r.status === 'pending' ? 'Account created. Tell us about your show to agree the fee.' : 'Host account created.');
  }),
  hostMsg: fd => run(async () => { const h = host(), msg = String(fd.get('msg')).trim(); if (!h) return; if (msg.length < 10) return void ($('#h-err').textContent = 'Add a few details about the show first.'); await patch('hosts', h.id, { contactNote: msg.slice(0, 1200), contactAt: Date.now() }); toast('Sent to the Entrava team.'); }),
  hostPlan: () => run(async () => {
    const h = host(), r = planFrom(U.auth, false); if (!h) return closeDlg();
    if (r.err) return dlgErr(r.err);
    await patch('hosts', h.id, { plan: r.plan, status: r.status }); U.auth = { mode: 'in' }; closeDlg();
    toast(r.status === 'pending' ? 'Saved. Tell us about your show to agree the fee.' : `Saved. ${FEE}% management fee applies to each sale.`);
  }),
  hostTransfer: fd => run(async () => {
    const t = S.data.tickets[fd.get('id')], e = t && S.data.events[t.eventId]; if (!t || !e) return closeDlg();
    const name = String(fd.get('name')).trim(), email = String(fd.get('email')).trim().toLowerCase();
    if (!name) return dlgErr("Enter the new holder's full name.");
    if (!validEmail(email)) return dlgErr('Enter a full email address, like tolu@example.com.');
    if (email === t.holderEmail) return dlgErr('This ticket is already under that email.');
    if (t.voided || t.checkedInAt) return dlgErr('This ticket can no longer be transferred.');
    await patch('tickets', t.id, { holderName: name, holderEmail: email, code: rnd(8), secret: rnd(12), oldCodes: [...(t.oldCodes || []), t.code], history: [...(t.history || []), { at: Date.now(), fromName: t.holderName, fromEmail: t.holderEmail, toName: name, toEmail: email, by: 'host' }] });
    closeDlg(); toast(`Ticket moved to ${email}. The old QR code no longer works.`);
  }),
  staffIn(fd) { if (String(fd.get('code')).trim() !== ADMIN_CODE) return dlgErr('That passcode is not right.'); U.staff = true; ls.set('en:staff', true); closeDlg(); U.tq = ''; render(true); window.scrollTo(0, 0); },
  staffApprove: fd => run(async () => { const h = S.data.hosts[fd.get('id')], fee = Math.max(0, Math.round(Number(fd.get('fee')) || 0)); if (!h) return; await patch('hosts', h.id, { status: 'active', agreedFee: fee }); toast(`${h.org} approved with a ${naira(fee)} management fee.`); }),
  eventSave: fd => run(async () => {
    const id = String(fd.get('id') || ''), old = id ? S.data.events[id] : null, h = host(); if (!h) return closeDlg();
    const free = h.plan === 'free';
    const title = String(fd.get('title')).trim(), venue = String(fd.get('venue')).trim(), city = String(fd.get('city')).trim(), startsAt = new Date(String(fd.get('when'))).getTime();
    if (!title || !venue || !city) return dlgErr('Add the show name, venue and city.');
    if (!Number.isFinite(startsAt)) return dlgErr('Choose the date and start time.');
    const tiers = [];
    for (const i of [1, 2, 3]) {
      const name = String(fd.get('tn' + i) || '').trim(), price = free ? 0 : Number(fd.get('tp' + i)), qty = Math.floor(Number(fd.get('tq' + i))), tid = 't' + i, s = old ? sold(old.id, tid) : 0;
      if (!name) { if (s) return dlgErr(`Ticket type ${i} has ${plural(s, 'ticket')} sold, so it can't be removed.`); continue; }
      if (!(price >= 0) || !(qty >= 1)) return dlgErr(`Give ${name} a price and a quantity of at least 1.`);
      if (qty < s) return dlgErr(`${name} has already sold ${s}. Its quantity can't go below that.`);
      tiers.push({ id: tid, name, price, qty });
    }
    if (!tiers.length) return dlgErr('Add at least one ticket type.');
    const maxPerBuyer = Math.min(20, Math.max(1, Math.floor(Number(fd.get('max')) || 1)));
    const doc = { hostId: old ? (old.hostId || h.id) : h.id, title, artist: String(fd.get('artist') || '').trim(), venue, city, startsAt, tone: POSTER[fd.get('tone')] ? String(fd.get('tone')) : 'electric', tiers, maxPerBuyer, maxTransfers: Number(fd.get('transfers')) || 0, releaseHours: Number(fd.get('release')) || 12, releasedEarly: old ? !!old.releasedEarly : false, releasedAt: old ? (old.releasedAt || null) : null, createdAt: old ? (old.createdAt || Date.now()) : Date.now() };
    const eid = id || uid('e_');
    await put('events', eid, doc);
    if (!old) { const n = Math.min(8, Math.max(1, Math.floor(Number(fd.get('gates')) || 2))), names = ['Male lane', 'Female lane']; for (let i = 0; i < n; i++) await put('passes', uid('p_'), newPass(eid, names[i] || `Lane ${i + 1}`, Date.now() + i)); }
    closeDlg(); if (!old) hgo('event', { adminEvent: eid, adminTab: 'passes', q: '' }); toast(old ? 'Changes saved.' : 'Show created. Gate logins are ready.');
  }),
  passAdd: fd => run(async () => { const label = String(fd.get('label')).trim(); if (!label) return; await put('passes', uid('p_'), newPass(String(fd.get('eventId')), label, Date.now())); const i = $('#p-label'); if (i) i.value = ''; toast('Gate login added.'); })
};

/* ---------- render ---------- */
const VIEWS = { shows: showsView, event: eventView, mine: mineView };
function viewHTML() {
  if (!S.ready) return `<p class="loading">Loading…</p>`;
  if (U.me && !S.data.users[U.me.id]) { U.me = null; ls.del('en:me'); }
  if (U.site === 'gate') return gateView();
  if (U.site === 'host') return hostView();
  if (!U.me) return landingView();
  return (VIEWS[U.view] || showsView)();
}
function navSync() {
  let items = [], right = '';
  if (U.site === 'main') {
    if (U.me) { items = [['go', 'shows', 'Shows', U.view === 'shows' || U.view === 'event'], ['go', 'mine', 'My tickets', U.view === 'mine']]; right = `<button class="acct" data-act="account" aria-label="Your account, ${esc(U.me.email)}">${esc(String(U.me.name || U.me.email).trim().charAt(0).toUpperCase())}</button>`; }
    else right = `<button class="btn btn-sm" data-act="auth" data-mode="in">Sign in</button>`;
  } else if (U.site === 'host') {
    const h = host();
    if (U.staff) right = `<button class="btn btn-sm btn-quiet" data-act="staffOut">Leave staff view</button>`;
    else if (h && h.status === 'active') items = [['hgo', 'shows', 'My shows', U.hview === 'shows' || U.hview === 'event'], ['hgo', 'tickets', 'All tickets', U.hview === 'tickets'], ['hgo', 'account', 'Account', U.hview === 'account']];
  }
  const tag = $('#site-tag'); tag.hidden = U.site === 'main'; tag.textContent = U.site === 'host' ? (U.staff ? 'Staff' : 'Hosts') : 'Check-in';
  $('#nav').innerHTML = items.map(([act, v, label, cur]) => `<button data-act="${act}" data-view="${v}"${cur ? ' aria-current="page"' : ''}>${label}</button>`).join('');
  $('#top-r').innerHTML = right;
  $$('.sitebar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.site === U.site)));
}
function tickLive() { const s = 'Live ' + new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }); $$('[data-live]').forEach(el => { el.textContent = s; }); }
function render(force) {
  const app = $('#app');
  if (!force && U.site === 'gate' && $('#gate-shell') && gatePass()) return gateRefresh();
  if (Cam.on) camStop();
  const keep = {}; $$('input[id],select[id],textarea[id]', app).forEach(el => { if (el.type !== 'file') keep[el.id] = el.value; });
  const act = document.activeElement, actId = act && app.contains(act) ? act.id : '';
  let sel = null; try { if (actId && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch {}
  app.innerHTML = viewHTML();
  if (!force) {
    for (const id in keep) { const el = document.getElementById(id); if (el && el.type !== 'file') el.value = keep[id]; }
    if (actId) { const el = document.getElementById(actId); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  }
  navSync(); drawQRs(app); tickLive(); heroSync(); watchReveals();
  if ($('#gate-shell')) gateRefresh();
  $('#foot').textContent = !S.ready ? '' : `Entrava prototype. Sign-in, payments, emails and wallet passes are simulated. ${S.mode === 'cloud' ? 'Sales and check-ins sync live across every device that opens this page.' : 'Data is saved on this device only.'}`;
}

/* ---------- events ---------- */
document.addEventListener('click', ev => { const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return; const fn = ACT[b.dataset.act]; if (fn) fn(b.dataset, b, ev); });
document.addEventListener('submit', ev => { const f = ev.target.closest('form[data-form]'); if (!f) return; ev.preventDefault(); const fn = FORMS[f.dataset.form]; if (fn) fn(new FormData(f), f); });
document.addEventListener('input', ev => { const el = ev.target; if (el.dataset && (el.dataset.in === 'q' || el.dataset.in === 'tq')) { U[el.dataset.in] = el.value; render(false); } });
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.auth != null) { U.auth = { ...U.auth, [el.name]: el.type === 'checkbox' ? el.checked : el.value }; if ($('#dlg').open) planDlg(); else render(true); return; }
  if (ev.target.id === 'scan-file' && ev.target.files && ev.target.files[0]) { scanFile(ev.target.files[0]); ev.target.value = ''; } });
document.addEventListener('pointerdown', ev => {
  let b = ev.target.closest('.btn, .card-hit'); if (!b || b.disabled) return;
  let x = ev.clientX, y = ev.clientY;
  if (b.classList.contains('card-hit')) { const inner = b.parentElement.querySelector('.card-foot .btn'); if (!inner) return; const r = inner.getBoundingClientRect(); b = inner; x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
  s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${x - r.left - d / 2}px;top:${y - r.top - d / 2}px`;
  b.append(s); s.addEventListener('animationend', () => s.remove());
});
const dlg = $('#dlg');
const paying = () => U.pay && U.pay.step === 'wait';
dlg.addEventListener('cancel', ev => { if (paying()) ev.preventDefault(); });
dlg.addEventListener('close', () => { dlg.innerHTML = ''; });
dlg.addEventListener('click', ev => { if (ev.target === ev.currentTarget && !paying()) closeDlg(); });
window.addEventListener('scroll', topSync, { passive: true });
window.addEventListener('pagehide', camStop);
setInterval(tickLive, 1000);
setInterval(() => { if (!S.ready || dlg.open) return; const a = document.activeElement; if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return; render(false); }, 30000);
const savedTheme = ls.get('sg:theme', null); if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.dataset.theme = savedTheme;
themeSync();
if (LOCK) {
  $('.sitebar').hidden = true;
  const base = document.documentElement.dataset.base || './', links = { main: ['Fan site', base], host: ['For hosts', base + 'host/'], gate: ['Staff check-in', base + 'checkin/'] };
  $('#foot-links').innerHTML = Object.entries(links).filter(([k]) => k !== LOCK).map(([, [label, href]]) => `<a href="${href}">${label}</a>`).join('');
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeSync); new MutationObserver(themeSync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch {}

// if the device cannot keep up, drop the decorative motion and keep everything else
(() => { let n = 0, t0 = performance.now(), slow = 0; const f = t => { n++; const el = t - t0; if (el >= 2000) { if (el < 4000 && !document.hidden) { slow = n * 1000 / el < 22 ? slow + 1 : 0; if (slow >= 2) return void document.documentElement.classList.add('lowfx'); } n = 0; t0 = t; } requestAnimationFrame(f); }; requestAnimationFrame(f); })();

render(true);
initStore();
})();
