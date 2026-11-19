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
 dishes: [], trends: [], settings: {}, marks: {}, pasted: [], lastBackup: '', seen: '',
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
  localStorage.setItem(KEY, JSON.stringify({dishes: state.dishes, settings: state.settings, marks: state.marks, pasted: state.pasted, lastBackup: state.lastBackup, seen: state.seen}));
  return true;
 } catch { return false; }
}
export function cleanDish(d) {
 return {...d, name: String(d.name || ''), concept: String(d.concept || ''), course: d.course || 'otro', season: d.season || '', status: d.status || 'idea', tags: arr(d.tags), components: arr(d.components), tests: arr(d.tests), images: arr(d.images), notes: String(d.notes || ''), version: Number(d.version) || 1};
}
const trendId = t => t.id || 'r' + [...(String(t.day) + '|' + String(t.title))].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
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
 state.settings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
 state.marks = saved.marks && typeof saved.marks === 'object' ? saved.marks : {};
 state.pasted = arr(saved.pasted); state.lastBackup = String(saved.lastBackup || ''); state.seen = String(saved.seen || '');
 mergeTrends();
 const kb = await loadKB();
 state.kitchen = buildKitchen(kb);
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
 const next = cleanDish({...state.dishes[at], ...patch, version: state.dishes[at].version + 1, updated_at: new Date().toISOString()});
 if ('components' in patch || !next.flavor) next.flavor = withFlavor(next);
 state.dishes[at] = next;
 save('dishes');
 return next;
}
export const trashDish = id => saveDish(id, {deleted_at: new Date().toISOString()});
export const restoreDish = id => saveDish(id, {deleted_at: null});

// ---------- El radar ----------
export async function markTrend(id, patch) {
 const m = {...(state.marks[id] || {})};
 for (const k of ['saved_at', 'dismissed_at']) if (k in patch) m[k] = patch[k];
 state.marks[id] = m; mergeTrends(); save('trends');
}
// Avisos pegados desde una búsqueda hecha con Claude o ChatGPT: se suman al radar, nunca sustituyen a los anteriores.
export function addTrends(list) {
 const day = dayKey(), before = state.trends.length;
 state.pasted = [...state.pasted, ...arr(list).filter(t => t && typeof t === 'object' && String(t.title || '').trim()).map(t => ({...t, day: /^\d{4}-\d{2}-\d{2}$/.test(String(t.day || '')) ? t.day : day}))].slice(-400);
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
export async function saveSettings(profile) { state.settings = profile; state.hasSettings = true; save('settings'); }

// ---------- Imágenes (en la base de datos local del navegador) ----------
const DB = 'id-cocina', STORE = 'images', urls = new Map();
const idb = () => new Promise((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
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

// ---------- Copia de seguridad: un archivo con todo, imágenes incluidas ----------
const toData = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
export async function exportBackup() {
 const images = {};
 for (const d of state.dishes) for (const i of d.images) { if (!i?.path || images[i.path]) continue; try { const blob = await tx('readonly', s => s.get(i.path)); if (blob) images[i.path] = await toData(blob); } catch {} }
 state.lastBackup = new Date().toISOString(); persist();
 return new Blob([JSON.stringify({app: 'id-cocina', version: 1, exported_at: state.lastBackup, dishes: state.dishes, settings: state.settings, marks: state.marks, pasted: state.pasted, images})], {type: 'application/json'});
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
 for (const [path, url] of Object.entries(data.images || {})) { try { const blob = await (await fetch(url)).blob(); await tx('readwrite', s => s.put(blob, path)); } catch {} }
 if (data.settings && typeof data.settings === 'object' && !Object.keys(state.settings).length) state.settings = data.settings;
 state.marks = {...(data.marks || {}), ...state.marks};
 const have = new Set(state.pasted.map(t => t.day + '|' + t.title));
 state.pasted = [...state.pasted, ...arr(data.pasted).filter(t => t && !have.has(t.day + '|' + t.title))];
 state.dishes.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
 mergeTrends(); save('load');
 return {added, updated};
}
