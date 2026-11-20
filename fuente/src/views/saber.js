// I+D · Saber: buscar y leer el cerebro de cocina. Cada entrada se lee ordenada (qué es, receta base, cambios según el uso,
// variantes, claves, errores, historia…), enlaza con otras y guarda tus propias versiones con su historia, sin borrar ninguna.
import {t, en, relDay, shortDate} from '../i18n.js';
import {esc, icon, $, toast, clip} from '../ui.js';
import {state, saberMine, addSaberVersion, saveSaberEntry, trashSaberEntry, liveSubs} from '../store.js';
import {entries, entryById, search, backlinks, CATS, slug, builtIds} from '../saber/index.js';
import {iaOn, askIa, iaMessage} from '../ia.js';
import {copy, parseReply} from '../ai.js';
import {emptyState} from './shared.js';
import {go} from '../nav.js';

let query = '';
export const title = params => (params[0] ? entryById(params[0])?.name || t('Saber', 'Knowledge') : t('Saber', 'Knowledge'));
export const presetSaber = q => { query = String(q || ''); };
const lbl = row => (en() ? row[2] : row[1]);
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Texto con enlaces: [[id]] o [[id|texto]] a otras entradas; lo que no existe se queda como texto.
function linked(text) {
 return esc(text).replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (m, id, label) => { const e = entryById(id.trim()); const show = label || e?.name || id; return e ? '<a class="kref" href="#/saber/' + esc(e.id) + '">' + show + '</a>' : show; });
}
const para = text => String(text || '').split(/\n{2,}/).filter(Boolean).map(p => '<p>' + linked(p).replace(/\n/g, '<br>') + '</p>').join('');

