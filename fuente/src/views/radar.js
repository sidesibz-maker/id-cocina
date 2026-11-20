// I+D · Radar: los avisos de tendencia, con sus fuentes. Llegan de dos sitios: del archivo radar.js que hay junto a la app
// (lo puede poner al día Claude cada mañana) y de «Buscar tendencias de hoy», que prepara la búsqueda para Claude o ChatGPT
// con internet y guarda lo que contesten. Aquí se leen, se guardan o se descartan, y cada idea se puede llevar a la libreta.
import {role, technique} from '../flavor-core.js';
import {t, en, longDate, relDay, dayKey, shortDate} from '../i18n.js';
import {esc, icon, $, toast, friendly} from '../ui.js';
import {state, liveTrends, markTrend, markRadarSeen, addTrends} from '../store.js';
import {radarPrompt, trendsFromReply, copy} from '../ai.js';
import {sheet} from '../ui.js';
import {trendCard, KINDS, kindLabel, heatMark, trText, trIdeas, trSources, trPlaces, emptyState, skeleton, adoptIdea, hostOf} from './shared.js';
import {go} from '../nav.js';
import {iaOn, askIa, iaMessage} from '../ia.js';
import {cleanProfile} from '../ai-core.js';
import {saveSettings} from '../store.js';
import {INTERESTS} from './kitchen-view.js';

// El radar se ve por tema (lo más útil arriba y cada tema con sus avisos), por fecha o solo lo guardado.
// «filter» es la vista: 'tema', 'fecha', 'guardados', 'descartados' o el id de un tema abierto entero.
let filter = 'tema', query = '', seenAtOpen = null;
export const title = params => (params[0] ? t('Aviso', 'Alert') : t('Radar', 'Radar'));

