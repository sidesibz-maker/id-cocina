// I+D · Preguntar: hablar con ChatGPT desde la app, en general o sobre un plato. Con ChatGPT conectado contesta aquí mismo;
// sin conectar, la pregunta se abre ya escrita en ChatGPT. La conversación se guarda en este aparato (sin las fotos).
import {t} from '../i18n.js';
import {esc, icon, $, toast, clip} from '../ui.js';
import {state, dishById, saveDish} from '../store.js';
import {chatInstructions, copy} from '../ai.js';
import {iaOn, askIa, iaMessage, imageData} from '../ia.js';
import {iaSheet} from './ia-sheet.js';

const KEY = 'id-cocina-preguntas', MAX = 40;
let pending = [], busy = false, controller = null;
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const thread = ctx => (Array.isArray(load()[ctx]) ? load()[ctx] : []);
function store(ctx, list) { const all = load(); all[ctx] = list.slice(-MAX); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} }

export const title = () => t('Preguntar', 'Ask');
// Texto de la respuesta con un formato mínimo: párrafos, listas y negritas.
export function rich(text) {
 const out = [];
 let list = null;
 for (const raw of String(text).split('\n')) {
  const line = raw.trim(), item = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^#+\s*/, '');
  if (item) { if (!list) { list = []; out.push(list); } list.push('<li>' + fmt(item[1]) + '</li>'); continue; }
  list = null;
  if (line) out.push(/^#{1,4}\s/.test(line) ? '<p><strong>' + fmt(line) + '</strong></p>' : '<p>' + fmt(line) + '</p>');
 }
 return out.map(x => (Array.isArray(x) ? '<ul>' + x.join('') + '</ul>' : x)).join('');
}
const SUGGEST = dish => (dish
 ? [t('¿Qué le falta a este plato?', 'What is this dish missing?'), t('¿Cómo lo saco rápido en pleno servicio?', 'How do I send it out fast in a full service?'), t('Dame una salsa distinta para este plato', 'Give me a different sauce for this dish'), t('¿Con qué vino o bebida lo acompaño?', 'What wine or drink goes with it?')]
 : [t('Una salsa nueva para el pescado a la brasa', 'A new sauce for charcoal-grilled fish'), t('¿Cómo aprovecho los recortes de atún?', 'How do I use tuna trimmings?'), t('Un postre de invierno que no lleve horno', 'A winter dessert with no oven'), t('¿Qué guarnición le pongo a la carrillera?', 'What side goes with pork cheek?')]);
function msgHtml(m, k, dish) {
 if (m.role === 'user') return '<li class="msg msg-me">' + (m.photos ? '<span class="msg-photo">' + icon('image') + esc(m.photos === 1 ? t('1 foto', '1 photo') : m.photos + t(' fotos', ' photos')) + '</span>' : '') + '<p>' + esc(m.text) + '</p></li>';
 return '<li class="msg msg-ai"><div class="msg-body">' + rich(m.text) + '</div><div class="msg-actions"><button type="button" class="linkbtn" data-copy="' + k + '">' + icon('copy') + esc(t('Copiar', 'Copy')) + '</button>' + (dish ? '<button type="button" class="linkbtn" data-note="' + k + '">' + icon('book') + esc(t('Guardar en las notas del plato', 'Save to the dish notes')) + '</button>' : '') + '</div></li>';
}
export function render(params) {
 const dish = params[0] ? dishById(params[0]) : null, ctx = dish ? dish.id : 'general', list = thread(ctx), on = iaOn();
 return (dish ? '<a class="back" href="#/plato/' + esc(dish.id) + '">' + icon('left') + esc(dish.name) + '</a>' : '') +
  '<header class="page-head"><h1>' + esc(t('Preguntar', 'Ask')) + '</h1><p>' + esc(dish ? t('Pregunta lo que quieras sobre «' + dish.name + '». ChatGPT ya conoce el plato y tu cocina.', 'Ask anything about “' + dish.name + '”. ChatGPT already knows the dish and your kitchen.') : t('Pregunta lo que quieras de cocina. ChatGPT ya conoce tu cocina y tus básicos. También puedes mandarle una foto.', 'Ask anything about cooking. ChatGPT already knows your kitchen and staples. You can also send a photo.')) + '</p></header>' +
  (on ? '' : '<div class="notice" role="status">' + icon('info') + '<p><strong>' + esc(t('ChatGPT no está conectado a la app.', 'ChatGPT is not connected to the app.')) + '</strong> ' + esc(t('Tu pregunta se abrirá ya escrita en ChatGPT. Para que conteste aquí mismo, conéctalo.', 'Your question will open already written in ChatGPT. To get the answer right here, connect it.')) + ' <button type="button" class="linkbtn" data-act="connect">' + esc(t('Conectar ChatGPT', 'Connect ChatGPT')) + '</button></p></div>') +
  '<section class="chat card">' + (list.length ? '<div class="chat-top"><button type="button" class="linkbtn" data-act="clear">' + icon('refresh') + esc(t('Empezar una conversación nueva', 'Start a new conversation')) + '</button></div>' : '') + '<ol class="msgs" id="msgs" aria-live="polite">' + list.map((m, k) => msgHtml(m, k, dish)).join('') + (busy ? '<li class="msg msg-ai msg-wait">' + esc(t('Pensando…', 'Thinking…')) + '</li>' : '') + '</ol>' +
  (list.length ? '' : '<div class="chips" id="suggest">' + SUGGEST(dish).map(q => '<button type="button" class="chip" data-suggest>' + esc(q) + '</button>').join('') + '</div>') +
  '<form id="askForm" class="composer"><div id="pending" class="pending"></div><label class="sr" for="askText">' + esc(t('Tu pregunta', 'Your question')) + '</label><textarea id="askText" data-voice rows="2" maxlength="4000" placeholder="' + esc(t('Escribe tu pregunta…', 'Type your question…')) + '"></textarea>' +
  '<div class="composer-row"><label class="btn ghost" for="askPhoto" title="' + esc(t('Añadir foto o captura', 'Add photo or screenshot')) + '">' + icon('image') + '<span>' + esc(t('Foto', 'Photo')) + '</span></label><input id="askPhoto" class="sr" type="file" accept="image/*" multiple' + (on ? '' : ' disabled') + '>' +
  '<button type="submit" class="btn primary">' + icon('send') + '<span>' + esc(on ? t('Preguntar', 'Ask') : t('Preguntar en ChatGPT', 'Ask in ChatGPT')) + '</span></button></div></form></section>';
}
export function mount(root, params) {
 const dish = params[0] ? dishById(params[0]) : null, ctx = dish ? dish.id : 'general';
 const repaint = () => { if (!root.isConnected) return; const text = $('#askText', root)?.value || ''; root.innerHTML = render(params); const box = $('#askText', root); if (box) box.value = text; drawPending(); const m = $('#msgs', root); m?.lastElementChild?.scrollIntoView({block: 'nearest'}); };
 const drawPending = () => { const p = $('#pending', root); if (p) p.innerHTML = pending.map((_, k) => '<span class="chip chip-static">' + icon('image') + esc(t('Foto ', 'Photo ') + (k + 1)) + '<button type="button" class="iconbtn" data-unpend="' + k + '" aria-label="' + esc(t('Quitar foto', 'Remove photo')) + '">' + icon('x') + '</button></span>').join(''); };
 pending = [];
 async function send(text) {
  text = String(text || '').trim().slice(0, 4000);
  if (!text && !pending.length) { $('#askText', root)?.focus(); return; }
  if (!iaOn()) {
   const q = text || t('Te paso una foto.', 'Here is a photo.'), full = chatInstructions(dish) + '\n\nPREGUNTA:\n' + q, u = encodeURIComponent(full);
   await copy(full);
   window.open(u.length <= 9000 ? 'https://chatgpt.com/?q=' + u : 'https://chatgpt.com/', '_blank', 'noopener');
   return;
  }
  if (busy) return;
  const list = thread(ctx), photos = pending.slice();
  const mine = {role: 'user', text: text || t('Mira esta foto.', 'Look at this photo.'), ...(photos.length ? {photos: photos.length} : {})};
  store(ctx, [...list, mine]); pending = []; busy = true;
  const box = $('#askText', root); if (box) box.value = '';
  repaint();
  controller = new AbortController();
  try {
   const turns = [...list.slice(-12), mine].map((m, k, all) => ({role: m.role, text: m.text, ...(k === all.length - 1 && photos.length ? {images: photos} : {})}));
   const answer = await askIa({instructions: chatInstructions(dish), turns, signal: controller.signal});
   store(ctx, [...thread(ctx), {role: 'assistant', text: answer.trim()}]);
  } catch (e) {
   if (e?.name !== 'AbortError') toast(iaMessage(e), 'error', 7000);
  } finally { busy = false; controller = null; repaint(); }
 }
 root.addEventListener('submit', e => { if (e.target.id === 'askForm') { e.preventDefault(); send($('#askText', root).value); } });
 root.addEventListener('keydown', e => { if (e.target.id === 'askText' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(e.target.value); } });
 root.addEventListener('change', async e => {
  if (e.target.id !== 'askPhoto') return;
  for (const f of [...e.target.files].slice(0, 4 - pending.length)) { try { pending.push(await imageData(f)); } catch { toast(t('No se pudo leer esa imagen.', 'That image could not be read.'), 'error'); } }
  e.target.value = ''; drawPending();
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-suggest')) { send(b.textContent); return; }
  if (b.dataset.unpend) { pending.splice(Number(b.dataset.unpend), 1); drawPending(); return; }
  if (b.dataset.act === 'connect') { iaSheet(repaint); return; }
  if (b.dataset.act === 'clear') { store(ctx, []); repaint(); return; }
  const list = thread(ctx);
  if (b.dataset.copy) { const done = await copy(list[Number(b.dataset.copy)]?.text || ''); toast(done ? t('Copiado.', 'Copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  if (b.dataset.note && dish) {
   const m = list[Number(b.dataset.note)];
   if (!m) return;
   const fresh = dishById(dish.id), q = list[Number(b.dataset.note) - 1];
   const add = (q?.role === 'user' ? '— ' + q.text + '\n' : '') + m.text.trim();
   const notes = [fresh?.notes || '', add].filter(Boolean).join('\n\n');
   // Nunca se recortan las notas que ya hay: si no cabe, se avisa.
   if (notes.length > 6000) { toast(t('Las notas del plato están llenas. Copia la respuesta y guárdala donde quieras.', 'The dish notes are full. Copy the answer and keep it elsewhere.'), 'error', 6000); return; }
   try { await saveDish(dish.id, {notes}); b.disabled = true; toast(t('Guardado en las notas del plato.', 'Saved to the dish notes.')); }
   catch { toast(t('No se pudo guardar.', 'It could not be saved.'), 'error'); }
  }
 });
 return () => { controller?.abort(); busy = false; };
}
export function onData() {}
