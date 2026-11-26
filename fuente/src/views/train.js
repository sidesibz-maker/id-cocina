// I+D · Entrenar: tarjetas de repaso sacadas de la Biblioteca (proporciones según el uso, fallos y cómo se arreglan,
// recetas base) y de las temperaturas de oficio. Repetición espaciada: lo que sabes vuelve cada vez más tarde, lo que
// fallas vuelve mañana. Cinco minutos al día y en unos meses lo tienes en la cabeza, no en el móvil.
// El estado va en un documento «repaso:estado» (copia y sincronización).
import {t, en, dayKey} from '../i18n.js';
import {esc, icon, $, toast} from '../ui.js';
import {docById, saveDoc, liveSubs, liveDishes, liveDocs, trashDoc} from '../store.js';
import {entries, entryById} from '../saber/index.js';
import {PATHS} from './paths.js';
import {makeQuestions, localGrade, iaGrade, canAskIa, questionHtml, feedbackHtml, resultHtml} from './exam.js';
import {relDay} from '../i18n.js';

export const title = () => t('Entrenar', 'Train');
const ID = 'repaso:estado', GAP = [0, 1, 3, 7, 16, 35, 80]; // días hasta volver a verla, según la caja
const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
const CATS = [['todo', 'Todo', 'Everything'], ['proporciones', 'Proporciones', 'Ratios'], ['fallos', 'Fallos y arreglos', 'Faults and fixes'], ['recetas', 'Recetas base', 'Base recipes'], ['temperaturas', 'Temperaturas', 'Temperatures'], ['mias', 'Tus recetas', 'Your recipes']];
const TEMPS = [['Vacuno y cordero, poco hecho', '50–52 °C'], ['Vacuno y cordero, al punto', '54–57 °C'], ['Cerdo jugoso', '62–65 °C'], ['Aves, a corazón', '72–74 °C'], ['Pescado jugoso, nacarado', '45–50 °C'], ['Crema inglesa', '82–84 °C'], ['Fritura', '170–180 °C'], ['Mantener en caliente', '65 °C o más'], ['Mantener en frío', '4 °C o menos'], ['Abatir', 'De 60 a 10 °C en menos de 2 horas'], ['Regenerar, a corazón', '70–75 °C'], ['Agar: cuaja al bajar de', 'unos 40 °C (aguanta hasta unos 80 °C)'], ['Gelatina: fundir sin hervir, a', '60–70 °C']];