export const GROUPS = () => [
 ['producto', t('Producto y temporada', 'Produce and season'), ['producto'], 'leaf'],
 ['tecnica', t('Técnicas', 'Techniques'), ['tecnica'], 'flame'],
 ['plato', t('Platos y cartas', 'Dishes and menus'), ['plato'], 'book'],
 ['dulce', t('Dulces y bebidas', 'Sweets and drinks'), ['dulce', 'bebida'], 'drop'],
 ['escena', t('Restaurantes y premios', 'Restaurants and awards'), ['escena'], 'star'],
 ['idea', t('Ideas del día', 'Ideas of the day'), ['idea'], 'spark']
];
const groupOf = tr => GROUPS().find(g => g[2].includes(tr.kind)) || GROUPS()[2];
const isNew = tr => seenAtOpen !== null && String(tr.day) > seenAtOpen;
const age = tr => Math.max(0, (Date.now() - new Date(tr.day + 'T12:00:00').getTime()) / 86400000);
// Lo más útil: encaja con tu cocina (fit) y es reciente.
const useful = list => list.filter(x => x.kind !== 'idea').map(x => [x, (Number(x.fit) || 60) - age(x) * 1.5 + (x.saved_at ? 5 : 0) + (followed(x) ? 20 : 0)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Lo que te interesa (de Mi cocina): un aviso encaja si su texto lleva todas las palabras de alguno de tus temas.
const interests = () => cleanProfile(state.settings).interests;
const trWords = tr => norm([trText(tr, 'title'), trText(tr, 'summary'), trText(tr, 'adapt'), (tr.tags || []).join(' '), trIdeas(tr).map(i => i.name).join(' ')].join(' '));
const followed = tr => { const text = trWords(tr); return interests().find(x => norm(x).split(' ').filter(w => w.length > 2).every(w => text.includes(w))) || null; };
const matches = (tr, q) => !q || norm([trText(tr, 'title'), trText(tr, 'summary'), trText(tr, 'adapt'), (tr.tags || []).join(' '), trPlaces(tr).join(' '), trIdeas(tr).map(i => i.name).join(' ')].join(' ')).includes(q);

// Un aviso en una línea: lo que es, el título y de dónde viene. Para leer muchos de un vistazo.
function row(tr, {kind = true} = {}) {
 const src = trSources(tr)[0]?.name || (tr.kind === 'idea' ? t('Idea para tu cocina', 'An idea for your kitchen') : '');
 return '<li><a class="trow' + (tr.saved_at ? ' is-saved' : '') + '" href="#/radar/' + esc(tr.id) + '" data-kind="' + esc(tr.kind) + '">' +
  '<span class="trow-top">' + (kind ? '<span class="trow-kind">' + esc(kindLabel(tr.kind)) + '</span>' : '') + (tr.kind === 'idea' ? '' : heatMark(tr.heat)) + (isNew(tr) ? '<span class="new">' + esc(t('Nuevo', 'New')) + '</span>' : '') + (followed(tr) ? '<span class="follow">' + icon('check') + esc(followed(tr)) + '</span>' : '') + (tr.saved_at ? '<span class="saved-mark">' + icon('star') + '</span>' : '') + '</span>' +
  '<span class="trow-title">' + esc(trText(tr, 'title')) + '</span>' +
  '<span class="trow-sum">' + esc(trText(tr, 'summary')) + '</span>' +
  '<span class="trow-meta">' + esc([relDay(tr.day), src].filter(Boolean).join(' · ')) + '</span>' + icon('right') + '</a></li>';
}
const rows = (list, opts) => '<ul class="trows">' + list.map(x => row(x, opts)).join('') + '</ul>';

function interestsSheet(done) {
 let chosen = interests().slice();
 const all = () => [...new Set([...INTERESTS(), ...chosen])];
 const draw = () => all().map(x => '<button type="button" class="pill' + (chosen.includes(x) ? ' active' : '') + '" data-i="' + esc(x) + '" aria-pressed="' + chosen.includes(x) + '">' + esc(x) + '</button>').join('');
 const s = sheet({title: t('Lo que te interesa', 'What you follow'), wide: true, body: '<p class="lead">' + esc(t('Lo que elijas sale primero en el radar, con su marca, y la búsqueda de cada día le da prioridad.', 'What you choose comes first on the radar, marked, and the daily search gives it priority.')) + '</p><div class="chips" id="iList">' + draw() + '</div>' +
  '<div class="row-actions row-left"><label class="sr" for="iNew">' + esc(t('Otro tema', 'Another topic')) + '</label><input id="iNew" maxlength="60" placeholder="' + esc(t('Otro: alcachofa, cocina nikkei, Etxebarri…', 'Another: artichoke, nikkei, Etxebarri…')) + '" autocomplete="off" style="max-width:320px"><button type="button" class="btn ghost" data-act="i-add">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></div>' +
  '<div class="row-actions"><button type="button" class="btn primary" data-act="i-save">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>'});
 const add = () => { const v = $('#iNew', s.el).value.trim().slice(0, 60); if (v && !chosen.includes(v)) chosen = [...chosen, v].slice(0, 16); $('#iNew', s.el).value = ''; $('#iList', s.el).innerHTML = draw(); };
 s.el.addEventListener('keydown', e => { if (e.target.id === 'iNew' && e.key === 'Enter') { e.preventDefault(); add(); } });
 s.el.addEventListener('click', async e => {
  const p = e.target.closest('[data-i]');
  if (p) { const v = p.dataset.i; chosen = chosen.includes(v) ? chosen.filter(x => x !== v) : [...chosen, v].slice(0, 16); p.classList.toggle('active', chosen.includes(v)); p.setAttribute('aria-pressed', chosen.includes(v)); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'i-add') add();
  if (act === 'i-save') { await saveSettings({...cleanProfile(state.settings), interests: chosen}); s.close(); toast(t('Guardado. El radar te lo pondrá primero.', 'Saved. The radar will put it first.')); done(); }
 });
}
function toolbar(live) {
 const saved = live.filter(x => x.saved_at).length, view = GROUPS().some(g => g[0] === filter) ? 'tema' : filter;
 const tabs = [['tema', t('Por tema', 'By topic')], ['fecha', t('Por fecha', 'By date')], ['guardados', t('Guardados', 'Saved') + (saved ? ' · ' + saved : '')]];
 return '<div class="radar-bar"><div class="seg" role="tablist" aria-label="' + esc(t('Cómo ver el radar', 'How to view the radar')) + '">' + tabs.map(([id, label]) => '<button type="button" role="tab" class="seg-btn' + (view === id ? ' active' : '') + '" data-filter="' + id + '" aria-selected="' + (view === id) + '">' + (id === 'guardados' ? icon('star') : '') + esc(label) + '</button>').join('') + '</div>' +
  '<button type="button" class="btn ghost radar-follow" data-act="interests">' + icon('star') + esc(interests().length ? t('Te interesa: ', 'You follow: ') + interests().slice(0, 3).join(', ') + (interests().length > 3 ? '…' : '') : t('Elegir lo que te interesa', 'Choose what you follow')) + '</button>' +
  '<label class="sr" for="radarQ">' + esc(t('Buscar en el radar', 'Search the radar')) + '</label><div class="searchbox radar-q">' + icon('search') + '<input id="radarQ" type="search" value="' + esc(query) + '" placeholder="' + esc(t('Buscar: alcachofa, brasa, Etxebarri…', 'Search: artichoke, charcoal, Etxebarri…')) + '" autocomplete="off" enterkeyhint="search"></div></div>';
}
function body(live) {
 const q = norm(query.trim());
 if (q) {
  const found = live.filter(x => matches(x, q));
  return found.length ? '<p class="fine radar-count">' + esc(found.length === 1 ? t('1 aviso', '1 alert') : found.length + t(' avisos', ' alerts')) + '</p>' + rows(found) : emptyState('search', t('Nada con «', 'Nothing for “') + query.trim() + t('»', '”'), t('Prueba con otra palabra: un producto, una técnica o un restaurante.', 'Try another word: a product, a technique or a restaurant.'));
 }
 const group = GROUPS().find(g => g[0] === filter);
 if (group) {
  const list = live.filter(x => group[2].includes(x.kind));
  return '<button type="button" class="back linkback" data-filter="tema">' + icon('left') + esc(t('Todos los temas', 'All topics')) + '</button><h2 class="group-title">' + icon(group[3]) + esc(group[1]) + '<small>' + list.length + '</small></h2>' + (list.length ? '<div class="trend-grid">' + list.map(x => trendCard(x)).join('') + '</div>' : emptyState(group[3], t('Nada en este tema todavía', 'Nothing in this topic yet'), t('Cuando busques tendencias, lo que salga de aquí aparecerá en este apartado.', 'When you look for trends, anything on this topic will appear here.')));
 }
 if (filter === 'guardados') {
  const list = live.filter(x => x.saved_at);
  return list.length ? '<div class="trend-grid">' + list.map(x => trendCard(x)).join('') + '</div>' : emptyState('star', t('Aún no has guardado nada', 'Nothing saved yet'), t('Abre un aviso que te interese y pulsa «Guardar»: aquí los tendrás a mano.', 'Open an alert you like and press “Save”: you will have them here.'));
 }
 if (filter === 'fecha') {
  const d = x => age(x), parts = [[t('Hoy', 'Today'), x => d(x) < 1], [t('Esta semana', 'This week'), x => d(x) >= 1 && d(x) < 7], [t('Este mes', 'This month'), x => d(x) >= 7 && d(x) < 31], [t('Antes', 'Earlier'), x => d(x) >= 31]];
  return parts.map(([label, test]) => { const list = live.filter(test); return list.length ? '<section class="sec"><h2 class="day">' + esc(label) + ' · ' + list.length + '</h2>' + rows(list) + '</section>' : ''; }).join('');
 }
 // Por tema: lo que sigues, lo más útil y luego cada tema con sus tres primeros.
 const top = useful(live).slice(0, 3), topIds = new Set(top.map(x => x.id)), mine = live.filter(x => followed(x) && !topIds.has(x.id)).slice(0, 5);
 let html = (mine.length ? '<section class="group card group-follow"><header class="group-head"><h2>' + icon('star') + esc(t('Lo que sigues', 'What you follow')) + '</h2><span class="group-n">' + live.filter(followed).length + '</span></header>' + rows(mine) + '</section>' : '') + top.length ? '<section class="sec"><h2 class="day">' + icon('pan') + esc(t('Lo más útil para tu cocina', 'Most useful for your kitchen')) + '</h2><div class="strip trend-strip">' + top.map(x => trendCard(x, {lead: true})).join('') + '</div></section>' : '';
 html += '<div class="groups">' + GROUPS().map(([id, label, kinds, ic]) => {
  const all = live.filter(x => kinds.includes(x.kind)), rest = all.filter(x => !topIds.has(x.id)), list = (rest.length ? rest : all).slice(0, 3), fresh = all.filter(isNew).length;
  if (!all.length) return '';
  return '<section class="group card"><header class="group-head"><h2>' + icon(ic) + esc(label) + '</h2><span class="group-n">' + (fresh ? '<span class="new">' + fresh + ' ' + esc(fresh === 1 ? t('nuevo', 'new') : t('nuevos', 'new')) + '</span>' : '') + all.length + '</span></header>' +
   (list.length ? rows(list, {kind: kinds.length > 1}) : '<p class="fine">' + esc(t('Lo de este tema está arriba, en lo más útil.', 'This topic\'s alerts are above, in the most useful.')) + '</p>') +
   (all.length > list.length ? '<button type="button" class="linkbtn group-more" data-filter="' + id + '">' + esc(t('Ver los ', 'See all ') + all.length) + icon('right') + '</button>' : '') + '</section>';
 }).join('') + '</div>';
 return html;
}
function list() {
 const all = state.trends, hidden = all.filter(x => x.dismissed_at).length, live = liveTrends();
 if (seenAtOpen === null) seenAtOpen = state.seen || '';
 const fresh = live.filter(isNew).length;
 let html = '<header class="page-head"><h1>' + esc(t('Radar', 'Radar')) + '</h1><p>' + esc(t('Lo que se mueve en las mejores cocinas y revistas, llevado a tu cocina.', 'What is moving in the best kitchens and magazines, brought to your kitchen.')) + (live.length ? ' <span class="radar-sum">' + esc(live.length + t(' avisos', ' alerts') + (fresh ? ' · ' + fresh + ' ' + (fresh === 1 ? t('nuevo', 'new') : t('nuevos', 'new')) : '')) + '</span>' : '') + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-act="search">' + icon('search') + esc(t('Buscar tendencias de hoy', 'Find today\'s trends')) + '</button>' + (iaOn() ? '<button type="button" class="btn ghost" data-act="search-manual">' + esc(t('Hacerlo copiando y pegando', 'Do it by copy and paste')) + '</button>' : '') + '</div></header>';
 if (filter === 'descartados') {
  const gone = all.filter(x => x.dismissed_at);
  return html + '<button type="button" class="back linkback" data-filter="tema">' + icon('left') + esc(t('Volver al radar', 'Back to the radar')) + '</button><h2 class="group-title">' + esc(t('Descartados', 'Dismissed')) + '<small>' + gone.length + '</small></h2>' + (gone.length ? rows(gone) : '');
 }
 if (!live.length) {
  return html + (!state.loaded && !state.loadError ? skeleton(3) : emptyState('radar', t('Aún no hay avisos', 'No alerts yet'), iaOn() ? t('Pulsa «Buscar tendencias de hoy» y ChatGPT buscará en internet lo que se mueve.', 'Press “Find today\'s trends” and ChatGPT will search the internet.') : t('Pulsa «Buscar tendencias de hoy»: la app prepara la búsqueda, tú la pegas en Claude o en ChatGPT y traes aquí lo que encuentren.', 'Press “Find today\'s trends”: the app prepares the search, you paste it into Claude or ChatGPT and bring back what they find.'))) +
   (hidden ? '<p class="fine center"><button type="button" class="linkbtn" data-filter="descartados">' + esc(t('Ver descartados', 'See dismissed')) + ' (' + hidden + ')</button></p>' : '');
 }
 html += toolbar(live) + '<div id="radarBody">' + body(live) + '</div>';
 if (hidden) html += '<p class="fine center"><button type="button" class="linkbtn" data-filter="descartados">' + esc(t('Ver descartados', 'See dismissed')) + ' (' + hidden + ')</button></p>';
 return html;
}

