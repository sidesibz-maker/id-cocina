// I+D · Sabores: con qué combina cada producto (clásicas, atrevidas y lo que hay en casa) y qué une a dos productos.
// Todo sale de la tabla de sabores y de la cocina del restaurante: no hay IA aquí, la respuesta es inmediata.
import {FAMILIES, AROMAS, TEXTURES, AXIS_IDS, technique, pairings, bridge, inSeason} from '../flavor-core.js';
import {searchIngredients, flavorContext} from '../kitchen.js';
import {t, en, pick, monthName} from '../i18n.js';
import {esc, icon, $, flavorMeters, joinList} from '../ui.js';
import {state} from '../store.js';
import {emptyState, skeleton, sectionHead} from './shared.js';

export const title = params => { const ing = state.kb?.byId[params[0]]; return ing ? (en() ? ing.en : ing.es) : t('Sabores', 'Flavours'); };
const name = id => { const i = state.kb.byId[id]; return i ? (en() ? i.en : i.es) : id; };
const chip = (p, base) => '<a class="chip' + (p.have || p.own ? ' chip-have' : '') + '" href="#/sabores/' + esc(base ? base + '/' + p.id : p.id) + '">' + esc(name(p.id)) + (p.own ? '<small>' + esc(t('subreceta tuya', 'your sub-recipe')) + '</small>' : p.have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : p.season ? '<small>' + esc(t('de temporada', 'in season')) + '</small>' : '') + '</a>';

// Meses de temporada como texto: «de noviembre a marzo».
function seasonText(ing) {
 if (!ing.months.size) return t('Todo el año', 'All year');
 const months = [...ing.months].sort((a, b) => a - b), runs = [];
 for (const m of months) { const last = runs[runs.length - 1]; if (last && last[1] === m - 1) last[1] = m; else runs.push([m, m]); }
 if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) { runs[0][0] = runs.pop()[0]; }
 return joinList(runs.map(([a, b]) => (a === b ? monthName(a) : t('de ', 'from ') + monthName(a) + t(' a ', ' to ') + monthName(b))));
}

function index() {
 const kb = state.kb;
 if (!kb) return '<header class="page-head"><h1>' + esc(t('Sabores', 'Flavours')) + '</h1></header>' + skeleton(3);
 const pantry = state.kitchen?.pantry || new Set(), m = new Date().getMonth() + 1;
 const groups = [['carne', 'ave', 'embutido'], ['pescado', 'marisco'], ['verdura', 'seta', 'fruta'], ['queso', 'lacteo', 'huevo'], ['salsa', 'condimento', 'encurtido']];
 const titles = [t('Carnes y curados', 'Meat and cured'), t('Pescado y marisco', 'Fish and shellfish'), t('Verdura, setas y fruta', 'Vegetables, mushrooms and fruit'), t('Quesos, lácteos y huevo', 'Cheese, dairy and egg'), t('Salsas y despensa', 'Sauces and pantry')];
 let html = '<header class="page-head"><h1>' + esc(t('Sabores', 'Flavours')) + '</h1><p>' + esc(t('Busca un producto y mira con qué combina, o elige dos y encuentra lo que los une.', 'Search a product to see what it pairs with, or choose two and find what links them.')) + '</p></header>' +
  '<label class="sr" for="flavSearch">' + esc(t('Buscar producto', 'Search product')) + '</label><div class="searchbox searchbox-big">' + icon('search') + '<input id="flavSearch" type="search" placeholder="' + esc(t('¿Con qué combina…?', 'What pairs with…?')) + '" autocomplete="off" enterkeyhint="search"></div><div id="flavResults" class="chips"></div>';
 if (pantry.size) {
  html += '<section class="sec">' + sectionHead(t('Tus básicos', 'Your staples'), '', t('Los productos de siempre de tu cocina. El buscador encuentra todo el catálogo.', 'Your kitchen\'s everyday products. The search covers the whole catalogue.'));
  groups.forEach((families, k) => {
   const rows = kb.list.filter(i => families.includes(i.family) && pantry.has(i.id)).sort((a, b) => (inSeason(b, m) - inSeason(a, m)) || name(a.id).localeCompare(name(b.id)));
   if (rows.length) html += '<p class="mini">' + esc(titles[k]) + '</p><div class="chips">' + rows.slice(0, 40).map(i => '<a class="chip chip-have" href="#/sabores/' + esc(i.id) + '">' + esc(name(i.id)) + (inSeason(i, m) && i.months.size <= 7 ? '<small>' + esc(t('de temporada', 'in season')) + '</small>' : '') + '</a>').join('') + '</div>';
  });
  html += '</section>';
 }
 const local = kb.list.filter(i => i.tags.includes('ibiza'));
 if (local.length) html += '<section class="sec">' + sectionHead(t('De aquí', 'From here'), '', t('Producto y tradición de Ibiza y Baleares.', 'Produce and tradition from Ibiza and the Balearics.')) + '<div class="chips">' + local.map(i => '<a class="chip' + (pantry.has(i.id) ? ' chip-have' : '') + '" href="#/sabores/' + esc(i.id) + '">' + esc(name(i.id)) + '</a>').join('') + '</div></section>';
 return html;
}

