// I+D · Mi trayectoria: tu carrera de cocinero en un sitio. Quién eres en cocina, dónde has trabajado y qué aprendiste,
// formación, técnicas que dominas (y cuántas veces las has usado en tus platos), platos firma, objetivos con sus pasos
// y logros. Con todo eso, un dossier listo para imprimir o guardar en PDF y llevarlo a una entrevista o un stage.
// Todo son documentos «carrera:…», «puesto:…», «formacion:…», «objetivo:…» y «logro:…»: van en la copia y se sincronizan.
import {TECHNIQUES} from '../flavor-core.js';
import {discoverHtml, bindDiscover} from './discover.js';
import {t, en, locale, dayKey} from '../i18n.js';
import {esc, icon, $, $$, toast, sheet, ask, friendly, flavorPrint} from '../ui.js';
import {state, liveDocs, docById, saveDoc, trashDoc, liveDishes, imageUrl} from '../store.js';
import {courseLabel, statusLabel, dishThumb} from './shared.js';
import {entries} from '../saber/index.js';

export const title = () => t('Mi trayectoria', 'My career');
const PERFIL = 'carrera:perfil';
const profile = () => docById(PERFIL) || {};
const LEVELS = [[0, 'Sin marcar', 'Not set'], [1, 'Aprendiendo', 'Learning'], [2, 'La controlo', 'Comfortable'], [3, 'La domino', 'Mastered']];
const lv = n => { const r = LEVELS.find(x => x[0] === Number(n)) || LEVELS[0]; return en() ? r[2] : r[1]; };
const byDate = (a, b) => String(b.from || b.when || b.due || '').localeCompare(String(a.from || a.when || a.due || ''));
const ym = v => (v ? new Date(v + (v.length === 7 ? '-15' : '') + 'T12:00:00').toLocaleDateString(locale(), {month: 'short', year: 'numeric'}) : '');
const period = x => (x.from ? ym(x.from) : '') + (x.from || x.to ? ' – ' : '') + (x.to ? ym(x.to) : x.from ? t('hoy', 'now') : '');
// Cuántas veces sale cada técnica en tus platos.
function techUse() {
 const n = {};
 for (const d of liveDishes()) for (const c of d.components) for (const id of c.techniques || []) n[id] = (n[id] || 0) + 1;
 return n;
}
const skills = () => profile().skills || {};
const signature = () => (profile().signature || []).map(id => state.dishes.find(d => d.id === id && !d.deleted_at)).filter(Boolean);

function numbers() {
 const year = String(new Date().getFullYear()), dishes = liveDishes(), journal = liveDocs('diario');
 return [
  [dishes.filter(d => String(d.created_at || '').startsWith(year)).length, t('platos creados este año', 'dishes created this year')],
  [dishes.reduce((a, d) => a + (d.tests || []).filter(x => String(x.at || x.date || '').startsWith(year)).length, 0), t('pruebas de cata este año', 'tastings this year')],
  [journal.filter(e => String(e.day).startsWith(year)).length, t('días en el diario', 'days in the journal')],
  [Object.values(skills()).filter(v => Number(v) === 3).length, t('técnicas dominadas', 'techniques mastered')],
  [liveDocs('objetivo').filter(g => g.done_at).length + liveDocs('logro').length, t('logros', 'achievements')]
 ];
}

