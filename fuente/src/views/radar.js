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

let filter = 'todo';
export const title = params => (params[0] ? t('Aviso', 'Alert') : t('Radar', 'Radar'));

const FILTERS = () => [['todo', t('Todo', 'All')], ...Object.keys(KINDS).map(k => [k, k === 'idea' ? t('Ideas', 'Ideas') : kindLabel(k)]), ['guardados', t('Guardados', 'Saved')]];

function list() {
 const all = state.trends, hidden = all.filter(x => x.dismissed_at).length;
 const shown = filter === 'descartados' ? all.filter(x => x.dismissed_at) : liveTrends().filter(x => filter === 'todo' || (filter === 'guardados' ? !!x.saved_at : x.kind === filter));
 let html = '<header class="page-head"><h1>' + esc(t('Radar', 'Radar')) + '</h1><p>' + esc(t('Lo que se mueve en las mejores cocinas y revistas, llevado a tu cocina.', 'What is moving in the best kitchens and magazines, brought to your kitchen.')) + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-act="search">' + icon('search') + esc(t('Buscar tendencias de hoy', 'Find today\'s trends')) + '</button>' + (iaOn() ? '<button type="button" class="btn ghost" data-act="search-manual">' + esc(t('Hacerlo copiando y pegando', 'Do it by copy and paste')) + '</button>' : '') + '</div></header>';
 html += '<div class="filters" role="group" aria-label="' + esc(t('Filtrar avisos', 'Filter alerts')) + '">' + FILTERS().map(([id, label]) => '<button type="button" class="pill' + (filter === id ? ' active' : '') + '" data-filter="' + id + '" aria-pressed="' + (filter === id) + '">' + (id === 'guardados' ? icon('star') : '') + esc(label) + '</button>').join('') + '</div>';
 if (!shown.length) {
  html += !state.loaded && !state.loadError ? skeleton(3) : filter === 'todo'
   ? emptyState('radar', t('Aún no hay avisos', 'No alerts yet'), t('Pulsa «Buscar tendencias de hoy»: la app prepara la búsqueda, tú la pegas en Claude o en ChatGPT y traes aquí lo que encuentren.', 'Press “Find today\'s trends”: the app prepares the search, you paste it into Claude or ChatGPT and bring back what they find.'))
   : emptyState('search', t('Nada con este filtro', 'Nothing with this filter'), t('Prueba con «Todo» para ver el radar entero.', 'Try “All” to see the full radar.'), '<button type="button" class="btn ghost" data-filter="todo">' + esc(t('Ver todo', 'See all')) + '</button>');
 } else {
  let day = '';
  for (const tr of shown) {
   if (tr.day !== day) {
    if (day) html += '</div>';
    day = tr.day;
    html += '<h2 class="day">' + esc(day === dayKey() ? t('Hoy', 'Today') + ' · ' + longDate(day) : longDate(day)) + '</h2><div class="trend-grid">';
   }
   html += trendCard(tr);
  }
  html += '</div>';
 }
 if (hidden && filter !== 'descartados') html += '<p class="fine center"><button type="button" class="linkbtn" data-filter="descartados">' + esc(t('Ver descartados', 'See dismissed')) + ' (' + hidden + ')</button></p>';
 if (filter === 'descartados') html += '<p class="fine center"><button type="button" class="linkbtn" data-filter="todo">' + esc(t('Volver al radar', 'Back to the radar')) + '</button></p>';
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
   try { const n = addTrends(found); s.close(); filter = 'todo'; toast(n ? t('Radar al día: ' + n + ' avisos nuevos.', 'Radar updated: ' + n + ' new alerts.') : t('Esos avisos ya estaban en el radar.', 'Those alerts were already on the radar.')); if (root.isConnected) root.innerHTML = list(); }
   catch (err) { toast(friendly(err), 'error'); }
  }
 });
}
export const render = params => (params[0] ? detail(params[0]) : list());

export function mount(root, params) {
 const id = params[0], tr = id && state.trends.find(x => x.id === id);
 if (!id) setTimeout(() => { if (root.isConnected && root.classList.contains('view-radar')) markRadarSeen(); }, 1200);
 root.addEventListener('click', async e => {
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; root.innerHTML = list(); return; }
  if (e.target.closest('[data-act=search-manual]')) { searchSheet(root); return; }
  const sb = e.target.closest('[data-act=search]');
  if (sb && !iaOn()) { searchSheet(root); return; }
  if (sb) {
   // Con ChatGPT conectado busca él solo en internet; tarda un poco porque lee varias fuentes.
   sb.disabled = true; sb.classList.add('is-busy'); sb.lastChild.textContent = t('Buscando en internet… (puede tardar un minuto)', 'Searching the internet… (may take a minute)');
   try {
    const found = trendsFromReply(await askIa({text: radarPrompt(), web: true}));
    if (!found.length) throw Object.assign(Error('empty'), {kind: 'empty'});
    const n = addTrends(found); filter = 'todo';
    toast(n ? t('Radar al día: ' + n + ' avisos nuevos.', 'Radar updated: ' + n + ' new alerts.') : t('No hay avisos nuevos desde la última búsqueda.', 'No new alerts since the last search.'));
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
 return null;
}
