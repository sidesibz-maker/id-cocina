// I+D · datos. Todo se guarda en este ordenador (en el navegador con el que se abre la app): la libreta, «Mi cocina» y las
// marcas del radar en el almacenamiento local, y las imágenes en su base de datos local. No hay servidores ni cuentas.
// Nada se borra: lo que se quita va a la papelera. La copia de seguridad se descarga como un archivo y se puede recuperar.
import {buildKB, dishProfile} from './flavor-core.js';
import {buildKitchen} from './kitchen.js';
import {dayKey} from './i18n.js';
import {uid} from './ui.js';

const KEY = 'id-cocina-v1';
export const state = {
 canSee: true, canEdit: true, canPrices: false, setupPending: false,
 dishes: [], menus: [], subs: [], saber: {}, trends: [], settings: {}, marks: {}, pasted: [], lastBackup: '', seen: '',
 kb: null, kitchen: null, loaded: false, loadError: '', restaurant: {name: ''}
};
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });
const arr = v => (Array.isArray(v) ? v : []);

// ---------- Guardar en este ordenador ----------
function read() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export function persist() {
 try {
  localStorage.setItem(KEY, JSON.stringify({dishes: state.dishes, menus: state.menus, subs: state.subs, saber: state.saber, settings: state.settings, marks: state.marks, pasted: state.pasted, lastBackup: state.lastBackup, seen: state.seen}));
  return true;
 } catch { return false; }
}
export function cleanDish(d) {
 return {...d, name: String(d.name || ''), concept: String(d.concept || ''), course: d.course || 'otro', season: d.season || '', status: d.status || 'idea', tags: arr(d.tags), components: arr(d.components), tests: arr(d.tests), images: arr(d.images), notes: String(d.notes || ''), version: Number(d.version) || 1};
}
export const trendId = t => t.id || 'r' + [...(String(t.day) + '|' + String(t.title))].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
function mergeTrends() {
 const file = arr(typeof window !== 'undefined' ? window.ID_RADAR : []), seen = new Set(), out = [];
 for (const t of [...file, ...state.pasted]) {
  if (!t || typeof t !== 'object' || !String(t.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.day || ''))) continue;
  const id = trendId(t);
  if (seen.has(id)) continue;
  seen.add(id);
  out.push({kind: 'plato', heat: 'alza', summary: '', why: '', adapt: '', places: [], sources: [], ideas: [], tags: [], ...t, id, created_at: t.created_at || t.day, saved_at: state.marks[id]?.saved_at || null, dismissed_at: state.marks[id]?.dismissed_at || null});
 }
 state.trends = out.sort((a, b) => String(b.day).localeCompare(String(a.day)) || (Number(b.fit) || 0) - (Number(a.fit) || 0));
}

let kbPromise = null;
export function loadKB() { kbPromise ||= import('./flavor-data.js').then(m => { state.kb = buildKB(m.TABLE); return state.kb; }); return kbPromise; }
export async function loadAll() {
 const saved = read();
 state.dishes = arr(saved.dishes).map(cleanDish).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
 state.menus = arr(saved.menus).filter(m => m && m.id).map(cleanMenu);
 state.subs = arr(saved.subs).filter(x => x && x.id).map(cleanSub);
 state.saber = saved.saber && typeof saved.saber === 'object' ? saved.saber : {};
 state.settings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
 state.marks = saved.marks && typeof saved.marks === 'object' ? saved.marks : {};
 state.pasted = arr(saved.pasted); state.lastBackup = String(saved.lastBackup || ''); state.seen = String(saved.seen || '');
 mergeTrends();
 const kb = await loadKB();
 state.kitchen = buildKitchen(kb, state.subs);
 state.loaded = true;
 emit('load');
}
export const refreshLab = () => {};
export const readCache = () => false;
export const userName = () => state.settings?.name || '';