export function render() {
 const p = profile(), jobs = liveDocs('puesto').sort(byDate), courses = liveDocs('formacion').sort(byDate), goals = liveDocs('objetivo').sort((a, b) => (!!a.done_at - !!b.done_at) || String(a.due || '9').localeCompare(String(b.due || '9'))), wins = [...liveDocs('logro'), ...goals.filter(g => g.done_at).map(g => ({...g, when: g.done_at.slice(0, 10), fromGoal: true}))].sort(byDate);
 const sig = signature(), used = techUse(), sk = skills(), firstYear = Number(p.since) || null;
 return '<header class="page-head page-head-row"><div><h1>' + esc(t('Mi trayectoria', 'My career')) + '</h1><p>' + esc(t('Tu carrera en un sitio: de dónde vienes, qué dominas y a dónde vas. Con un toque, tu dossier para una entrevista o un stage.', 'Your career in one place: where you come from, what you master and where you are going. One tap gives you a dossier for an interview or a stage.')) + '</p></div>' +
  '<div class="row-actions"><button type="button" class="btn ghost" data-act="year">' + icon('star') + esc(t('Mi año en cocina', 'My year in the kitchen')) + '</button><a class="btn ghost" href="#/estilo">' + icon('wheel') + esc(t('Tu estilo', 'Your style')) + '</a><button type="button" class="btn primary" data-act="dossier">' + icon('down') + esc(t('Ver mi dossier', 'See my dossier')) + '</button></div></header>' +
  '<div class="stats cstats">' + numbers().map(([n, l]) => '<div class="stat"><strong>' + n + '</strong><span>' + esc(l) + '</span></div>').join('') + '</div>' +
  // Perfil
  '<section class="card csec"><div class="csec-head"><h2>' + esc(t('Quién eres en cocina', 'Who you are in the kitchen')) + '</h2><button type="button" class="linkbtn" data-act="profile">' + icon('edit') + esc(t('Editar', 'Edit')) + '</button></div>' +
  (p.name || p.role || p.philosophy ? '<div class="cprofile"><p class="cname">' + esc(p.name || state.settings?.name || t('Tu nombre', 'Your name')) + '</p><p class="crole">' + esc([p.role, p.place, p.city].filter(Boolean).join(', ')) + '</p>' + (firstYear ? '<p class="fine">' + esc(t('En cocina desde ', 'Cooking since ') + firstYear + ' (' + (new Date().getFullYear() - firstYear) + t(' años)', ' years)')) + '</p>' : '') + (p.philosophy ? '<blockquote class="cphil">' + esc(p.philosophy) + '</blockquote>' : '') + (p.languages ? '<p class="fine">' + esc(t('Idiomas: ', 'Languages: ') + p.languages) + '</p>' : '') + '</div>'
   : '<p class="hint">' + esc(t('Empieza por aquí: tu puesto, dónde estás y tu cocina en una frase.', 'Start here: your role, where you are and your cooking in one sentence.')) + '</p>') + '</section>' +
  // Objetivos
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Objetivos', 'Goals')) + '</h2><p>' + esc(t('Lo que quieres conseguir, partido en pasos. Cuando lo cumples, pasa a tus logros.', 'What you want to achieve, broken into steps. When you do it, it moves to your achievements.')) + '</p></div><button type="button" class="btn ghost" data-act="goal">' + icon('plus') + esc(t('Nuevo objetivo', 'New goal')) + '</button></header>' +
  (goals.filter(g => !g.done_at).length ? '<div class="cgoals">' + goals.filter(g => !g.done_at).map(goalCard).join('') + '</div>' : '<p class="hint">' + esc(t('Ideas: dominar la masa madre, hacer un stage en un restaurante que admiras, llevar la partida de carnes, sacar tu primer menú degustación.', 'Ideas: master sourdough, do a stage at a restaurant you admire, run the meat section, put out your first tasting menu.')) + '</p>') + '</section>' +
  // Técnicas
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Técnicas', 'Techniques')) + '</h2><p>' + esc(t('Marca cómo vas con cada una. El número es cuántas veces la usas en tus platos.', 'Mark how you are doing with each one. The number is how often you use it in your dishes.')) + '</p></div></header>' +
  '<div class="cskills">' + TECHNIQUES.map(([id, es, eng]) => '<button type="button" class="cskill" data-skill="' + esc(id) + '" data-level="' + (Number(sk[id]) || 0) + '"><span class="cskill-name">' + esc(en() ? eng : es) + '</span><span class="cskill-lv">' + esc(lv(sk[id])) + '</span>' + (used[id] ? '<small>' + used[id] + (used[id] === 1 ? t(' plato', ' dish') : t(' platos', ' dishes')) + '</small>' : '') + '<i class="cskill-bar" aria-hidden="true"><b></b><b></b><b></b></i></button>').join('') + '</div>' + learnLinks() + '</section>' +
  // Platos firma
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Platos firma', 'Signature dishes')) + '</h2><p>' + esc(t('Los platos de tu libreta que mejor te representan. Salen en tu dossier con su foto.', 'The dishes from your notebook that best represent you. They appear in your dossier with their photo.')) + '</p></div><button type="button" class="btn ghost" data-act="signature">' + icon('star') + esc(t('Elegir', 'Choose')) + '</button></header>' +
  (sig.length ? '<div class="csig">' + sig.map(d => '<a class="csig-card" href="#/plato/' + esc(d.id) + '"><span class="csig-media">' + (d.cover_path ? '<img data-img="' + esc(d.cover_path) + '" alt="">' : dishThumb(d)) + '</span><strong>' + esc(d.name) + '</strong><small>' + esc(courseLabel(d.course) + ', ' + statusLabel(d.status).toLowerCase()) + '</small></a>').join('') + '</div>' : '<p class="hint">' + esc(t('Aún no has elegido ninguno.', 'You have not chosen any yet.')) + '</p>') + '</section>' +
  // Experiencia y formación
  '<div class="cduo"><section class="sec"><header class="sec-head"><div><h2>' + esc(t('Experiencia', 'Experience')) + '</h2></div><button type="button" class="btn ghost" data-act="job">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></header>' + (jobs.length ? '<ol class="ctime">' + jobs.map(j => '<li><button type="button" class="ctime-item" data-edit="' + esc(j.id) + '"><small>' + esc(period(j)) + '</small><strong>' + esc(j.role || '') + (j.place ? t(' en ', ' at ') + j.place : '') + '</strong>' + (j.city ? '<span>' + esc(j.city) + '</span>' : '') + (j.learned ? '<p>' + esc(j.learned) + '</p>' : '') + '</button></li>').join('') + '</ol>' : '<p class="hint">' + esc(t('Cada cocina por la que has pasado y lo que te llevaste de ella.', 'Every kitchen you have been through and what you took from it.')) + '</p>') + '</section>' +
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Formación y cursos', 'Training and courses')) + '</h2></div><button type="button" class="btn ghost" data-act="course">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></header>' + (courses.length ? '<ol class="ctime">' + courses.map(c => '<li><button type="button" class="ctime-item" data-edit="' + esc(c.id) + '"><small>' + esc(period(c)) + '</small><strong>' + esc(c.title || '') + '</strong>' + (c.place ? '<span>' + esc(c.place) + '</span>' : '') + (c.learned ? '<p>' + esc(c.learned) + '</p>' : '') + '</button></li>').join('') + '</ol>' : '<p class="hint">' + esc(t('Escuela, cursos, masterclass, stages cortos, certificados (manipulador, alérgenos…).', 'School, courses, masterclasses, short stages, certificates (food handling, allergens…).')) + '</p>') + '</section></div>' +
  discoverHtml() +
  // Logros
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Logros', 'Achievements')) + '</h2></div><button type="button" class="btn ghost" data-act="win">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></header>' +
  (wins.length ? '<ul class="cwins">' + wins.map(w => '<li>' + icon(w.fromGoal ? 'check' : 'star') + '<div><strong>' + esc(w.title) + '</strong><small>' + esc(w.when ? new Date(w.when + 'T12:00:00').toLocaleDateString(locale(), {day: 'numeric', month: 'long', year: 'numeric'}) : '') + (w.fromGoal ? t(', objetivo cumplido', ', goal achieved') : '') + '</small>' + (w.note ? '<p>' + esc(w.note) + '</p>' : '') + '</div>' + (w.fromGoal ? '' : '<button type="button" class="iconbtn" data-edit="' + esc(w.id) + '" aria-label="' + esc(t('Editar', 'Edit')) + '">' + icon('edit') + '</button>') + '</li>').join('') + '</ul>' : '<p class="hint">' + esc(t('Un ascenso, un premio, una buena crítica, tu primer plato en carta, un stage terminado.', 'A promotion, an award, a good review, your first dish on the menu, a finished stage.')) + '</p>') + '</section>';
}
// Las técnicas que tienen ficha en la Biblioteca, para aprenderlas o repasarlas.
function learnLinks() {
 const list = entries().filter(e => e.technique && TECHNIQUES.some(x => x[0] === e.technique));
 return list.length ? '<p class="fine clearn">' + icon('library') + esc(t('Aprende o repasa en la Biblioteca:', 'Learn or review in the Library:')) + '</p><div class="chips">' + list.map(e => '<a class="chip" href="#/biblioteca/' + esc(e.id) + '">' + esc(e.name) + '</a>').join('') + '</div>' : '';
}
function goalCard(g) {
 const steps = g.steps || [], done = steps.filter(s => s.done).length, late = g.due && g.due < dayKey();
 return '<article class="cgoal" data-goal="' + esc(g.id) + '"><header><strong>' + esc(g.title) + '</strong>' + (g.due ? '<small class="' + (late ? 'is-late' : '') + '">' + esc((late ? t('Se pasó el ', 'Was due ') : t('Para el ', 'By ')) + new Date(g.due + 'T12:00:00').toLocaleDateString(locale(), {day: 'numeric', month: 'long', year: 'numeric'})) + '</small>' : '') + '</header>' +
  (g.why ? '<p class="cgoal-why">' + esc(g.why) + '</p>' : '') +
  (steps.length ? '<div class="cgoal-bar" aria-hidden="true"><i style="width:' + (done / steps.length * 100).toFixed(0) + '%"></i></div><ul class="cgoal-steps">' + steps.map((s, k) => '<li><label class="cook-tick' + (s.done ? ' is-on' : '') + '"><input type="checkbox" data-step="' + k + '"' + (s.done ? ' checked' : '') + '><span>' + esc(s.text) + '</span></label></li>').join('') + '</ul>' : '') +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-edit="' + esc(g.id) + '">' + icon('edit') + esc(t('Editar', 'Edit')) + '</button><button type="button" class="btn primary" data-done="' + esc(g.id) + '">' + icon('check') + esc(t('¡Conseguido!', 'Achieved!')) + '</button></div></article>';
}

