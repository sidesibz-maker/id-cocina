// I+D · motor de sabores. Funciones puras (sin pantalla ni red) para poder probarlas con node (test-lab-flavor.mjs).
// Con la tabla de ingredientes de flavor-data.js calcula qué sabores dominan en un plato, qué le falta para estar
// equilibrado (ácido, crujiente, frescor, color…), con qué se arregla usando primero lo que hay en la cocina,
// qué combina con qué y qué une a dos productos. Nada de esto sale de una IA: son reglas de oficio, siempre iguales.

// Ejes del perfil: los ocho primeros vienen de la tabla (0-5 por ingrediente); «fresco» se deduce de aromas y técnica.
export const AXES = [
 ['dulce', 'Dulce', 'Sweet'], ['salado', 'Salado', 'Salty'], ['acido', 'Ácido', 'Sour'], ['amargo', 'Amargo', 'Bitter'],
 ['umami', 'Umami', 'Umami'], ['graso', 'Graso', 'Rich'], ['picante', 'Picante', 'Heat'], ['ahumado', 'Ahumado', 'Smoky'],
 ['fresco', 'Fresco', 'Fresh']
];
export const AXIS_IDS = AXES.map(a => a[0]);

export const FAMILIES = {
 verdura: ['Verdura', 'Vegetable'], fruta: ['Fruta', 'Fruit'], seta: ['Seta', 'Mushroom'], hierba: ['Hierba', 'Herb'],
 especia: ['Especia', 'Spice'], carne: ['Carne', 'Meat'], ave: ['Ave', 'Poultry'], embutido: ['Curado y embutido', 'Cured meat'],
 pescado: ['Pescado', 'Fish'], marisco: ['Marisco', 'Shellfish'], lacteo: ['Lácteo', 'Dairy'], queso: ['Queso', 'Cheese'],
 huevo: ['Huevo', 'Egg'], cereal: ['Cereal, pan y pasta', 'Grain, bread and pasta'], legumbre: ['Legumbre', 'Pulse'],
 'fruto-seco': ['Fruto seco y semilla', 'Nut and seed'], grasa: ['Grasa y aceite', 'Fat and oil'],
 condimento: ['Condimento', 'Seasoning'], salsa: ['Salsa y fondo', 'Sauce and stock'], encurtido: ['Encurtido', 'Pickle'],
 dulce: ['Dulce', 'Sweet'], bebida: ['Vino y licor', 'Wine and spirits'], alga: ['Alga', 'Seaweed']
};
export const AROMAS = {
 citrico: ['cítrico', 'citrus'], herbal: ['herbal', 'herbal'], verde: ['verde', 'green'], floral: ['floral', 'floral'],
 frutal: ['frutal', 'fruity'], tropical: ['tropical', 'tropical'], tostado: ['tostado', 'toasted'], ahumado: ['ahumado', 'smoky'],
 lacteo: ['lácteo', 'dairy'], marino: ['marino', 'briny'], terroso: ['terroso', 'earthy'], especiado: ['especiado', 'spiced'],
 anisado: ['anisado', 'aniseed'], aliaceo: ['ajo y cebolla', 'allium'], fermentado: ['fermentado', 'fermented'],
 nuez: ['fruto seco', 'nutty'], caramelo: ['caramelo', 'caramel'], mentolado: ['mentolado', 'minty'], resinoso: ['resinoso', 'resinous'],
 carnico: ['cárnico', 'meaty'], vinoso: ['vinoso', 'winey'], cacao: ['cacao', 'cocoa'], vainilla: ['vainilla', 'vanilla'],
 miel: ['miel', 'honeyed'], sulfuroso: ['sulfuroso', 'sulphurous']
};
export const TEXTURES = {
 crujiente: ['crujiente', 'crunchy'], cremoso: ['cremoso', 'creamy'], jugoso: ['jugoso', 'juicy'], tierno: ['tierno', 'tender'],
 firme: ['firme', 'firm'], gelatinoso: ['gelatinoso', 'gelatinous'], liquido: ['líquido', 'liquid'], untuoso: ['untuoso', 'unctuous'],
 aireado: ['aireado', 'airy'], meloso: ['meloso', 'silky'], carnoso: ['carnoso', 'meaty'], seco: ['seco', 'dry']
};
export const COLORS = {
 rojo: ['rojo', 'red'], verde: ['verde', 'green'], blanco: ['blanco', 'white'], amarillo: ['amarillo', 'yellow'],
 naranja: ['naranja', 'orange'], marron: ['marrón', 'brown'], negro: ['negro', 'black'], rosa: ['rosa', 'pink'],
 morado: ['morado', 'purple'], beige: ['beige', 'beige'], dorado: ['dorado', 'golden']
};
export const TAGS = ['ibiza', 'japon', 'asia', 'mexico', 'oriente', 'fermento', 'lujo', 'despensa', 'tendencia'];