// ---------- La libreta ----------
export const dishById = id => state.dishes.find(d => d.id === id) || null;
export const liveDishes = () => state.dishes.filter(d => !d.deleted_at);
export const fetchDish = async id => dishById(id);
export const withFlavor = dish => { const p = state.kb ? dishProfile(state.kb, dish) : null; return p && !p.empty ? {axes: p.axes, dominant: p.dominant} : null; };
function save(what) { if (!persist()) throw Error('quota'); emit(what); }
export async function createDish(fields = {}) {
 const at = new Date().toISOString();
 const row = cleanDish({id: uid(), name: String(fields.name || '').trim().slice(0, 140) || 'Plato sin nombre', concept: String(fields.concept || '').slice(0, 600), course: fields.course || 'otro', season: fields.season || '', status: fields.status || 'idea', tags: arr(fields.tags).slice(0, 20), components: arr(fields.components), tests: [], images: [], notes: String(fields.notes || '').slice(0, 6000), plating: String(fields.plating || '').slice(0, 2000), portions: String(fields.portions || '').slice(0, 30), source: fields.source || null, advice: null, cover_path: null, version: 1, created_at: at, updated_at: at, deleted_at: null});
 row.flavor = withFlavor(row);
 state.dishes.unshift(row);
 save('dishes');
 return row;
}
// Guarda solo los campos que han cambiado; lo demás se queda como estaba.
export async function saveDish(id, patch) {
 const at = state.dishes.findIndex(d => d.id === id);
 if (at < 0) throw Error('not found');
 snapshotDish(state.dishes[at]);
 const next = cleanDish({...state.dishes[at], ...patch, version: state.dishes[at].version + 1, updated_at: new Date().toISOString()});
 if ('components' in patch || !next.flavor) next.flavor = withFlavor(next);
 state.dishes[at] = next;
 save('dishes');
 return next;
}
export const trashDish = id => saveDish(id, {deleted_at: new Date().toISOString()});

// ---------- Subrecetas propias: salsas, fondos, encurtidos… que se usan como un ingrediente más ----------
export function cleanSub(x) { return {...x, name: String(x.name || ''), items: arr(x.items).filter(i => i && String(i.n || '').trim()), method: String(x.method || ''), yield: String(x.yield || ''), notes: String(x.notes || ''), version: Number(x.version) || 1}; }
export const subById = id => state.subs.find(x => x.id === id) || null;
export const liveSubs = () => state.subs.filter(x => !x.deleted_at).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const rebuildKitchen = () => { if (state.kb) state.kitchen = buildKitchen(state.kb, state.subs); };
export async function createSub(fields = {}) {
 const at = new Date().toISOString();
 const row = cleanSub({id: uid(), name: String(fields.name || '').trim().slice(0, 90) || 'Subreceta', items: arr(fields.items), method: String(fields.method || '').slice(0, 4000), yield: '', notes: '', kb: fields.kb || null, created_at: at, updated_at: at, deleted_at: null, version: 1});
 state.subs.push(row); rebuildKitchen(); save('subs');
 return row;
}
export async function saveSub(id, patch) {
 const at = state.subs.findIndex(x => x.id === id);
 if (at < 0) throw Error('not found');
 state.subs[at] = cleanSub({...state.subs[at], ...patch, version: state.subs[at].version + 1, updated_at: new Date().toISOString()});
 rebuildKitchen(); save('subs');
 return state.subs[at];
}

// ---------- Saber: tus versiones de cada entrada (con su historia) y las entradas que creas tú ----------
// Nunca se sobrescribe una versión: cada cambio se añade con su fecha y el porqué.
export const saberMine = id => state.saber[id] || null;
export async function addSaberVersion(id, text, why = '') {
 const at = new Date().toISOString(), cur = state.saber[id] || {id, custom: null, versions: [], created_at: at};
 state.saber[id] = {...cur, versions: [...arr(cur.versions), {at, text: String(text).slice(0, 8000), why: String(why).slice(0, 300), by: userName()}].slice(-300), updated_at: at};
 save('saber');
 return state.saber[id];
}
export async function saveSaberEntry(entry) {
 const at = new Date().toISOString(), cur = state.saber[entry.id] || {id: entry.id, versions: [], created_at: at};
 state.saber[entry.id] = {...cur, custom: entry, updated_at: at, deleted_at: null};
 save('saber');
 return state.saber[entry.id];
}
export async function trashSaberEntry(id, back = false) {
 const cur = state.saber[id];
 if (!cur) return;
 state.saber[id] = {...cur, deleted_at: back ? null : new Date().toISOString(), updated_at: new Date().toISOString()};
 save('saber');
}