// Todas las tarjetas posibles. El id es estable para guardar cómo vas con cada una.
export function cards() {
 const out = [];
 for (const e of entries()) {
  if (e.mine) continue;
  for (const r of e.ratios || []) if (r.use && r.ratio) out.push({id: 'r|' + e.id + '|' + r.use, cat: 'proporciones', from: e.id, short: plain(r.ratio), q: e.name + ': ' + t('¿qué proporción para «', 'what ratio for “') + r.use + t('»?', '”?'), a: plain(r.ratio) + (r.note ? '. ' + plain(r.note) : '')});
  for (const x of e.errors || []) if (x.p && x.fix) out.push({id: 'e|' + e.id + '|' + x.p, cat: 'fallos', from: e.id, q: e.name + ': ' + x.p.charAt(0).toLowerCase() + x.p.slice(1) + t('. ¿Por qué pasa y qué haces?', '. Why does it happen and what do you do?'), a: plain(x.fix)});
  if (e.base?.items?.length >= 2 && e.base.for) out.push({id: 'b|' + e.id, cat: 'recetas', from: e.id, q: e.name + t(' para ', ' for ') + e.base.for + t(': ¿qué lleva y cuánto?', ': what goes in and how much?'), a: e.base.items.map(([n, q]) => n + (q ? ': ' + q : '')).join('\n')});
 }
 // Tus recetas: tus subrecetas con cantidades y los componentes y el emplatado de tus platos listos o en carta.
 for (const x of liveSubs()) {
  const items = x.items.filter(i => i.n);
  if (items.length >= 2) out.push({id: 'ms|' + x.id, cat: 'mias', q: t('Tu ', 'Your ') + x.name + (x.yield ? t(' (rinde ', ' (yields ') + x.yield + ')' : '') + t(': ¿qué lleva y cuánto?', ': what goes in and how much?'), a: items.map(i => i.n + (i.q ? ': ' + i.q : '')).join('\n') + (x.method ? '\n\n' + x.method : '')});
 }
 for (const d of liveDishes().filter(d => ['lista', 'carta'].includes(d.status))) {
  const comps = d.components.filter(c => c.items.length);
  if (comps.length) out.push({id: 'md|' + d.id, cat: 'mias', q: d.name + t(': ¿qué componentes lleva y con qué?', ': which components and with what?'), a: comps.map(c => (c.name || t('Componente', 'Component')) + ': ' + c.items.map(i => i.n + (i.q ? ' (' + i.q + ')' : '')).join(', ')).join('\n')});
  if (d.plating) out.push({id: 'mp|' + d.id, cat: 'mias', q: d.name + t(': ¿cómo se emplata?', ': how is it plated?'), a: d.plating});
 }
 // Lo que apuntaste como aprendido en el diario vuelve en tarjetas, para que no se olvide.
 for (const e of liveDocs('diario').filter(e => String(e.learned || '').trim().length > 10)) out.push({id: 'mj|' + e.id, cat: 'mias', q: t('¿Qué aprendiste el ', 'What did you learn on ') + new Date(e.day + 'T12:00:00').toLocaleDateString(en() ? 'en-GB' : 'es-ES', {day: 'numeric', month: 'long'}) + ((e.dishNames || []).length ? ' (' + e.dishNames.join(', ') + ')' : '') + '?', a: e.learned});
 // Las tarjetas que escribes tú (documentos «tarjeta:…»).
 for (const c of liveDocs('tarjeta')) if (c.q && c.a) out.push({id: 'mc|' + c.id, cat: 'mias', q: c.q, a: c.a});
 for (const [k, v] of TEMPS) out.push({id: 't|' + k, cat: 'temperaturas', key: k, short: v, q: k + (k.endsWith('de') || k.endsWith(', a') ? '…?' : t(': ¿temperatura?', ': temperature?')), a: v});
 return out;
}
const progress = () => docById(ID)?.cards || {};
const isDue = (c, p) => !p[c.id] || p[c.id].due <= dayKey();
let session = null, cat = 'todo', only = '', onlyIds = new Set(), mode = 'examen', ex = null;
const catLabel = id => { const c = CATS.find(x => x[0] === id) || CATS[0]; return en() ? c[2] : c[1]; };
// Un examen: 10 preguntas (primero lo que toca repasar y lo fallado, luego lo nuevo), o solo las que se piden.
function newExam(ids) {
 const p = progress(), pool = cards(), all = ids ? pool.filter(c => ids.includes(c.id)) : pool.filter(c => (only ? onlyIds.has(c.from) : cat === 'todo' || c.cat === cat));
 let list;
 if (ids || only) list = shuffle(all).slice(0, 10);
 else { const due = all.filter(c => p[c.id] && p[c.id].due <= dayKey()).sort((a, b) => p[a.id].box - p[b.id].box); const fresh = shuffle(all.filter(c => !p[c.id])); list = shuffle([...due.slice(0, 6), ...fresh].slice(0, 10)); if (list.length < 10) list = [...list, ...shuffle(all.filter(c => !list.includes(c))).slice(0, 10 - list.length)]; }
 ex = {list: makeQuestions(list, pool), at: 0, phase: 'q', results: [], current: null};
}
const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function examHtml() {
 if (!ex) newExam();
 if (!ex.list.length) return '<div class="empty">' + icon('check') + '<h2>' + esc(t('No hay preguntas en este tema', 'No questions in this topic')) + '</h2><p>' + esc(t('Elige otro tema.', 'Choose another topic.')) + '</p></div>';
 if (ex.phase === 'done') return resultHtml(ex);
 return ex.phase === 'fb' ? feedbackHtml(ex, catLabel) : questionHtml(ex, catLabel);
}
// Cuántas tarjetas salen de una ficha (para el botón «Repasar esta ficha»).
export const cardsFor = id => cards().filter(c => c.from === id).length;
function newSession() {
 const p = progress(), all = cards().filter(c => (only ? onlyIds.has(c.from) : cat === 'todo' || c.cat === cat));
 if (only) { session = {list: all.sort(() => Math.random() - .5).slice(0, 20), at: 0, shown: false, right: 0, wrong: 0}; return; }
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

export function render(params = []) {
 const s = stats(), d = docById(ID), path = params[0] === 'ruta' ? PATHS.find(p => p[0] === params[1]) : null;
 const want = params[0] === 'ficha' && entryById(params[1]) ? 'ficha:' + params[1] : path ? 'ruta:' + path[0] : '';
 if (want !== only) { only = want; onlyIds = new Set(path ? path[5] : want ? [params[1]] : []); session = null; ex = null; }
 if (!session) newSession();
 const focus = only.startsWith('ficha:') ? entryById(params[1]) : null;
 return '<header class="page-head"><h1>' + esc(t('Entrenar', 'Train')) + '</h1><p>' + esc(t('Exámenes de 10 preguntas sobre lo que un buen cocinero sabe de memoria: proporciones, fallos y arreglos, recetas base y temperaturas. Respondes con tus palabras, y la corrección te dice lo que has acertado, lo que te falta y por qué. Lo que fallas vuelve mañana; lo que sabes, cada vez más tarde.', 'Ten-question exams on what a good cook knows by heart: ratios, faults and fixes, base recipes and temperatures. You answer in your own words, and the correction tells you what you got right, what is missing and why. What you miss comes back tomorrow; what you know, later and later.')) + '</p></header>' +
  '<div class="stats"><div class="stat"><strong>' + s.known + '</strong><span>' + esc(t('tarjetas que ya dominas', 'cards you master')) + '</span></div><div class="stat"><strong>' + s.seen + ' / ' + s.total + '</strong><span>' + esc(t('vistas alguna vez', 'seen at least once')) + '</span></div><div class="stat"><strong>' + s.due + '</strong><span>' + esc(t('para repasar hoy', 'to review today')) + '</span></div><div class="stat"><strong>' + (d?.streak || 0) + '</strong><span>' + esc(t('días seguidos entrenando', 'days in a row')) + '</span></div></div>' +
  (path ? '<p class="tronly">' + esc(t('Examen de la ruta «', 'Test on the path “') + (en() ? path[2] : path[1]) + t('»: tarjetas de todas sus fichas. ', '”: cards from all its entries. ')) + '<a href="#/entrenar">' + esc(t('Volver a todos los temas', 'Back to all topics')) + '</a></p>' : focus ? '<p class="tronly">' + esc(t('Repasando solo la ficha ', 'Reviewing only the entry ')) + '<a href="#/biblioteca/' + esc(focus.id) + '">' + esc(focus.name) + '</a>. <a href="#/entrenar">' + esc(t('Volver a todos los temas', 'Back to all topics')) + '</a></p>' :
  masteryHtml() +
  '<div class="seg tcats" role="group" aria-label="' + esc(t('Tema', 'Topic')) + '">' + CATS.map(c => '<button type="button" class="seg-btn' + (c[0] === cat ? ' active' : '') + '" data-cat="' + c[0] + '" aria-pressed="' + (c[0] === cat) + '">' + esc(en() ? c[2] : c[1]) + '</button>').join('') + '</div>') +
  '<div class="seg tmode" role="group" aria-label="' + esc(t('Cómo entrenar', 'How to train')) + '"><button type="button" class="seg-btn' + (mode === 'examen' ? ' active' : '') + '" data-mode="examen" aria-pressed="' + (mode === 'examen') + '">' + esc(t('Examen', 'Exam')) + '</button><button type="button" class="seg-btn' + (mode === 'rapido' ? ' active' : '') + '" data-mode="rapido" aria-pressed="' + (mode === 'rapido') + '">' + esc(t('Repaso rápido', 'Quick review')) + '</button></div>' +
  lastExamHtml() +
  '<div id="trCard" aria-live="polite">' + (mode === 'examen' ? examHtml() : cardHtml()) + '</div>' + mineHtml();
}
// El último examen, para ver cómo vas.
function lastExamHtml() {
 const list = liveDocs('examen').sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
 if (!list.length) return '';
 const f = n => Number(n).toLocaleString(en() ? 'en' : 'es', {maximumFractionDigits: 1});
 return '<p class="fine exlast">' + esc(t('Tus últimos exámenes: ', 'Your last exams: ') + list.map(x => f(x.nota) + t(' (', ' (') + relDay(x.at).toLowerCase() + ')').join(', ') + '.') + '</p>';
}
// Tus tarjetas: lo que quieres saberte de memoria y no está en ningún sitio (tus puntos, tus proporciones, nombres…).
function mineHtml() {
 const list = liveDocs('tarjeta').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
 return '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Tus tarjetas', 'Your cards')) + '</h2><p>' + esc(t('Escribe una pregunta y su respuesta: entra en el repaso con las demás, en «Tus recetas».', 'Write a question and its answer: it joins the review with the rest, under “Your recipes”.')) + '</p></div></header>' +
  '<details class="trnew-wrap"' + (list.length ? '' : ' open') + '><summary>' + esc(t('Escribir una tarjeta', 'Write a card')) + '</summary><form id="trNew" class="card trnew"><div class="tfield"><label for="trQ">' + esc(t('Pregunta', 'Question')) + '</label><input id="trQ" maxlength="300" autocomplete="off" placeholder="' + esc(t('p. ej. ¿A cuántos grados saco el cordero lechal?', 'e.g. At what temperature do I take out the suckling lamb?')) + '"></div>' +
  '<div class="tfield"><label for="trA">' + esc(t('Respuesta', 'Answer')) + '</label><textarea id="trA" rows="3" maxlength="2000" data-voice></textarea></div><div class="row-actions"><button type="submit" class="btn primary">' + icon('plus') + esc(t('Añadir tarjeta', 'Add card')) + '</button></div></form></details>' +
  (list.length ? '<details class="trmine"><summary>' + esc(list.length === 1 ? t('1 tarjeta tuya', '1 card of yours') : list.length + t(' tarjetas tuyas', ' cards of yours')) + '</summary><ul class="plain">' + list.map(c => '<li><strong>' + esc(c.q) + '</strong><br>' + esc(c.a) + ' <button type="button" class="linkbtn" data-trash-card="' + esc(c.id) + '">' + esc(t('A la papelera', 'To the bin')) + '</button></li>').join('') + '</ul></details>' : '') + '</section>';
}
// Cuánto dominas de cada tema: tarjetas en la caja 4 o más, sobre el total del tema.
function masteryHtml() {
 const p = progress(), all = cards(), rows = CATS.filter(c => c[0] !== 'todo').map(c => { const list = all.filter(x => x.cat === c[0]), known = list.filter(x => (p[x.id]?.box || 0) >= 4).length; return [c, list.length, known]; }).filter(r => r[1]);
 if (!Object.keys(p).length) return '';
 return '<details class="tmastery"><summary>' + esc(t('Cuánto dominas de cada tema', 'How much of each topic you master')) + '</summary><ul>' + rows.map(([c, n, k]) => '<li><span>' + esc(en() ? c[2] : c[1]) + '</span><span class="cook-bar" aria-hidden="true"><i style="width:' + (k / n * 100).toFixed(0) + '%"></i></span><span>' + esc(k + t(' de ', ' of ') + n) + '</span></li>').join('') + '</ul></details>';
}
function cardHtml() {
 const s = session;
 if (!s.list.length) return '<div class="empty">' + icon('check') + '<h2>' + esc(t('Nada que repasar en este tema', 'Nothing to review in this topic')) + '</h2><p>' + esc(t('Vuelve mañana o elige otro tema.', 'Come back tomorrow or choose another topic.')) + '</p></div>';
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
 const c = session.list[session.at];
 await record(c, grade);
 if (grade === 2) session.right++; else session.wrong++;
 session.at++; session.shown = false;
}
// Lo aprendido se guarda igual en el examen y en el repaso rápido (cajas de repetición espaciada y racha).
async function record(c, grade, before) {
 const d = docById(ID) || {}, p = {...(d.cards || {})}, cur = before !== undefined ? (before || {box: 0}) : p[c.id] || {box: 0};
 const box = grade === 2 ? Math.min(GAP.length - 1, cur.box + 1) : grade === 1 ? Math.max(1, cur.box) : 0;
 const due = new Date(); due.setDate(due.getDate() + (grade === 0 ? 1 : GAP[box] || 1));
 p[c.id] = {box, due: dayKey(due), n: (cur.n || 0) + 1};
 // Racha: días seguidos con al menos una tarjeta.
 const today = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
 const streak = d.last === today ? d.streak || 1 : d.last === dayKey(y) ? (d.streak || 0) + 1 : 1;
 await saveDoc('repaso', ID, {cards: p, last: today, streak});
}
export function mount(root, params = []) {
 const paint = () => { $('#trCard', root).innerHTML = cardHtml(); $('#trCard [data-tr]', root)?.focus({preventScroll: true}); };
 root.addEventListener('click', async e => {
  const b = e.target.closest('[data-tr]'), c = e.target.closest('[data-cat]');
  if (c) { cat = c.dataset.cat; newSession(); ex = null; root.innerHTML = render(params); return; }
  if (!b) return;
  if (b.dataset.tr === 'flip') { session.shown = true; paint(); return; }
  if (b.dataset.tr === 'more') { newSession(); root.innerHTML = render(params); return; }
  await answer(Number(b.dataset.tr)); paint();
 });
 const paintEx = (focus = true) => { $('#trCard', root).innerHTML = examHtml(); if (focus) ($('#trCard #exA', root) || $('#trCard [data-ex], #trCard .exopt', root))?.focus({preventScroll: true}); $('#trCard', root).scrollIntoView({block: 'nearest'}); };
 const grade = nota => (nota >= 8 ? 2 : nota >= 5 ? 1 : 0);
 const finishQuestion = async (res) => {
  const it = ex.list[ex.at], snap = (docById(ID)?.cards || {})[it.card.id] || null;
  ex.current = {...res, snap}; ex.phase = 'fb';
  await record(it.card, grade(res.nota), snap);
  paintEx();
 };
 const correct = async user => {
  const it = ex.list[ex.at], btn = $('#exForm button[type=submit]', root);
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); btn.lastChild.textContent = canAskIa() ? t('Corrigiendo…', 'Marking…') : t('Corrigiendo', 'Marking'); }
  let res;
  if (canAskIa() && user.trim()) { try { res = await iaGrade(it.card, user); } catch { res = {...localGrade(it.card, user), note: t('ChatGPT no ha respondido: corrección de la app.', 'ChatGPT did not answer: app correction.')}; toast(t('ChatGPT no ha respondido; te corrige la app.', 'ChatGPT did not answer; the app marks it.'), 'info'); } }
  else res = localGrade(it.card, user);
  await finishQuestion({...res, user});
 };
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'exForm') return;
  e.preventDefault();
  const user = $('#exA', root).value;
  if (!user.trim()) { toast(t('Escribe o dicta tu respuesta, o pulsa «No lo sé».', 'Write or dictate your answer, or press “I do not know”.'), 'error'); $('#exA', root).focus(); return; }
  await correct(user);
 });
 root.addEventListener('click', async e => {
  const m = e.target.closest('[data-mode]');
  if (m) { mode = m.dataset.mode; root.innerHTML = render(params); return; }
  const o = e.target.closest('button.exopt[data-opt]');
  if (o && ex?.phase === 'q') { const it = ex.list[ex.at], i = Number(o.dataset.opt), ok = !!it.options[i]?.correct; await finishQuestion({nota: ok ? 10 : 0, verdict: ok ? 'bien' : 'mal', hits: [], missing: [], picked: i, user: it.options[i]?.text || ''}); return; }
  const g = e.target.closest('[data-ex-grade]');
  if (g && ex?.phase === 'fb') { const it = ex.list[ex.at], v = Number(g.dataset.exGrade); ex.current = {...ex.current, nota: v === 2 ? 10 : v === 1 ? 6 : 2, verdict: v === 2 ? 'bien' : v === 1 ? 'casi' : 'mal'}; await record(it.card, v, ex.current.snap); paintEx(); toast(t('Nota corregida.', 'Mark fixed.')); return; }
  const a = e.target.closest('[data-ex]')?.dataset.ex;
  if (!a || !ex) return;
  if (a === 'skip') { await correct(''); return; }
  if (a === 'next') {
   const it = ex.list[ex.at];
   ex.results.push({id: it.card.id, nota: ex.current.nota, verdict: ex.current.verdict});
   ex.at++; ex.current = null; ex.phase = ex.at >= ex.list.length ? 'done' : 'q';
   if (ex.phase === 'done') { const n = ex.results.length, nota = ex.results.reduce((s2, r2) => s2 + r2.nota, 0) / n; await saveDoc('examen', null, {at: new Date().toISOString(), nota: Math.round(nota * 10) / 10, n, tema: only || cat, fallos: ex.results.filter(r2 => r2.verdict !== 'bien').map(r2 => r2.id)}); }
   paintEx(); return;
  }
  if (a === 'retry') { newExam(ex.results.filter(r2 => r2.verdict !== 'bien').map(r2 => r2.id)); root.innerHTML = render(params); $('#trCard', root).scrollIntoView({block: 'nearest'}); return; }
  if (a === 'new') { newExam(); root.innerHTML = render(params); $('#trCard', root).scrollIntoView({block: 'nearest'}); return; }
 });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'trNew') return;
  e.preventDefault();
  const q = $('#trQ', root).value.trim(), a = $('#trA', root).value.trim();
  if (!q || !a) { toast(t('Escribe la pregunta y la respuesta.', 'Write the question and the answer.'), 'error'); return; }
  await saveDoc('tarjeta', null, {q, a}); toast(t('Tarjeta añadida.', 'Card added.'));
  if (only || cat === 'mias' || cat === 'todo') newSession();
  root.innerHTML = render(params);
 });
 root.addEventListener('click', async e => { const b = e.target.closest('[data-trash-card]'); if (!b) return; await trashDoc(b.dataset.trashCard); toast(t('En la papelera.', 'Moved to the bin.')); root.innerHTML = render(params); });
 // Teclado: espacio para dar la vuelta; 1, 2, 3 para responder.
 const keys = e => { if (mode === 'examen') { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement?.id === 'exA') { e.preventDefault(); $('#exForm', root)?.requestSubmit(); } return; } if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.documentElement.classList.contains('has-sheet')) return; if (e.key === ' ' && session && !session.shown && session.at < session.list.length) { e.preventDefault(); session.shown = true; paint(); } else if (session?.shown && ['1', '2', '3'].includes(e.key)) { answer(Number(e.key) - 1).then(paint); } };
 document.addEventListener('keydown', keys);
 return () => document.removeEventListener('keydown', keys);
}
// Lo que llega de otro aparato no interrumpe una tanda a medias.
export function onData() {}
export {toast};
