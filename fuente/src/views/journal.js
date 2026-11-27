// I+D · Diario de cocina: dos minutos al acabar cada servicio. Qué salió bien, qué falló, qué has aprendido y qué
// quieres probar. Con el tiempo es tu memoria de oficio: se busca, se resume por semanas y alimenta tu trayectoria.
// Cada entrada es un documento «diario:…» (va en la copia y se sincroniza); nada se borra, va a la papelera.
import {t, en, locale, dayKey, longDate} from '../i18n.js';
import {esc, icon, $, $$, toast, ask, friendly, short} from '../ui.js';
import {uploadImage} from '../store.js';
import {shrinkImage} from '../ai.js';
import {hydrateImages} from './shared.js';
import {state, liveDocs, docById, saveDoc, trashDoc, liveDishes} from '../store.js';
import {iaOn, askIa, iaMessage} from '../ia.js';
import {go} from '../nav.js';

export const title = p => (p[0] === 'aprendido' ? t('Lo aprendido', 'What I learned') : p[0] ? t('Diario', 'Journal') : t('Diario de cocina', 'Kitchen journal'));
const SERVICES = [['comida', 'Comida', 'Lunch'], ['cena', 'Cena', 'Dinner'], ['evento', 'Evento', 'Event'], ['pruebas', 'Día de pruebas', 'Testing day'], ['libre', 'Fuera de cocina', 'Away from the kitchen']];
const svc = id => { const r = SERVICES.find(x => x[0] === id) || SERVICES[1]; return en() ? r[2] : r[1]; };
const MOODS = [[1, 'Durísimo', 'Brutal'], [2, 'Flojo', 'Weak'], [3, 'Normal', 'Normal'], [4, 'Bien', 'Good'], [5, 'Redondo', 'Spot on']];
const FIELDS = [
 ['good', t => t('Lo que salió bien', 'What went well'), t => t('Un plato que salió perfecto, un pase limpio, alguien del equipo que se lució…', 'A dish that came out perfect, a clean pass, someone on the team who shone…')],
 ['bad', t => t('Lo que falló o hay que corregir', 'What went wrong or needs fixing'), t => t('Tiempos, puntos, faltas de mise en place, devoluciones…', 'Timings, cooking points, missing mise en place, returns…')],
 ['learned', t => t('Lo que he aprendido', 'What I learned'), t => t('Una técnica, un truco, algo de un compañero, de un proveedor, de un cliente…', 'A technique, a trick, something from a colleague, a supplier, a guest…')],
 ['ideas', t => t('Ideas para probar', 'Ideas to try'), t => t('Lo que se te ha ocurrido durante el servicio', 'What came to mind during service')]
];
const entries = () => liveDocs('diario').sort((a, b) => String(b.day).localeCompare(String(a.day)) || String(b.created_at).localeCompare(String(a.created_at)));
const dateLabel = d => new Date(d + 'T12:00:00').toLocaleDateString(locale(), {weekday: 'short', day: 'numeric', month: 'short'});
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Lunes de la semana de un día (para agrupar).
const monday = d => { const x = new Date(d + 'T12:00:00'), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return dayKey(x); };