// Técnicas: [id, español, inglés, cambio en los 8 sabores, cambio en frescor, texturas que aporta, temperatura de pase].
export const TECHNIQUES = [
 ['brasa', 'Brasa', 'Charcoal grill', [0, 0, 0, .5, 1, 0, 0, 2.5], -.5, [], 'hot'],
 ['plancha', 'Plancha', 'Griddle', [0, 0, 0, 0, 1, 0, 0, .7], 0, [], 'hot'],
 ['fritura', 'Fritura', 'Deep-fried', [0, 0, 0, 0, 0, 2, 0, .3], -1, ['crujiente'], 'hot'],
 ['tempura', 'Rebozado o tempura', 'Battered or tempura', [0, 0, 0, 0, 0, 1.5, 0, 0], -.5, ['crujiente'], 'hot'],
 ['horno', 'Horno o asado', 'Roasted', [.5, 0, 0, 0, 1, 0, 0, .5], -.3, ['tierno'], 'hot'],
 ['guiso', 'Guiso o estofado', 'Braised or stewed', [.3, 0, 0, 0, 1.5, .5, 0, 0], -1, ['tierno', 'meloso'], 'hot'],
 ['confitado', 'Confitado', 'Confit', [0, 0, 0, 0, .3, 2, 0, 0], -1, ['tierno', 'untuoso'], 'hot'],
 ['bajatemp', 'Baja temperatura', 'Low temperature', [0, 0, 0, 0, .5, 0, 0, 0], 0, ['jugoso', 'tierno'], 'hot'],
 ['salteado', 'Salteado', 'Sautéed', [0, 0, 0, 0, .7, .5, 0, .4], 0, [], 'hot'],
 ['gratinado', 'Gratinado', 'Gratinated', [0, 0, 0, 0, 1, .7, 0, .6], -.5, ['crujiente'], 'hot'],
 ['hervido', 'Hervido o escaldado', 'Boiled or blanched', [0, 0, 0, 0, 0, 0, 0, 0], 0, ['tierno'], 'hot'],
 ['vapor', 'Vapor', 'Steamed', [0, 0, 0, 0, 0, 0, 0, 0], .3, ['jugoso'], 'hot'],
 ['crudo', 'Crudo', 'Raw', [0, 0, 0, 0, 0, 0, 0, 0], 2, [], 'cold'],
 ['curado', 'Curado o marinado', 'Cured or marinated', [0, 1.5, .3, 0, 1, 0, 0, 0], .3, ['firme'], 'cold'],
 ['encurtido', 'Encurtido', 'Pickled', [.3, .5, 2.5, 0, 0, 0, 0, 0], 1, ['crujiente'], 'cold'],
 ['escabeche', 'Escabeche', 'Escabeche', [0, .3, 2, 0, .3, 1, 0, 0], .3, ['tierno'], 'cold'],
 ['ahumado', 'Ahumado', 'Smoked', [0, .3, 0, .3, .5, 0, 0, 3], -.5, [], null],
 ['fermentado', 'Fermentado', 'Fermented', [0, .5, 1, 0, 2, 0, 0, 0], 0, [], null],
 ['caramelizado', 'Caramelizado o glaseado', 'Caramelised or glazed', [2, 0, 0, .5, .3, 0, 0, .5], -.5, [], 'hot'],
 ['tostado', 'Tostado', 'Toasted', [0, 0, 0, .3, .3, 0, 0, 1.5], -.3, ['crujiente'], null],
 ['pure', 'Puré o crema', 'Purée or cream', [0, 0, 0, 0, 0, .5, 0, 0], -.3, ['cremoso'], 'hot'],
 ['emulsion', 'Emulsión', 'Emulsion', [0, 0, 0, 0, 0, 1, 0, 0], 0, ['cremoso', 'untuoso'], null],
 ['helado', 'Helado o granizado', 'Ice cream or granita', [.5, 0, 0, 0, 0, 0, 0, 0], 1, ['cremoso'], 'cold']
];
export const TECH_IDS = TECHNIQUES.map(t => t[0]);
const TECH = Object.fromEntries(TECHNIQUES.map(t => [t[0], {id: t[0], es: t[1], en: t[2], mods: t[3], fresh: t[4], textures: t[5], temp: t[6]}]));
// El Ofyr y el Josper son brasa: mismo efecto en el sabor.
TECH.josper = {...TECH.brasa, id: 'josper', es: 'Josper', en: 'Josper'};
TECH.ofyr = {...TECH.brasa, id: 'ofyr', es: 'Ofyr', en: 'Ofyr'};
export const technique = id => TECH[id] || null;

