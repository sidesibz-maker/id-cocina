// I+D · piezas que comparten las pantallas: etiquetas, tarjetas de aviso y de plato, imágenes y «llevar a la libreta».
import {COURSES} from '../flavor-core.js';
import {ideaToDish} from '../ai-core.js';
import {t, en, pick, relDay, seasonOf} from '../i18n.js';
import {metaRow, short, esc, icon, flavorPrint, toast, friendly, safeUrl, hostOf, uid} from '../ui.js';
import {state, imageUrl, createDish} from '../store.js';
import {go} from '../nav.js';

export const KINDS = {tecnica: ['Técnica', 'Technique'], producto: ['Producto', 'Ingredient'], plato: ['Plato', 'Dish'], escena: ['Escena', 'Scene'], dulce: ['Dulce', 'Sweet'], bebida: ['Bebida', 'Drinks'], idea: ['Idea del día', 'Idea of the day']};
export const HEAT = {emergente: ['Emergente', 'Emerging', 1], alza: ['En alza', 'Rising', 2], consolidada: ['En todas partes', 'Everywhere', 3]};
export const STATUSES = [
 ['idea', 'Idea', 'Idea'], ['pruebas', 'En pruebas', 'Testing'], ['afinando', 'Afinando', 'Refining'],
 ['lista', 'Lista', 'Ready'], ['carta', 'En carta', 'On the menu'], ['descartada', 'Descartada', 'Dropped']
];
export const kindLabel = k => pick(KINDS[k] || KINDS.plato);
export const heatLabel = h => pick(HEAT[h] || HEAT.alza);
export const statusLabel = s => { const row = STATUSES.find(x => x[0] === s) || STATUSES[0]; return en() ? row[2] : row[1]; };
export const courseLabel = c => { const row = COURSES.find(x => x[0] === c) || COURSES[COURSES.length - 1]; return en() ? row[2] : row[1]; };

// Texto de un aviso en el idioma de la app (si la tarea diaria lo dejó también en inglés).
export const trText = (tr, key) => { const english = en() && tr?.en && typeof tr.en[key] === 'string' && tr.en[key].trim(); return english || (typeof tr?.[key] === 'string' ? tr[key] : ''); };
export const trIdeas = tr => { const english = en() && Array.isArray(tr?.en?.ideas) && tr.en.ideas.length ? tr.en.ideas : null; return (english || (Array.isArray(tr?.ideas) ? tr.ideas : [])).filter(i => i && typeof i === 'object' && typeof i.name === 'string' && i.name.trim()); };
export const trSources = tr => (Array.isArray(tr?.sources) ? tr.sources : []).map(s => ({name: String(s?.name || '').trim(), url: safeUrl(s?.url), date: String(s?.date || '')})).filter(s => s.name && s.url);
export const trPlaces = tr => (Array.isArray(tr?.places) ? tr.places : []).map(p => String(p || '').trim()).filter(Boolean);

// Tres puntos: cuánto de extendida está la tendencia. Siempre con su nombre al lado (no solo el dibujo).
export function heatMark(heat) {
 const level = (HEAT[heat] || HEAT.alza)[2];
 return '<span class="heat" data-level="' + level + '"><span class="heat-pips" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(heatLabel(heat)) + '</span>';
}
export const sourceLine = tr => { const s = trSources(tr); return s.length ? s.slice(0, 3).map(x => esc(x.name)).join(', ') : ''; };

export function trendCard(tr, {lead = false} = {}) {
 const kind = tr.kind in KINDS ? tr.kind : 'plato';
 return '<a class="trend' + (lead ? ' trend-lead' : '') + (tr.saved_at ? ' is-saved' : '') + '" href="#/radar/' + esc(tr.id) + '" data-kind="' + kind + '">' +
  '<span class="trend-title">' + esc(trText(tr, 'title')) + '</span>' +
  '<span class="trend-sum">' + esc(short(trText(tr, 'summary'), 150)) + '</span>' +
  metaRow([esc(kindLabel(kind)), kind === 'idea' ? '' : heatMark(tr.heat)], 'kicker') +
  '<span class="trend-foot">' + (sourceLine(tr) ? '<span class="trend-src">' + sourceLine(tr) + '</span>' : '<span class="trend-src">' + esc(t('Idea propia para tu cocina', 'An idea for your kitchen')) + '</span>') +
  (tr.saved_at ? '<span class="saved-mark">' + icon('star') + esc(t('Guardado', 'Saved')) + '</span>' : '') + '</span></a>';
}

