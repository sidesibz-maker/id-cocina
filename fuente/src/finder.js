// I+D · Buscador general: Ctrl+K (o «/») desde cualquier pantalla. Busca a la vez en platos, subrecetas, la Biblioteca,
// el diario, productos del catálogo de sabores, herramientas y secciones. Flechas para moverse, Intro para abrir.
import {t, en} from './i18n.js';
import {esc, icon, $, $$, sheet} from './ui.js';
import {state, liveDishes, liveSubs, liveDocs} from './store.js';
import {search as saberSearch} from './saber/index.js';
import {toolList} from './views/tools.js';

const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const SECTIONS = () => [
 ['#/hoy', 'flame', t('Hoy', 'Today')], ['#/radar', 'radar', t('Radar', 'Radar')], ['#/crear', 'plus', t('Crear un plato', 'Create a dish')], ['#/crear/ideas', 'spark', t('Dame ideas', 'Give me ideas')],
 ['#/crear/importar', 'down', t('Importar receta', 'Import recipe')], ['#/libreta', 'book', t('Libreta', 'Notebook')], ['#/menus', 'book', t('Cartas y menús', 'Menus')], ['#/biblioteca', 'library', t('Biblioteca', 'Library')],
 ['#/laboratorio', 'spark', t('Laboratorio creativo', 'Creative lab')], ['#/diario', 'edit', t('Diario de cocina', 'Kitchen journal')], ['#/diario/nuevo', 'edit', t('Escribir el diario de hoy', 'Write today\'s journal')], ['#/trayectoria', 'star', t('Mi trayectoria', 'My career')], ['#/hoy', 'flame', t('Reto de la semana', 'Challenge of the week')], ['#/entrenar', 'brain', t('Entrenar: tarjetas de repaso', 'Train: review cards')],
 ['#/herramientas', 'bolt', t('Herramientas', 'Tools')], ['#/sabores', 'wheel', t('Sabores', 'Flavours')], ['#/temporada', 'leaf', t('Temporada', 'Season')], ['#/preguntar', 'chat', t('Preguntar', 'Ask')], ['#/cocina', 'pan', t('Mi cocina', 'My kitchen')]
];
// Puntuación sencilla: todas las palabras tienen que estar; vale más si están en el nombre y al principio.
function score(q, name, extra = '') {
 const words = norm(q).split(' ').filter(Boolean), n = norm(name), x = norm(extra);
 if (!words.length) return 0;
 let s = 0;
 for (const w of words) { if (n.startsWith(w)) s += 30; else if ((' ' + n).includes(' ' + w)) s += 20; else if (n.includes(w)) s += 10; else if (x.includes(w)) s += 3; else return 0; }
 return s - n.length / 100;
}
export function find(q) {
 const groups = [];
 const add = (label, rows) => { const r = rows.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6); if (r.length) groups.push({label, rows: r}); };
 add(t('Platos', 'Dishes'), liveDishes().map(d => ({href: '#/plato/' + d.id, ic: 'book', title: d.name, sub: d.concept || (d.tags || []).map(x => '#' + x).join(' '), s: score(q, d.name, [d.concept, d.notes, (d.tags || []).join(' '), d.components.flatMap(c => c.items.map(i => i.n)).join(' ')].join(' '))})));
 add(t('Subrecetas', 'Sub-recipes'), liveSubs().map(x => ({href: '#/subreceta/' + x.id, ic: 'pan', title: x.name, sub: x.yield ? t('Rinde ', 'Yields ') + x.yield : '', s: score(q, x.name, x.items.map(i => i.n).join(' ') + ' ' + x.method)})));
 const lib = q.trim().length >= 2 ? saberSearch(q, 6) : [];
 if (lib.length) groups.push({label: t('Biblioteca', 'Library'), rows: lib.map((e, k) => ({href: '#/biblioteca/' + e.id, ic: 'library', title: e.name, sub: e.summary || '', s: 100 - k}))});
 add(t('Diario', 'Journal'), liveDocs('diario').map(e => ({href: '#/diario/' + encodeURIComponent(e.id), ic: 'edit', title: new Date(e.day + 'T12:00:00').toLocaleDateString(en() ? 'en-GB' : 'es-ES', {weekday: 'long', day: 'numeric', month: 'long'}), sub: [e.learned, e.good, e.bad].filter(Boolean)[0] || '', s: score(q, '', [e.good, e.bad, e.learned, e.ideas, (e.dishNames || []).join(' ')].join(' '))})));
 if (state.kb) add(t('Productos', 'Products'), state.kb.list.map(i => ({href: '#/sabores/' + i.id, ic: 'wheel', title: en() ? i.en : i.es, sub: t('Con qué combina', 'What it pairs with'), s: score(q, en() ? i.en : i.es, (i.aka || []).join(' '))})));
 add(t('Chispas', 'Sparks'), liveDocs('chispa').map(s => ({href: '#/laboratorio', ic: 'spark', title: s.text.slice(0, 70), sub: '', s: score(q, s.text)})));
 add(t('Herramientas', 'Tools'), toolList().map(x => ({href: '#/herramientas/' + x.id, ic: x.ic, title: x.name, sub: x.sub, s: score(q, x.name, x.sub)})));
 add(t('Ir a', 'Go to'), SECTIONS().map(([href, ic, title]) => ({href, ic, title, sub: '', s: score(q, title)})));
 return groups;
}