// Papel de cada componente en el plato: [id, español, inglés, peso en el perfil, textura que aporta por definición].
export const ROLES = [
 ['principal', 'Protagonista', 'Main element', 1, null],
 ['salsa', 'Salsa o jugo', 'Sauce or jus', .8, 'liquido'],
 ['guarnicion', 'Guarnición', 'Side', .6, null],
 ['cremoso', 'Cremoso', 'Creamy', .6, 'cremoso'],
 ['fresco', 'Fresco o ácido', 'Fresh or acidic', .5, null],
 ['crujiente', 'Crujiente', 'Crunch', .4, 'crujiente'],
 ['toque', 'Toque final', 'Finishing touch', .35, null]
];
const ROLE = Object.fromEntries(ROLES.map(r => [r[0], {id: r[0], es: r[1], en: r[2], weight: r[3], texture: r[4]}]));
export const role = id => ROLE[id] || ROLE.guarnicion;
// Cuánto pesa un ingrediente dentro de su componente: 3 protagonista, 2 normal, 1 un toque.
export const ITEM_WEIGHT = {3: 1.6, 2: 1, 1: .45};

export const COURSES = [
 ['picar', 'Para picar', 'To share'], ['entrante', 'Entrante', 'Starter'], ['principal', 'Principal', 'Main'],
 ['guarnicion', 'Guarnición', 'Side'], ['postre', 'Postre', 'Dessert'], ['brunch', 'Brunch y desayuno', 'Brunch and breakfast'],
 ['salsa', 'Salsa o base', 'Sauce or base'], ['otro', 'Otro', 'Other']
];

// ---------- Texto ----------
export const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'al', 'a', 'y', 'e', 'o', 'para', 'sin', 'tipo', 'the', 'of', 'and', 'with']);
// Singular aproximado en español e inglés: «tomates» → «tomate», «nueces» → «nuez», «coles» → «col», «pimientos» → «pimiento».
export function singular(word) {
 if (word.length <= 3 || /\d/.test(word)) return word;
 if (word.endsWith('ces')) return word.slice(0, -3) + 'z';
 if (word.endsWith('oes')) return word.slice(0, -2);
 if (/[rlndj]es$/.test(word)) return word.slice(0, -2);
 if (/[^sui]s$/.test(word)) return word.slice(0, -1);
 return word;
}
export const tokens = v => norm(v).split(' ').filter(w => w && !STOP.has(w)).map(singular);

// ---------- Tabla de ingredientes ----------
// Cada línea: id|español|inglés|familia|sabor (8 cifras 0-5)|aromas|texturas|color|meses|combina con|otros nombres|técnicas|etiquetas
function monthsOf(text) {
 const out = new Set();
 if (!text || text === '*') return out;
 for (const part of text.split(',')) {
  const m = part.trim().match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) throw Error('meses');
  let from = Number(m[1]), to = Number(m[2] || m[1]);
  if (from < 1 || from > 12 || to < 1 || to > 12) throw Error('meses');
  for (let k = from; ; k = k % 12 + 1) { out.add(k); if (k === to) break; }
 }
 return out;
}
const list = text => (text || '').split(',').map(x => x.trim()).filter(Boolean);

// Lee la tabla y devuelve {list, byId, errors}. No lanza: los fallos de la tabla se devuelven en errors para la prueba.
export function parseTable(text) {
 const rows = [], byId = {}, errors = [];
 String(text || '').split('\n').forEach((raw, n) => {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return;
  const f = line.split('|').map(x => x.trim());
  const where = 'línea ' + (n + 1) + ' (' + (f[0] || '?') + ')';
  if (f.length < 10 || f.length > 13) { errors.push(where + ': tiene ' + f.length + ' campos y deben ser de 10 a 13'); return; }
  const [id, es, en, family, taste, aromas, textures, color, months, pairs, syn = '', tech = '', tags = ''] = f;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) errors.push(where + ': id no válido');
  if (byId[id]) errors.push(where + ': id repetido');
  if (!es || !en) errors.push(where + ': falta el nombre en español o en inglés');
  if (!FAMILIES[family]) errors.push(where + ': familia desconocida «' + family + '»');
  if (!/^[0-5]{8}$/.test(taste)) errors.push(where + ': el sabor deben ser 8 cifras de 0 a 5');
  const row = {
   id, es, en, family, taste: [...taste].map(Number), aromas: list(aromas), textures: list(textures), color,
   months: new Set(), pairs: [], bold: new Set(), syn: list(syn).map(norm).filter(Boolean), tech: list(tech), tags: list(tags)
  };
  for (const a of row.aromas) if (!AROMAS[a]) errors.push(where + ': aroma desconocido «' + a + '»');
  for (const t of row.textures) if (!TEXTURES[t]) errors.push(where + ': textura desconocida «' + t + '»');
  if (!COLORS[color]) errors.push(where + ': color desconocido «' + color + '»');
  try { row.months = monthsOf(months); } catch { errors.push(where + ': meses no válidos «' + months + '»'); }
  for (const p of list(pairs)) { const bold = p.endsWith('!'), pid = bold ? p.slice(0, -1) : p; row.pairs.push(pid); if (bold) row.bold.add(pid); }
  for (const t of row.tech) if (!TECH[t] || t === 'josper' || t === 'ofyr') errors.push(where + ': técnica desconocida «' + t + '»');
  for (const t of row.tags) if (!TAGS.includes(t)) errors.push(where + ': etiqueta desconocida «' + t + '»');
  rows.push(row); byId[id] = row;
 });
 for (const row of rows) {
  const seen = new Set();
  for (const p of row.pairs) {
   if (!byId[p]) errors.push(row.id + ': combina con «' + p + '», que no existe en la tabla');
   if (p === row.id) errors.push(row.id + ': se combina consigo mismo');
   if (seen.has(p)) errors.push(row.id + ': «' + p + '» repetido en sus combinaciones');
   seen.add(p);
  }
 }
 return {list: rows, byId, errors};
}