// ---------- Índice y buscador ----------
function row(e) {
 return '<li><a class="krow" href="#/saber/' + esc(e.id) + '"><span class="krow-name">' + esc(e.name) + (saberMine(e.id)?.versions?.length ? '<span class="kmine">' + esc(t('tu versión', 'your version')) + '</span>' : '') + '</span><span class="krow-sum">' + linked(clip(e.summary || '', 160)).replace(/<a[^>]*>|<\/a>/g, '') + '</span></a></li>';
}
function results() {
 const q = query.trim();
 if (!q) return '';
 const list = search(q);
 if (list.length) return '<p class="fine">' + esc(list.length === 1 ? t('1 entrada', '1 entry') : list.length + t(' entradas', ' entries')) + '</p><ul class="krows">' + list.map(row).join('') + '</ul>';
 return emptyState('search', t('«', '“') + q + t('» no está todavía', '” is not here yet'), iaOn() ? t('Puedes pedir a ChatGPT que escriba la entrada con el mismo formato. Luego la revisas y le añades tu versión.', 'Ask ChatGPT to write the entry in the same format. Then check it and add your version.') : t('Puedes pedirla a ChatGPT: copia la petición, pégala allí y trae aquí la respuesta.', 'Ask ChatGPT for it: copy the request, paste it there and bring back the answer.'),
  iaOn() ? '<button type="button" class="btn primary" data-act="create-ia">' + icon('spark') + esc(t('Escribir «', 'Write “') + q + t('» con ChatGPT', '” with ChatGPT')) + '</button>'
   : '<div class="row-actions"><button type="button" class="btn primary" data-act="create-copy">' + icon('copy') + esc(t('Copiar la petición', 'Copy the request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + '</a></div><label class="mini" for="kReply">' + esc(t('Pega aquí la respuesta', 'Paste the answer here')) + '</label><textarea id="kReply" rows="3"></textarea><div class="row-actions"><button type="button" class="btn ghost" data-paste="kReply" data-then="[data-act=create-save]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="create-save">' + icon('check') + esc(t('Guardar la entrada', 'Save the entry')) + '</button></div>');
}
function indexHtml() {
 const all = entries(), recent = Object.values(state.saber || {}).filter(x => x?.versions?.length && !x.deleted_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 6).map(x => entryById(x.id)).filter(Boolean);
 let html = '<header class="page-head"><h1>' + esc(t('Saber', 'Knowledge')) + '</h1><p>' + esc(t('Tu cerebro de cocina: busca una elaboración, una salsa o una técnica y lo tienes todo ordenado, enlazado y con tus propias versiones.', 'Your kitchen brain: search a preparation, a sauce or a technique and get it all in order, linked and with your own versions.')) + '</p></header>' +
  '<label class="sr" for="saberQ">' + esc(t('Buscar en el Saber', 'Search knowledge')) + '</label><div class="searchbox searchbox-big">' + icon('search') + '<input id="saberQ" type="search" value="' + esc(query) + '" placeholder="' + esc(t('Bechamel, fumet, emulsión, croquetas…', 'Béchamel, fish stock, emulsion, croquettes…')) + '" autocomplete="off" enterkeyhint="search"></div>' +
  '<div id="saberRes">' + results() + '</div>';
 if (query.trim()) return html;
 if (recent.length) html += '<section class="sec"><h2 class="day">' + esc(t('Con tu versión', 'With your version')) + '</h2><ul class="krows">' + recent.map(row).join('') + '</ul></section>';
 html += '<div class="kcats">';
 for (const [cat, es, enl] of CATS) {
  const list = all.filter(e => (e.cat || 'conceptos') === cat);
  if (!list.length) continue;
  const groups = [...new Set(list.map(e => e.group || ''))];
  html += '<section class="kcat card"><header class="group-head"><h2>' + esc(en() ? enl : es) + '</h2><span class="group-n">' + list.length + '</span></header>' +
   groups.map(g => (g ? '<h3 class="kgroup">' + esc(g) + '</h3>' : '') + '<ul class="klinks">' + list.filter(e => (e.group || '') === g).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(e => '<li><a href="#/saber/' + esc(e.id) + '">' + esc(e.name) + '</a></li>').join('') + '</ul>').join('') + '</section>';
 }
 html += '</div><p class="fine">' + esc(t(all.length + ' entradas. Escrito para esta app con palabras propias: no reproduce libros. Lo que añadas tú lleva tu nombre y tu historia.', all.length + ' entries. Written for this app in its own words: no books are reproduced. What you add keeps your name and its history.')) + '</p>';
 return html;
}

// ---------- Una entrada ----------
function inDishes(e) {
 const names = [e.name, ...(e.aka || [])].map(norm);
 const dishes = state.dishes.filter(d => !d.deleted_at && d.components.some(c => c.items.some(i => names.includes(norm(i.n))) || names.includes(norm(c.name))));
 const subs = liveSubs().filter(x => names.some(n => norm(x.name).includes(n)));
 return {dishes, subs};
}
function mineHtml(e) {
 const m = saberMine(e.id), vs = (m?.versions || []).slice().reverse(), last = vs[0];
 const start = last ? last.text : (e.base ? (e.base.for ? t('Para ', 'For ') + e.base.for + '\n' : '') + (e.base.items || []).map(x => '- ' + x[0] + ': ' + x[1]).join('\n') + '\n\n' + (e.base.steps || []).map((s, k) => (k + 1) + '. ' + s).join('\n') : '');
 return '<section class="card kmine-card" id="kMine"><h2>' + esc(t('Tu versión', 'Your version')) + '</h2>' +
  (last ? '<div class="kversion"><p class="fine">' + esc(t('Última, ', 'Latest, ') + relDay(last.at).toLowerCase() + (last.by ? t(', de ', ', by ') + last.by : '')) + (last.why ? '. ' + esc(last.why) : '') + '</p><div class="kv-text">' + esc(last.text) + '</div></div>' : '<p class="hint">' + esc(t('Escribe cómo lo haces tú: tus proporciones, tus trucos, para qué platos lo cambias. Cada vez que guardes queda una versión nueva y la anterior se guarda en el historial.', 'Write how you make it: your ratios, your tricks, which dishes you change it for. Each save is a new version and the previous one stays in the history.')) + '</p>') +
  '<label class="mini" for="kText">' + esc(last ? t('Cambiarla', 'Change it') : t('Empieza desde la receta base', 'Start from the base recipe')) + '</label><textarea id="kText" rows="8" maxlength="8000" data-voice>' + esc(start) + '</textarea>' +
  '<label class="mini" for="kWhy">' + esc(t('Qué cambias y por qué (opcional)', 'What you change and why (optional)')) + '</label><input id="kWhy" maxlength="300" placeholder="' + esc(t('p. ej. más espesa para las croquetas de jamón', 'e.g. thicker for the ham croquettes')) + '" autocomplete="off">' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="save-version">' + icon('check') + esc(t('Guardar como versión nueva', 'Save as a new version')) + '</button></div>' +
  (vs.length > 1 ? '<h3>' + esc(t('Cómo ha ido cambiando', 'How it has changed')) + '</h3><ol class="khistory">' + vs.slice(1).map(v => '<li><details><summary><strong>' + esc(shortDate(v.at)) + '</strong>' + (v.why ? ' ' + esc(v.why) : '') + '</summary><div class="kv-text">' + esc(v.text) + '</div></details></li>').join('') + '</ol>' : '') + '</section>';
}
function entryHtml(id) {
 const e = entryById(id);
 const back = '<a class="back" href="#/saber">' + icon('left') + esc(t('Saber', 'Knowledge')) + '</a>';
 if (!e) return back + emptyState('book', t('Esta entrada no está', 'This entry is not here'), t('Búscala en el Saber.', 'Search for it in Knowledge.'));
 const back2 = backlinks(e.id), {dishes, subs} = inDishes(e), sec = (title, body, cls = '') => (body ? '<section class="ksec' + (cls ? ' ' + cls : '') + '"><h2>' + esc(title) + '</h2>' + body + '</section>' : '');
 const base = e.base && (e.base.items || []).length ? '<table class="ktable"><caption>' + esc(t('Para ', 'For ') + (e.base.for || '')) + '</caption><tbody>' + e.base.items.map(x => '<tr><td>' + linked(x[0]) + '</td><td class="q">' + esc(x[1] || '') + '</td></tr>').join('') + '</tbody></table>' + ((e.base.steps || []).length ? '<ol class="ksteps">' + e.base.steps.map(s => '<li>' + linked(s) + '</li>').join('') + '</ol>' : '') : '';
 const ratios = (e.ratios || []).length ? '<table class="ktable kratios"><thead><tr><th>' + esc(t('Para', 'For')) + '</th><th>' + esc(t('Cómo cambia', 'How it changes')) + '</th></tr></thead><tbody>' + e.ratios.map(r => '<tr><td><strong>' + linked(r.use) + '</strong></td><td>' + linked(r.ratio) + (r.note ? '<small>' + linked(r.note) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table>' : '';
 const variants = (e.variants || []).length ? '<ul class="kvariants">' + e.variants.map(v => '<li>' + (v.id && entryById(v.id) ? '<a class="kref" href="#/saber/' + esc(v.id) + '">' + esc(v.name) + '</a>' : '<strong>' + esc(v.name) + '</strong>') + (v.note ? ' ' + linked(v.note) : '') + '</li>').join('') + '</ul>' : '';
 const list = arr => (arr || []).length ? '<ul class="kbullets">' + arr.map(x => '<li>' + linked(x) + '</li>').join('') + '</ul>' : '';
 const errors = (e.errors || []).length ? '<dl class="kerrors">' + e.errors.map(x => '<dt>' + linked(x.p) + '</dt><dd>' + linked(x.fix) + '</dd>').join('') + '</dl>' : '';
 const rel = [...new Set([...(e.related || []), ...back2.map(x => x.id)])].map(entryById).filter(x => x && x.id !== e.id);
 return back + '<article class="kentry"><header class="page-head"><h1>' + esc(e.name) + '</h1>' + (e.aka?.length ? '<p class="kaka">' + esc(t('También: ', 'Also: ') + e.aka.join(', ')) + '</p>' : '') + (e.summary ? '<p class="lead">' + linked(e.summary) + '</p>' : '') + '</header>' +
  '<nav class="jump kjump" aria-label="' + esc(t('Partes de la entrada', 'Parts of the entry')) + '">' + [['kBase', t('Receta base', 'Base recipe'), base], ['kRatios', t('Según el uso', 'By use'), ratios], ['kVar', t('Variantes', 'Variants'), variants], ['kErr', t('Errores', 'Mistakes'), errors], ['kMine', t('Tu versión', 'Your version'), true]].filter(x => x[2]).map(([id, l]) => '<button type="button" data-kjump="' + id + '">' + esc(l) + '</button>').join('') + '</nav>' +
  '<div class="kbody">' +
  sec(t('Qué es', 'What it is'), para(e.what)) +
  (base ? '<section class="ksec" id="kBase"><h2>' + esc(t('Receta base', 'Base recipe')) + '</h2>' + base + '</section>' : '') +
  (ratios ? '<section class="ksec" id="kRatios"><h2>' + esc(t('Cómo cambia según para qué', 'How it changes by use')) + '</h2>' + ratios + '</section>' : '') +
  (variants ? '<section class="ksec" id="kVar"><h2>' + esc(t('Variantes y derivadas', 'Variants and derivatives')) + '</h2>' + variants + '</section>' : '') +
  sec(t('Claves', 'Key points'), list(e.keys)) +
  (errors ? '<section class="ksec" id="kErr"><h2>' + esc(t('Errores y cómo arreglarlos', 'Mistakes and fixes')) + '</h2>' + errors + '</section>' : '') +
  sec(t('Historia y evolución', 'History and evolution'), para(e.history)) +
  sec(t('Usos', 'Uses'), (e.uses || []).length ? '<p>' + e.uses.map(linked).join(', ') + '.</p>' : '') +
  sec(t('Conservación', 'Keeping'), para(e.keep)) +
  sec(t('En producción y en el pase', 'In production and at the pass'), para(e.pro)) +
  '</div>' +
  ((dishes.length || subs.length) ? '<section class="card ksec-mine"><h2>' + esc(t('En tu cocina', 'In your kitchen')) + '</h2><div class="chips">' + dishes.map(d => '<a class="chip" href="#/plato/' + esc(d.id) + '">' + esc(d.name) + '<small>' + esc(t('plato', 'dish')) + '</small></a>').join('') + subs.map(x => '<a class="chip" href="#/subreceta/' + esc(x.id) + '">' + esc(x.name) + '<small>' + esc(t('subreceta', 'sub-recipe')) + '</small></a>').join('') + '</div></section>' : '') +
  mineHtml(e) +
  (rel.length ? '<section class="sec"><h2 class="day">' + esc(t('Relacionado', 'Related')) + '</h2><div class="chips">' + rel.map(x => '<a class="chip" href="#/saber/' + esc(x.id) + '">' + esc(x.name) + '</a>').join('') + '</div></section>' : '') +
  (e.mine ? '<p class="fine center"><button type="button" class="linkbtn" data-act="trash-entry">' + esc(t('Enviar esta entrada a la papelera', 'Move this entry to the bin')) + '</button></p>' : '') +
  '</article>';
}

export const render = params => (params[0] ? entryHtml(params[0]) : indexHtml());

// ---------- Crear una entrada que falta (con ChatGPT) ----------
function createPrompt(topic) {
 const ids = entries().map(e => e.id).join(', ');
 return 'Escribe una entrada de enciclopedia de cocina profesional sobre «' + topic + '», en español de España, para un jefe de cocina de un restaurante mediterráneo de brasa. Texto original con tus palabras (no copies libros ni webs), medidas métricas, proporciones reales, sin inventar datos históricos dudosos. Responde SOLO con un bloque JSON válido con estas claves: ' +
  '{"name","aka":[otros nombres],"cat": "salsas"|"fondos"|"bases"|"conceptos","group","summary": una frase,"what": 2-4 frases,"base":{"for","items":[["ingrediente","cantidad"]],"steps":["..."]},"ratios":[{"use","ratio","note"}] (cómo cambia según para qué se usa),"variants":[{"id": null o un id de la lista,"name","note"}],"keys":[3-6 claves],"errors":[{"p","fix"}],"history": 2-4 frases,"uses":[...],"keep","pro","related":[ids de la lista]}. ' +
  'En los textos puedes enlazar otras entradas como [[id]] o [[id|texto]], solo con estos ids: ' + ids + '.';
}
function entryFromReply(text, topic) {
 const v = parseReply(text);
 if (!v || typeof v !== 'object' || Array.isArray(v) || !String(v.name || topic).trim()) return null;
 const name = clip(String(v.name || topic), 80), taken = new Set(entries().map(e => e.id).concat(builtIds()));
 let id = slug(name) || 'entrada', n = 2;
 while (taken.has(id)) id = slug(name) + '-' + n++;
 const s = x => (typeof x === 'string' ? x.slice(0, 3000) : '');
 const arr = x => (Array.isArray(x) ? x : []);
 return {id, name, aka: arr(v.aka).map(String).slice(0, 8), cat: ['salsas', 'fondos', 'bases', 'conceptos'].includes(v.cat) ? v.cat : 'conceptos', group: s(v.group).slice(0, 60), summary: s(v.summary), what: s(v.what),
  base: v.base && typeof v.base === 'object' ? {for: s(v.base.for), items: arr(v.base.items).filter(Array.isArray).map(x => [String(x[0] || ''), String(x[1] || '')]).slice(0, 30), steps: arr(v.base.steps).map(String).slice(0, 20)} : null,
  ratios: arr(v.ratios).filter(x => x && x.use).map(x => ({use: String(x.use), ratio: String(x.ratio || ''), note: String(x.note || '')})).slice(0, 12),
  variants: arr(v.variants).filter(x => x && x.name).map(x => ({id: x.id || null, name: String(x.name), note: String(x.note || '')})).slice(0, 12),
  keys: arr(v.keys).map(String).slice(0, 8), errors: arr(v.errors).filter(x => x && x.p).map(x => ({p: String(x.p), fix: String(x.fix || '')})).slice(0, 8),
  history: s(v.history), uses: arr(v.uses).map(String).slice(0, 12), keep: s(v.keep), pro: s(v.pro), related: arr(v.related).map(String).slice(0, 12), source: 'chatgpt', created_at: new Date().toISOString()};
}

export function mount(root, params) {
 const repaint = () => { if (root.isConnected) root.innerHTML = render(params); };
 root.addEventListener('input', e => { if (e.target.id === 'saberQ') { query = e.target.value; const r = $('#saberRes', root); if (r) r.innerHTML = results(); const rest = root.querySelector('.kcats'); if (rest) { rest.hidden = !!query.trim(); [...root.querySelectorAll('.kcats ~ .fine, .sec')].forEach(x => { x.hidden = !!query.trim(); }); } } });
 root.addEventListener('keydown', e => { if (e.target.id === 'saberQ' && e.key === 'Enter') { const first = root.querySelector('#saberRes .krow'); if (first) { e.preventDefault(); location.hash = first.getAttribute('href'); } } });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.kjump) { document.getElementById(b.dataset.kjump)?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}); return; }
  const act = b.dataset.act, id = params[0];
  if (act === 'save-version' && id) {
   const text = ($('#kText', root)?.value || '').trim();
   if (!text) { toast(t('Escribe tu versión primero.', 'Write your version first.'), 'error'); return; }
   const last = saberMine(id)?.versions?.slice(-1)[0];
   if (last && last.text === text) { toast(t('No has cambiado nada.', 'Nothing has changed.')); return; }
   await addSaberVersion(id, text, clip($('#kWhy', root)?.value || '', 300));
   repaint(); document.getElementById('kMine')?.scrollIntoView({block: 'start'}); toast(t('Versión guardada. La anterior queda en el historial.', 'Version saved. The previous one stays in the history.'));
  }
  if (act === 'trash-entry' && id) { await trashSaberEntry(id); toast(t('En la papelera.', 'Moved to the bin.')); go('saber'); }
  if (act === 'create-copy') { const done = await copy(createPrompt(query.trim())); toast(done ? t('Petición copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  if (act === 'create-save') {
   const entry = entryFromReply($('#kReply', root)?.value || '', query.trim());
   if (!entry) { toast(t('No encuentro la entrada en esa respuesta. Pega la respuesta entera.', 'I cannot find the entry in that answer. Paste the whole answer.'), 'error'); return; }
   await saveSaberEntry(entry); query = ''; go('saber/' + entry.id); toast(t('Entrada guardada en tu Saber.', 'Entry saved in your Knowledge.'));
  }
  if (act === 'create-ia') {
   const topic = query.trim();
   b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('ChatGPT está escribiendo la entrada…', 'ChatGPT is writing the entry…');
   try {
    const entry = entryFromReply(await askIa({text: createPrompt(topic), json: true}), topic);
    if (!entry) throw Object.assign(Error('empty'), {kind: 'empty'});
    await saveSaberEntry(entry); query = ''; go('saber/' + entry.id); toast(t('Entrada escrita por ChatGPT. Revísala y añade tu versión.', 'Entry written by ChatGPT. Check it and add your version.'));
   } catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Escribir con ChatGPT', 'Write with ChatGPT'); } }
  }
 });
 if (!params[0] && matchMedia('(min-width: 960px)').matches) setTimeout(() => $('#saberQ', root)?.focus(), 50);
 return null;
}
export function onData(what, el, params) { if (['saber', 'remote', 'load'].includes(what) && el && !el.contains(document.activeElement)) el.innerHTML = render(params); }
