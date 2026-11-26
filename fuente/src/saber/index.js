// I+D · Saber: el cerebro de cocina. Entradas escritas para la app (salsas, fondos, bases…) más las que crea el cocinero.
// Todo se busca a la vez: nombre, otros nombres, resumen y texto. Los enlaces [[id]] unen unas entradas con otras.
import A from './a.json';
import B from './b.json';
import C from './c.json';
import PREPARACIONES from './preparaciones.json';
import TECNICAS from './tecnicas.json';
import DULCE from './dulce.json';
import PRODUCTO from './producto.json';
import CREATIVIDAD from './creatividad.json';
import {state} from '../store.js';

const BUILT = [...A, ...B, ...C, ...PREPARACIONES, ...TECNICAS, ...DULCE, ...PRODUCTO, ...CREATIVIDAD].filter(e => e && e.id && e.name);
export const CATS = [['salsas', 'Salsas', 'Sauces'], ['fondos', 'Fondos, jugos y caldos', 'Stocks, jus and broths'], ['bases', 'Bases y aliños', 'Bases and dressings'], ['creatividad', 'Creatividad y método', 'Creativity and method'], ['tecnicas', 'Técnicas de cocción', 'Cooking techniques'], ['dulce', 'Pastelería y masas', 'Pastry and doughs'], ['producto', 'Producto: arroz, pescado, marisco y carne', 'Produce: rice, fish, shellfish and meat'], ['conceptos', 'Conceptos y técnicas', 'Concepts and techniques'], ['mias', 'Tus entradas', 'Your entries']];
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
 const parts = [e.what, e.history, e.keep, e.pro, ...(e.keys || []), ...(e.uses || []), ...(e.errors || []).flatMap(x => [x.p, x.fix]), ...(e.ratios || []).flatMap(x => [x.use, x.ratio, x.note]), ...(e.variants || []).flatMap(x => [x.name, x.note]), ...(e.base?.items || []).map(x => x[0]), ...(e.base?.steps || []), ...(e.method || [])];
 return norm(plain(parts.join(' ')));
}
const STOP = new Set(['como', 'por', 'que', 'para', 'con', 'sin', 'del', 'los', 'las', 'una', 'unos', 'unas', 'hacer', 'arreglar', 'evitar', 'mi', 'el', 'la', 'de', 'se', 'me', 'en', 'un']);
const wordList = value => norm(value).split(' ').filter(w => w.length > 1 && !STOP.has(w));

// Admite palabras a medio escribir sin confundir «ostras» con «costras».
const startsWord = (text, word) => (' ' + text).includes(' ' + word);

// «Suena a»: como se pronuncia en español, para que bexamel encuentre bechamel, binagreta vinagreta o biscaina vizcaína.
export function soundKey(word) {
 return norm(word).replace(/ch/g, 'x').replace(/h/g, '').replace(/v/g, 'b').replace(/z/g, 's').replace(/c(?=[ei])/g, 's').replace(/qu/g, 'k').replace(/c/g, 'k').replace(/x/g, 'k').replace(/ll/g, 'y').replace(/w/g, 'u').replace(/(.)\1+/g, '$1').replace(/ /g, '');
}
// Cuántas letras hay que cambiar para pasar de una palabra a otra (se corta en cuanto pasa de «max»).
function lev(a, b, max = 2) {
 if (Math.abs(a.length - b.length) > max) return max + 1;
 let prev = Array.from({length: b.length + 1}, (_, i) => i);
 for (let i = 1; i <= a.length; i++) {
  const cur = [i]; let best = i;
  for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
  if (best > max) return max + 1;
  prev = cur;
 }
 return prev[b.length];
}
// ¿Esta palabra escrita se parece a esta otra? Admite la palabra a medio escribir (se compara con el principio).
function like(typed, word) {
 if (typed.length < 3) return false;
 const a = soundKey(typed), w = soundKey(word);
 if (!a || !w) return false;
 if (w.startsWith(a) || a === w) return true;
 const tol = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0;
 // Con pocas letras solo vale si suena igual desde el principio; con más, se admite alguna letra cambiada.
 if (a.length < 5) return false;
 return lev(a, w, tol) <= tol || (w.length > a.length && lev(a, w.slice(0, a.length), tol) <= tol);
}

// Las preguntas pueden combinar el nombre con un síntoma de la ficha.
export function searchInfo(q, limit = 40, {category = '', fixes = false} = {}) {
 const words = wordList(q);
 if (!words.length) return {list: [], guessed: false};
 const phrase = words.join(' ');
 const exact = [], guess = [];
 for (const e of entries()) {
  if (category && e.cat !== category) continue;
  if (fixes && !e.errors?.length) continue;
  const name = wordList(e.name).join(' '), aliases = (e.aka || []).map(a => wordList(a).join(' '));
  const names = [name, ...aliases].join(' ');
  const problems = norm(plain((e.errors || []).map(x => x.p).join(' ')));
  const summary = norm(plain(e.summary)), body = fixes ? norm(plain((e.errors || []).flatMap(x => [x.p, x.fix]).join(' '))) : fullText(e);
  const scores = words.map(w => startsWord(names, w) ? 40 : startsWord(problems, w) ? 24 : startsWord(summary, w) ? 12 : startsWord(body, w) ? 5 : 0);
  if (scores.every(Boolean)) { exact.push({e, score: scores.reduce((a, b) => a + b, 0) + ([name, ...aliases].includes(phrase) ? 100 : 0) + (name.startsWith(phrase) ? 30 : 0)}); continue; }
  if (fixes) continue;
  // Si alguna palabra no está tal cual, se mira si se parece a una palabra del nombre (faltas, b/v, c/z, ch/x…).
  const own = wordList(e.name), aka = (e.aka || []).flatMap(x => wordList(x));
  const fit = w => { const k = soundKey(w); const inName = own.find(x => like(w, x)), inAka = inName ? null : aka.find(x => like(w, x)); const hit = inName || inAka; return hit ? (inName ? 12 : 8) + (soundKey(hit) === k ? 4 : 0) : 0; };
  const fuzzy = words.map((w, i) => scores[i] || fit(w));
  if (fuzzy.every(Boolean)) guess.push({e, score: fuzzy.reduce((a, b) => a + b, 0)});
 }
 const sort = l => l.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'es'));
 if (exact.length) return {list: sort(exact).slice(0, limit).map(x => x.e), guessed: false};
 return {list: sort(guess).slice(0, limit).map(x => x.e), guessed: guess.length > 0};
}
export const search = (q, limit = 40, opts = {}) => searchInfo(q, limit, opts).list;
// Sugerencias mientras se escribe: primero los nombres que empiezan así, luego lo demás que encaja o se parece.
export function suggest(q, limit = 7) {
 const n = norm(q);
 if (n.length < 2) return [];
 const starts = entries().filter(e => [e.name, ...(e.aka || [])].some(x => norm(x).startsWith(n))).sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, 'es'));
 const seen = new Set(starts.map(e => e.id));
 const rest = searchInfo(q, limit * 2).list.filter(e => !seen.has(e.id));
 return [...starts, ...rest].slice(0, limit);
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