// ---------- Formularios ----------
const input = (id, label, value = '', {type = 'text', ph = '', rows = 0, max = 300} = {}) => '<div class="tfield"><label for="' + id + '">' + esc(label) + '</label>' + (rows ? '<textarea id="' + id + '" rows="' + rows + '" maxlength="' + max + '" data-voice placeholder="' + esc(ph) + '">' + esc(value || '') + '</textarea>' : '<input id="' + id + '" type="' + type + '" maxlength="' + max + '" value="' + esc(value || '') + '" placeholder="' + esc(ph) + '" autocomplete="off">') + '</div>';
const FORMS = {
 perfil: {title: () => t('Quién eres en cocina', 'Who you are in the kitchen'), fields: x => input('f-name', t('Nombre', 'Name'), x.name || state.settings?.name) + '<div class="tpair">' + input('f-role', t('Puesto', 'Role'), x.role, {ph: t('Jefe de cocina, segundo, jefe de partida…', 'Head chef, sous chef, chef de partie…')}) + input('f-place', t('Dónde', 'Where'), x.place, {ph: t('Restaurante', 'Restaurant')}) + '</div><div class="tpair">' + input('f-city', t('Ciudad', 'City'), x.city) + input('f-since', t('En cocina desde (año)', 'Cooking since (year)'), x.since, {type: 'number'}) + '</div>' + input('f-philosophy', t('Tu cocina en una o dos frases', 'Your cooking in one or two sentences'), x.philosophy, {rows: 3, max: 600, ph: t('Producto de la isla, brasa y temporada; platos para compartir que se entienden al primer bocado.', 'Island produce, fire and season; sharing dishes you get at first bite.')}) + input('f-languages', t('Idiomas', 'Languages'), x.languages) + input('f-contact', t('Contacto para el dossier (opcional)', 'Contact for the dossier (optional)'), x.contact, {ph: t('Correo, teléfono o Instagram', 'Email, phone or Instagram')}),
  read: () => ({name: v('f-name'), role: v('f-role'), place: v('f-place'), city: v('f-city'), since: v('f-since'), philosophy: v('f-philosophy'), languages: v('f-languages'), contact: v('f-contact')})},
 puesto: {title: () => t('Experiencia', 'Experience'), fields: x => '<div class="tpair">' + input('f-role', t('Puesto', 'Role'), x.role) + input('f-place', t('Restaurante o empresa', 'Restaurant or company'), x.place) + '</div>' + input('f-city', t('Ciudad', 'City'), x.city) + '<div class="tpair">' + input('f-from', t('Desde', 'From'), x.from, {type: 'month'}) + input('f-to', t('Hasta (vacío si sigues)', 'To (empty if still there)'), x.to, {type: 'month'}) + '</div>' + input('f-learned', t('Qué hacías y qué aprendiste', 'What you did and learned'), x.learned, {rows: 4, max: 1500}),
  read: () => ({role: v('f-role'), place: v('f-place'), city: v('f-city'), from: v('f-from'), to: v('f-to'), learned: v('f-learned')}), need: x => x.role || x.place},
 formacion: {title: () => t('Formación o curso', 'Training or course'), fields: x => input('f-title', t('Qué', 'What'), x.title, {ph: t('Grado superior de cocina, curso de fermentación…', 'Culinary diploma, fermentation course…')}) + input('f-place', t('Dónde o con quién', 'Where or with whom'), x.place) + '<div class="tpair">' + input('f-from', t('Desde', 'From'), x.from, {type: 'month'}) + input('f-to', t('Hasta', 'To'), x.to, {type: 'month'}) + '</div>' + input('f-learned', t('Lo que te llevaste', 'What you took away'), x.learned, {rows: 3, max: 1000}),
  read: () => ({title: v('f-title'), place: v('f-place'), from: v('f-from'), to: v('f-to'), learned: v('f-learned')}), need: x => x.title},
 objetivo: {title: () => t('Objetivo', 'Goal'), fields: x => input('f-title', t('Qué quieres conseguir', 'What you want to achieve'), x.title, {ph: t('Dominar la masa madre', 'Master sourdough')}) + input('f-why', t('Para qué', 'Why'), x.why, {rows: 2, max: 500}) + input('f-due', t('Para cuándo', 'By when'), x.due, {type: 'date'}) + input('f-steps', t('Pasos, uno por línea', 'Steps, one per line'), (x.steps || []).map(s => s.text).join('\n'), {rows: 5, max: 2000, ph: t('Leer sobre fermentación\nHacer una madre y alimentarla 2 semanas\nUn pan a la semana y apuntarlo en el diario', 'Read about fermentation\nMake a starter and feed it for 2 weeks\nOne loaf a week, logged in the journal')}),
  read: x => { const old = x.steps || []; return {title: v('f-title'), why: v('f-why'), due: v('f-due'), steps: v('f-steps').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 30).map(text => ({text, done: !!old.find(o => o.text === text)?.done}))}; }, need: x => x.title},
 logro: {title: () => t('Logro', 'Achievement'), fields: x => input('f-title', t('Qué', 'What'), x.title, {ph: t('Primer plato en carta, ascenso a segundo…', 'First dish on the menu, promoted to sous chef…')}) + input('f-when', t('Cuándo', 'When'), x.when, {type: 'date'}) + input('f-note', t('Nota', 'Note'), x.note, {rows: 2, max: 600}),
  read: () => ({title: v('f-title'), when: v('f-when'), note: v('f-note')}), need: x => x.title}
};
let formRoot = null;
const v = id => ($('#' + id, formRoot)?.value || '').trim();
function form(type, id = null) {
 const f = FORMS[type], x = id ? docById(id) || {} : type === 'perfil' ? profile() : {};
 const s = sheet({title: f.title(), wide: true, body: '<form id="cform">' + f.fields(x) + '<div class="row-actions">' + (id && type !== 'perfil' ? '<button type="button" class="btn danger" data-del>' + icon('trash') + esc(t('A la papelera', 'To the bin')) + '</button>' : '') + '<button type="submit" class="btn primary">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div></form>'});
 formRoot = s.el;
 $('#cform', s.el).onsubmit = async e => {
  e.preventDefault();
  const patch = f.read(x);
  if (f.need && !f.need(patch)) { toast(t('Rellena al menos el primer campo.', 'Fill in at least the first field.'), 'error'); return; }
  try { await saveDoc(type === 'perfil' ? 'carrera' : type, type === 'perfil' ? PERFIL : id, type === 'perfil' ? {...profile(), ...patch} : patch); s.close(); toast(t('Guardado.', 'Saved.')); }
  catch (err) { toast(friendly(err), 'error'); }
 };
 const del = $('[data-del]', s.el);
 if (del) del.onclick = async () => { if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), yes: t('A la papelera', 'To the bin'), danger: true})) return; await trashDoc(id); s.close(); };
}
function pickSignature() {
 const chosen = new Set(profile().signature || []), dishes = liveDishes();
 if (!dishes.length) { toast(t('Primero crea platos en tu libreta.', 'Create dishes in your notebook first.')); return; }
 const s = sheet({title: t('Platos firma', 'Signature dishes'), wide: true, body: '<p class="lead">' + esc(t('Elige hasta 6.', 'Choose up to 6.')) + '</p><div class="chips">' + dishes.map(d => '<label class="chip' + (chosen.has(d.id) ? ' chip-have' : '') + '"><input type="checkbox" class="sr" value="' + esc(d.id) + '"' + (chosen.has(d.id) ? ' checked' : '') + '>' + esc(d.name) + '</label>').join('') + '</div><div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>'});
 s.el.addEventListener('change', e => { const c = e.target.closest('input'); if (!c) return; if (c.checked && $$('input:checked', s.el).length > 6) { c.checked = false; toast(t('Como mucho 6.', 'At most 6.')); } c.closest('.chip').classList.toggle('chip-have', c.checked); });
 $('[data-ok]', s.el).onclick = async () => { await saveDoc('carrera', PERFIL, {...profile(), signature: $$('input:checked', s.el).map(x => x.value)}); s.close(); };
}

