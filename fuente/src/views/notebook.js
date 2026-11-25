// I+D · Libreta: todos los platos en desarrollo, por estado. Nada se borra: lo que se quita va a la papelera y se recupera.
import {norm} from '../flavor-core.js';
import {t, en, relDay} from '../i18n.js';
import {esc, icon, $, $$, toast, friendly, sheet} from '../ui.js';
import {state, restoreDish, liveDishes} from '../store.js';
import {STATUSES, statusLabel, dishCard, hydrateImages, emptyState, skeleton} from './shared.js';
import {tabs} from './menus.js';

let status = 'todos', query = '', tagf = '';
export const title = params => (params[0] === 'papelera' ? t('Papelera', 'Bin') : t('Libreta', 'Notebook'));

const matches = d => { if (tagf && !(d.tags || []).includes(tagf)) return false; const q = norm(query); if (!q) return true; const text = norm([d.name, d.concept, ...(d.tags || []), ...(d.components || []).flatMap(c => [c?.name, ...(c?.items || []).map(i => i?.n)])].join(' ')); return q.split(' ').every(w => text.includes(w)); };
function grid() {
 const live = state.dishes.filter(d => !d.deleted_at), shown = live.filter(d => (status === 'todos' || d.status === status) && matches(d));
 if (!live.length) return !state.loaded && !state.loadError ? skeleton(3) : emptyState('book', t('Tu libreta está vacía', 'Your notebook is empty'), t('Aquí se guardan tus platos en desarrollo, con sus pruebas de cata y cómo van cambiando.', 'Your dishes in development are kept here, with their tasting tests and how they evolve.'), state.canEdit ? '<a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a>' : '');
 if (!shown.length) return emptyState('search', t('Nada con este filtro', 'Nothing with this filter'), t('Prueba con otro estado o borra la búsqueda.', 'Try another status or clear the search.'), '<button type="button" class="btn ghost" data-reset>' + esc(t('Ver todos', 'See all')) + '</button>');
 return '<div class="dish-grid">' + shown.map(dishCard).join('') + '</div>';
}
function list() {
 const live = state.dishes.filter(d => !d.deleted_at), trashed = state.dishes.filter(d => d.deleted_at).length;
 const count = id => (id === 'todos' ? live.length : live.filter(d => d.status === id).length);
 return '<header class="page-head page-head-row"><div><h1>' + esc(t('Libreta', 'Notebook')) + '</h1><p>' + esc(t('Tus platos de I+D, de la idea a la carta.', 'Your R&D dishes, from idea to menu.')) + '</p></div>' + '<div class="row-actions">' + (liveDishes().length ? '<button type="button" class="btn ghost" data-act="book">' + icon('down') + esc(t('Mi recetario en PDF', 'My recipe book as PDF')) + '</button>' : '') + (state.canEdit ? '<a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear', 'Create')) + '</a>' : '') + '</div></header>' + tabs('platos') +
  '<div class="filters" role="group" aria-label="' + esc(t('Filtrar por estado', 'Filter by status')) + '">' + [['todos', t('Todos', 'All')], ...STATUSES.map(s => [s[0], statusLabel(s[0])])].filter(([id]) => id === 'todos' || count(id) || id === status).map(([id, label]) => '<button type="button" class="pill' + (status === id ? ' active' : '') + '" data-status="' + id + '" aria-pressed="' + (status === id) + '">' + esc(label) + '<span class="count">' + count(id) + '</span></button>').join('') + '</div>' +
  (() => { const tags = [...new Set(live.flatMap(d => d.tags || []))].sort((a, b) => a.localeCompare(b, 'es')); return tags.length ? '<div class="filters tag-filters" role="group" aria-label="' + esc(t('Filtrar por etiqueta', 'Filter by tag')) + '">' + tags.map(x => '<button type="button" class="pill pill-tag' + (tagf === x ? ' active' : '') + '" data-tagf="' + esc(x) + '" aria-pressed="' + (tagf === x) + '">#' + esc(x) + '</button>').join('') + '</div>' : ''; })() +
  (live.length > 5 ? '<label class="sr" for="bookSearch">' + esc(t('Buscar en la libreta', 'Search the notebook')) + '</label><div class="searchbox">' + icon('search') + '<input id="bookSearch" type="search" value="' + esc(query) + '" placeholder="' + esc(t('Buscar por nombre o ingrediente', 'Search by name or ingredient')) + '" autocomplete="off" enterkeyhint="search"></div>' : '') +
  '<div id="bookGrid">' + grid() + '</div>' +
  (trashed ? '<p class="fine center"><a class="linkbtn" href="#/libreta/papelera">' + icon('trash') + esc(t('Papelera', 'Bin')) + ' (' + trashed + ')</a></p>' : '');
}
function bin() {
 const trashed = state.dishes.filter(d => d.deleted_at);
 return '<a class="back" href="#/libreta">' + icon('left') + esc(t('Libreta', 'Notebook')) + '</a><header class="page-head"><h1>' + esc(t('Papelera', 'Bin')) + '</h1><p>' + esc(t('Aquí no se borra nada: recupera lo que quieras.', 'Nothing is deleted here: restore whatever you want.')) + '</p></header>' +
  (trashed.length ? '<ul class="bin">' + trashed.map(d => '<li><div><strong>' + esc(d.name) + '</strong><small>' + esc(t('En la papelera desde ', 'In the bin since ') + relDay(d.deleted_at).toLowerCase()) + '</small></div>' + (state.canEdit ? '<button type="button" class="btn ghost" data-restore="' + esc(d.id) + '">' + icon('undo') + esc(t('Recuperar', 'Restore')) + '</button>' : '') + '</li>').join('') + '</ul>' : emptyState('trash', t('La papelera está vacía', 'The bin is empty'), t('Lo que mandes a la papelera aparecerá aquí.', 'Whatever you move to the bin will show up here.')));
}
export const render = params => (params[0] === 'papelera' ? bin() : list());

