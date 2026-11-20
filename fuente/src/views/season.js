// I+D · Temporada: qué entra, qué está en su mejor momento y qué se va, mes a mes, con lo de Ibiza destacado.
// Sale de los meses que tiene cada producto en el catálogo de sabores.
import {inSeason} from '../flavor-core.js';
import {t, en} from '../i18n.js';
import {esc, icon} from '../ui.js';
import {state} from '../store.js';
import {skeleton} from './shared.js';

const MONTHS = () => (en() ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']);
const LONG = () => (en() ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] : ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']);
const FRESH = ['verdura', 'fruta', 'seta', 'pescado', 'marisco', 'hierba', 'carne', 'ave'];
const FAMILY = {verdura: ['Verdura', 'Vegetables'], fruta: ['Fruta', 'Fruit'], seta: ['Setas', 'Mushrooms'], pescado: ['Pescado', 'Fish'], marisco: ['Marisco', 'Shellfish'], hierba: ['Hierbas', 'Herbs'], carne: ['Carne', 'Meat'], ave: ['Aves', 'Poultry']};
const prev = m => ((m + 10) % 12) + 1, next = m => (m % 12) + 1;
export const title = () => t('Temporada', 'Season');

// Para un mes: lo que entra, lo que está en su punto, lo que se va y lo de aquí.
export function seasonOfMonth(kb, m) {
 const seasonal = kb.list.filter(i => FRESH.includes(i.family) && i.months.size > 0 && i.months.size < 12 && inSeason(i, m));
 return {
  entering: seasonal.filter(i => !i.months.has(prev(m))),
  leaving: seasonal.filter(i => !i.months.has(next(m)) && i.months.has(prev(m))),
  best: seasonal.filter(i => i.months.has(prev(m)) && i.months.has(next(m)) && i.months.size <= 7),
  local: kb.list.filter(i => i.tags.includes('ibiza') && (i.months.size === 0 || i.months.size === 12 ? false : inSeason(i, m))),
  localAll: kb.list.filter(i => i.tags.includes('ibiza') && (i.months.size === 0 || i.months.size === 12) && FRESH.concat(['embutido', 'queso']).includes(i.family))
 };
}
const chips = list => {
 const pantry = state.kitchen?.pantry || new Set();
 return '<div class="chips">' + list.sort((a, b) => (en() ? a.en.localeCompare(b.en) : a.es.localeCompare(b.es, 'es'))).map(i => '<a class="chip' + (pantry.has(i.id) ? ' chip-have' : '') + '" href="#/sabores/' + esc(i.id) + '">' + esc(en() ? i.en : i.es) + '<small>' + esc((FAMILY[i.family] ? (en() ? FAMILY[i.family][1] : FAMILY[i.family][0]) : '').toLowerCase()) + '</small></a>').join('') + '</div>';
};
export function render(params) {
 const kb = state.kb, now = new Date().getMonth() + 1, m = Math.min(12, Math.max(1, Number(params[0]) || now));
 let html = '<header class="page-head"><h1>' + esc(t('Temporada', 'Season')) + '</h1><p>' + esc(t('Qué entra, qué está en su mejor momento y qué se va, mes a mes. Lo de Ibiza, destacado. Toca un producto para ver con qué combina.', 'What comes in, what is at its best and what is leaving, month by month, with Ibiza produce highlighted. Tap a product to see what it pairs with.')) + '</p></header>' +
  '<nav class="months" aria-label="' + esc(t('Mes', 'Month')) + '">' + MONTHS().map((n, k) => '<a class="month' + (k + 1 === m ? ' active' : '') + (k + 1 === now ? ' is-now' : '') + '" href="#/temporada/' + (k + 1) + '"' + (k + 1 === m ? ' aria-current="page"' : '') + '>' + esc(n) + '</a>').join('') + '</nav>';
 if (!kb) return html + skeleton(3);
 const s = seasonOfMonth(kb, m), sec = (ic, title, sub, list) => (list.length ? '<section class="card season-sec"><h2>' + icon(ic) + esc(title) + '<small>' + list.length + '</small></h2>' + (sub ? '<p class="fine">' + esc(sub) + '</p>' : '') + chips(list) + '</section>' : '');
 html += '<h2 class="season-month">' + esc((m === now ? t('Ahora, en ', 'Now, in ') : t('En ', 'In ')) + LONG()[m - 1]) + '</h2><div class="season-grid">' +
  sec('leaf', t('De aquí', 'From Ibiza'), t('Producto de la isla en temporada.', 'Island produce in season.'), s.local) +
  sec('arrow', t('Entra ahora', 'Coming in'), t('Empieza su temporada este mes: es el momento de probarlo.', 'Its season starts this month: time to try it.'), s.entering) +
  sec('star', t('En su mejor momento', 'At its best'), '', s.best) +
  sec('clock', t('Se va pronto', 'Leaving soon'), t('Último mes: aprovéchalo o pásalo a conserva.', 'Last month: use it or preserve it.'), s.leaving) + '</div>' +
  (s.localAll.length ? '<section class="sec"><h2 class="day">' + esc(t('De Ibiza, todo el año', 'From Ibiza, all year')) + '</h2>' + chips(s.localAll) + '</section>' : '');
 return html;
}
export function mount() { return null; }
export function onData(what, el, params) { if (what === 'load') el.innerHTML = render(params); }
