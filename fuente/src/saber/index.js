// I+D · Saber: el cerebro de cocina. Entradas escritas para la app (salsas, fondos, bases…) más las que crea el cocinero.
// Todo se busca a la vez: nombre, otros nombres, resumen y texto. Los enlaces [[id]] unen unas entradas con otras.
import A from './a.json';
import B from './b.json';
import C from './c.json';
import PREPARACIONES from './preparaciones.json';
import TECNICAS from './tecnicas.json';
import DULCE from './dulce.json';
import {state} from '../store.js';

const BUILT = [...A, ...B, ...C, ...PREPARACIONES, ...TECNICAS, ...DULCE].filter(e => e && e.id && e.name);
export const CATS = [['salsas', 'Salsas', 'Sauces'], ['fondos', 'Fondos, jugos y caldos', 'Stocks, jus and broths'], ['bases', 'Bases y aliños', 'Bases and dressings'], ['tecnicas', 'Técnicas de cocción', 'Cooking techniques'], ['dulce', 'Pastelería y masas', 'Pastry and doughs'], ['conceptos', 'Conceptos y técnicas', 'Concepts and techniques'], ['mias', 'Tus entradas', 'Your entries']];
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

function near(a, b) {
 if (a === b) return true;
 if (a.length === b.length) {
  const first = [...a].findIndex((letter, i) => letter !== b[i]);
  return a.slice(first + 1) === b.slice(first + 1) ||
   (a[first] === b[first + 1] && a[first + 1] === b[first] && a.slice(first + 2) === b.slice(first + 2));
 }
 if (Math.abs(a.length - b.length) !== 1) return false;
 const [long, short] = a.length > b.length ? [a, b] : [b, a];
 const first = [...long].findIndex((letter, i) => letter !== short[i]);
 return long.slice(first + 1) === short.slice(first);
}

// Las preguntas pueden combinar el nombre con un síntoma de la ficha.
export function search(q, limit = 40, {category = '', fixes = false} = {}) {
 const words = wordList(q);
 if (!words.length) return [];
 const phrase = words.join(' ');
 const out = [];
 for (const e of entries()) {
  if (category && e.cat !== category) continue;
  if (fixes && !e.errors?.length) continue;
  const name = wordList(e.name).join(' '), aliases = (e.aka || []).map(a => wordList(a).join(' '));
  const names = [name, ...aliases].join(' ');
  const problems = norm(plain((e.errors || []).map(x => x.p).join(' ')));
  const summary = norm(plain(e.summary)), body = fixes ? norm(plain((e.errors || []).flatMap(x => [x.p, x.fix]).join(' '))) : fullText(e);
  const scores = words.map(w => startsWord(names, w) ? 40 : startsWord(problems, w) ? 24 : startsWord(summary, w) ? 12 : startsWord(body, w) ? 5 : 0);
  if (scores.every(Boolean)) out.push({e, score: scores.reduce((a, b) => a + b, 0) + ([name, ...aliases].includes(phrase) ? 100 : 0)});
  else if (!fixes && words.length === 1 && phrase.length >= 5 && names.split(' ').some(w => near(w, phrase))) out.push({e, score: 3});
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