// ---------- Dossier para imprimir ----------
async function dossier() {
 const p = profile(), jobs = liveDocs('puesto').sort(byDate), courses = liveDocs('formacion').sort(byDate), sk = skills(), sig = signature();
 const wins = [...liveDocs('logro'), ...liveDocs('objetivo').filter(g => g.done_at).map(g => ({title: g.title, when: g.done_at.slice(0, 10)}))].sort(byDate);
 const mastered = TECHNIQUES.filter(([id]) => Number(sk[id]) === 3).map(x => (en() ? x[2] : x[1])), comfy = TECHNIQUES.filter(([id]) => Number(sk[id]) === 2).map(x => (en() ? x[2] : x[1]));
 const pics = await Promise.all(sig.map(d => (d.cover_path ? imageUrl(d.cover_path) : '')));
 let host = document.getElementById('printFicha');
 if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
 host.innerHTML = '<article class="ficha dossier"><header class="dossier-head"><h1>' + esc(p.name || state.settings?.name || '') + '</h1><p class="dossier-role">' + esc([p.role, p.place, p.city].filter(Boolean).join(', ')) + '</p>' + (p.contact ? '<p class="ficha-meta">' + esc(p.contact) + '</p>' : '') + (p.philosophy ? '<p class="ficha-concept">' + esc(p.philosophy) + '</p>' : '') + '</header>' +
  (jobs.length ? '<section class="ficha-comp"><h2>' + esc(t('Experiencia', 'Experience')) + '</h2>' + jobs.map(j => '<div class="dossier-row"><small>' + esc(period(j)) + '</small><div><strong>' + esc(j.role + (j.place ? t(', ', ', ') + j.place : '') + (j.city ? ' (' + j.city + ')' : '')) + '</strong>' + (j.learned ? '<p>' + esc(j.learned) + '</p>' : '') + '</div></div>').join('') + '</section>' : '') +
  (courses.length ? '<section class="ficha-comp"><h2>' + esc(t('Formación', 'Training')) + '</h2>' + courses.map(c => '<div class="dossier-row"><small>' + esc(period(c)) + '</small><div><strong>' + esc(c.title + (c.place ? ', ' + c.place : '')) + '</strong>' + (c.learned ? '<p>' + esc(c.learned) + '</p>' : '') + '</div></div>').join('') + '</section>' : '') +
  (mastered.length || comfy.length ? '<section class="ficha-comp"><h2>' + esc(t('Técnicas', 'Techniques')) + '</h2>' + (mastered.length ? '<p><strong>' + esc(t('Domino: ', 'Mastered: ')) + '</strong>' + esc(mastered.join(', ')) + '</p>' : '') + (comfy.length ? '<p><strong>' + esc(t('Controlo: ', 'Comfortable: ')) + '</strong>' + esc(comfy.join(', ')) + '</p>' : '') + '</section>' : '') +
  (sig.length ? '<section class="ficha-comp"><h2>' + esc(t('Platos firma', 'Signature dishes')) + '</h2><div class="dossier-dishes">' + sig.map((d, k) => '<figure>' + (pics[k] ? '<img src="' + esc(pics[k]) + '" alt="">' : flavorPrint(d.flavor?.axes, {size: 90})) + '<figcaption><strong>' + esc(d.name) + '</strong>' + (d.concept ? '<span>' + esc(d.concept) + '</span>' : '') + '</figcaption></figure>').join('') + '</div></section>' : '') +
  (wins.length ? '<section class="ficha-comp"><h2>' + esc(t('Logros', 'Achievements')) + '</h2><ul>' + wins.map(w => '<li>' + esc(w.title) + (w.when ? ' <small>(' + esc(new Date(w.when + 'T12:00:00').toLocaleDateString(locale(), {month: 'long', year: 'numeric'})) + ')</small>' : '') + '</li>').join('') + '</ul></section>' : '') +
  (p.languages ? '<p class="ficha-line"><strong>' + esc(t('Idiomas: ', 'Languages: ')) + '</strong>' + esc(p.languages) + '</p>' : '') + '</article>';
 const imgs = [...host.querySelectorAll('img')];
 await Promise.all(imgs.map(i => (i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 1500); }))));
 document.documentElement.classList.add('printing');
 const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
 addEventListener('afterprint', done);
 setTimeout(() => print(), 50);
}