function ideaCard(idea, k) {
 const comps = (Array.isArray(idea.components) ? idea.components : []).slice(0, 7).map(c => {
  const items = (Array.isArray(c?.items) ? c.items : []).map(x => (typeof x === 'string' ? x : x?.name || x?.n)).filter(Boolean);
  const techs = (Array.isArray(c?.techniques) ? c.techniques : []).map(technique).filter(Boolean).map(x => (en() ? x.en : x.es));
  const r = role(c?.role);
  return '<li><span class="comp-role">' + esc(en() ? r.en : r.es) + '</span><span><strong>' + esc(c?.name || items[0] || '') + '</strong>' + (techs.length ? ' · ' + esc(techs.join(', ')) : '') + (items.length ? '<br><small>' + esc(items.join(', ')) + '</small>' : '') + '</span></li>';
 }).join('');
 return '<article class="idea-card"><h3>' + esc(idea.name) + '</h3>' + (idea.line ? '<p>' + esc(idea.line) + '</p>' : '') + (comps ? '<ul class="comp-list">' + comps + '</ul>' : '') +
  (state.canEdit ? '<button type="button" class="btn primary" data-adopt="' + k + '">' + icon('book') + esc(t('Llevar a la libreta', 'Add to notebook')) + '</button>' : '') + '</article>';
}

