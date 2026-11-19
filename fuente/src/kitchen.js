// I+D · la despensa de la app: el catálogo general (la tabla de sabores) y, dentro de él, los básicos de la casa.
// No lee nada de fuera: ni compras, ni precios, ni recetas de otros programas.
import {norm} from './flavor-core.js';
import {BASICS} from './basics.js';

export function buildKitchen(kb) {
 const pantry = new Set(BASICS.filter(id => kb.byId[id]));
 return {pantry, subrecipes: [], ownByKb: new Map(), usedIn: new Map(), productsByKb: new Map(), dishes: [], carta: null, havePrices: false, stats: {catalogue: kb.list.length, known: pantry.size, families: new Set(kb.list.map(i => i.family)).size}};
}
export const flavorContext = (kitchen, now = new Date()) => ({pantry: kitchen?.pantry || new Set(), recipes: new Map(), month: now.getMonth() + 1});
export const costOf = () => null;

// Buscador de ingredientes: primero los básicos de la casa, luego el resto del catálogo.
export function searchIngredients(kb, kitchen, query, {limit = 24, english = false} = {}) {
 const q = norm(query), words = q.split(' ').filter(Boolean);
 const hit = name => { const n = norm(name); return words.every(w => n.includes(w)); };
 const out = [];
 for (const ing of kb.list) {
  if (q && ![ing.es, ing.en, ...ing.syn].some(hit)) continue;
  const have = !!kitchen?.pantry.has(ing.id), label = english ? ing.en : ing.es;
  const starts = norm(label).startsWith(q) || norm(ing.es).startsWith(q);
  out.push({type: 'kb', label, have, item: {n: label, k: ing.id, w: 2, src: 'kb'}, rank: (q ? (starts ? 2 : 4) : 3) + (have ? 0 : 1)});
 }
 out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, english ? 'en' : 'es'));
 return out.slice(0, limit);
}