// ---------- Cartas y menús: platos de la libreta en orden, para ver si el conjunto está equilibrado ----------
export function cleanMenu(m) { return {...m, name: String(m.name || ''), kind: m.kind === 'carta' ? 'carta' : 'degustacion', items: arr(m.items).filter(x => x && x.dish_id), notes: String(m.notes || ''), version: Number(m.version) || 1}; }
export const menuById = id => state.menus.find(m => m.id === id) || null;
export const liveMenus = () => state.menus.filter(m => !m.deleted_at).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
export async function createMenu(fields = {}) {
 const at = new Date().toISOString();
 const row = cleanMenu({id: uid(), name: String(fields.name || '').trim().slice(0, 120) || 'Menú sin nombre', kind: fields.kind, items: arr(fields.items), notes: fields.notes, advice: null, created_at: at, updated_at: at, deleted_at: null, version: 1});
 state.menus.unshift(row); save('menus');
 return row;
}
export async function saveMenu(id, patch) {
 const at = state.menus.findIndex(m => m.id === id);
 if (at < 0) throw Error('not found');
 const next = cleanMenu({...state.menus[at], ...patch, version: state.menus[at].version + 1, updated_at: new Date().toISOString()});
 state.menus[at] = next; save('menus');
 return next;
}
export const restoreDish = id => saveDish(id, {deleted_at: null});

// ---------- El radar ----------
export async function markTrend(id, patch) {
 const m = {...(state.marks[id] || {}), at: new Date().toISOString()};
 for (const k of ['saved_at', 'dismissed_at']) if (k in patch) m[k] = patch[k];
 state.marks[id] = m; mergeTrends(); save('trends');
}
// Avisos pegados desde una búsqueda hecha con Claude o ChatGPT: se suman al radar, nunca sustituyen a los anteriores.
export function addTrends(list) {
 const day = dayKey(), before = state.trends.length;
 state.pasted = [...state.pasted, ...arr(list).filter(t => t && typeof t === 'object' && String(t.title || '').trim()).map(t => ({...t, day: /^\d{4}-\d{2}-\d{2}$/.test(String(t.day || '')) ? t.day : day, added_at: new Date().toISOString()}))].slice(-400);
 mergeTrends(); save('trends');
 return state.trends.length - before;
}
export const lastSeen = () => state.seen;
export const liveTrends = () => state.trends.filter(x => !x.dismissed_at);
export const unseenTrends = () => liveTrends().filter(x => String(x.day) > state.seen).length;
export function markRadarSeen() {
 const newest = state.trends.reduce((m, x) => (String(x.day) > m ? String(x.day) : m), '');
 if (!newest || newest === state.seen) return;
 state.seen = newest; persist(); emit('seen');
}

// ---------- Mi cocina ----------
export async function saveSettings(profile) { state.settings = {...profile, _at: new Date().toISOString()}; state.hasSettings = true; save('settings'); }

