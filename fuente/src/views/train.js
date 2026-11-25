// I+D · Entrenar: tarjetas de repaso sacadas de la Biblioteca (proporciones según el uso, fallos y cómo se arreglan,
// recetas base) y de las temperaturas de oficio. Repetición espaciada: lo que sabes vuelve cada vez más tarde, lo que
// fallas vuelve mañana. Cinco minutos al día y en unos meses lo tienes en la cabeza, no en el móvil.
// El estado va en un documento «repaso:estado» (copia y sincronización).
import {t, en, dayKey} from '../i18n.js';
import {esc, icon, $, toast} from '../ui.js';
import {docById, saveDoc} from '../store.js';
import {entries} from '../saber/index.js';

export const title = () => t('Entrenar', 'Train');
const ID = 'repaso:estado', GAP = [0, 1, 3, 7, 16, 35, 80]; // días hasta volver a verla, según la caja
const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
const CATS = [['todo', 'Todo', 'Everything'], ['proporciones', 'Proporciones', 'Ratios'], ['fallos', 'Fallos y arreglos', 'Faults and fixes'], ['recetas', 'Recetas base', 'Base recipes'], ['temperaturas', 'Temperaturas', 'Temperatures']];
const TEMPS = [['Vacuno y cordero, poco hecho', '50–52 °C'], ['Vacuno y cordero, al punto', '54–57 °C'], ['Cerdo jugoso', '62–65 °C'], ['Aves, a corazón', '72–74 °C'], ['Pescado jugoso, nacarado', '45–50 °C'], ['Crema inglesa', '82–84 °C'], ['Fritura', '170–180 °C'], ['Mantener en caliente', '65 °C o más'], ['Mantener en frío', '4 °C o menos'], ['Abatir', 'De 60 a 10 °C en menos de 2 horas'], ['Regenerar, a corazón', '70–75 °C'], ['Agar: cuaja al bajar de', 'unos 40 °C (aguanta hasta unos 80 °C)'], ['Gelatina: fundir sin hervir, a', '60–70 °C']];

// Todas las tarjetas posibles. El id es estable para guardar cómo vas con cada una.
export function cards() {
 const out = [];
 for (const e of entries()) {
  if (e.mine) continue;
  for (const r of e.ratios || []) if (r.use && r.ratio) out.push({id: 'r|' + e.id + '|' + r.use, cat: 'proporciones', from: e.id, q: e.name + ': ' + t('¿qué proporción para «', 'what ratio for “') + r.use + t('»?', '”?'), a: plain(r.ratio) + (r.note ? '. ' + plain(r.note) : '')});
  for (const x of e.errors || []) if (x.p && x.fix) out.push({id: 'e|' + e.id + '|' + x.p, cat: 'fallos', from: e.id, q: e.name + ': ' + x.p.charAt(0).toLowerCase() + x.p.slice(1) + t('. ¿Por qué pasa y qué haces?', '. Why does it happen and what do you do?'), a: plain(x.fix)});
  if (e.base?.items?.length >= 2 && e.base.for) out.push({id: 'b|' + e.id, cat: 'recetas', from: e.id, q: e.name + t(' para ', ' for ') + e.base.for + t(': ¿qué lleva y cuánto?', ': what goes in and how much?'), a: e.base.items.map(([n, q]) => n + (q ? ': ' + q : '')).join('\n')});
 }
 for (const [k, v] of TEMPS) out.push({id: 't|' + k, cat: 'temperaturas', q: k + (k.endsWith('de') || k.endsWith(', a') ? '…?' : t(': ¿temperatura?', ': temperature?')), a: v});
 return out;
}
const progress = () => docById(ID)?.cards || {};
const isDue = (c, p) => !p[c.id] || p[c.id].due <= dayKey();
let session = null, cat = 'todo';
function newSession() {
 const p = progress(), all = cards().filter(c => cat === 'todo' || c.cat === cat);
 // Primero las que tocan hoy (las falladas antes), luego algunas nuevas: 15 por tanda.
 const due = all.filter(c => p[c.id] && p[c.id].due <= dayKey()).sort((a, b) => p[a.id].box - p[b.id].box);
 const fresh = all.filter(c => !p[c.id]).sort(() => Math.random() - .5);
 session = {list: [...due, ...fresh].slice(0, 15), at: 0, shown: false, right: 0, wrong: 0};
}
function stats() {
 const p = progress(), all = cards(), seen = all.filter(c => p[c.id]), known = seen.filter(c => p[c.id].box >= 4).length, due = seen.filter(c => p[c.id].due <= dayKey()).length;
 return {total: all.length, seen: seen.length, known, due};
}
export const dueToday = () => { const p = progress(); return Object.values(p).filter(x => x.due <= dayKey()).length; };