let open = null;
export function openFinder(initial = '') {
 if (open) { $('#finderQ', open.el)?.focus(); return; }
 const s = sheet({title: t('Buscar en todo', 'Search everything'), wide: true, onClose: () => { open = null; }, body:
  '<div class="searchbox searchbox-big"><label class="sr" for="finderQ">' + esc(t('Buscar', 'Search')) + '</label>' + icon('search') + '<input id="finderQ" type="search" autocomplete="off" enterkeyhint="go" placeholder="' + esc(t('Platos, subrecetas, bechamel, diario, herramientas…', 'Dishes, sub-recipes, béchamel, journal, tools…')) + '" value="' + esc(initial) + '" role="combobox" aria-expanded="true" aria-controls="finderRes" aria-autocomplete="list"></div>' +
  '<div id="finderRes" class="finder" role="listbox" aria-label="' + esc(t('Resultados', 'Results')) + '"></div><p class="fine finder-keys">' + esc(t('Flechas para moverte, Intro para abrir, Esc para cerrar. Ctrl+K desde cualquier sitio.', 'Arrows to move, Enter to open, Esc to close. Ctrl+K from anywhere.')) + '</p>'});
 open = s;
 const input = $('#finderQ', s.el), res = $('#finderRes', s.el);
 let at = 0;
 const mark = () => { const items = $$('.finder-row', res); items.forEach((el, k) => { const on = k === at; el.classList.toggle('is-on', on); el.setAttribute('aria-selected', on); if (on) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({block: 'nearest'}); } }); };
 const paint = () => {
  const q = input.value.trim();
  if (!q) { res.innerHTML = '<p class="hint">' + esc(t('Escribe lo que buscas.', 'Type what you are looking for.')) + '</p>'; return; }
  const groups = find(q);
  let k = 0;
  res.innerHTML = groups.length ? groups.map(g => '<div class="finder-group"><p class="finder-label">' + esc(g.label) + '</p>' + g.rows.map(r => '<a class="finder-row" role="option" id="fr' + (k++) + '" href="' + esc(r.href) + '">' + icon(r.ic) + '<span><strong>' + esc(r.title) + '</strong>' + (r.sub ? '<small>' + esc(r.sub.slice(0, 110)) + '</small>' : '') + '</span></a>').join('') + '</div>').join('')
   : '<p class="hint">' + esc(t('No encuentro nada con eso. Prueba con otra palabra o pregunta en «Preguntar».', 'Nothing found. Try another word or use “Ask”.')) + '</p>';
  at = 0; mark();
 };
 input.addEventListener('input', paint);
 input.addEventListener('keydown', e => {
  const n = $$('.finder-row', res).length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); at = (at + 1) % n; mark(); }
  if (e.key === 'ArrowUp' && n) { e.preventDefault(); at = (at - 1 + n) % n; mark(); }
  if (e.key === 'Enter') { e.preventDefault(); const el = $$('.finder-row', res)[at]; if (el) { s.close({restoreFocus: false}); location.hash = el.getAttribute('href'); } }
 });
 res.addEventListener('click', e => { if (e.target.closest('.finder-row')) s.close({restoreFocus: false}); });
 paint();
 setTimeout(() => { input.focus(); input.select(); }, 30);
}
export function startFinder() {
 document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openFinder(); }
  else if (e.key === '/' && !typing && !document.documentElement.classList.contains('has-sheet')) { e.preventDefault(); openFinder(); }
 });
 document.addEventListener('click', e => { if (e.target.closest('[data-act=finder]')) { e.preventDefault(); openFinder(); } });
}