function page(id) {
 const kb = state.kb, ing = kb.byId[id], ctx = flavorContext(state.kitchen), m = ctx.month;
 const p = pairings(kb, id, ctx), have = ctx.pantry.has(id), usedIn = state.kitchen?.usedIn.get(id) || [], products = (state.kitchen?.productsByKb.get(id) || []).filter(x => x.recent).slice(0, 5);
 const axes = Object.fromEntries(AXIS_IDS.map((a, k) => [a, k < 8 ? ing.taste[k] * 2 : 0]));
 const dominant = AXIS_IDS.slice(0, 8).filter((a, k) => ing.taste[k] >= 4);
 const meters = flavorMeters({axes, dominant}).replace(/<li class="fm-row[^"]*"><span class="fm-name">[^<]*<\/span><span class="fm-track"[^>]*><span class="fm-fill" style="width:0\.0%"><\/span><\/span><span class="fm-val">0<\/span><span class="fm-tag"><\/span><\/li>/g, '');
 const techs = ing.tech.map(technique).filter(Boolean).map(x => (en() ? x.en : x.es));
 let html = '<a class="back" href="#/sabores">' + icon('left') + esc(t('Sabores', 'Flavours')) + '</a><article class="ing-page"><header class="page-head"><p class="kicker">' + esc(pick(FAMILIES[ing.family])) + (ing.tags.includes('ibiza') ? ', ' + esc(t('de aquí', 'local')) : '') + (have ? ', ' + esc(t('de tus básicos', 'one of your staples')) : '') + '</p><h1>' + esc(name(id)) + '</h1>' +
  '<p>' + icon('leaf') + esc(seasonText(ing)) + (ing.months.size && inSeason(ing, m) ? ', <strong>' + esc(t('ahora en temporada', 'in season now')) + '</strong>' : '') + '</p></header>' +
  '<div class="row-actions row-left">' + (state.canEdit && !state.setupPending ? '<a class="btn primary" href="#/plato/nuevo/' + esc(id) + '">' + icon('plus') + esc(t('Crear un plato con esto', 'Create a dish with this')) + '</a>' : '') + '<a class="btn ghost" href="#/sabores/' + esc(id) + '/con">' + icon('link') + esc(t('Buscar un puente con otro producto', 'Find a bridge to another product')) + '</a></div>' +
  '<div class="ing-cols"><section class="card"><h2>' + esc(t('A qué sabe', 'What it tastes like')) + '</h2>' + meters +
  '<p class="fine">' + esc(t('Aromas: ', 'Aromas: ')) + esc(ing.aromas.map(a => pick(AROMAS[a])).join(', ')) + '. ' + esc(t('Textura: ', 'Texture: ')) + esc(ing.textures.map(x => pick(TEXTURES[x])).join(', ')) + '.' + (techs.length ? ' ' + esc(t('Le va: ', 'Suits: ')) + esc(techs.join(', ').toLowerCase()) + '.' : '') + '</p></section>' +
  '<section class="card"><h2>' + esc(t('Combina con', 'Pairs with')) + '</h2>';
 if (p.pantry.length) html += '<p class="mini">' + esc(t('Con tus básicos', 'With your staples')) + '</p><div class="chips">' + p.pantry.slice(0, 16).map(x => chip(x)).join('') + '</div>';
 html += '<p class="mini">' + esc(t('Clásicas', 'Classics')) + '</p><div class="chips">' + p.classic.filter(x => !(x.have || x.own) || !p.pantry.length).slice(0, 22).map(x => chip(x)).join('') + '</div>';
 if (p.bold.length) html += '<p class="mini">' + esc(t('Atrevidas', 'Bold')) + '</p><div class="chips">' + p.bold.map(x => chip(x)).join('') + '</div>';
 html += '<p class="fine">' + esc(t('Toca una para ver su ficha.', 'Tap one to see its page.')) + '</p></section></div>';
 if (usedIn.length) html += '<section class="sec">' + sectionHead(t('Ya lo usas en', 'You already use it in')) + '<div class="chips">' + usedIn.slice(0, 20).map(n => '<span class="chip chip-static">' + esc(n) + '</span>').join('') + '</div></section>';
 return html + '</article>';
}

