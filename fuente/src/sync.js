// I+D · Sincronizar el PC y el móvil. Los platos, cartas, marcas del radar y «Mi cocina» se guardan también en una base de
// datos propia de esta app (separada de cualquier otra), dentro de una «libreta» que solo se abre con un código secreto largo.
// Gana siempre el cambio más reciente de cada cosa y nunca se borra nada: lo sustituido queda en el historial del servidor.
// El código se guarda solo en este aparato; no va en las copias de seguridad ni se envía a ningún otro sitio.
import {state, onChange, applyRemote, syncItems, imagePaths, imageBlob, storeImage, hasImage} from './store.js';

const API = 'https://dyacksxibcwvrdsulsfc.supabase.co/rest/v1/rpc/';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5YWNrc3hpYmN3dnJkc3Vsc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMzg2OTYsImV4cCI6MjExMDcxNDY5Nn0.8nuuA4yjJLHlrdD1XWjSyYmOtGH3RTS2BtdeJrOnNcs';
const KEY = 'id-cocina-sync', ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const syncConfig = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const saveConfig = patch => { const next = {...syncConfig(), ...patch}; localStorage.setItem(KEY, JSON.stringify(next)); return next; };
export const syncOn = () => /^[A-Z2-9]{24}$/.test(syncConfig().code || '');
export const pretty = code => String(code || '').replace(/(.{4})(?=.)/g, '$1-');
export const cleanCode = text => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

let status = {state: 'off', at: null, error: ''}, running = null, again = false, timer = null;
const watchers = new Set();
export const syncStatus = () => ({...status, on: syncOn(), last: syncConfig().last || null});
export const onSync = fn => { watchers.add(fn); return () => watchers.delete(fn); };
const setStatus = next => { status = {...status, ...next}; watchers.forEach(fn => { try { fn(syncStatus()); } catch {} }); };

