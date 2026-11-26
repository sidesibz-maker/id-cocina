// I+D · Tu estilo: un retrato de tu cocina hecho con tus propios platos. La huella de sabor media de tu repertorio,
// los productos, familias y técnicas que más repites, cómo reparte tu libreta por tipos de plato y, sobre todo,
// lo que nunca has tocado: familias, técnicas y productos de temporada que no aparecen en ningún plato tuyo.
import {AXIS_IDS, FAMILIES, TECHNIQUES, COURSES, inSeason} from '../flavor-core.js';
import {t, en, monthName} from '../i18n.js';
import {esc, icon, flavorPrint, flavorMeters} from '../ui.js';
import {state, liveDishes, withFlavor} from '../store.js';

export const title = () => t('Tu estilo', 'Your style');
const pick = pair => (en() ? pair[1] : pair[0]);
const bars = (rows, max) => '<ul class="stbars">' + rows.map(([label, n, href]) => '<li><span class="stb-l">' + (href ? '<a href="' + esc(href) + '">' + esc(label) + '</a>' : esc(label)) + '</span><span class="stb-t" aria-hidden="true"><i style="width:' + (n / max * 100).toFixed(0) + '%"></i></span><span class="stb-n">' + n + '</span></li>').join('') + '</ul>';

export function render() {
 const dishes = liveDishes(), kb = state.kb;
 const head = '<a class="back" href="#/trayectoria">' + icon('left') + esc(t('Mi trayectoria', 'My career')) + '</a><header class="page-head"><h1>' + esc(t('Tu estilo', 'Your style')) + '</h1><p>' + esc(t('Un retrato de tu cocina hecho con tus platos: lo que repites y lo que nunca has probado. Lo segundo es donde está tu próximo plato.', 'A portrait of your cooking made from your dishes: what you repeat and what you have never tried. The second is where your next dish is.')) + '</p></header>';
 if (dishes.length < 3 || !kb) return head + '<div class="empty">' + icon('wheel') + '<h2>' + esc(t('Hacen falta unos cuantos platos', 'A few dishes are needed')) + '</h2><p>' + esc(t('Con tres platos o más en la libreta, aquí verás cómo es tu cocina.', 'With three or more dishes in your notebook, you will see what your cooking looks like here.')) + '</p><a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a></div>';
 // Huella media
 const withF = dishes.map(d => d.flavor?.axes || withFlavor(d)?.axes).filter(Boolean), avg = Object.fromEntries(AXIS_IDS.map(id => [id, withF.length ? withF.reduce((s, a) => s + (Number(a[id]) || 0), 0) / withF.length : 0]));
 const sorted = Object.entries(avg).sort((a, b) => b[1] - a[1]), dominant = sorted.filter(([, v]) => v >= 4).slice(0, 3).map(([id]) => id), low = sorted.slice(-2).map(([id]) => id);
 // Productos, familias y técnicas
 const prod = new Map(), fam = new Map(), tech = new Map(), course = new Map();
 for (const d of dishes) {
  const seen = new Set();
  for (const c of d.components) { for (const i of c.items) { const k = i.k && kb.byId[i.k] ? i.k : null; if (!k || seen.has(k)) continue; seen.add(k); prod.set(k, (prod.get(k) || 0) + 1); const f = kb.byId[k].family; fam.set(f, (fam.get(f) || 0) + 1); } for (const x of c.techniques || []) tech.set(x, (tech.get(x) || 0) + 1); }
  course.set(d.course || 'otro', (course.get(d.course || 'otro') || 0) + 1);
 }
 const name = id => (en() ? kb.byId[id].en : kb.byId[id].es);
 const topProd = [...prod].sort((a, b) => b[1] - a[1]).slice(0, 10), topTech = [...tech].sort((a, b) => b[1] - a[1]).slice(0, 8);
 const neverFam = Object.keys(FAMILIES).filter(f => !fam.has(f) && !['bebida', 'grasa', 'condimento'].includes(f));
 const neverTech = TECHNIQUES.filter(([id]) => !tech.has(id));
 const m = new Date().getMonth() + 1, seasonal = kb.list.filter(i => i.months.size > 0 && i.months.size <= 7 && inSeason(i, m) && !prod.has(i.id) && ['verdura', 'fruta', 'seta', 'pescado', 'marisco', 'hierba'].includes(i.family)).slice(0, 14);
 return head +
  '<div class="stgrid"><section class="card"><h2>' + esc(t('Tu huella media', 'Your average print')) + '</h2><div class="analysis-chart">' + flavorPrint(avg, {size: 150, labels: true, title: t('Huella de sabor media de tus platos', 'Average flavour print of your dishes')}) + flavorMeters({axes: avg, dominant}) + '</div>' +
  '<p class="lead">' + esc((dominant.length ? t('Tu cocina tira a ', 'Your cooking leans towards ') + dominant.map(axisLabel).join(', ') + '. ' : '') + t('Lo que menos usas: ', 'What you use least: ') + low.map(axisLabel).join(t(' y ', ' and ')) + '.') + '</p>' +
  '<p class="fine">' + esc(withF.length + t(' platos con perfil de sabor.', ' dishes with a flavour profile.')) + '</p></section>' +
  '<section class="card"><h2>' + esc(t('Lo que más repites', 'What you repeat most')) + '</h2>' + (topProd.length ? bars(topProd.map(([k, n]) => [name(k), n, '#/sabores/' + k]), topProd[0][1]) : '<p class="hint">' + esc(t('Aún no hay productos del catálogo en tus platos.', 'No catalogue products in your dishes yet.')) + '</p>') +
  (topTech.length ? '<h3>' + esc(t('Técnicas', 'Techniques')) + '</h3>' + bars(topTech.map(([id, n]) => [pick((TECHNIQUES.find(x => x[0] === id) || [id, id, id]).slice(1, 3)), n]), topTech[0][1]) : '') +
  '<h3>' + esc(t('Tipos de plato', 'Dish types')) + '</h3>' + bars([...course].sort((a, b) => b[1] - a[1]).map(([id, n]) => [pick((COURSES.find(x => x[0] === id) || [id, id, id]).slice(1, 3)), n]), Math.max(...course.values())) + '</section></div>' +
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Lo que nunca has tocado', 'What you have never touched')) + '</h2><p>' + esc(t('Aquí está tu próximo plato. Toca uno y llévalo al Laboratorio.', 'Your next dish is here. Tap one and take it to the Lab.')) + '</p></div></header>' +
  '<div class="stnever">' +
  (seasonal.length ? '<div><h3>' + esc(t('De temporada en ', 'In season in ') + monthName(m)) + '</h3><div class="chips">' + seasonal.map(i => '<a class="chip" href="#/sabores/' + esc(i.id) + '">' + esc(en() ? i.en : i.es) + '</a>').join('') + '</div></div>' : '') +
  (neverFam.length ? '<div><h3>' + esc(t('Familias', 'Families')) + '</h3><div class="chips">' + neverFam.map(f => '<span class="chip chip-static">' + esc(pick(FAMILIES[f])) + '</span>').join('') + '</div></div>' : '') +
  (neverTech.length ? '<div><h3>' + esc(t('Técnicas', 'Techniques')) + '</h3><div class="chips">' + neverTech.map(x => '<span class="chip chip-static">' + esc(pick(x.slice(1, 3))) + '</span>').join('') + '</div></div>' : '') +
  '</div><div class="row-actions row-left"><a class="btn primary" href="#/laboratorio">' + icon('spark') + esc(t('Ir al Laboratorio', 'Go to the Lab')) + '</a></div></section>';
}
const AXL = {dulce: ['lo dulce', 'sweet'], salado: ['lo salado', 'salty'], acido: ['lo ácido', 'sour'], amargo: ['lo amargo', 'bitter'], umami: ['el umami', 'umami'], graso: ['lo graso', 'rich'], picante: ['lo picante', 'heat'], ahumado: ['lo ahumado', 'smoky'], fresco: ['lo fresco', 'fresh']};
const axisLabel = id => pick(AXL[id] || [id, id]);
export function mount() { return null; }