// Prepara la tabla para usarla: combinaciones en los dos sentidos e índice de nombres.
export function buildKB(text) {
 const {list: rows, byId, errors} = parseTable(text);
 if (errors.length) throw Error('Tabla de sabores con errores: ' + errors.slice(0, 5).join('; '));
 const links = Object.fromEntries(rows.map(r => [r.id, new Map()]));
 for (const r of rows) for (const p of r.pairs) {
  const bold = r.bold.has(p);
  const a = links[r.id], b = links[p];
  a.set(p, {score: (a.get(p)?.score || 0) + 1, bold: bold || !!a.get(p)?.bold});
  b.set(r.id, {score: (b.get(r.id)?.score || 0) + 1, bold: bold || !!b.get(r.id)?.bold});
 }
 // Índice de nombres: cada frase (nombre en español, en inglés y otros nombres) como lista de palabras.
 const phrases = [];
 for (const r of rows) {
  const seen = new Set();
  for (const name of [r.es, r.en, r.id.replace(/-/g, ' '), ...r.syn]) {
   const words = tokens(name);
   const key = words.join(' ');
   if (!words.length || seen.has(key)) continue;
   seen.add(key); phrases.push({id: r.id, words, key});
  }
 }
 phrases.sort((a, b) => b.words.length - a.words.length || b.key.length - a.key.length);
 const first = {};
 for (const p of phrases) (first[p.words[0]] ||= []).push(p);
 return {list: rows, byId, links, phrases, first};
}

// Un nombre leído de un papel o una foto a veces trae una cifra donde había una letra con tilde («Calabac3n», «Padr3n»): se compara dejando ese hueco libre.
const loose = word => word.length >= 5 && /^[a-z]/.test(word) && /[a-z]\d[a-z]|[a-z]\d$/.test(word) ? new RegExp('^' + word.replace(/\d/g, '[a-z]{1,2}') + '$') : null;
const same = (word, target) => word === target || (loose(word)?.test(target) ?? false);

// Reconoce de qué ingrediente habla un nombre («Gamba langostinera nº 2 congelada» → gamba). La frase más larga gana y,
// a igual longitud, la que aparece antes en el nombre (en español lo primero suele ser el producto). null si no es comida conocida.
export function matchName(kb, name) {
 const words = tokens(name);
 let best = null;
 for (let i = 0; i < words.length; i++) {
  const candidates = kb.first[words[i]] || (loose(words[i]) ? kb.phrases.filter(p => same(words[i], p.words[0])) : []);
  for (const p of candidates) {
   if (i + p.words.length > words.length) continue;
   if (!p.words.every((w, k) => same(words[i + k], w))) continue;
   if (!best || p.words.length > best.len || (p.words.length === best.len && i < best.at)) best = {id: p.id, len: p.words.length, at: i};
   break; // las frases de cada palabra inicial van de más larga a más corta
  }
 }
 return best ? best.id : null;
}

export const inSeason = (ingredient, month) => ingredient.months.size > 0 && ingredient.months.has(month);

// ---------- Perfil de un plato ----------
const P = 2.2; // media potenciada: un toque de anchoa o de vinagre se nota más que su peso
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FRESH_AROMA = {citrico: 2, mentolado: 2, herbal: 1.5, verde: 1.5, anisado: 1, floral: .5, frutal: .5};
function freshOf(ing) {
 let v = Math.min(4, ing.aromas.reduce((n, a) => n + (FRESH_AROMA[a] || 0), 0));
 if (ing.family === 'hierba') v = Math.max(v, 3.5);
 if (ing.taste[2] >= 3) v += 1;
 if (ing.taste[5] >= 4) v -= 1;
 if (ing.taste[7] >= 3) v -= 1;
 return clamp(v, 0, 5);
}
// Sabor de un ingrediente del plato: uno de la tabla, o la mezcla de una subreceta (lista de [id, peso]).
function vectorOf(kb, item) {
 const parts = Array.isArray(item.mix) && item.mix.length ? item.mix : (item.k ? [[item.k, 1]] : []);
 const vec = new Array(9).fill(0), textures = new Set(), colors = {}, ids = [];
 let total = 0;
 for (const [id, w0] of parts) {
  const ing = kb.byId[id], w = Number(w0) > 0 ? Number(w0) : 1;
  if (!ing) continue;
  ids.push(id); total += w;
  for (let k = 0; k < 8; k++) vec[k] += w * Math.pow(ing.taste[k], P);
  vec[8] += w * Math.pow(freshOf(ing), P);
  ing.textures.forEach(t => textures.add(t));
  colors[ing.color] = (colors[ing.color] || 0) + w;
 }
 if (!total) return null;
 return {vec: vec.map(v => Math.pow(v / total, 1 / P)), textures, colors, ids, total};
}