export function render() {
 const s = stats(), d = docById(ID);
 if (!session) newSession();
 return '<header class="page-head"><h1>' + esc(t('Entrenar', 'Train')) + '</h1><p>' + esc(t('Cinco minutos al día con lo que un buen cocinero sabe de memoria: proporciones, fallos y arreglos, recetas base y temperaturas. Lo que fallas vuelve mañana; lo que sabes, cada vez más tarde.', 'Five minutes a day with what a good cook knows by heart: ratios, faults and fixes, base recipes and temperatures. What you miss comes back tomorrow; what you know, later and later.')) + '</p></header>' +
  '<div class="stats"><div class="stat"><strong>' + s.known + '</strong><span>' + esc(t('tarjetas que ya dominas', 'cards you master')) + '</span></div><div class="stat"><strong>' + s.seen + ' / ' + s.total + '</strong><span>' + esc(t('vistas alguna vez', 'seen at least once')) + '</span></div><div class="stat"><strong>' + s.due + '</strong><span>' + esc(t('para repasar hoy', 'to review today')) + '</span></div><div class="stat"><strong>' + (d?.streak || 0) + '</strong><span>' + esc(t('días seguidos entrenando', 'days in a row')) + '</span></div></div>' +
  '<div class="seg tcats" role="group" aria-label="' + esc(t('Tema', 'Topic')) + '">' + CATS.map(c => '<button type="button" class="seg-btn' + (c[0] === cat ? ' active' : '') + '" data-cat="' + c[0] + '" aria-pressed="' + (c[0] === cat) + '">' + esc(en() ? c[2] : c[1]) + '</button>').join('') + '</div>' +
  '<div id="trCard" aria-live="polite">' + cardHtml() + '</div>';
}
function cardHtml() {
 const s = session;
 if (!s.list.length) return '<div class="empty">' + icon('check') + '<h3>' + esc(t('Nada que repasar en este tema', 'Nothing to review in this topic')) + '</h3><p>' + esc(t('Vuelve mañana o elige otro tema.', 'Come back tomorrow or choose another topic.')) + '</p></div>';
 if (s.at >= s.list.length) return '<div class="trdone"><h2>' + esc(t('Tanda terminada', 'Round finished')) + '</h2><p>' + esc(t('Sabías ', 'You knew ') + s.right + t(' de ', ' of ') + s.list.length + '.') + (s.wrong ? ' ' + esc(t('Las que has fallado vuelven mañana.', 'The ones you missed come back tomorrow.')) : '') + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-tr="more">' + icon('refresh') + esc(t('Otra tanda', 'Another round')) + '</button><a class="btn ghost" href="#/hoy">' + esc(t('Hecho por hoy', 'Done for today')) + '</a></div></div>';
 const c = s.list[s.at];
 const label = (CATS.find(x => x[0] === c.cat) || CATS[0]);
 return '<article class="trcard"><p class="trmeta"><span>' + esc(t('Tarjeta ', 'Card ') + (s.at + 1) + t(' de ', ' of ') + s.list.length) + '</span><span>' + esc(en() ? label[2] : label[1]) + '</span></p>' +
  '<div class="cook-bar" aria-hidden="true"><i style="width:' + (s.at / s.list.length * 100).toFixed(1) + '%"></i></div>' +
  '<p class="trq">' + esc(c.q) + '</p>' +
  (s.shown ? '<div class="tra">' + esc(c.a).split('\n').map(l => '<p>' + l + '</p>').join('') + (c.from ? '<a class="more" href="#/biblioteca/' + esc(c.from) + '">' + esc(t('Leer la entrada', 'Read the entry')) + icon('right') + '</a>' : '') + '</div>' +
   '<p class="trask">' + esc(t('¿Lo sabías?', 'Did you know it?')) + '</p><div class="trbtns"><button type="button" class="btn ghost" data-tr="0">' + esc(t('No', 'No')) + '</button><button type="button" class="btn ghost" data-tr="1">' + esc(t('Más o menos', 'Roughly')) + '</button><button type="button" class="btn primary" data-tr="2">' + esc(t('Sí, lo sabía', 'Yes, I knew it')) + '</button></div>'
   : '<p class="fine">' + esc(t('Piénsalo (o dilo en voz alta) antes de darle la vuelta.', 'Think it through (or say it out loud) before turning it over.')) + '</p><button type="button" class="btn primary trflip" data-tr="flip">' + esc(t('Ver la respuesta', 'Show the answer')) + '</button>') + '</article>';
}
async function answer(grade) {
 const c = session.list[session.at], d = docById(ID) || {}, p = {...(d.cards || {})}, cur = p[c.id] || {box: 0};
 const box = grade === 2 ? Math.min(GAP.length - 1, cur.box + 1) : grade === 1 ? Math.max(1, cur.box) : 0;
 const due = new Date(); due.setDate(due.getDate() + (grade === 0 ? 1 : GAP[box] || 1));
 p[c.id] = {box, due: dayKey(due), n: (cur.n || 0) + 1};
 if (grade === 2) session.right++; else session.wrong++;
 // Racha: días seguidos con al menos una tarjeta.
 const today = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
 const streak = d.last === today ? d.streak || 1 : d.last === dayKey(y) ? (d.streak || 0) + 1 : 1;
 session.at++; session.shown = false;
 await saveDoc('repaso', ID, {cards: p, last: today, streak});
}
export function mount(root) {
 const paint = () => { $('#trCard', root).innerHTML = cardHtml(); $('#trCard [data-tr]', root)?.focus({preventScroll: true}); };
 root.addEventListener('click', async e => {
  const b = e.target.closest('[data-tr]'), c = e.target.closest('[data-cat]');
  if (c) { cat = c.dataset.cat; newSession(); root.innerHTML = render(); return; }
  if (!b) return;
  if (b.dataset.tr === 'flip') { session.shown = true; paint(); return; }
  if (b.dataset.tr === 'more') { newSession(); root.innerHTML = render(); return; }
  await answer(Number(b.dataset.tr)); paint();
 });
 // Teclado: espacio para dar la vuelta; 1, 2, 3 para responder.
 const keys = e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.documentElement.classList.contains('has-sheet')) return; if (e.key === ' ' && session && !session.shown && session.at < session.list.length) { e.preventDefault(); session.shown = true; paint(); } else if (session?.shown && ['1', '2', '3'].includes(e.key)) { answer(Number(e.key) - 1).then(paint); } };
 document.addEventListener('keydown', keys);
 return () => document.removeEventListener('keydown', keys);
}
// Lo que llega de otro aparato no interrumpe una tanda a medias.
export function onData() {}
export {toast};