function pickSecond(id) {
 return '<a class="back" href="#/sabores/' + esc(id) + '">' + icon('left') + esc(name(id)) + '</a><header class="page-head"><h1>' + esc(name(id)) + ' <span class="times">×</span> …</h1><p>' + esc(t('Elige el segundo producto y te digo qué los une.', 'Choose the second product and I will tell you what links them.')) + '</p></header>' +
  '<label class="sr" for="flavSearch">' + esc(t('Buscar producto', 'Search product')) + '</label><div class="searchbox searchbox-big">' + icon('search') + '<input id="flavSearch" type="search" data-base="' + esc(id) + '" placeholder="' + esc(t('Calabaza, miso, naranja…', 'Pumpkin, miso, orange…')) + '" autocomplete="off" enterkeyhint="search"></div><div id="flavResults" class="chips"></div>';
}
function bridgePage(a, b) {
 const kb = state.kb, ctx = flavorContext(state.kitchen), r = bridge(kb, a, b, ctx);
 let html = '<a class="back" href="#/sabores/' + esc(a) + '">' + icon('left') + esc(name(a)) + '</a><header class="page-head"><p class="kicker">' + esc(t('Puente de sabores', 'Flavour bridge')) + '</p><h1>' + esc(name(a)) + ' <span class="times">×</span> ' + esc(name(b)) + '</h1>' +
  '<p>' + esc(r.direct ? t('Es una pareja conocida: combinan directamente.', 'A known pair: they go together directly.') : r.links.length ? t('No es una pareja clásica, pero hay productos que las unen.', 'Not a classic pair, but there are products that link them.') : t('No encuentro un puente claro entre los dos. Puede ser una pareja por descubrir… o un aviso.', 'I cannot find a clear bridge between the two. It may be a pairing to discover… or a warning.')) + '</p></header>';
 if (r.aromas.length) html += '<p class="fine">' + esc(t('Comparten aromas: ', 'Shared aromas: ')) + esc(r.aromas.map(x => pick(AROMAS[x])).join(', ')) + '.</p>';
 if (r.links.length) html += '<section class="card"><h2>' + esc(t('Lo que los une', 'What links them')) + '</h2><div class="chips">' + r.links.slice(0, 18).map(x => chip(x)).join('') + '</div><p class="fine">' + esc(t('Cada uno combina con los dos: úsalo de salsa, de aliño o de toque final.', 'Each one pairs with both: use it as a sauce, a dressing or a finishing touch.')) + '</p></section>';
 if (state.canEdit && !state.setupPending) html += '<div class="row-actions row-left"><a class="btn primary" href="#/plato/nuevo/' + esc(a) + '/' + esc(b) + '">' + icon('plus') + esc(t('Crear un plato con los dos', 'Create a dish with both')) + '</a></div>';
 return html;
}

export function render(params) {
 const kb = state.kb, [a, b] = params;
 if (!kb) return index();
 if (!a) return index();
 if (!kb.byId[a]) return '<a class="back" href="#/sabores">' + icon('left') + esc(t('Sabores', 'Flavours')) + '</a>' + emptyState('search', t('No conozco ese producto', 'I do not know that product'), t('Búscalo por otro nombre.', 'Search for it under another name.'), '<a class="btn primary" href="#/sabores">' + esc(t('Buscar', 'Search')) + '</a>');
 if (b === 'con') return pickSecond(a);
 if (b && kb.byId[b] && b !== a) return bridgePage(a, b);
 return page(a);
}
export function mount(root) {
 const input = $('#flavSearch', root), box = $('#flavResults', root);
 if (!input) return null;
 const base = input.dataset.base || '';
 input.oninput = () => {
  const q = input.value.trim();
  if (q.length < 2 || !state.kb) { box.innerHTML = ''; return; }
  const seen = new Set(), rows = searchIngredients(state.kb, state.kitchen, q, {limit: 30, english: en()}).filter(r => r.item.k && r.item.k !== base && !seen.has(r.item.k) && seen.add(r.item.k));
  box.innerHTML = rows.map(r => '<a class="chip' + (r.have || r.type === 'recipe' ? ' chip-have' : '') + '" href="#/sabores/' + esc(base ? base + '/' + r.item.k : r.item.k) + '">' + esc(name(r.item.k)) + (r.have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : '') + '</a>').join('') || '<p class="hint">' + esc(t('No lo encuentro. Prueba con otro nombre.', 'I cannot find it. Try another name.')) + '</p>';
 };
 if (base) setTimeout(() => input.focus(), 200);
 return null;
}
