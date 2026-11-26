// I+D · Modo cocina: una receta para usarla con las manos ocupadas. Letra grande, un paso cada vez, la pantalla no se
// apaga, las cantidades se multiplican por las raciones que vas a hacer y cada tiempo de un paso («25 min») es un botón
// que pone un temporizador. Vale para platos, subrecetas y recetas de la Biblioteca.
import {t, en} from '../i18n.js';
import {esc, icon, $, $$} from '../ui.js';
import {dishById, subById} from '../store.js';
import {entryById} from '../saber/index.js';
import {scaleLine, nice, parseNum} from './tools.js';
import {addTimer} from '../timers.js';

export const title = p => (load(p)?.name || t('Modo cocina', 'Cook mode'));
const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
// Separa un texto de elaboración en pasos: por líneas, y si viene en un solo párrafo, por frases numeradas.
export function stepsOf(text) {
 const lines = String(text || '').split(/\n+/).map(x => x.replace(/^\s*(\d+[.)-]|[-•·*])\s*/, '').trim()).filter(Boolean);
 if (lines.length > 1) return lines;
 const one = lines[0] || '';
 const numbered = one.split(/\s(?=\d+[.)]\s)/).map(x => x.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
 return numbered.length > 1 ? numbered : one ? one.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/).map(x => x.trim()).filter(Boolean) : [];
}
// Lo que se va a cocinar, igual venga de donde venga: nombre, raciones de base, grupos de ingredientes y pasos.
function load([kind, id] = []) {
 if (kind === 'plato') {
  const d = dishById(id); if (!d) return null;
  const comps = d.components.filter(c => c.items.length || c.method);
  return {name: d.name, back: '#/plato/' + d.id, base: parseNum(String(d.portions || '').match(/[\d.,]+/)?.[0]) || 1, unit: t('raciones', 'portions'),
   groups: comps.map(c => ({title: c.name || '', items: c.items.map(i => (i.q ? i.q + ' ' : '') + i.n)})).filter(g => g.items.length),
   steps: [...comps.flatMap(c => stepsOf(c.method).map(s => ({text: s, part: c.name || ''}))), ...stepsOf(d.plating).map(s => ({text: s, part: t('Emplatado', 'Plating')}))]};
 }
 if (kind === 'sub') {
  const x = subById(id); if (!x) return null;
  return {name: x.name, back: '#/subreceta/' + x.id, base: 1, unit: t('tandas', 'batches'), note: x.yield ? t('Una tanda rinde ', 'One batch yields ') + x.yield : '',
   groups: [{title: '', items: x.items.map(i => (i.q ? i.q + ' ' : '') + i.n)}], steps: stepsOf(x.method).map(s => ({text: s, part: ''}))};
 }
 if (kind === 'biblioteca') {
  const e = entryById(id); if (!e?.base && !e?.method) return null;
  const forN = parseNum(String(e.base?.for || '').match(/[\d.,]+/)?.[0]) || 1, unit = String(e.base?.for || '').replace(/^[\d.,\s]+/, '').replace(/\s*\(.*$/, '').trim() || t('tandas', 'batches');
  const qty = /^[\d.,/\s–-]+\s*(kg|g|gr|ml|cl|l|ud|uds|unidad(es)?|dientes?|hojas?|ramas?|yemas?|huevos?)?\.?$/i;
  return {name: e.name, back: '#/biblioteca/' + e.id, base: forN, unit,
   groups: e.base?.items?.length ? [{title: '', items: e.base.items.map(([n, q]) => (q && qty.test(q.trim()) ? q.trim() + ' ' + n.charAt(0).toLowerCase() + n.slice(1) : n + (q ? ', ' + q : '')))}] : [],
   steps: [...(e.base?.steps || []), ...(e.method || [])].map(s => ({text: plain(s), part: ''}))};
 }
 return null;
}

// Tiempos dentro de un paso: «25 min», «1 h 30 min», «2-3 minutos», «45 segundos», «2 horas».
export function timesIn(text) {
 const out = [], rx = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|a|–)\s*(\d+(?:[.,]\d+)?))?\s*(h|horas?|min(?:utos?)?|'|seg(?:undos?)?|s)\b(?:\s*(?:y\s*)?(\d+)\s*(min(?:utos?)?))?/gi;
 let m;
 while ((m = rx.exec(text))) {
  const n = parseNum(m[2] || m[1]), u = m[3].toLowerCase(), extra = m[4] ? Number(m[4]) * 60 : 0;
  const secs = (u.startsWith('h') ? n * 3600 : u.startsWith('s') ? n : n * 60) + extra;
  if (secs >= 10 && secs <= 48 * 3600) out.push({label: m[0].trim(), secs});
 }
 return out;
}