export function mount(root) {
 bindDiscover(root);
 root.querySelectorAll('img[data-img]').forEach(async img => { const u = await imageUrl(img.dataset.img); if (u && img.isConnected) img.src = u; });
 root.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]')?.dataset.act, edit = e.target.closest('[data-edit]'), sk = e.target.closest('[data-skill]'), dn = e.target.closest('[data-done]');
  if (a === 'profile') form('perfil');
  if (a === 'job') form('puesto'); if (a === 'course') form('formacion'); if (a === 'goal') form('objetivo'); if (a === 'win') form('logro');
  if (a === 'signature') pickSignature();
  if (a === 'year') { import('./year.js').then(m => m.yearSheet()); return; }
  if (a === 'dossier') { if (!profile().name && !liveDocs('puesto').length) toast(t('Rellena primero «Quién eres en cocina» y tu experiencia.', 'Fill in “Who you are in the kitchen” and your experience first.')); dossier(); }
  if (edit) { const d = docById(edit.dataset.edit); if (d) form(d.type, d.id); }
  if (sk) { const id = sk.dataset.skill, next = ((Number(skills()[id]) || 0) + 1) % 4; await saveDoc('carrera', PERFIL, {...profile(), skills: {...skills(), [id]: next}}); }
  if (dn) { const g = docById(dn.dataset.done); if (!g) return; await saveDoc('objetivo', g.id, {done_at: new Date().toISOString(), steps: (g.steps || []).map(s => ({...s, done: true}))}); toast(t('¡Enhorabuena! Pasa a tus logros.', 'Well done! It moves to your achievements.'), 'info', 5000); }
 });
 root.addEventListener('change', async e => {
  const c = e.target.closest('[data-goal] [data-step]');
  if (!c) return;
  const g = docById(c.closest('[data-goal]').dataset.goal), k = Number(c.dataset.step);
  await saveDoc('objetivo', g.id, {steps: (g.steps || []).map((s, i) => (i === k ? {...s, done: c.checked} : s))});
 });
 return null;
}