function detail(id) {
 const tr = state.trends.find(x => x.id === id);
 if (!tr) return '<a class="back" href="#/radar">' + icon('left') + esc(t('Radar', 'Radar')) + '</a>' + (state.loaded || state.loadError ? emptyState('radar', t('Este aviso ya no está', 'This alert is no longer here'), t('Puede que sea de hace tiempo. Mira el radar de hoy.', 'It may be an old one. Have a look at today\'s radar.'), '<a class="btn primary" href="#/radar">' + esc(t('Ir al radar', 'Go to the radar')) + '</a>') : skeleton(3));
 const ideas = trIdeas(tr), sources = trSources(tr), places = trPlaces(tr), why = trText(tr, 'why'), adapt = trText(tr, 'adapt');
 let html = '<a class="back" href="#/radar">' + icon('left') + esc(t('Radar', 'Radar')) + '</a><article class="story">';
 html += '<p class="kicker">' + esc(kindLabel(tr.kind)) + (tr.kind === 'idea' ? '' : ' · ' + heatMark(tr.heat)) + ' · ' + esc(relDay(tr.day)) + '</p><h1>' + esc(trText(tr, 'title')) + '</h1><p class="story-lead">' + esc(trText(tr, 'summary')) + '</p>';
 if (why) html += '<section class="story-sec"><h2>' + esc(t('Por qué ahora', 'Why now')) + '</h2><p>' + esc(why) + '</p></section>';
 if (places.length) html += '<section class="story-sec"><h2>' + esc(t('Dónde se ve', 'Where it shows up')) + '</h2><div class="chips">' + places.map(p => '<span class="chip chip-static">' + esc(p) + '</span>').join('') + '</div></section>';
 if (adapt) html += '<section class="story-sec adapt"><h2>' + icon('pan') + esc(t('En tu cocina', 'In your kitchen')) + '</h2><p>' + esc(adapt) + '</p></section>';
 if (ideas.length) html += '<section class="story-sec"><h2>' + esc(ideas.length === 1 ? t('Una idea de plato', 'A dish idea') : t('Ideas de plato', 'Dish ideas')) + '</h2><div class="idea-list">' + ideas.map(ideaCard).join('') + '</div></section>';
 if (sources.length) html += '<section class="story-sec"><h2>' + esc(t('Fuentes', 'Sources')) + '</h2><ul class="sources">' + sources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + icon('out') + '</a><small>' + esc(hostOf(s.url)) + (/^\d{4}-\d{2}-\d{2}$/.test(s.date) ? ' · ' + esc(shortDate(s.date)) : '') + '</small></li>').join('') + '</ul></section>';
 if (state.canEdit) {
  html += '<div class="story-actions"><button type="button" class="btn ' + (tr.saved_at ? 'primary' : 'ghost') + '" data-act="save" aria-pressed="' + !!tr.saved_at + '">' + icon('star') + esc(tr.saved_at ? t('Guardado', 'Saved') : t('Guardar', 'Save')) + '</button>' +
   '<a class="btn ghost" href="#/crear/ideas/' + esc(tr.id) + '">' + icon('spark') + esc(t('Más ideas con esto', 'More ideas from this')) + '</a>' +
   '<button type="button" class="btn ghost" data-act="dismiss">' + icon(tr.dismissed_at ? 'undo' : 'x') + esc(tr.dismissed_at ? t('Recuperar', 'Restore') : t('No me interesa', 'Not for me')) + '</button></div>';
 }
 // El siguiente aviso del mismo tema, para leer seguido.
 const g = groupOf(tr), same = liveTrends().filter(x => g[2].includes(x.kind)), at = same.findIndex(x => x.id === tr.id), next = same.length > 1 ? same[(at + 1) % same.length] : null;
 if (next) html += '<a class="story-next" href="#/radar/' + esc(next.id) + '"><small>' + esc(t('Siguiente en ', 'Next in ') + g[1]) + '</small><strong>' + esc(trText(next, 'title')) + '</strong></a>';
 return html + '</article>';
}