export function dishCard(d) {
 const tests = Array.isArray(d.tests) ? d.tests.length : Number(d.tests) || 0;
 const media = d.cover_path ? '<img class="dish-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" width="1" height="1" data-img="' + esc(d.cover_path) + '" alt="" loading="lazy">' : flavorPrint(d.flavor?.axes, {size: 64, title: t('Huella de sabor de ', 'Flavour print of ') + d.name});
 return '<a class="dish" href="#/plato/' + esc(d.id) + '"><span class="dish-media' + (d.cover_path ? '' : ' dish-print') + '">' + media + '</span>' +
  '<span class="dish-main"><span class="dish-name">' + esc(d.name) + '</span>' +
  '<span class="dish-meta"><span class="status status-' + esc(d.status) + '">' + esc(statusLabel(d.status)) + '</span><span>' + esc(courseLabel(d.course)) + '</span></span>' +
  ((d.tags || []).length ? '<span class="dish-tags">' + d.tags.slice(0, 4).map(x => '#' + esc(x)).join(' ') + '</span>' : '') +
  '<span class="dish-foot">' + metaRow([esc(relDay(d.updated_at || d.created_at || new Date())), tests ? tests + ' ' + esc(tests === 1 ? t('prueba', 'test') : t('pruebas', 'tests')) : '']) + '</span></span></a>';
}

// Pone en cada <img data-img> el enlace temporal de su imagen (la carpeta es privada).
export function hydrateImages(root) {
 root.querySelectorAll('img[data-img]').forEach(async img => {
  const url = await imageUrl(img.dataset.img);
  if (!img.isConnected) return;
  if (url) { img.src = url; img.removeAttribute('data-img'); } else img.closest('.dish-media')?.classList.add('no-img');
 });
}

// Crea un plato en la libreta a partir de una idea (del radar o de la IA) y lo abre en la mesa de trabajo.
export async function adoptIdea(idea, source) {
 if (!state.canEdit || state.setupPending) { toast(state.setupPending ? t('La libreta aún no está lista para guardar.', 'The notebook is not ready to save yet.') : t('Tu cuenta no puede crear platos.', 'Your account cannot create dishes.'), 'error'); return null; }
 if (!state.kb) { toast(t('Un momento: se está cargando la tabla de sabores.', 'One moment: the flavour table is loading.')); return null; }
 try {
  const fields = ideaToDish(state.kb, state.kitchen, idea, () => uid().slice(0, 8));
  const dish = await createDish({...fields, season: seasonOf().key, source});
  toast(t('En tu libreta: ', 'In your notebook: ') + dish.name);
  go('plato/' + dish.id);
  return dish;
 } catch (e) { toast(friendly(e, t('No se pudo crear el plato. Inténtalo de nuevo.', 'The dish could not be created. Please try again.')), 'error'); return null; }
}

export const emptyState = (ic, title, text, action = '') => '<div class="empty">' + icon(ic) + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + action + '</div>';
export const sectionHead = (title, link = '', sub = '') => '<header class="sec-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + link + '</header>';
export const moreLink = (href, label) => '<a class="more" href="' + href + '">' + esc(label) + icon('right') + '</a>';
export const skeleton = (n = 3) => '<div class="sk-list" aria-hidden="true">' + '<div class="sk"></div>'.repeat(n) + '</div>';
export {hostOf};

// Alérgenos de un plato: los que ha confirmado el cocinero (d.allergens) o, si aún no, la pista de la IA (probables).
import {ALLERGENS as ALG} from '../ai-core.js';
export function dishAllergens(d) {
 const confirmed = Array.isArray(d?.allergens), ids = confirmed ? d.allergens : (d?.advice?.allergens || []);
 const list = ids.map(id => ALG.find(a => a[0] === id)).filter(Boolean);
 return {confirmed, ids: list.map(a => a[0]), names: list.map(a => (en() ? a[2] : a[1]))};
}