export function cleanItem(item) {
 const weight = [1, 2, 3].includes(Number(item?.w)) ? Number(item.w) : 2;
 return {...item, n: String(item?.n ?? '').trim(), w: weight};
}

// Perfil del plato: ejes 0-10, texturas presentes, temperaturas, colores y cuánto del plato se ha reconocido.
export function dishProfile(kb, dish) {
 const acc = new Array(9).fill(0), textures = new Set(), colors = {}, ids = new Map(), mains = [];
 let total = 0, known = 0, unknown = 0, hot = 0, cold = 0, items = 0, techCount = 0;
 const components = Array.isArray(dish?.components) ? dish.components : [];
 for (const c of components) {
  const r = role(c.role), techs = (Array.isArray(c.techniques) ? c.techniques : []).map(technique).filter(Boolean);
  techCount += techs.length;
  if (r.texture) textures.add(r.texture);
  for (const t of techs) { t.textures.forEach(x => textures.add(x)); if (t.temp === 'hot') hot++; if (t.temp === 'cold') cold++; }
  for (const raw of Array.isArray(c.items) ? c.items : []) {
   const item = cleanItem(raw); items++;
   const v = vectorOf(kb, item);
   if (!v) { unknown++; continue; }
   known++;
   const w = r.weight * ITEM_WEIGHT[item.w];
   const vec = v.vec.slice();
   for (const t of techs) { for (let k = 0; k < 8; k++) vec[k] = clamp(vec[k] + t.mods[k], 0, 6.5); vec[8] = clamp(vec[8] + t.fresh, 0, 6.5); }
   for (let k = 0; k < 9; k++) acc[k] += w * Math.pow(vec[k], P);
   total += w;
   v.textures.forEach(t => textures.add(t));
   for (const [color, cw] of Object.entries(v.colors)) colors[color] = (colors[color] || 0) + w * cw / v.total;
   for (const id of v.ids) ids.set(id, Math.max(ids.get(id) || 0, w));
   if (c.role === 'principal' || item.w === 3) mains.push(...v.ids);
  }
 }
 const axes = {};
 AXIS_IDS.forEach((id, k) => { axes[id] = total ? Math.round(clamp(Math.pow(acc[k] / total, 1 / P) * 2, 0, 10) * 10) / 10 : 0; });
 const sorted = AXIS_IDS.map(id => [id, axes[id]]).sort((a, b) => b[1] - a[1]);
 const top = sorted[0]?.[1] || 0;
 const dominant = top >= 4 ? sorted.filter(([, v]) => v >= 5 && v >= top - 1.6).slice(0, 3).map(([id]) => id) : [];
 if (top >= 4 && !dominant.length) dominant.push(sorted[0][0]);
 return {axes, dominant, top, textures, colors, hot, cold, known, unknown, items, components: components.length, techniques: techCount, ids: [...ids.keys()], mains: [...new Set(mains)], empty: !total};
}

// Huella del plato para dibujarla pequeña en las tarjetas: nueve valores de 0 a 1.
export const fingerprint = axes => AXIS_IDS.map(id => clamp((axes?.[id] || 0) / 10, 0, 1));

// ---------- Equilibrio ----------
const CRUNCH = ['crujiente'], SOFT = ['cremoso', 'untuoso', 'meloso', 'liquido', 'aireado'], TENDER = ['jugoso', 'tierno', 'carnoso', 'gelatinoso'];
const DULL = ['marron', 'beige', 'blanco', 'dorado', 'negro'];
const has = (set, names) => names.some(n => set.has(n));
const label = (id, en) => { const a = AXES.find(x => x[0] === id); return a ? (en ? a[2] : a[1]).toLowerCase() : id; };

