// I+D · Catálogo general: toda tu obra numerada y ordenada por temporadas, del primer plato al último. Cada plato
// conserva su número para siempre (por orden de creación), con su foto o su huella de sabor y su estado.
// Se puede ver por temporadas o como una sola lista, filtrar por estado e imprimir el catálogo.
import {t, en, seasonOf, seasonLabel} from '../i18n.js';
import {esc, icon, $, $$, flavorPrint, short} from '../ui.js';
import {state, imageUrl} from '../store.js';
import {statusLabel, courseLabel, STATUSES, dishThumb} from './shared.js';

export const title = () => t('Catálogo general', 'General catalogue');
// Número de cada plato por orden de creación (los de la papelera también cuentan, para que nadie cambie de número).
export function numbers() {
 const all = [...state.dishes].sort((a, b) => String(a.created_at || a.updated_at || '').localeCompare(String(b.created_at || b.updated_at || '')) || String(a.id).localeCompare(String(b.id)));
 return new Map(all.map((d, i) => [d.id, i + 1]));
}
const pad = n => String(n).padStart(3, '0');
const seasonKey = d => d.season || seasonOf(new Date(d.created_at || d.updated_at || Date.now())).key;
// Orden de temporadas: año descendente y, dentro del año, verano antes que invierno solo si el invierno es el del principio.
const seasonSort = k => { const m = String(k).match(/(\d{4})/), y = m ? Number(m[1]) : 0, w = /^Invierno/.test(k) ? 0 : /^Verano/.test(k) ? 1 : 2; return y * 10 + w; };
let filter = 'todos', mode = 'temporadas';

export function render() {
 const nums = numbers(), list = state.dishes.filter(d => !d.deleted_at && (filter === 'todos' || d.status === filter));
 const groups = new Map();
 for (const d of list) { const k = mode === 'temporadas' ? seasonKey(d) : 'all'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
 const keys = [...groups.keys()].sort((a, b) => seasonSort(b) - seasonSort(a));
 const years = new Set(state.dishes.filter(d => !d.deleted_at).map(d => (String(seasonKey(d)).match(/\d{4}/) || [''])[0]).filter(Boolean));
 return '<a class="back" href="#/libreta">' + icon('left') + esc(t('Platos', 'Dishes')) + '</a><header class="page-head page-head-row"><div><h1>' + esc(t('Catálogo general', 'General catalogue')) + '</h1><p>' + esc(t('Toda tu obra, numerada y por temporadas. Cada plato guarda su número para siempre.', 'All your work, numbered and by season. Each dish keeps its number forever.')) + '</p></div>' +
  (list.length ? '<button type="button" class="btn ghost" data-act="cat-print">' + icon('down') + esc(t('Imprimir el catálogo', 'Print the catalogue')) + '</button>' : '') + '</header>' +
  '<div class="stats catstats"><div class="stat"><strong>' + state.dishes.filter(d => !d.deleted_at).length + '</strong><span>' + esc(t('platos en total', 'dishes in total')) + '</span></div><div class="stat"><strong>' + state.dishes.filter(d => !d.deleted_at && d.status === 'carta').length + '</strong><span>' + esc(t('en carta', 'on the menu')) + '</span></div><div class="stat"><strong>' + years.size + '</strong><span>' + esc(years.size === 1 ? t('año de trabajo', 'year of work') : t('años de trabajo', 'years of work')) + '</span></div></div>' +
  '<div class="catbar"><div class="seg" role="group" aria-label="' + esc(t('Vista', 'View')) + '">' + [['temporadas', t('Por temporadas', 'By season')], ['lista', t('Lista completa', 'Full list')]].map(([id, l]) => '<button type="button" class="seg-btn' + (mode === id ? ' active' : '') + '" data-mode="' + id + '" aria-pressed="' + (mode === id) + '">' + esc(l) + '</button>').join('') + '</div>' +
  '<label class="sr" for="catFilter">' + esc(t('Estado', 'Status')) + '</label><select id="catFilter" class="catfilter"><option value="todos">' + esc(t('Todos los estados', 'All statuses')) + '</option>' + STATUSES.map(s => '<option value="' + s[0] + '"' + (filter === s[0] ? ' selected' : '') + '>' + esc(en() ? s[2] : s[1]) + '</option>').join('') + '</select></div>' +
  (list.length ? keys.map(k => '<section class="sec catsec">' + (mode === 'temporadas' ? '<h2 class="catseason">' + esc(seasonLabel(k).replace(/^(\d{4})$/, t('Todo el año ', 'All year ') + '$1')) + '<span class="count">' + groups.get(k).length + '</span></h2>' : '') +
   '<div class="catgrid">' + groups.get(k).sort((a, b) => nums.get(a.id) - nums.get(b.id)).map(d => '<a class="catcard" href="#/plato/' + esc(d.id) + '"><span class="catnum">' + pad(nums.get(d.id)) + '</span><span class="catmedia">' + (d.cover_path ? '<img data-img="' + esc(d.cover_path) + '" alt="">' : dishThumb(d)) + '</span><strong>' + esc(d.name) + '</strong><small>' + esc(courseLabel(d.course) + ', ' + statusLabel(d.status).toLowerCase()) + '</small>' + (d.concept ? '<span class="catconcept">' + esc(short(d.concept, 110)) + '</span>' : '') + '</a>').join('') + '</div></section>').join('')
   : '<div class="empty">' + icon('book') + '<h2>' + esc(t('Aún no hay platos aquí', 'No dishes here yet')) + '</h2><p>' + esc(t('Cada plato que crees tendrá su número en tu catálogo.', 'Every dish you create will get its number in your catalogue.')) + '</p><a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a></div>');
}
export function mount(root) {
 const hydrate = () => $$('img[data-img]', root).forEach(async img => { const u = await imageUrl(img.dataset.img); if (u && img.isConnected) { img.src = u; img.removeAttribute('data-img'); } });
 hydrate();
 const repaint = () => { root.innerHTML = render(); hydrate(); };
 root.addEventListener('click', async e => {
  const m = e.target.closest('[data-mode]');
  if (m) { mode = m.dataset.mode; repaint(); return; }
  if (!e.target.closest('[data-act=cat-print]')) return;
  let host = document.getElementById('printFicha');
  if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
  const nums = numbers(), list = state.dishes.filter(d => !d.deleted_at && (filter === 'todos' || d.status === filter));
  const groups = new Map(); for (const d of list) { const k = seasonKey(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  host.innerHTML = '<article class="ficha catprint"><header class="ficha-head"><div><h1>' + esc(t('Catálogo general', 'General catalogue')) + '</h1><p class="ficha-kicker is-after">I+D</p><p class="ficha-meta">' + esc(list.length + t(' platos', ' dishes')) + '</p></div></header>' +
   [...groups.keys()].sort((a, b) => seasonSort(a) - seasonSort(b)).map(k => '<section class="ficha-comp"><h2>' + esc(seasonLabel(k)) + '</h2><table><tbody>' + groups.get(k).sort((a, b) => nums.get(a.id) - nums.get(b.id)).map(d => '<tr><td class="ficha-q">' + pad(nums.get(d.id)) + '</td><td><strong>' + esc(d.name) + '</strong>' + (d.concept ? '<br><small>' + esc(d.concept) + '</small>' : '') + '</td><td>' + esc(statusLabel(d.status)) + '</td></tr>').join('') + '</tbody></table></section>').join('') + '</article>';
  document.documentElement.classList.add('printing');
  const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => print(), 50);
 });
 root.addEventListener('change', e => { if (e.target.id === 'catFilter') { filter = e.target.value; repaint(); } });
 return null;
}