// Tal día como hoy: lo que escribiste hace un año (o, si no, hace un mes), para ver cuánto has avanzado.
export function onThisDay() {
 const today = dayKey(), list = liveDocs('diario');
 const year = list.filter(e => e.day && e.day.slice(5) === today.slice(5) && e.day < today).sort((a, b) => b.day.localeCompare(a.day))[0];
 if (year) return {e: year, label: t('Hace ', '') + (Number(today.slice(0, 4)) - Number(year.day.slice(0, 4))) + (Number(today.slice(0, 4)) - Number(year.day.slice(0, 4)) === 1 ? t(' año', ' year ago') : t(' años', ' years ago'))};
 const m = new Date(today + 'T12:00:00'); m.setMonth(m.getMonth() - 1);
 const month = list.find(e => e.day === dayKey(m));
 return month ? {e: month, label: t('Hace un mes', 'A month ago')} : null;
}
const gist = e => e.learned || e.good || e.bad || e.ideas || '';
// Cómo han ido los servicios los últimos 30 días: una barra por día con nota (1 durísimo, 5 redondo).
function moodHtml(list) {
 const days = [], today = new Date();
 for (let k = 29; k >= 0; k--) { const d = new Date(today); d.setDate(d.getDate() - k); const key = dayKey(d), ms = list.filter(e => e.day === key && Number(e.mood)).map(e => Number(e.mood)); days.push([key, ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0]); }
 const rated = days.filter(d => d[1]);
 if (rated.length < 3) return '';
 const avg = rated.reduce((a, d) => a + d[1], 0) / rated.length, w = 300, h = 60, bw = w / 30;
 const word = avg >= 4.3 ? t('redondo', 'spot on') : avg >= 3.5 ? t('bien', 'good') : avg >= 2.7 ? t('normal', 'normal') : avg >= 1.8 ? t('flojo', 'weak') : t('durísimo', 'brutal');
 return '<figure class="jmood"><figcaption><strong>' + esc(t('Tus servicios, los últimos 30 días', 'Your services, the last 30 days')) + '</strong> ' + esc(t('Media ', 'Average ') + avg.toLocaleString(en() ? 'en' : 'es', {maximumFractionDigits: 1}) + t(' de 5 (', ' out of 5 (') + word + t('), con ', '), with ') + rated.length + t(' días con nota.', ' rated days.')) + '</figcaption>' +
  '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(t('Nota de cada servicio en los últimos 30 días', 'Rating of each service over the last 30 days')) + '">' + days.map(([key, v], i) => v ? '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (h - v / 5 * h).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + (v / 5 * h).toFixed(1) + '" class="' + (v >= 4 ? 'jm-good' : v <= 2 ? 'jm-bad' : 'jm-mid') + '"><title>' + esc(key + ': ' + v.toFixed(1)) + '</title></rect>' : '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (h - 2) + '" width="' + (bw - 2).toFixed(1) + '" height="2" class="jm-none"></rect>').join('') + '</svg></figure>';
}
// Lo aprendido, mes a mes: todo lo que has apuntado como aprendido y las ideas del servicio, para releerlo, imprimirlo
// y pasar las ideas al cuaderno de chispas del Laboratorio.
function learnedHtml() {
 const list = entries().filter(e => String(e.learned || '').trim() || String(e.ideas || '').trim()), months = new Map();
 for (const e of list) { const m = String(e.day).slice(0, 7); if (!months.has(m)) months.set(m, []); months.get(m).push(e); }
 const mLabel = m => new Date(m + '-15T12:00:00').toLocaleDateString(locale(), {month: 'long', year: 'numeric'}).replace(/^./, c => c.toUpperCase());
 return '<a class="back" href="#/diario">' + icon('left') + esc(t('Diario', 'Journal')) + '</a><header class="page-head page-head-row"><div><h1>' + esc(t('Lo aprendido', 'What I learned')) + '</h1><p>' + esc(t('Lo que has apuntado como aprendido y las ideas que te vinieron en el servicio, mes a mes. Releerlo es la forma de no olvidarlo.', 'What you noted as learned and the ideas that came to you during service, month by month. Rereading it is how you keep it.')) + '</p></div>' +
  (list.length ? '<button type="button" class="btn ghost" data-act="print-learned">' + icon('down') + esc(t('Imprimir', 'Print')) + '</button>' : '') + '</header>' +
  (list.length ? '<div id="jlearned">' + [...months].map(([m, es]) => { const l = es.filter(e => String(e.learned || '').trim()), i = es.filter(e => String(e.ideas || '').trim());
   return '<section class="sec jmonth"><h2 class="day">' + esc(mLabel(m)) + '</h2>' +
    (l.length ? '<h3 class="kh3">' + esc(t('Aprendido', 'Learned')) + '</h3><ul class="jlearn">' + l.map(e => '<li><a href="#/diario/' + encodeURIComponent(e.id) + '">' + esc(dateLabel(e.day)) + '</a> ' + esc(e.learned) + '</li>').join('') + '</ul>' : '') +
    (i.length ? '<h3 class="kh3">' + esc(t('Ideas para probar', 'Ideas to try')) + '</h3><ul class="jlearn">' + i.map(e => '<li><a href="#/diario/' + encodeURIComponent(e.id) + '">' + esc(dateLabel(e.day)) + '</a> ' + esc(e.ideas) + ' ' + (e.sparked ? '<span class="fine">' + esc(t('(ya en tus chispas)', '(already in your sparks)')) + '</span>' : '<button type="button" class="linkbtn" data-spark="' + esc(e.id) + '">' + esc(t('Pasar a chispas', 'Send to sparks')) + '</button>') + '</li>').join('') + '</ul>' : '') + '</section>'; }).join('') + '</div>'
  : '<div class="empty">' + icon('edit') + '<h2>' + esc(t('Aún no hay nada apuntado como aprendido', 'Nothing noted as learned yet')) + '</h2><p>' + esc(t('En cada entrada del diario, rellena «Lo que he aprendido» o «Ideas para probar» y aparecerá aquí.', 'In each journal entry, fill in “What I learned” or “Ideas to try” and it will show up here.')) + '</p></div>');
}
export function render(params) {
 if (params[0] === 'aprendido') return learnedHtml();
 if (params[0]) return editor(params[0]);
 const list = entries(), today = dayKey(), done = list.some(e => e.day === today);
 const weeks = new Map();
 for (const e of list) { const w = monday(e.day); if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(e); }
 const week = list.filter(e => monday(e.day) === monday(today)), covers = week.reduce((a, e) => a + (Number(e.covers) || 0), 0);
 const streak = (() => { let n = 0; const days = new Set(list.map(e => e.day)), d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); } return n; })();
 return '<header class="page-head page-head-row"><div><h1>' + esc(t('Diario de cocina', 'Kitchen journal')) + '</h1><p>' + esc(t('Dos minutos al acabar el servicio. Lo que apuntas hoy es lo que sabrás mañana.', 'Two minutes after service. What you write today is what you will know tomorrow.')) + '</p></div>' +
  '<div class="row-actions"><a class="btn ghost" href="#/diario/aprendido">' + icon('brain') + esc(t('Lo aprendido', 'What I learned')) + '</a><a class="btn primary" href="#/diario/nuevo">' + icon('plus') + esc(done ? t('Otra entrada de hoy', 'Another entry for today') : t('Escribir el de hoy', 'Write today\'s')) + '</a></div></header>' +
  (list.length ? '<div class="stats jstats"><div class="stat"><strong>' + week.length + '</strong><span>' + esc(t('entradas esta semana', 'entries this week')) + '</span></div><div class="stat"><strong>' + (covers || '—') + '</strong><span>' + esc(t('cubiertos esta semana', 'covers this week')) + '</span></div><div class="stat"><strong>' + streak + '</strong><span>' + esc(streak === 1 ? t('día seguido escribiendo', 'day in a row') : t('días seguidos escribiendo', 'days in a row')) + '</span></div><div class="stat"><strong>' + list.filter(e => String(e.learned || '').trim()).length + '</strong><span>' + esc(t('cosas aprendidas en total', 'things learned in total')) + '</span></div></div>' +
   moodHtml(list) +
   (() => { const o = onThisDay(); return o ? '<a class="jonday" href="#/diario/' + encodeURIComponent(o.e.id) + '"><strong>' + esc(t('Tal día como hoy. ', 'On this day. ') + o.label) + '</strong><span>' + esc(short(gist(o.e), 220)) + '</span></a>' : ''; })() +
   '<div class="searchbox"><label class="sr" for="jq">' + esc(t('Buscar en el diario', 'Search the journal')) + '</label>' + icon('search') + '<input id="jq" type="search" autocomplete="off" placeholder="' + esc(t('Busca en tu diario: un plato, un producto, un problema…', 'Search your journal: a dish, a product, a problem…')) + '"></div>' +
   '<div id="jlist">' + [...weeks].map(([w, es]) => weekBlock(w, es)).join('') + '</div>'
  : '<div class="empty">' + icon('edit') + '<h2>' + esc(t('Tu diario está en blanco', 'Your journal is blank')) + '</h2><p>' + esc(t('Los grandes cocineros apuntan. Al acabar hoy, escribe tres líneas: qué salió bien, qué falló y qué has aprendido. En un mes tendrás un mapa de cómo trabajas.', 'Great cooks take notes. After today, write three lines: what went well, what went wrong and what you learned. In a month you will have a map of how you work.')) + '</p><a class="btn primary" href="#/diario/nuevo">' + icon('plus') + esc(t('Escribir el de hoy', 'Write today\'s')) + '</a></div>');
}
function weekBlock(w, es) {
 const end = new Date(w + 'T12:00:00'); end.setDate(end.getDate() + 6);
 const label = t('Semana del ', 'Week of ') + new Date(w + 'T12:00:00').toLocaleDateString(locale(), {day: 'numeric', month: 'long'});
 const saved = docById('diario-semana:' + w);
 return '<section class="sec jweek" data-week="' + w + '"><header class="sec-head"><div><h2>' + esc(label) + '</h2><p>' + esc(es.length + (es.length === 1 ? t(' entrada', ' entry') : t(' entradas', ' entries')) + (es.some(e => e.covers) ? ', ' + es.reduce((a, e) => a + (Number(e.covers) || 0), 0) + t(' cubiertos', ' covers') : '')) + '</p></div>' +
  '<button type="button" class="linkbtn" data-review="' + w + '">' + icon('spark') + esc(saved ? t('Ver el repaso', 'See the review') : t('Repasar la semana', 'Review the week')) + '</button></header>' +
  '<div class="jcards">' + es.map(card).join('') + '</div></section>';
}
function card(e) {
 const mood = MOODS.find(m => m[0] === Number(e.mood));
 const lines = FIELDS.map(([k, label]) => e[k] ? '<p><b>' + esc(label(t)) + '.</b> ' + esc(short(e[k], 180)) + '</p>' : '').join('');
 return '<a class="jcard" href="#/diario/' + encodeURIComponent(e.id) + '" data-text="' + esc(norm([e.good, e.bad, e.learned, e.ideas, e.notes, ...(e.dishNames || [])].join(' '))) + '"><span class="jcard-top"><strong>' + esc(dateLabel(e.day)) + '</strong><span>' + esc(svc(e.service)) + '</span>' + (e.covers ? '<span>' + esc(e.covers + t(' cub.', ' covers')) + '</span>' : '') + (mood ? '<span class="jmood" data-mood="' + mood[0] + '">' + esc(en() ? mood[2] : mood[1]) + '</span>' : '') + '</span>' + (lines || '<p class="hint">' + esc(t('Sin apuntes.', 'No notes.')) + '</p>') + '</a>';
}
function editor(id) {
 const e = id === 'nuevo' ? {day: dayKey(), service: new Date().getHours() < 18 ? 'comida' : 'cena'} : docById(id);
 if (!e || e.type && e.type !== 'diario') return '<a class="back" href="#/diario">' + icon('left') + esc(t('Diario', 'Journal')) + '</a><div class="empty">' + icon('edit') + '<h3>' + esc(t('No encuentro esta entrada', 'I cannot find this entry')) + '</h3></div>';
 const dishes = liveDishes().slice(0, 60);
 jpics = Array.isArray(e.images) ? e.images.slice() : [];
 return '<a class="back" href="#/diario">' + icon('left') + esc(t('Diario', 'Journal')) + '</a><header class="page-head"><h1>' + esc(id === 'nuevo' ? t('¿Cómo ha ido?', 'How did it go?') : longDate(e.day)) + '</h1></header>' +
  '<form id="jform" class="card jform" data-id="' + esc(id) + '"><div class="tpair"><div class="tfield"><label for="jday">' + esc(t('Día', 'Day')) + '</label><input id="jday" type="date" value="' + esc(e.day) + '" max="' + dayKey() + '"></div>' +
  '<div class="tfield"><label for="jservice">' + esc(t('Servicio', 'Service')) + '</label><select id="jservice">' + SERVICES.map(s => '<option value="' + s[0] + '"' + (s[0] === e.service ? ' selected' : '') + '>' + esc(en() ? s[2] : s[1]) + '</option>').join('') + '</select></div>' +
  '<div class="tfield"><label for="jcovers">' + esc(t('Cubiertos', 'Covers')) + '</label><input id="jcovers" inputmode="numeric" value="' + esc(e.covers || '') + '" autocomplete="off"></div></div>' +
  '<fieldset class="jmoods"><legend>' + esc(t('¿Qué tal el servicio?', 'How was service?')) + '</legend><div class="seg">' + MOODS.map(m => '<label class="seg-btn' + (Number(e.mood) === m[0] ? ' active' : '') + '"><input type="radio" name="jmood" value="' + m[0] + '" class="sr"' + (Number(e.mood) === m[0] ? ' checked' : '') + '>' + esc(en() ? m[2] : m[1]) + '</label>').join('') + '</div></fieldset>' +
  FIELDS.map(([k, label, ph]) => '<div class="tfield"><label for="j-' + k + '">' + esc(label(t)) + '</label><textarea id="j-' + k + '" data-voice rows="3" maxlength="3000" placeholder="' + esc(ph(t)) + '">' + esc(e[k] || '') + '</textarea></div>').join('') +
  '<div class="tfield"><p class="jlegend">' + esc(t('Fotos del día (platos, pruebas, el pase)', 'Photos of the day (dishes, tests, the pass)')) + '</p><div id="jpics" class="jpics">' + picsHtml() + '</div><label class="btn ghost" for="jphoto">' + icon('image') + '<span>' + esc(t('Añadir fotos', 'Add photos')) + '</span></label><input id="jphoto" class="sr" type="file" accept="image/*" multiple></div>' +
  (dishes.length ? '<fieldset class="tfield"><legend class="jlegend">' + esc(t('Platos de tu libreta que han salido o has tocado', 'Dishes from your notebook that went out or you worked on')) + '</legend><div class="chips jdishes">' + dishes.map(d => '<label class="chip' + ((e.dishes || []).includes(d.id) ? ' chip-have' : '') + '"><input type="checkbox" class="sr" value="' + esc(d.id) + '"' + ((e.dishes || []).includes(d.id) ? ' checked' : '') + '>' + esc(d.name) + '</label>').join('') + '</div></fieldset>' : '') +
  '<div class="row-actions">' + (id !== 'nuevo' ? '<button type="button" class="btn danger" data-act="trash">' + icon('trash') + esc(t('A la papelera', 'To the bin')) + '</button>' : '') + '<button type="submit" class="btn primary">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div></form>' +
  (id !== 'nuevo' && (e.dishes || []).length ? '<section class="sec">' + '<header class="sec-head"><div><h2>' + esc(t('Platos de este día', 'Dishes from this day')) + '</h2></div></header><div class="chips">' + e.dishes.map(did => { const d = state.dishes.find(x => x.id === did); return d ? '<a class="chip" href="#/plato/' + esc(d.id) + '">' + esc(d.name) + '</a>' : ''; }).join('') + '</div></section>' : '');
}
// Repaso de la semana: lo que se repite, sin IA (por palabras) y, con ChatGPT conectado, un resumen de jefe de cocina.
async function review(w) {
 const es = entries().filter(e => monday(e.day) === w).sort((a, b) => a.day.localeCompare(b.day));
 const {sheet} = await import('../ui.js');
 const saved = docById('diario-semana:' + w);
 const block = (title, key) => { const items = es.filter(e => String(e[key] || '').trim()); return items.length ? '<h3>' + esc(title) + '</h3><ul class="plain">' + items.map(e => '<li><b>' + esc(dateLabel(e.day)) + ':</b> ' + esc(e[key]) + '</li>').join('') + '</ul>' : ''; };
 const s = sheet({title: t('Repaso de la semana', 'Week review'), wide: true, body:
  '<div id="jrev">' + (saved?.text ? '<div class="callout"><h3>' + esc(t('Resumen', 'Summary')) + '</h3>' + saved.text.split(/\n+/).map(p => '<p>' + esc(p) + '</p>').join('') + '</div>' : '') + '</div>' +
  (iaOn() ? '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="ia">' + icon('spark') + esc(saved ? t('Rehacer el resumen con ChatGPT', 'Redo the summary with ChatGPT') : t('Resumir con ChatGPT', 'Summarise with ChatGPT')) + '</button></div>' : '<p class="fine">' + icon('info') + esc(t('Con ChatGPT conectado (Ajustes), te hago un resumen de jefe: qué se repite, qué corregir y en qué centrarte la semana que viene.', 'With ChatGPT connected (Settings), I write a head-chef summary: what repeats, what to fix and what to focus on next week.')) + '</p>') +
  block(t('Lo que salió bien', 'What went well'), 'good') + block(t('Lo que falló', 'What went wrong'), 'bad') + block(t('Lo aprendido', 'What I learned'), 'learned') + block(t('Ideas para probar', 'Ideas to try'), 'ideas')});
 const b = $('[data-act=ia]', s.el);
 if (b) b.onclick = async () => {
  b.disabled = true; b.classList.add('is-busy');
  try {
   const text = await askIa({instructions: 'Eres un jefe de cocina con experiencia que hace de mentor. Responde en español de España, directo y práctico, sin halagos. Máximo 180 palabras, en 3 párrafos cortos: 1) lo que se repite (bueno y malo), 2) qué corregir y cómo, en concreto, 3) en qué centrarse la semana que viene (una o dos cosas). No inventes nada que no esté en el diario.',
    text: 'Diario de la semana del ' + w + ' de un cocinero:\n' + es.map(e => '- ' + e.day + ' (' + svc(e.service) + (e.covers ? ', ' + e.covers + ' cubiertos' : '') + '): bien: ' + (e.good || '-') + ' | mal: ' + (e.bad || '-') + ' | aprendido: ' + (e.learned || '-') + ' | ideas: ' + (e.ideas || '-')).join('\n')});
   await saveDoc('diario-semana', 'diario-semana:' + w, {week: w, text: text.trim()});
   $('#jrev', s.el).innerHTML = '<div class="callout"><h3>' + esc(t('Resumen', 'Summary')) + '</h3>' + text.trim().split(/\n+/).map(p => '<p>' + esc(p) + '</p>').join('') + '</div>';
  } catch (err) { toast(err?.kind ? iaMessage(err) : friendly(err), 'error', 7000); }
  b.disabled = false; b.classList.remove('is-busy');
 };
}
export function mount(root, params) {
 root.addEventListener('input', e => {
  if (e.target.id !== 'jq') return;
  const q = norm(e.target.value).trim();
  $$('.jcard', root).forEach(c => { c.hidden = !!q && !c.dataset.text.includes(q) && !norm(c.textContent).includes(q); });
  $$('.jweek', root).forEach(w => { w.hidden = !$$('.jcard', w).some(c => !c.hidden); });
 });
 root.addEventListener('change', e => {
  const r = e.target.closest('input[name=jmood]'), c = e.target.closest('.jdishes input');
  if (r) $$('.jmoods .seg-btn', root).forEach(l => l.classList.toggle('active', l.contains(r)));
  if (c) c.closest('.chip').classList.toggle('chip-have', c.checked);
 });
 root.addEventListener('click', async e => {
  const sp = e.target.closest('[data-spark]');
  if (sp) { const je = docById(sp.dataset.spark); if (!je) return; sp.disabled = true; await saveDoc('chispa', null, {text: String(je.ideas).slice(0, 2000), from: 'diario', diario_id: je.id}); await saveDoc('diario', je.id, {sparked: true}); sp.replaceWith(Object.assign(document.createElement('span'), {className: 'fine', textContent: t('(ya en tus chispas)', '(already in your sparks)')})); toast(t('En tu cuaderno de chispas del Laboratorio.', 'In your Lab spark notebook.')); return; }
  if (e.target.closest('[data-act=print-learned]')) {
   let host = document.getElementById('printFicha');
   if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
   const copyEl = $('#jlearned', root).cloneNode(true); copyEl.querySelectorAll('button').forEach(x => x.remove());
   host.innerHTML = '<article class="kbook-entry"><h2>' + esc(t('Lo aprendido', 'What I learned')) + '</h2>' + copyEl.innerHTML + '</article>';
   document.documentElement.classList.add('printing');
   const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
   addEventListener('afterprint', done); setTimeout(() => print(), 60); return;
  }
  const rv = e.target.closest('[data-review]');
  if (rv) review(rv.dataset.review);
  if (e.target.closest('[data-act=trash]')) {
   const id = $('#jform', root).dataset.id;
   if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: queda guardada en la papelera.', 'It is not deleted: it stays in the bin.'), yes: t('A la papelera', 'To the bin'), danger: true})) return;
   await trashDoc(id); toast(t('En la papelera.', 'Moved to the bin.')); go('diario');
  }
 });
 // Fotos del día: se guardan con la entrada; «Quitar» la retira sin borrarla.
 root.addEventListener('change', async e => {
  if (e.target.id !== 'jphoto' || !e.target.files?.length) return;
  for (const f of [...e.target.files].slice(0, 6)) { try { jpics.push({path: await uploadImage('diario', await shrinkImage(f)), at: new Date().toISOString()}); } catch { toast(t('No se pudo guardar una foto.', 'A photo could not be saved.'), 'error'); } }
  e.target.value = ''; paintPics(root);
 });
 root.addEventListener('click', e => { const q = e.target.closest('[data-unpic]'); if (!q) return; const p = jpics.find(x => x.path === q.dataset.unpic); if (p) p.deleted_at = new Date().toISOString(); paintPics(root); });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'jform') return;
  e.preventDefault();
  const f = e.target, id = f.dataset.id, val = k => $('#j-' + k, f).value.trim();
  const patch = {day: $('#jday', f).value || dayKey(), service: $('#jservice', f).value, covers: Math.max(0, parseInt($('#jcovers', f).value, 10) || 0) || null, mood: Number(f.querySelector('input[name=jmood]:checked')?.value) || null,
   good: val('good'), bad: val('bad'), learned: val('learned'), ideas: val('ideas'), dishes: $$('.jdishes input:checked', f).map(x => x.value), images: jpics};
  patch.dishNames = patch.dishes.map(d => state.dishes.find(x => x.id === d)?.name).filter(Boolean);
  if (!patch.good && !patch.bad && !patch.learned && !patch.ideas && !patch.covers && !jpics.some(x => !x.deleted_at)) { toast(t('Escribe al menos una línea.', 'Write at least one line.'), 'error'); return; }
  try { await saveDoc('diario', id === 'nuevo' ? null : id, patch); toast(t('Guardado en tu diario.', 'Saved to your journal.')); go('diario'); }
  catch (err) { toast(friendly(err), 'error'); }
 });
 return null;
}
export function onData(what, root, params) { if (!params[0] && ['remote', 'load'].includes(what)) { const host = root; host.innerHTML = render(params); } }

let jpics = [];
const picsHtml = () => jpics.filter(x => !x.deleted_at).map(x => '<figure class="jpic"><img data-img="' + esc(x.path) + '" alt="' + esc(t('Foto del día', 'Photo of the day')) + '"><button type="button" class="linkbtn" data-unpic="' + esc(x.path) + '">' + esc(t('Quitar', 'Remove')) + '</button></figure>').join('');
function paintPics(root) { const box = $('#jpics', root); if (box) { box.innerHTML = picsHtml(); hydrateImages(box); } }