// Notas de equilibrio: cada una con nivel (ok, tip, warn), título y texto en español e inglés, y qué arreglaría (fix).
export function dishAdvice(kb, dish, profile = dishProfile(kb, dish)) {
 const notes = [], a = profile.axes, sweet = dish?.course === 'postre';
 const add = (id, level, es, en, fix = null) => notes.push({id, level, title: [es[0], en[0]], text: [es[1], en[1]], fix});
 if (profile.empty) return {notes, verdict: null, profile};
 if (!profile.mains.length && profile.components > 1) add('lead', 'tip', ['¿Quién manda?', 'Ningún componente está marcado como protagonista: decide qué producto es el plato y deja que lo demás lo acompañe.'], ['Who leads?', 'No component is marked as the main element: decide which product is the dish and let the rest support it.']);
 if (profile.top < 4) add('flat', 'warn', ['Perfil plano', 'Ningún sabor destaca. Sube uno con decisión: un fondo con umami, un punto ácido o un toque de brasa.'], ['Flat profile', 'No flavour stands out. Push one with intent: an umami base, a sour note or a touch of char.'], 'umami');
 const loud = AXIS_IDS.filter(id => a[id] >= 6.5);
 if (loud.length >= 4) add('crowded', 'tip', ['Muchas voces a la vez', 'Hay ' + loud.length + ' sabores muy altos (' + loud.map(x => label(x)).join(', ') + '). Quita un elemento o baja uno: el plato se entiende mejor.'], ['Too many voices', loud.length + ' flavours are very high (' + loud.map(x => label(x, true)).join(', ') + '). Remove one element or tone one down so the dish reads clearly.']);
 const cut = Math.max(a.acido, a.fresco * .8);
 if (!sweet) {
  if (a.graso >= 6 && a.acido < 3.5 && a.fresco < 4.5) add('fat', 'warn', ['Pide algo que corte la grasa', 'Es un plato graso (' + a.graso + '/10) y casi no hay ácido (' + a.acido + '/10). Un encurtido, un cítrico o un vinagre lo aligeran y dan ganas de otro bocado.'], ['It needs something to cut the fat', 'It is a rich dish (' + a.graso + '/10) with hardly any acidity (' + a.acido + '/10). A pickle, citrus or vinegar lightens it and invites another bite.'], 'acido');
  else if (a.graso >= 5 && cut < 3) add('lift', 'tip', ['Le vendría bien frescor', 'Hay grasa y poco que la levante. Una hierba fresca, un cítrico o algo crudo al final.'], ['It would welcome freshness', 'There is fat and little to lift it. A fresh herb, citrus or something raw to finish.'], 'fresco');
  if (a.ahumado >= 6.5 && a.acido < 3 && a.fresco < 3) add('smoke', 'tip', ['Mucha brasa sin contrapunto', 'El ahumado manda (' + a.ahumado + '/10). Un punto ácido o fresco lo limpia y deja que se note el producto.'], ['Lots of char with no counterpoint', 'Smoke leads (' + a.ahumado + '/10). A sour or fresh note cleans it up and lets the product show.'], 'acido');
  if (a.umami < 3.5 && profile.top >= 4 && ['principal', 'entrante', 'picar'].includes(dish?.course || 'principal')) add('umami', 'tip', ['Le falta fondo', 'Poco umami (' + a.umami + '/10). Un fondo, una anchoa, un queso curado o un punto de miso le dan profundidad sin cambiar el plato.'], ['It lacks depth', 'Little umami (' + a.umami + '/10). A stock, an anchovy, an aged cheese or a little miso add depth without changing the dish.'], 'umami');
  if (a.dulce >= 6 && a.acido < 3 && a.amargo < 2.5 && a.picante < 2.5) add('sweet', 'warn', ['Tira a dulce', 'El dulce está alto (' + a.dulce + '/10) y nada lo compensa. Equilíbralo con ácido, amargo o un punto picante.'], ['It leans sweet', 'Sweetness is high (' + a.dulce + '/10) with nothing to balance it. Offset it with acidity, bitterness or a little heat.'], 'acido');
  if (a.amargo >= 6 && a.dulce < 2.5 && a.graso < 4) add('bitter', 'tip', ['Amargor sin red', 'Mucho amargo (' + a.amargo + '/10). Un poco de grasa o de dulce lo redondea.'], ['Bitterness with no safety net', 'Lots of bitterness (' + a.amargo + '/10). A little fat or sweetness rounds it off.'], 'graso');
  if (a.picante >= 6.5 && a.graso < 3.5 && a.dulce < 2.5) add('heat', 'tip', ['Picante sin freno', 'El picante está alto (' + a.picante + '/10). Algo graso, lácteo o dulce lo hace más amable.'], ['Heat with no brake', 'Heat is high (' + a.picante + '/10). Something rich, dairy or sweet makes it friendlier.'], 'graso');
  if (a.salado >= 7 && a.acido < 3 && a.dulce < 2.5) add('salt', 'tip', ['Muy salino', 'Hay varios elementos salados (' + a.salado + '/10). Vigila el punto de sal y dale un ácido o un dulce que lo equilibre.'], ['Very salty', 'Several salty elements (' + a.salado + '/10). Watch the seasoning and balance it with acidity or sweetness.'], 'acido');
 } else {
  if (a.dulce >= 6.5 && a.acido < 3 && a.amargo < 2.5 && a.salado < 1.5) add('sweet', 'warn', ['Muy dulce', 'Todo empuja al dulce (' + a.dulce + '/10). Un ácido, un amargo (cacao, café, cítrico) o una pizca de sal lo hacen más adulto.'], ['Very sweet', 'Everything pushes towards sweet (' + a.dulce + '/10). Acidity, bitterness (cocoa, coffee, citrus) or a pinch of salt make it more grown-up.'], 'acido');
  if (a.graso >= 6 && cut < 3) add('fat', 'tip', ['Postre pesado', 'Mucha grasa y poco que la corte. Una fruta ácida o un cítrico lo aligeran.'], ['A heavy dessert', 'Lots of fat and little to cut it. A sharp fruit or citrus lightens it.'], 'acido');
 }
 // Texturas
 const crunch = has(profile.textures, CRUNCH), soft = has(profile.textures, SOFT), tender = has(profile.textures, TENDER);
 if (!crunch) add('crunch', 'tip', ['No hay crujiente', 'Todo es blando. Un crujiente (fruto seco tostado, pan frito, una piel, un encurtido) da contraste y hace el plato más goloso.'], ['Nothing crunchy', 'Everything is soft. A crunch (toasted nuts, fried bread, crisp skin, a pickle) adds contrast and makes the dish more moreish.'], 'crujiente');
 if (!soft && profile.components >= 2) add('sauce', 'tip', ['Falta algo que ligue', 'No hay salsa, crema ni jugo. Algo untuoso une los elementos y hace que el plato no quede seco.'], ['Nothing binds it', 'There is no sauce, cream or jus. Something unctuous ties the elements together and keeps the dish from being dry.'], 'graso');
 // Temperatura
 if (profile.hot >= 2 && !profile.cold && profile.components >= 3 && a.fresco < 4) add('temp', 'tip', ['Todo va caliente', 'Un elemento frío o crudo al pase (un encurtido, una hierba, un tartar) da contraste de temperatura.'], ['Everything is hot', 'A cold or raw element at the pass (a pickle, a herb, a tartare) adds temperature contrast.'], 'fresco');
 // Color
 const colorTotal = Object.values(profile.colors).reduce((n, v) => n + v, 0), dull = DULL.reduce((n, c) => n + (profile.colors[c] || 0), 0);
 if (colorTotal > 0 && profile.known >= 3 && dull / colorTotal >= .8) add('color', 'tip', ['Plato de tonos pardos', 'Casi todo es marrón, blanco o dorado. Un verde o un rojo lo despiertan en la mesa y en la foto.'], ['A brown-toned plate', 'Almost everything is brown, white or golden. Something green or red wakes it up on the table and in the photo.'], 'color');
 // Servicio
 if (profile.components > 6 || profile.items > 16) add('service', 'tip', ['Muchos elementos para el pase', profile.components + ' componentes y ' + profile.items + ' ingredientes. Piensa si se monta en cinco gestos con la cocina llena.'], ['A lot of elements for the pass', profile.components + ' components and ' + profile.items + ' ingredients. Ask whether it can be plated in five moves on a full service.']);
 // Lo que ya funciona
 if (!sweet && a.graso >= 5 && cut >= 4) add('ok-fat', 'ok', ['Grasa y acidez en equilibrio', 'Hay grasa que da gusto y algo que la corta.'], ['Fat and acidity in balance', 'There is fat for pleasure and something to cut it.']);
 if (crunch && (soft || tender)) add('ok-texture', 'ok', ['Hay contraste de texturas', 'Crujiente y algo tierno o cremoso en el mismo bocado.'], ['There is texture contrast', 'Crunch and something tender or creamy in the same bite.']);
 if (a.umami >= 6 && !sweet) add('ok-umami', 'ok', ['Buen fondo', 'El umami sostiene el plato (' + a.umami + '/10).'], ['Good depth', 'Umami carries the dish (' + a.umami + '/10).']);
 if (profile.hot && profile.cold) add('ok-temp', 'ok', ['Contraste de temperatura', 'Hay elementos calientes y fríos.'], ['Temperature contrast', 'There are hot and cold elements.']);
 const lacking = [...new Set(notes.filter(n => n.level !== 'ok' && n.fix).map(n => n.fix))];
 return {notes, verdict: {dominant: profile.dominant, lacking}, profile};
}