// Buscar tendencias: la app prepara la búsqueda (con tu cocina y lo que ya ha salido) y guarda lo que encuentren.
function searchSheet(root) {
 const s = sheet({title: t('Buscar tendencias de hoy', 'Find today\'s trends'), wide: true, body:
  '<p class="lead">' + esc(t('La búsqueda la hace Claude o ChatGPT con internet: copia la petición, pégala allí y pega aquí lo que conteste.', 'Claude or ChatGPT do the search on the internet: copy the request, paste it there and paste the answer here.')) + '</p>' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="copy">' + icon('copy') + esc(t('1 · Copiar la búsqueda', '1 · Copy the search')) + '</button><a class="btn ghost" href="https://claude.ai/new" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a Claude', 'Ask Claude')) + icon('out') + '</a><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
  '<label class="mini" for="radarReply">' + esc(t('2 · Pega aquí la respuesta', '2 · Paste the answer here')) + '</label><textarea id="radarReply" rows="6" placeholder="' + esc(t('Pega la respuesta entera, tal cual', 'Paste the whole answer as it is')) + '"></textarea>' +
  '<div class="row-actions"><button type="button" class="btn ghost" data-paste="radarReply" data-then="[data-act=add]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="add">' + icon('plus') + esc(t('3 · Añadir al radar', '3 · Add to the radar')) + '</button></div>'});
 s.el.addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'copy') { const done = await copy(radarPrompt()); toast(done ? t('Búsqueda copiada. Pégala en Claude o en ChatGPT.', 'Search copied. Paste it into Claude or ChatGPT.') : t('No se pudo copiar. Prueba otra vez.', 'It could not be copied. Please try again.'), done ? 'info' : 'error'); }
  if (act === 'add') {
   const found = trendsFromReply($('#radarReply', s.el).value);
   if (!found.length) { toast(t('No encuentro avisos en ese texto. Pega la respuesta entera.', 'I cannot find alerts in that text. Paste the whole answer.'), 'error'); return; }
   try { const n = addTrends(found); s.close(); filter = 'tema'; toast(n ? t('Radar al día: ' + n + ' avisos nuevos.', 'Radar updated: ' + n + ' new alerts.') : t('Esos avisos ya estaban en el radar.', 'Those alerts were already on the radar.')); if (root.isConnected) root.innerHTML = list(); }
   catch (err) { toast(friendly(err), 'error'); }
  }
 });
}
export const render = params => (params[0] ? detail(params[0]) : list());