let state = {key: '', step: 0, people: 0, lock: null, done: new Set()};
export function render(params) {
 const r = load(params);
 if (!r) return '<a class="back" href="#/libreta">' + icon('left') + esc(t('Libreta', 'Notebook')) + '</a><div class="empty">' + icon('book') + '<h3>' + esc(t('No encuentro esta receta', 'I cannot find this recipe')) + '</h3><p>' + esc(t('Puede que se haya movido o que no tenga ingredientes ni pasos.', 'It may have moved, or it has no ingredients or steps.')) + '</p></div>';
 const key = params.join('/');
 if (state.key !== key) state = {key, step: 0, people: r.base, lock: state.lock, done: new Set()};
 return '<div class="cook"><header class="cook-head"><a class="back" href="' + esc(r.back) + '">' + icon('left') + esc(t('Salir del modo cocina', 'Leave cook mode')) + '</a><h1>' + esc(r.name) + '</h1>' +
  '<div class="cook-scale"><label for="cookN">' + esc(t('Voy a hacer', 'I am making')) + '</label><div class="tinput"><input id="cookN" inputmode="decimal" value="' + esc(nice(state.people)) + '" autocomplete="off"><span>' + esc(r.unit) + '</span></div>' + (r.base !== 1 || r.unit ? '<small>' + esc(t('La receta es para ', 'The recipe is for ') + nice(r.base) + ' ' + r.unit) + '</small>' : '') + '</div>' + (r.note ? '<p class="fine">' + esc(r.note) + '</p>' : '') + '</header>' +
  '<div class="cook-body"><section class="cook-ings" aria-label="' + esc(t('Ingredientes', 'Ingredients')) + '"><h2>' + esc(t('Ingredientes', 'Ingredients')) + '</h2><div id="cookIngs">' + ings(r) + '</div></section>' +
  '<section class="cook-steps" aria-label="' + esc(t('Pasos', 'Steps')) + '"><div id="cookStep">' + step(r) + '</div></section></div></div>';
}
function ings(r) {
 if (!r.groups.length) return '<p class="hint">' + esc(t('Esta receta no tiene ingredientes apuntados.', 'This recipe has no ingredients written down.')) + '</p>';
 const f = state.people / r.base;
 return r.groups.map((g, gi) => (g.title ? '<h3>' + esc(g.title) + '</h3>' : '') + '<ul class="cook-list">' + g.items.map((i, k) => { const id = gi + '-' + k, on = state.done.has(id); return '<li><label class="cook-tick' + (on ? ' is-on' : '') + '"><input type="checkbox" data-ing="' + id + '"' + (on ? ' checked' : '') + '><span>' + esc(f === 1 ? i : scaleLine(i, f)) + '</span></label></li>'; }).join('') + '</ul>').join('');
}
function step(r) {
 const n = r.steps.length;
 if (!n) return '<p class="hint">' + esc(t('Esta receta no tiene pasos apuntados. Escríbelos en la elaboración y aquí saldrán uno a uno.', 'This recipe has no steps written down. Write them in the method and they will show here one at a time.')) + '</p>';
 const k = Math.max(0, Math.min(n - 1, state.step)), s = r.steps[k], times = timesIn(s.text);
 return '<p class="cook-count">' + esc(t('Paso ', 'Step ') + (k + 1) + t(' de ', ' of ') + n) + (s.part ? '<span>' + esc(s.part) + '</span>' : '') + '</p>' +
  '<div class="cook-bar" aria-hidden="true"><i style="width:' + ((k + 1) / n * 100).toFixed(1) + '%"></i></div>' +
  '<p class="cook-text" aria-live="polite">' + esc(s.text) + '</p>' +
  (times.length ? '<div class="chips cook-times">' + times.map(x => '<button type="button" class="chip" data-timer="' + x.secs + '">' + icon('clock') + esc(t('Temporizador ', 'Timer ') + x.label) + '</button>').join('') + '</div>' : '') +
  '<div class="cook-nav"><button type="button" class="btn ghost" data-go="-1"' + (k === 0 ? ' disabled' : '') + '>' + icon('left') + esc(t('Anterior', 'Back')) + '</button><button type="button" class="btn primary" data-go="1"' + (k === n - 1 ? ' disabled' : '') + '>' + esc(k === n - 1 ? t('Último paso', 'Last step') : t('Siguiente', 'Next')) + icon('right') + '</button></div>' +
  (canSpeak() ? '<button type="button" class="linkbtn cook-read" data-read aria-pressed="' + !!state.read + '">' + icon('chat') + esc(state.read ? t('Dejar de leer en voz alta', 'Stop reading aloud') : t('Leer los pasos en voz alta', 'Read the steps aloud')) + '</button>' : '') +
  '<ol class="cook-all">' + r.steps.map((x, i) => '<li' + (i === k ? ' class="is-now"' : i < k ? ' class="is-past"' : '') + '><button type="button" data-step="' + i + '">' + esc(x.text) + '</button></li>').join('') + '</ol>';
}
// Leer en voz alta: con las manos ocupadas, cada paso se oye al llegar a él.
const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
function say(text) {
 if (!canSpeak()) return;
 try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = en() ? 'en-GB' : 'es-ES'; u.rate = 0.95; speechSynthesis.speak(u); } catch {}
}
// La pantalla no se apaga mientras se cocina (si el aparato lo permite).
async function keepAwake() { try { if ('wakeLock' in navigator && !document.hidden) state.lock = await navigator.wakeLock.request('screen'); } catch {} }
export function mount(root, params) {
 const r = load(params);
 if (!r) return null;
 keepAwake();
 const vis = () => { if (!document.hidden) keepAwake(); };
 document.addEventListener('visibilitychange', vis);
 const paintStep = () => { $('#cookStep', root).innerHTML = step(r); if (state.read && r.steps[state.step]) say(t('Paso ', 'Step ') + (state.step + 1) + '. ' + r.steps[state.step].text); };
 root.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'), s = e.target.closest('[data-step]'), tm = e.target.closest('[data-timer]');
  if (g) { state.step += Number(g.dataset.go); paintStep(); $('.cook-text', root)?.focus?.(); }
  if (s) { state.step = Number(s.dataset.step); paintStep(); }
  if (e.target.closest('[data-read]')) { state.read = !state.read; if (!state.read && canSpeak()) speechSynthesis.cancel(); paintStep(); $('[data-read]', root)?.focus(); return; }
  if (tm) addTimer(r.name + ': ' + (r.steps[state.step]?.text || '').slice(0, 30), Number(tm.dataset.timer));
 });
 root.addEventListener('change', e => { const c = e.target.closest('[data-ing]'); if (!c) return; if (c.checked) state.done.add(c.dataset.ing); else state.done.delete(c.dataset.ing); c.closest('.cook-tick').classList.toggle('is-on', c.checked); });
 root.addEventListener('input', e => { if (e.target.id !== 'cookN') return; const n = parseNum(e.target.value); if (n > 0) { state.people = n; $('#cookIngs', root).innerHTML = ings(r); } });
 // Con teclado: flechas para pasar de paso.
 const keys = e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return; if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); state.step = Math.min(r.steps.length - 1, state.step + 1); paintStep(); } if (e.key === 'ArrowLeft') { state.step = Math.max(0, state.step - 1); paintStep(); } };
 document.addEventListener('keydown', keys);
 document.documentElement.classList.add('cooking');
 return () => { document.removeEventListener('visibilitychange', vis); document.removeEventListener('keydown', keys); document.documentElement.classList.remove('cooking'); try { state.lock?.release(); } catch {} try { if (canSpeak()) speechSynthesis.cancel(); } catch {} state.lock = null; };
}
export const cookLink = (kind, id) => '#/cocinar/' + kind + '/' + encodeURIComponent(id);
export {$$, en};
