// I+D · Saber: el cerebro de cocina. Entradas escritas para la app (salsas, fondos, bases…) más las que crea el cocinero.
// Todo se busca a la vez: nombre, otros nombres, resumen y texto. Los enlaces [[id]] unen unas entradas con otras.
import A from './a.json';
import B from './b.json';
import C from './c.json';
import {state} from '../store.js';

const BUILT = [...A, ...B, ...C].filter(e => e && e.id && e.name);
export const CATS = [['salsas', 'Salsas', 'Sauces'], ['fondos', 'Fondos, jugos y caldos', 'Stocks, jus and broths'], ['bases', 'Bases y aliños', 'Bases and dressings'], ['conceptos', 'Conceptos y técnicas', 'Concepts and techniques'], ['mias', 'Tus entradas', 'Your entries']];
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');

// Todas las entradas: las de la app y las tuyas (que pueden añadir temas nuevos).
export function entries() {
 const mine = Object.values(state.saber || {}).filter(x => x?.custom && !x.deleted_at).map(x => ({...x.custom, cat: 'mias', mine: true}));
 const ids = new Set(mine.map(e => e.id));
 return [...BUILT.filter(e => !ids.has(e.id)), ...mine];
}
export const entryById = id => entries().find(e => e.id === id) || null;
export const builtIds = () => BUILT.map(e => e.id);

// Todo el texto de una entrada, para buscar.
function fullText(e) {
 const parts = [e.what, e.history, e.keep, e.pro, ...(e.keys || []), ...(e.uses || []), ...(e.errors || []).flatMap(x => [x.p, x.fix]), ...(e.ratios || []).flatMap(x => [x.use, x.ratio, x.note]), ...(e.variants || []).flatMap(x => [x.name, x.note]), ...(e.base?.items || []).map(x => x[0]), ...(e.base?.steps || [])];
 return norm(plain(parts.join(' ')));
}
let cache = null, cacheKey = '';
function index() {
 const list = entries(), key = list.length + '|' + Object.keys(state.saber || {}).length;
 if (cache && cacheKey === key) return cache;
 cacheKey = key;
 cache = list.map(e => ({e, name: norm(e.name), aka: (e.aka || []).map(norm), summary: norm(plain(e.summary)), body: fullText(e)}));
 return cache;
}
// Buscar: primero por nombre, luego otros nombres, luego resumen y, al final, cualquier mención en el texto.
export function search(q, limit = 40) {
 const words = norm(q).split(' ').filter(w => w.length > 1);
 if (!words.length) return [];
 const out = [];
 for (const x of index()) {
  let score = 0;
  const all = [x.name, ...x.aka].join(' ');
  if (x.name === words.join(' ') || x.aka.includes(words.join(' '))) score += 100;
  if (words.every(w => x.name.includes(w))) score += 50;
  else if (words.every(w => all.includes(w))) score += 35;
  if (words.every(w => x.summary.includes(w))) score += 15;
  if (words.every(w => x.body.includes(w))) score += 6 + Math.min(6, words.reduce((n, w) => n + (x.body.split(w).length - 1), 0));
  if (score) out.push({e: x.e, score});
 }
 return out.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'es')).slice(0, limit).map(x => x.e);
}
// Qué entradas enlazan a esta (para «Aparece en»).
export function backlinks(id) {
 const rx = new RegExp('\\[\\[' + id.replace(/[-]/g, '\\-') + '(\\||\\]\\])');
 return entries().filter(e => e.id !== id && (rx.test(JSON.stringify(e)) || (e.related || []).includes(id) || (e.variants || []).some(v => v.id === id)));
}
// Un nombre de ingrediente o de subreceta que coincide con una entrada (para enlazar desde los platos).
export function entryForName(name) {
 const n = norm(name);
 if (n.length < 3) return null;
 return entries().find(e => norm(e.name) === n || (e.aka || []).some(a => norm(a) === n)) || null;
}
export const slug = v => norm(v).replace(/ /g, '-').slice(0, 60);