export function mount(root, params) {
 const id = params[0], tr = id && state.trends.find(x => x.id === id);
 if (!id) setTimeout(() => { if (root.isConnected && root.classList.contains('view-radar')) markRadarSeen(); }, 1200);
 root.addEventListener('input', e => { if (e.target.id !== 'radarQ') return; query = e.target.value; const b = $('#radarBody', root); if (b) b.innerHTML = body(liveTrends()); });
 root.addEventListener('click', async e => {
  if (e.target.closest('[data-act=interests]')) { interestsSheet(() => { if (root.isConnected) root.innerHTML = list(); }); return; }
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; query = ''; root.innerHTML = list(); if (!f.closest('.radar-bar')) root.querySelector('.radar-bar, .group-title')?.scrollIntoView({block: 'start', behavior: 'smooth'}); return; }
  if (e.target.closest('[data-act=search-manual]')) { searchSheet(root); return; }
  const sb = e.target.closest('[data-act=search]');
  if (sb && !iaOn()) { searchSheet(root); return; }
  if (sb) {
   // Con ChatGPT conectado busca él solo en internet; tarda un poco porque lee varias fuentes.
   sb.disabled = true; sb.classList.add('is-busy'); sb.lastChild.textContent = t('Buscando en internet… (puede tardar un minuto)', 'Searching the internet… (may take a minute)');
   try {
    const found = trendsFromReply(await askIa({text: radarPrompt(), web: true}));
    if (!found.length) throw Object.assign(Error('empty'), {kind: 'empty'});
    const n = addTrends(found); filter = 'tema';
    toast(n ? t('Radar al día: ' + n + ' avisos nuevos.', 'Radar updated: ' + n + ' new alerts.') : t('No hay avisos nuevos desde la última búsqueda.', 'No new alerts since the last search.')); filter = 'tema';
    if (root.isConnected) root.innerHTML = list();
   } catch (err) { toast(iaMessage(err), 'error', 7000); if (sb.isConnected) { sb.disabled = false; sb.classList.remove('is-busy'); sb.lastChild.textContent = t('Buscar tendencias de hoy', 'Find today\'s trends'); } }
   return;
  }
  if (!tr) return;
  const adopt = e.target.closest('[data-adopt]');
  if (adopt) { const idea = trIdeas(tr)[Number(adopt.dataset.adopt)]; if (!idea) return; adopt.disabled = true; await adoptIdea(idea, {kind: 'radar', trend_id: tr.id, title: tr.title}); if (adopt.isConnected) adopt.disabled = false; return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const button = e.target.closest('[data-act]');
  try {
   if (act === 'save') { await markTrend(tr.id, {saved_at: tr.saved_at ? null : new Date().toISOString()}); toast(tr.saved_at ? t('Guardado en tu radar.', 'Saved to your radar.') : t('Quitado de guardados.', 'Removed from saved.')); }
   if (act === 'dismiss') {
    const undo = !!tr.dismissed_at;
    await markTrend(tr.id, {dismissed_at: undo ? null : new Date().toISOString()});
    toast(undo ? t('Recuperado.', 'Restored.') : t('Descartado: el radar lo tendrá en cuenta.', 'Dismissed: the radar will take note.'));
    if (!undo) go('radar');
   }
  } catch (err) {
   toast(friendly(err), 'error');
  }
 });
 // Lo «nuevo» se marca hasta salir del radar (ir a un aviso y volver no lo borra).
 return () => { if (!/^#\/?radar/.test(location.hash)) seenAtOpen = null; };
}