export function mount(root, params) {
 hydrateImages(root);
 const redraw = () => { const g = $('#bookGrid', root); if (g) { g.innerHTML = grid(); hydrateImages(g); } };
 root.addEventListener('input', e => { if (e.target.id === 'bookSearch') { query = e.target.value; redraw(); } });
 root.addEventListener('click', async e => {
  if (e.target.closest('[data-act=book]')) { bookSheet(); return; }
  const s = e.target.closest('[data-status]');
  if (s) { status = s.dataset.status; root.querySelectorAll('[data-status]').forEach(b => { const on = b.dataset.status === status; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); redraw(); return; }
  const tf = e.target.closest('[data-tagf]');
  if (tf) { tagf = tagf === tf.dataset.tagf ? '' : tf.dataset.tagf; root.querySelectorAll('[data-tagf]').forEach(b => { const on = b.dataset.tagf === tagf; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); redraw(); return; }
  if (e.target.closest('[data-reset]')) { status = 'todos'; query = ''; tagf = ''; root.innerHTML = list(); hydrateImages(root); return; }
  const r = e.target.closest('[data-restore]');
  if (r) { r.disabled = true; try { await restoreDish(r.dataset.restore); toast(t('Recuperado: vuelve a estar en la libreta.', 'Restored: it is back in the notebook.')); } catch (err) { toast(friendly(err), 'error'); if (r.isConnected) r.disabled = false; } }
 });
 return null;
}

// Mi recetario: todas las fichas elegidas en un solo documento, con portada e índice, para imprimir o guardar en PDF.
const BOOK_STATUS = [['carta', 'En carta', 'On the menu'], ['lista', 'Lista', 'Ready'], ['afinando', 'Afinando', 'Refining'], ['pruebas', 'En pruebas', 'Testing'], ['idea', 'Idea', 'Idea']];
function bookSheet() {
 const s = sheet({title: t('Mi recetario', 'My recipe book'), wide: true, body: '<p class="lead">' + esc(t('Todas las fichas técnicas en un documento, con portada e índice. Para tu archivo, para el equipo o para enseñar en una entrevista.', 'Every recipe sheet in one document, with a cover and contents. For your files, for the team or to show in an interview.')) + '</p>' +
  '<fieldset class="tfield"><legend class="jlegend">' + esc(t('Qué platos entran', 'Which dishes go in')) + '</legend><div class="chips bkst">' + BOOK_STATUS.map(([id, es, eng]) => { const n = liveDishes().filter(d => d.status === id).length, on = ['carta', 'lista'].includes(id); return '<label class="chip' + (on ? ' chip-have' : '') + '"><input type="checkbox" class="sr" value="' + id + '"' + (on ? ' checked' : '') + '>' + esc(en() ? eng : es) + ' <small>' + n + '</small></label>'; }).join('') + '</div></fieldset>' +
  '<div class="tfield"><label for="bkTitle">' + esc(t('Título', 'Title')) + '</label><input id="bkTitle" maxlength="80" value="' + esc(t('Recetario ', 'Recipe book ') + new Date().getFullYear()) + '"></div>' +
  '<div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('down') + esc(t('Preparar e imprimir', 'Prepare and print')) + '</button></div>'});
 s.el.addEventListener('change', e => { const c = e.target.closest('.bkst input'); if (c) c.closest('.chip').classList.toggle('chip-have', c.checked); });
 $('[data-ok]', s.el).onclick = async () => {
  const want = new Set($$('.bkst input:checked', s.el).map(x => x.value)), list = liveDishes().filter(d => want.has(d.status)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!list.length) { toast(t('No hay platos con ese estado.', 'No dishes with that status.'), 'error'); return; }
  const title = $('#bkTitle', s.el).value.trim() || t('Recetario', 'Recipe book');
  s.close();
  const {fichaFor} = await import('./dish.js'), {docById} = await import('../store.js');
  const who = docById('carrera:perfil') || {}, name = who.name || state.settings?.name || '';
  const pages = [];
  for (const d of list) pages.push(await fichaFor(d));
  let host = document.getElementById('printFicha');
  if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
  host.innerHTML = '<section class="book-cover"><p class="ficha-kicker">I+D</p><h1>' + esc(title) + '</h1>' + (name ? '<p class="book-who">' + esc(name) + (who.place ? ', ' + esc(who.place) : '') + '</p>' : '') + '<p class="ficha-meta">' + esc(list.length + (list.length === 1 ? t(' plato', ' dish') : t(' platos', ' dishes'))) + '</p></section>' +
   '<section class="book-index"><h2>' + esc(t('Índice', 'Contents')) + '</h2><ol>' + list.map(d => '<li>' + esc(d.name) + '</li>').join('') + '</ol></section>' +
   pages.map(p => '<div class="book-page">' + p + '</div>').join('');
  const imgs = [...host.querySelectorAll('img')];
  await Promise.all(imgs.map(i => (i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 2000); }))));
  document.documentElement.classList.add('printing');
  const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => print(), 60);
 };
}