// ---------- Sugerencias para equilibrar ----------
const FIX_AXIS = {acido: 2, umami: 4, graso: 5, dulce: 0, amargo: 3, picante: 6, ahumado: 7};
// Qué tiene que tener un ingrediente para arreglar cada carencia (0 = no sirve).
function fixStrength(ing, fix) {
 if (fix === 'crujiente') return ing.textures.includes('crujiente') ? 4 : 0;
 if (fix === 'fresco') { const f = freshOf(ing); return f >= 3 ? f : 0; }
 if (fix === 'color') return ['verde', 'rojo', 'morado', 'naranja', 'rosa'].includes(ing.color) && freshOf(ing) >= 1.5 ? 3 + (ing.color === 'verde' || ing.color === 'rojo' ? 1 : 0) : 0;
 const k = FIX_AXIS[fix];
 if (k === undefined) return 0;
 const v = ing.taste[k];
 if (v < 3) return 0;
 // Un ácido que además es muy dulce (o un umami muy graso) arregla peor.
 if (fix === 'acido' && ing.taste[0] >= 4) return 0;
 if (fix === 'acido' && ing.taste[5] >= 4) return 0;
 return v;
}
// ctx: {pantry: Set de ids de la tabla que hay en la cocina, recipes: Map id → nombre de la subreceta propia, month}
export function suggest(kb, dish, fix, ctx = {}, limit = 6) {
 const profile = dishProfile(kb, dish), used = new Set(profile.ids), mains = profile.mains.length ? profile.mains : profile.ids;
 const pantry = ctx.pantry || new Set(), recipes = ctx.recipes || new Map(), month = ctx.month || 0;
 const out = [];
 for (const ing of kb.list) {
  if (used.has(ing.id)) continue;
  const strength = fixStrength(ing, fix);
  if (!strength) continue;
  const affinity = mains.reduce((n, id) => n + (kb.links[id]?.get(ing.id)?.score || 0), 0);
  const own = recipes.has(ing.id), have = pantry.has(ing.id), season = inSeason(ing, month);
  const score = strength + affinity * 1.5 + (own ? 5 : 0) + (have ? 2.5 : 0) + (season ? .7 : 0);
  out.push({id: ing.id, score, affinity, own, have, season, recipe: own ? recipes.get(ing.id) : null});
 }
 out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
 // Que no salgan seis cosas iguales: como mucho dos de la misma familia.
 const perFamily = {}, picked = [];
 for (const s of out) {
  const family = kb.byId[s.id].family;
  if ((perFamily[family] || 0) >= 2) continue;
  perFamily[family] = (perFamily[family] || 0) + 1; picked.push(s);
  if (picked.length >= limit) break;
 }
 return picked;
}