// ---------- Imágenes (en la base de datos local del navegador) ----------
const DB = 'id-cocina', STORE = 'images', urls = new Map();
const idb = () => new Promise((resolve, reject) => { const r = indexedDB.open(DB, 2); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const tx = async (mode, run) => { const db = await idb(); return new Promise((resolve, reject) => { const t = db.transaction(STORE, mode), q = run(t.objectStore(STORE)); t.oncomplete = () => resolve(q?.result); t.onerror = () => reject(t.error); }); };
export async function imageUrl(path) {
 if (!path) return '';
 if (urls.has(path)) return urls.get(path);
 try { const blob = await tx('readonly', s => s.get(path)); if (!blob) return ''; const url = URL.createObjectURL(blob); urls.set(path, url); return url; } catch { return ''; }
}
export async function uploadImage(folder, blob) {
 const path = 'img/' + folder + '/' + uid();
 await tx('readwrite', s => s.put(blob, path));
 urls.set(path, URL.createObjectURL(blob));
 return path;
}

export const imageBlob = path => tx('readonly', st => st.get(path)).catch(() => null);
export async function storeImage(path, blob) { await tx('readwrite', st => st.put(blob, path)); urls.delete(path); }
export const hasImage = async path => !!(await imageBlob(path));

// ---------- Lo que llega del otro aparato (sincronización) ----------
// Gana lo más reciente de cada cosa; nada se borra (lo que se quita va con su marca de papelera).
export function applyRemote(items) {
 let changed = 0;
 const newer = (a, b) => String(a || '') > String(b || '');
 for (const it of arr(items)) {
  const d = it?.data;
  if (!d || typeof d !== 'object') continue;
  if (it.kind === 'dish') { const at = state.dishes.findIndex(x => x.id === it.id); if (at < 0) { state.dishes.push(cleanDish(d)); changed++; } else if (newer(d.updated_at, state.dishes[at].updated_at)) { snapshotDish(state.dishes[at], true); state.dishes[at] = cleanDish(d); changed++; } }
  else if (it.kind === 'menu') { const at = state.menus.findIndex(x => x.id === it.id); if (at < 0) { state.menus.push(cleanMenu(d)); changed++; } else if (newer(d.updated_at, state.menus[at].updated_at)) { state.menus[at] = cleanMenu(d); changed++; } }
  else if (it.kind === 'sub') { const at = state.subs.findIndex(x => x.id === it.id); if (at < 0) { state.subs.push(cleanSub(d)); changed++; } else if (newer(d.updated_at, state.subs[at].updated_at)) { state.subs[at] = cleanSub(d); changed++; } }
  else if (it.kind === 'saber') { const next = mergeSaber(state.saber[it.id], d); if (JSON.stringify(next) !== JSON.stringify(state.saber[it.id] || null)) { state.saber[it.id] = next; changed++; } }
  else if (it.kind === 'mark') { if (newer(d.at, state.marks[it.id]?.at)) { state.marks[it.id] = d; changed++; } }
  else if (it.kind === 'trend') { if (!state.pasted.some(x => trendId(x) === it.id)) { state.pasted.push(d); changed++; } }
  else if (it.kind === 'settings') { if (newer(d._at, state.settings?._at)) { state.settings = d; changed++; } }
 }
 if (changed) {
  state.dishes.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  state.pasted = state.pasted.slice(-400);
  mergeTrends(); rebuildKitchen();
  if (!persist()) throw Error('quota');
  emit('remote');
 }
 return changed;
}
// Todo lo de este aparato que se sincroniza, con la fecha de su último cambio.
export function syncItems() {
 const at = v => (v && !isNaN(new Date(v)) ? new Date(v).toISOString() : '2026-01-01T00:00:00.000Z');
 return [
  ...state.dishes.map(d => ({kind: 'dish', id: d.id, data: d, updated_at: at(d.updated_at)})),
  ...state.menus.map(m => ({kind: 'menu', id: m.id, data: m, updated_at: at(m.updated_at)})),
  ...state.subs.map(x => ({kind: 'sub', id: x.id, data: x, updated_at: at(x.updated_at)})),
  ...Object.values(state.saber).filter(x => x && x.id).map(x => ({kind: 'saber', id: x.id, data: x, updated_at: at(x.updated_at)})),
  ...Object.entries(state.marks).map(([id, m]) => ({kind: 'mark', id, data: m, updated_at: at(m?.at)})),
  ...state.pasted.map(t => ({kind: 'trend', id: trendId(t), data: t, updated_at: at(t.added_at || t.day)})),
  ...(Object.keys(state.settings || {}).length ? [{kind: 'settings', id: 'perfil', data: state.settings, updated_at: at(state.settings._at)}] : [])
 ];
}
// Dos copias de lo mismo en el Saber: se suman las versiones (sin repetir) y se queda la entrada propia y la papelera más recientes.
export function mergeSaber(a, b) {
 if (!a) return b; if (!b) return a;
 const seen = new Set(), versions = [...arr(a.versions), ...arr(b.versions)].filter(v => { const k = v.at + '|' + v.text; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => String(x.at).localeCompare(String(y.at)));
 const newer = String(b.updated_at || '') > String(a.updated_at || '') ? b : a;
 return {...a, ...b, versions, custom: newer.custom ?? a.custom ?? b.custom ?? null, deleted_at: newer.deleted_at || null, updated_at: [a.updated_at, b.updated_at].sort().pop()};
}
export const imagePaths = () => [...new Set(state.dishes.flatMap(d => arr(d.images).map(i => i?.path).filter(Boolean)))];

// ---------- Versiones anteriores de cada plato (en este aparato) ----------
// Antes de cambiar un plato se guarda cómo estaba, como mucho una vez cada 15 minutos (o siempre, si se pide), hasta 60 por plato.
const lastSnap = new Map();
const vtx = async (mode, run) => { const db = await idb(); return new Promise((resolve, reject) => { const t = db.transaction('versions', mode), q = run(t.objectStore('versions')); t.oncomplete = () => resolve(q?.result); t.onerror = () => reject(t.error); }); };
export async function snapshotDish(dish, force = false) {
 if (!dish?.id) return;
 const now = Date.now();
 if (!force && now - (lastSnap.get(dish.id) || 0) < 15 * 60000) return;
 lastSnap.set(dish.id, now);
 try {
  const copy = JSON.parse(JSON.stringify(dish));
  await vtx('readwrite', st => st.put({dish_id: dish.id, at: new Date(now).toISOString(), data: copy}, dish.id + '|' + new Date(now).toISOString()));
  const keys = await vtx('readonly', st => st.getAllKeys(IDBKeyRange.bound(dish.id + '|', dish.id + '|\uffff')));
  if (keys.length > 60) await vtx('readwrite', st => { for (const k of keys.slice(0, keys.length - 60)) st.delete(k); return null; });
 } catch {}
}
export async function dishVersions(id) {
 try { const list = await vtx('readonly', st => st.getAll(IDBKeyRange.bound(id + '|', id + '|\uffff'))); return (list || []).sort((a, b) => b.at.localeCompare(a.at)); } catch { return []; }
}

// ---------- Copia de seguridad: un archivo con todo, imágenes incluidas ----------
const toData = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
export async function exportBackup() {
 const images = {};
 for (const d of state.dishes) for (const i of d.images) { if (!i?.path || images[i.path]) continue; try { const blob = await tx('readonly', s => s.get(i.path)); if (blob) images[i.path] = await toData(blob); } catch {} }
 state.lastBackup = new Date().toISOString(); persist();
 return new Blob([JSON.stringify({app: 'id-cocina', version: 1, exported_at: state.lastBackup, dishes: state.dishes, menus: state.menus, subs: state.subs, saber: state.saber, settings: state.settings, marks: state.marks, pasted: state.pasted, images})], {type: 'application/json'});
}
// Recuperar una copia suma: los platos que no están se añaden y, si un plato está en los dos sitios, se queda el más reciente.
export async function importBackup(text) {
 const data = JSON.parse(text);
 if (!data || data.app !== 'id-cocina' || !Array.isArray(data.dishes)) throw Error('format');
 let added = 0, updated = 0;
 for (const raw of data.dishes) {
  if (!raw || !raw.id) continue;
  const at = state.dishes.findIndex(d => d.id === raw.id);
  if (at < 0) { state.dishes.push(cleanDish(raw)); added++; }
  else if (String(raw.updated_at || '') > String(state.dishes[at].updated_at || '')) { state.dishes[at] = cleanDish(raw); updated++; }
 }
 // Saber: se juntan las versiones de los dos lados (ninguna se pierde) y gana la entrada propia más reciente.
 for (const [id, raw] of Object.entries(data.saber && typeof data.saber === 'object' ? data.saber : {})) {
  if (!raw || typeof raw !== 'object') continue;
  state.saber[id] = mergeSaber(state.saber[id], raw);
 }
 for (const raw of arr(data.subs)) {
  if (!raw || !raw.id) continue;
  const at = state.subs.findIndex(x => x.id === raw.id);
  if (at < 0) state.subs.push(cleanSub(raw));
  else if (String(raw.updated_at || '') > String(state.subs[at].updated_at || '')) state.subs[at] = cleanSub(raw);
 }
 rebuildKitchen();
 for (const raw of arr(data.menus)) {
  if (!raw || !raw.id) continue;
  const at = state.menus.findIndex(m => m.id === raw.id);
  if (at < 0) state.menus.push(cleanMenu(raw));
  else if (String(raw.updated_at || '') > String(state.menus[at].updated_at || '')) state.menus[at] = cleanMenu(raw);
 }
 for (const [path, url] of Object.entries(data.images || {})) { try { const blob = await (await fetch(url)).blob(); await tx('readwrite', s => s.put(blob, path)); } catch {} }
 if (data.settings && typeof data.settings === 'object' && !Object.keys(state.settings).length) state.settings = data.settings;
 state.marks = {...(data.marks || {}), ...state.marks};
 const have = new Set(state.pasted.map(t => t.day + '|' + t.title));
 state.pasted = [...state.pasted, ...arr(data.pasted).filter(t => t && !have.has(t.day + '|' + t.title))];
 state.dishes.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
 mergeTrends(); save('load');
 return {added, updated};
}
