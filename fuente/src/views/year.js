// I+D · Mi año en cocina: el resumen de un año de oficio (platos creados, pruebas, diario, lo leído, chispas, objetivos,
// los productos y técnicas que más has usado y tu plato mejor valorado). Para mirarlo o imprimirlo a final de año.
import {t, en} from '../i18n.js';
import {esc, icon, $, sheet} from '../ui.js';
import {liveDishes, liveDocs, docById} from '../store.js';
import {technique} from '../flavor-core.js';

const inYear = (v, y) => String(v || '').startsWith(String(y));
const top = (list, n) => [...list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es')).slice(0, n);

export function yearStats(y) {
 const dishes = liveDishes(), made = dishes.filter(d => inYear(d.created_at, y));
 const tests = dishes.flatMap(d => (d.tests || []).filter(x => x && inYear(x.at, y)).map(x => ({...x, dish: d})));
 const read = Object.values(docById('lectura:estado')?.read || {}).filter(v => inYear(v, y)).length;
 const sparks = liveDocs('chispa').filter(s => inYear(s.created_at, y));
 const goals = liveDocs('objetivo').filter(g => inYear(g.done_at, y));
 const known = Object.values(docById('repaso:estado')?.cards || {}).filter(c => c.box >= 4).length;
 const journal = liveDocs('diario').filter(e => inYear(e.day, y));
 const comps = made.flatMap(d => d.components || []);
 const products = top(comps.flatMap(c => (c.items || []).map(i => String(i.n || '').trim().toLowerCase()).filter(Boolean)), 8);
 const techs = top(comps.flatMap(c => c.techniques || []), 5).map(([id, n]) => [technique(id) ? (en() ? technique(id).en : technique(id).es) : id, n]);
 const rated = dishes.map(d => { const r = (d.tests || []).filter(x => x && inYear(x.at, y) && x.rating); return {d, n: r.length, avg: r.length ? r.reduce((a, x) => a + Number(x.rating), 0) / r.length : 0}; }).filter(x => x.n).sort((a, b) => b.avg - a.avg || b.n - a.n)[0];
 return {y, made: made.length, carta: made.filter(d => d.status === 'carta').length, tests: tests.length, journal: journal.length, covers: journal.reduce((a, e) => a + (Number(e.covers) || 0), 0), read, sparks: sparks.length, sparkDishes: sparks.filter(s => s.dish_id).length, goals: goals.map(g => g.title), achievements: liveDocs('logro').filter(l => inYear(l.date || l.created_at, y)).map(l => l.title), known, products, techs, best: rated || null};
}

function body(s) {
 const stat = (n, label) => '<div class="stat"><strong>' + esc(String(n)) + '</strong><span>' + esc(label) + '</span></div>';
 return '<div class="stats">' + stat(s.made, t('platos creados', 'dishes created')) + stat(s.tests, t('pruebas de cata', 'tasting tests')) + stat(s.journal, t('días en el diario', 'journal days')) + stat(s.read, t('fichas leídas', 'entries read')) + stat(s.sparks, t('chispas apuntadas', 'sparks noted')) + stat(s.known, t('tarjetas dominadas', 'cards mastered')) + '</div>' +
  '<ul class="yr-list">' +
  (s.carta ? '<li>' + esc(s.carta === 1 ? t('1 plato del año llegó a la carta.', '1 dish from this year reached the menu.') : s.carta + t(' platos del año llegaron a la carta.', ' dishes from this year reached the menu.')) + '</li>' : '') +
  (s.sparkDishes ? '<li>' + esc(s.sparkDishes + t(' chispas se convirtieron en plato.', ' sparks turned into dishes.')) + '</li>' : '') +
  (s.covers ? '<li>' + esc(s.covers.toLocaleString(en() ? 'en' : 'es') + t(' cubiertos apuntados en el diario.', ' covers noted in the journal.')) + '</li>' : '') +
  (s.best ? '<li>' + esc(t('Tu plato mejor valorado: ', 'Your best-rated dish: ') + s.best.d.name + ' (' + s.best.avg.toLocaleString(en() ? 'en' : 'es', {maximumFractionDigits: 1}) + t(' de 5 en ', ' out of 5 in ') + s.best.n + (s.best.n === 1 ? t(' prueba', ' test') : t(' pruebas', ' tests')) + ').') + '</li>' : '') +
  '</ul>' +
  (s.products.length ? '<h3 class="kh3">' + esc(t('Los productos que más has usado', 'The products you used most')) + '</h3><p>' + esc(s.products.map(([p, n]) => p + ' (' + n + ')').join(', ')) + '.</p>' : '') +
  (s.techs.length ? '<h3 class="kh3">' + esc(t('Tus técnicas del año', 'Your techniques of the year')) + '</h3><p>' + esc(s.techs.map(([p, n]) => p + ' (' + n + ')').join(', ')) + '.</p>' : '') +
  (s.goals.length || s.achievements.length ? '<h3 class="kh3">' + esc(t('Objetivos y logros', 'Goals and achievements')) + '</h3><ul class="yr-list">' + [...s.goals, ...s.achievements].map(g => '<li>' + esc(g) + '</li>').join('') + '</ul>' : '') +
  (!s.made && !s.tests && !s.journal && !s.read && !s.sparks ? '<p class="hint">' + esc(t('Este año todavía no hay nada apuntado. Crea platos, escribe el diario y lee la Biblioteca: aquí saldrá tu año.', 'Nothing noted for this year yet. Create dishes, write the journal and read the library: your year will show here.')) + '</p>' : '');
}

export function yearSheet() {
 const now = new Date().getFullYear(), years = [now, now - 1, now - 2];
 const s = sheet({title: t('Mi año en cocina', 'My year in the kitchen'), wide: true, body: '<div class="tfield"><label for="yrY">' + esc(t('Año', 'Year')) + '</label><select id="yrY">' + years.map(y => '<option value="' + y + '">' + y + '</option>').join('') + '</select></div><div id="yrBody"></div>' +
  '<div class="row-actions"><button type="button" class="btn ghost" data-yr-print>' + icon('down') + esc(t('Imprimir', 'Print')) + '</button></div>'});
 const paint = () => { $('#yrBody', s.el).innerHTML = body(yearStats(Number($('#yrY', s.el).value))); };
 $('#yrY', s.el).addEventListener('change', paint);
 $('[data-yr-print]', s.el).onclick = () => {
  let host = document.getElementById('printFicha');
  if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
  host.innerHTML = '<article class="kbook-entry"><p class="ficha-kicker">I+D</p><h2>' + esc(t('Mi año en cocina, ', 'My year in the kitchen, ') + $('#yrY', s.el).value) + '</h2>' + $('#yrBody', s.el).innerHTML + '</article>';
  document.documentElement.classList.add('printing');
  const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done); setTimeout(() => print(), 60);
 };
 paint();
 return s;
}