// ---------- Combinaciones ----------
const shared = (x, y) => x.aromas.filter(a => y.aromas.includes(a));
// Con qué combina un ingrediente: clásicas (primero las que se nombran en los dos sentidos), atrevidas y las que hay en la cocina.
export function pairings(kb, id, ctx = {}) {
 const ing = kb.byId[id];
 if (!ing) return {classic: [], bold: [], pantry: []};
 const pantry = ctx.pantry || new Set(), recipes = ctx.recipes || new Map(), month = ctx.month || 0;
 const all = [...kb.links[id].entries()].map(([pid, link]) => {
  const other = kb.byId[pid];
  return {id: pid, score: link.score, bold: link.bold, have: pantry.has(pid), own: recipes.has(pid), season: inSeason(other, month), aromas: shared(ing, other)};
 }).sort((x, y) => y.score - x.score || y.aromas.length - x.aromas.length || x.id.localeCompare(y.id));
 return {classic: all.filter(x => !x.bold), bold: all.filter(x => x.bold), pantry: all.filter(x => x.have || x.own)};
}

// Puente entre dos productos: lo que combina con los dos, y los aromas que comparten.
export function bridge(kb, a, b, ctx = {}) {
 const x = kb.byId[a], y = kb.byId[b];
 if (!x || !y || a === b) return {direct: false, aromas: [], links: []};
 const pantry = ctx.pantry || new Set(), recipes = ctx.recipes || new Map();
 const links = [];
 for (const [pid, la] of kb.links[a]) {
  const lb = kb.links[b].get(pid);
  if (!lb || pid === a || pid === b) continue;
  links.push({id: pid, score: la.score + lb.score, have: pantry.has(pid), own: recipes.has(pid)});
 }
 links.sort((p, q) => (q.score + (q.have || q.own ? .5 : 0)) - (p.score + (p.have || p.own ? .5 : 0)) || p.id.localeCompare(q.id));
 return {direct: kb.links[a].has(b), aromas: shared(x, y), links};
}

// Mezcla de una subreceta a partir de los nombres de sus ingredientes: [[id, peso], …] con lo que se reconoce.
export function mixFromNames(kb, names) {
 const weights = new Map();
 for (const entry of names || []) {
  const name = typeof entry === 'string' ? entry : entry?.name, w = typeof entry === 'string' ? 1 : (Number(entry?.weight) > 0 ? Number(entry.weight) : 1);
  const id = matchName(kb, name);
  if (id) weights.set(id, (weights.get(id) || 0) + w);
 }
 return [...weights.entries()].sort((p, q) => q[1] - p[1]).slice(0, 12).map(([id, w]) => [id, Math.round(w * 100) / 100]);
}