async function rpc(name, body) {
 let res;
 try { res = await fetch(API + name, {method: 'POST', headers: {'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON}, body: JSON.stringify(body)}); }
 catch { throw Object.assign(Error(navigator.onLine === false ? 'offline' : 'net'), {kind: navigator.onLine === false ? 'offline' : 'net'}); }
 const data = await res.json().catch(() => null);
 if (!res.ok) throw Object.assign(Error(String(data?.message || res.status)), {kind: /no encontrada/.test(data?.message || '') ? 'missing' : /no caben/.test(data?.message || '') ? 'full' : 'server'});
 return data;
}
const toData = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });

// Una vuelta completa: subir lo cambiado aquí, bajar lo cambiado allí, y las imágenes que falten en cada lado.
async function round() {
 const cfg = syncConfig(), secret = cfg.code;
 // 1. Subir
 const mark = cfg.pushed || '';
 const all = syncItems();
 const mine = all.filter(x => x.kind !== 'doc' && x.updated_at > mark).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
 let top = mark;
 for (let i = 0; i < mine.length; i += 120) {
  const part = mine.slice(i, i + 120);
  await rpc('id_push', {secret, items: part});
  top = part[part.length - 1].updated_at > top ? part[part.length - 1].updated_at : top;
  saveConfig({pushed: top});
 }
 // 1b. El diario y la trayectoria (tipo «doc») llevan su propia marca: solo avanza si el servidor los acepta todos,
 // así no se queda nada sin subir si el servidor todavía no conoce ese tipo.
 const docMark = cfg.pushedDoc || '', docs = all.filter(x => x.kind === 'doc' && x.updated_at > docMark).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
 for (let i = 0; i < docs.length; i += 120) {
  const part = docs.slice(i, i + 120), r = await rpc('id_push', {secret, items: part});
  if (Number(r?.accepted) !== part.length && Number(r?.skipped) > 0 && Number(r?.accepted) === 0) break;
  saveConfig({pushedDoc: part[part.length - 1].updated_at});
 }
 // 2. Bajar
 let seq = Number(syncConfig().seq) || 0, got = 0;
 for (let n = 0; n < 200; n++) {
  const r = await rpc('id_pull', {secret, since: seq});
  const items = Array.isArray(r?.items) ? r.items : [];
  if (items.length) got += applyRemote(items);
  seq = Number(r?.seq) || seq; saveConfig({seq});
  if (items.length < 300) break;
 }
 // 3. Imágenes: subir las que el servidor no tiene y bajar las nuevas.
 let sent = new Set(syncConfig().sentImages || []);
 const local = imagePaths().filter(p => !sent.has(p));
 if (local.length) {
  const remote = new Set(await rpc('id_image_paths', {secret}) || []);
  for (const path of local) {
   if (!remote.has(path)) { const blob = await imageBlob(path); if (!blob) continue; await rpc('id_push_image', {secret, path, data: await toData(blob)}); }
   sent.add(path); saveConfig({sentImages: [...sent]});
  }
 }
 let imgSeq = Number(syncConfig().imgSeq) || 0, pics = 0;
 for (let n = 0; n < 400; n++) {
  const r = await rpc('id_pull_images', {secret, since: imgSeq});
  const list = Array.isArray(r?.images) ? r.images : [];
  for (const im of list) {
   if (await hasImage(im.path)) { sent.add(im.path); continue; }
   try { await storeImage(im.path, await (await fetch(im.data)).blob()); sent.add(im.path); pics++; } catch {}
  }
  imgSeq = Number(r?.seq) || imgSeq; saveConfig({imgSeq, sentImages: [...sent]});
  if (list.length < 12) break;
 }
 if (pics) applyRemote([]);
 saveConfig({last: new Date().toISOString()});
 return {got, pics};
}

export async function syncNow() {
 if (!syncOn()) return null;
 if (running) { again = true; return running; }
 setStatus({state: 'syncing', error: ''});
 running = (async () => {
  try {
   let r;
   do { again = false; r = await round(); } while (again);
   setStatus({state: 'ok', at: new Date().toISOString()});
   return r;
  } catch (e) {
   setStatus({state: 'error', error: e.kind || 'server'});
   throw e;
  } finally { running = null; }
 })();
 return running;
}
const later = (ms = 2500) => { clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), ms); };

// Empezar en este aparato: crea la libreta con un código nuevo y sube todo.
export async function startSync() {
 const bytes = crypto.getRandomValues(new Uint8Array(24)), code = [...bytes].map(b => ALPHABET[b % 32]).join('');
 await rpc('id_open', {secret: code, create_new: true});
 localStorage.setItem(KEY, JSON.stringify({code}));
 await syncNow();
 return code;
}
// Unirse con el código de otro aparato: junta lo de los dos (no se pierde nada de ninguno).
export async function joinSync(text) {
 const code = cleanCode(text);
 if (!/^[A-Z2-9]{24}$/.test(code)) throw Object.assign(Error('code'), {kind: 'code'});
 const r = await rpc('id_open', {secret: code, create_new: false});
 if (!r?.ok) throw Object.assign(Error('missing'), {kind: 'missing'});
 localStorage.setItem(KEY, JSON.stringify({code}));
 await syncNow();
 return code;
}
// Dejar de sincronizar aquí: este aparato se queda con todo lo que tiene; solo olvida el código.
export function stopSync() { localStorage.removeItem(KEY); setStatus({state: 'off', error: ''}); }

let started = false;
export function startAutoSync() {
 if (started) return;
 started = true;
 onChange(what => { if (syncOn() && !['remote', 'seen'].includes(what)) later(); });
 document.addEventListener('visibilitychange', () => { if (!document.hidden && syncOn()) later(300); });
 addEventListener('online', () => { if (syncOn()) later(300); });
 setInterval(() => { if (!document.hidden && syncOn()) syncNow().catch(() => {}); }, 90000);
 if (syncOn()) later(600);
}
