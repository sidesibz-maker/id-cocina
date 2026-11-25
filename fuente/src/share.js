// I+D · Fichas para el equipo, en solo lectura. Cada plato compartido tiene un enlace largo e imposible de adivinar; quien lo
// abre ve la receta (sin poder cambiarla) y se pone al día sola cuando el cocinero cambia el plato. Se puede dejar de compartir.
import {state, subById, imageUrl} from './store.js';
import {role, technique} from './flavor-core.js';
import {ALLERGENS} from './ai-core.js';
import {imageData} from './ia.js';

const API = 'https://dyacksxibcwvrdsulsfc.supabase.co/rest/v1/rpc/';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5YWNrc3hpYmN3dnJkc3Vsc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMzg2OTYsImV4cCI6MjExMDcxNDY5Nn0.8nuuA4yjJLHlrdD1XWjSyYmOtGH3RTS2BtdeJrOnNcs';
export const SHARE_PAGE = 'https://sidesibz-maker.github.io/id-cocina/ficha.html#';
const rand = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56]).join('');
async function rpc(name, body) {
 let res;
 try { res = await fetch(API + name, {method: 'POST', headers: {'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON}, body: JSON.stringify(body)}); }
 catch { throw Object.assign(Error('net'), {kind: navigator.onLine === false ? 'offline' : 'net'}); }
 const data = await res.json().catch(() => null);
 if (!res.ok) throw Object.assign(Error(String(data?.message || res.status)), {kind: 'server'});
 return data;
}
const techName = id => { const x = technique(id); return x ? x.es : ''; };
// Lo que ve el equipo: la ficha, sin notas privadas, consejos ni pruebas de cata.
async function sheetData(d) {
 const subs = [...new Set(d.components.flatMap(c => c.items.filter(i => i.src === 'recipe' && i.ref).map(i => i.ref)))].map(subById).filter(x => x && !x.deleted_at);
 let image = null;
 const cover = (d.images || []).find(i => i.path === d.cover_path) || (d.images || [])[d.images.length - 1];
 if (cover) { try { const url = await imageUrl(cover.path); if (url) image = await imageData(await (await fetch(url)).blob()); } catch {} }
 return {
  name: d.name, concept: d.concept || '', portions: d.portions || '', plating: d.plating || '', image,
  components: d.components.filter(c => c.items.length || c.method).map(c => ({role: role(c.role).es, name: c.name || '', techniques: (c.techniques || []).map(techName).filter(Boolean), items: c.items.map(i => ({n: i.n, q: i.q || ''})), method: c.method || ''})),
  subs: subs.map(x => ({name: x.name, yield: x.yield, items: x.items.map(i => ({n: i.n, q: i.q || ''})), method: x.method})),
  allergens: (Array.isArray(d.allergens) ? d.allergens : d.advice?.allergens || []).map(id => ALLERGENS.find(a => a[0] === id)?.[1]).filter(Boolean),
  updated_at: new Date().toISOString()
 };
}
export const shareUrl = d => (d?.share?.token ? SHARE_PAGE + d.share.token : '');
// Crea el enlace (o lo vuelve a activar) y sube la ficha. Devuelve el objeto share para guardarlo en el plato.
export async function startShare(d) {
 const share = d.share?.token && d.share?.key ? {...d.share, on: true} : {token: rand(28), key: rand(36), on: true};
 await rpc('id_share_put', {token: share.token, edit_key: share.key, data: await sheetData(d)});
 return share;
}
export async function updateShare(d) { if (d?.share?.on && d.share.token && d.share.key) await rpc('id_share_put', {token: d.share.token, edit_key: d.share.key, data: await sheetData(d)}); }
export async function stopShare(d) { if (d?.share?.token && d.share.key) await rpc('id_share_off', {token: d.share.token, edit_key: d.share.key}); return {...d.share, on: false}; }
let timers = new Map();
// Al guardar un plato compartido, la ficha del equipo se pone al día unos segundos después.
export function refreshShareSoon(d) {
 if (!d?.share?.on) return;
 clearTimeout(timers.get(d.id));
 timers.set(d.id, setTimeout(() => { const fresh = state.dishes.find(x => x.id === d.id); if (fresh?.share?.on) updateShare(fresh).catch(() => {}); }, 3000));
}
