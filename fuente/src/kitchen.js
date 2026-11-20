// I+D · la despensa de la app: el catálogo general (la tabla de sabores) y, dentro de él, los básicos de la casa.
// No lee nada de fuera: ni compras, ni precios, ni recetas de otros programas.
import {norm} from './flavor-core.js';
import {BASICS} from './basics.js';

// Una subreceta, lista para el motor de sabores: su mezcla de ingredientes (con su peso) y a qué producto del catálogo se parece.
export function subForKitchen(kb, x) {
 const known = x.items.filter(i => i.k && kb.byId[i.k]);
 const mix = known.map(i => [i.k, i.w === 3 ? 3 : i.w === 1 ? .5 : 1.5]);
 return {id: x.id, name: x.name, kb: x.kb && kb.byId[x.kb] ? x.kb : known.sort((a, b) => (b.w || 2) - (a.w || 2))[0]?.k || null, mix};
}
export function buildKitchen(kb, subs = []) {
 const pantry = new Set(BASICS.filter(id => kb.byId[id]));
 const subrecipes = subs.filter(x => x && !x.deleted_at).map(x => subForKitchen(kb, x)).filter(x => x.kb || x.mix.length);
 return {pantry, subrecipes, ownByKb: new Map(), usedIn: new Map(), productsByKb: new Map(), dishes: [], carta: null, havePrices: false, stats: {catalogue: kb.list.length, known: pantry.size, families: new Set(kb.list.map(i => i.family)).size}};
}
export const flavorContext = (kitchen, now = new Date()) => ({pantry: kitchen?.pantry || new Set(), recipes: new Map((kitchen?.subrecipes || []).filter(x => x.kb).map(x => [x.kb, x])), month: now.getMonth() + 1});
export const costOf = () => null;

// Buscador de ingredientes: primero los básicos de la casa, luego el resto del catálogo.
export function searchIngredients(kb, kitchen, query, {limit = 24, english = false} = {}) {
 const q = norm(query), words = q.split(' ').filter(Boolean);
 const hit = name => { const n = norm(name); return words.every(w => n.includes(w)); };
 const out = [];
 // Las subrecetas propias salen primero.
 for (const x of kitchen?.subrecipes || []) if (!q || hit(x.name)) out.push({type: 'recipe', label: x.name, have: true, item: {n: x.name, k: x.kb, w: 2, src: 'recipe', ref: x.id, ...(x.mix.length ? {mix: x.mix} : {})}, rank: q ? (norm(x.name).startsWith(q) ? 0 : 1) : 1});
 for (const ing of kb.list) {
  if (q && ![ing.es, ing.en, ...ing.syn].some(hit)) continue;
  const have = !!kitchen?.pantry.has(ing.id), label = english ? ing.en : ing.es;
  const starts = norm(label).startsWith(q) || norm(ing.es).startsWith(q);
  out.push({type: 'kb', label, have, item: {n: label, k: ing.id, w: 2, src: 'kb'}, rank: (q ? (starts ? 2 : 4) : 3) + (have ? 0 : 1)});
 }
 out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, english ? 'en' : 'es'));
 return out.slice(0, limit);
}
