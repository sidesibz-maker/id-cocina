// I+D · la mesa de trabajo de un plato: composición, sabores que dominan (en vivo), consejo, imagen y pruebas de cata.
// Se guarda solo, en este ordenador: al cambiar algo se guardan únicamente los campos tocados.
import {ROLES, TECHNIQUES, COURSES, role, technique, dishProfile, dishAdvice, suggest, pairings, cleanItem, AXIS_IDS} from '../flavor-core.js';
import {ALLERGENS, IMAGE_STYLES} from '../ai-core.js';
import {searchIngredients, flavorContext} from '../kitchen.js';
import {t, en, pick, relDay, shortDate, seasonOf, seasonLabel, dayKey} from '../i18n.js';
import {esc, icon, $, $$, uid, toast, friendly, sheet, ask, flavorMeters, flavorPrint, verdictText, axisName, lackName, clip} from '../ui.js';
import {state, dishById, fetchDish, createDish, saveDish, trashDish, restoreDish, imageUrl, uploadImage, userName, subById, createSub, dishVersions, snapshotDish} from '../store.js';
import {advicePrompt, imagePrompt, adviceFromReply, copy, shrinkImage, pairingPrompt} from '../ai.js';
import {iaOn, askIa, iaMessage, imageData} from '../ia.js';
import {STATUSES, emptyState, skeleton} from './shared.js';
import {go} from '../nav.js';
import {rich} from './ask.js';
import {entryById, entryForName} from '../saber/index.js';
import {openDishCatalog} from './dish-catalog.js';
import {dishRequest} from '../ai-core.js';
import {startShare, stopShare, shareUrl, refreshShareSoon} from '../share.js';

let cur = null, root = null, ready = false, dirty = new Set(), removedTests = new Set(), removedImages = new Set();
let pendingCatalog = '';
let timer = null, firstDirty = 0, saving = false, saveState = 'saved', style = 'mesa';
const editable = () => state.canEdit && !state.setupPending && !cur?.deleted_at;
const sid = () => uid().slice(0, 8);
const draftKey = id => 'lab-draft:' + (id || 'new');
const lbl = row => (en() ? row[2] : row[1]);

export const title = () => (cur?.name ? cur.name : t('Plato', 'Dish'));

// ---------- Guardado ----------
function setSave(next) {
 saveState = next;
 const el = root && $('#saveState', root);
 if (!el) return;
 const text = {saved: t('Guardado', 'Saved'), dirty: t('Sin guardar', 'Unsaved'), saving: t('Guardando…', 'Saving…'), error: t('Sin guardar: se reintentará', 'Not saved: will retry')}[next];
 el.className = 'save save-' + next; el.innerHTML = icon(next === 'saved' ? 'check' : next === 'error' ? 'alert' : 'clock') + esc(text);
}
function touch(...fields) {
 if (!editable()) return;
 fields.forEach(f => dirty.add(f));
 try { localStorage.setItem(draftKey(cur.id), JSON.stringify({version: cur.version || 0, at: Date.now(), patch: Object.fromEntries([...dirty].map(f => [f, cur[f]]))})); } catch {}
 setSave('dirty');
 if (!firstDirty) firstDirty = Date.now();
 clearTimeout(timer);
 // Espera a que se deje de tocar (3 s), pero nunca más de medio minuto.
 timer = setTimeout(flush, Date.now() - firstDirty > 15000 ? 0 : 800);
}
const worthSaving = d => d.name.trim() || d.concept.trim() || d.components.some(c => c.items.length || c.name);
async function flush() {
 clearTimeout(timer);
 if (saving || !dirty.size || !cur || !editable()) return;
 const dish = cur, key = draftKey(dish.id);
 saving = true; firstDirty = 0;
 const fields = [...dirty]; dirty.clear();
 if (root?.isConnected) setSave('saving');
 try {
  if (!dish.id) {
   if (!worthSaving(dish)) { saving = false; setSave('saved'); return; }
   const made = await createDish({...dish, name: dish.name.trim() || t('Plato sin nombre', 'Untitled dish')});
   dish.id = made.id; dish.version = made.version; dish.updated_at = made.updated_at;
   if (!dish.name.trim()) { dish.name = made.name; const input = root && $('#dishName', root); if (input && cur === dish && !input.value) input.value = made.name; }
   if (cur === dish && root?.isConnected) history.replaceState(null, '', '#/plato/' + made.id);
   // Lo que no entra al crear (pruebas, imágenes, consejo) se guarda justo después.
   for (const f of fields) if (!['name', 'concept', 'course', 'season', 'status', 'tags', 'components', 'notes', 'source'].includes(f)) dirty.add(f);
  } else {
   const saved = await saveDish(dish.id, Object.fromEntries(fields.map(f => [f, dish[f]])), {removedTests, removedImages});
   dish.version = saved.version; dish.updated_at = saved.updated_at;
   refreshShareSoon(saved);
   if (fields.includes('tests') && !dirty.has('tests')) dish.tests = saved.tests;
   if (fields.includes('images') && !dirty.has('images')) dish.images = saved.images;
  }
  try { localStorage.removeItem(key); localStorage.removeItem(draftKey(null)); } catch {}
  if (cur === dish && root?.isConnected) setSave(dirty.size ? 'dirty' : 'saved');
 } catch (e) {
  fields.forEach(f => dirty.add(f));
  if (cur === dish && root?.isConnected) { setSave('error'); if (/conflict|not found|forbidden/.test(e?.message || '')) toast(friendly(e, t('No se pudo guardar. Recarga la página y revisa el plato.', 'It could not be saved. Reload the page and check the dish.')), 'error'); }
 } finally {
  saving = false;
  if (dirty.size && cur === dish) timer = setTimeout(flush, saveState === 'error' ? 15000 : 1500);
 }
}

// ---------- Abrir ----------
function blank(lead, second) {
 const d = {id: null, name: '', concept: '', course: 'otro', season: seasonOf().key, status: 'idea', tags: [], components: [], tests: [], images: [], notes: '', plating: '', portions: '', advice: null, cover_path: null, version: 0};
 const ing = lead && state.kb?.byId[lead];
 if (ing) d.components.push({id: sid(), role: 'principal', name: '', techniques: [], items: [{n: en() ? ing.en : ing.es, k: ing.id, w: 3, src: 'kb'}]});
 const other = second && second !== lead && state.kb?.byId[second];
 if (ing && other) d.components.push({id: sid(), role: 'guarnicion', name: '', techniques: [], items: [{n: en() ? other.en : other.es, k: other.id, w: 2, src: 'kb'}]});
 return d;
}
function open(params) {
 ready = false; dirty = new Set(); removedTests = new Set(); removedImages = new Set(); firstDirty = 0;
 const id = params[0];
 if (id === 'nuevo') {
  cur = blank(params[1], params[2]);
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(draftKey(null)) || 'null'); } catch {}
  if (!params[1] && draft?.patch && Date.now() - draft.at < 7 * 86400000) { Object.assign(cur, draft.patch); Object.keys(draft.patch).forEach(f => dirty.add(f)); }
  if (params[1] && cur.components.length) dirty.add('components');
  ready = true; return;
 }
 const found = dishById(id);
 if (!found || found.light) { cur = null; fetchDish(id).then(d => { if (root?.isConnected && !ready) { if (d) { open(params); paint(); } else paintMissing(); } }).catch(() => { if (root?.isConnected && !ready) paintMissing(); }); return; }
 cur = JSON.parse(JSON.stringify(found));
 cur.components = cur.components.filter(c => c && typeof c === 'object').map(c => ({...c, id: c.id || sid(), role: c.role || 'guarnicion', name: c.name || '', method: typeof c.method === 'string' ? c.method : '', techniques: Array.isArray(c.techniques) ? c.techniques : [], items: (Array.isArray(c.items) ? c.items : []).map(cleanItem)}));
 cur.plating = typeof cur.plating === 'string' ? cur.plating : ''; cur.portions = cur.portions == null ? '' : String(cur.portions);
 // Si una subreceta propia ha cambiado, el plato usa su mezcla de ahora (solo para calcular; el ingrediente se queda igual).
 for (const c of cur.components) for (const it of c.items) { if (it.src !== 'recipe' || !it.ref) continue; const own = state.kitchen?.subrecipes.find(x => x.id === it.ref); if (own && own.mix.length) it.mix = own.mix; }
 let draft = null;
 try { draft = JSON.parse(localStorage.getItem(draftKey(cur.id)) || 'null'); } catch {}
 // Cambios que no llegaron a guardarse la última vez (se cerró la app, no había cobertura): se recuperan si el plato no ha cambiado desde entonces.
 if (draft?.patch && draft.version === cur.version && editable()) {
  Object.assign(cur, draft.patch); Object.keys(draft.patch).forEach(f => dirty.add(f));
  setTimeout(() => { toast(t('Se han recuperado cambios que no se habían guardado.', 'Unsaved changes have been recovered.')); flush(); }, 400);
 } else if (draft) { try { localStorage.removeItem(draftKey(cur.id)); } catch {} }
 ready = true;
}

// ---------- Composición ----------
const brasaIds = () => { const eq = state.settings?.equipment || [], hint = state.kitchen?.dishes?.some(d => /josper/i.test(d.name)) || state.kitchen?.carta?.sections.some(s => /josper/i.test(s.title)); const out = []; if (eq.includes('josper') || (!eq.length && hint)) out.push('josper'); if (eq.includes('ofyr')) out.push('ofyr'); return out.length ? out : ['brasa']; };
const techList = () => [...brasaIds(), ...TECHNIQUES.map(x => x[0]).filter(id => id !== 'brasa')];
const techName = id => { const x = technique(id); return x ? (en() ? x.en : x.es) : id; };
const weightName = w => (w === 3 ? t('protagonista', 'lead') : w === 1 ? t('un toque', 'a touch') : '');
function itemChip(item, ci, ii) {
 const unknown = !item.k && !(item.mix && item.mix.length);
 return '<button type="button" class="ing w' + item.w + (unknown ? ' is-unknown' : '') + (item.src === 'recipe' ? ' is-own' : '') + '" data-item="' + ci + ':' + ii + '"' + (editable() ? '' : ' disabled') + '>' +
  esc(item.n) + (item.q ? '<small class="qty">' + esc(item.q) + '</small>' : '') + (weightName(item.w) ? '<small>' + esc(weightName(item.w)) + '</small>' : '') + (unknown ? '<small>' + esc(t('sin perfil', 'no profile')) + '</small>' : '') + '</button>';
}
function compCard(c, ci) {
 const r = role(c.role), can = editable(), source = c.catalog_id && entryById(c.catalog_id);
 return '<article class="comp" data-comp="' + ci + '" tabindex="-1"><header class="comp-head">' +
  '<label class="sr" for="role' + ci + '">' + esc(t('Papel en el plato', 'Role in the dish')) + '</label><select id="role' + ci + '" class="comp-role" data-field="role"' + (can ? '' : ' disabled') + '>' + ROLES.map(x => '<option value="' + x[0] + '"' + (x[0] === r.id ? ' selected' : '') + '>' + esc(lbl(x)) + '</option>').join('') + '</select>' +
  '<label class="sr" for="cname' + ci + '">' + esc(t('Nombre del componente', 'Component name')) + '</label><input id="cname' + ci + '" class="comp-name" data-field="name" value="' + esc(c.name) + '" maxlength="90" placeholder="' + esc(t('Nombre (p. ej. pulpo a la brasa)', 'Name (e.g. charcoal octopus)')) + '"' + (can ? '' : ' disabled') + ' enterkeyhint="done" autocomplete="off">' +
  (can ? '<button type="button" class="iconbtn" data-act="del-comp" aria-label="' + esc(t('Quitar este componente', 'Remove this component')) + '">' + icon('x') + '</button>' : '') + '</header>' +
  (source ? '<a class="comp-source" href="#/biblioteca/' + esc(source.id) + '/receta">' + icon('library') + esc(t('Receta de la Biblioteca', 'Library recipe')) + '</a>' : '') +
  '<div class="comp-items">' + c.items.map((it, ii) => itemChip(it, ci, ii)).join('') + (can ? '<button type="button" class="ing ing-add" data-act="add-item">' + icon('plus') + esc(t('Añadir ingrediente', 'Add ingredient')) + '</button>' : '') + '</div>' +
  '<div class="comp-techs">' + c.techniques.filter(technique).map(id => '<span class="tech">' + esc(techName(id)) + '</span>').join('') + (can ? '<button type="button" class="tech tech-add" data-act="techs">' + icon(c.techniques.length ? 'edit' : 'plus') + esc(c.techniques.length ? t('Cambiar', 'Change') : t('Técnica', 'Technique')) + '</button>' : '') + '</div>' +
  (can || c.method ? '<details class="comp-method"' + (c.method ? ' open' : '') + '><summary>' + esc(t('Elaboración', 'Method')) + (c.method ? '' : '<small>' + esc(t('pasos, tiempos y temperaturas', 'steps, times and temperatures')) + '</small>') + '</summary><label class="sr" for="cmethod' + ci + '">' + esc(t('Elaboración de este componente', 'Method for this component')) + '</label><textarea id="cmethod' + ci + '" data-field="method" data-voice rows="3" maxlength="3000" placeholder="' + esc(t('1. Cocer el pulpo 40 min a fuego suave…\n2. Marcar en la brasa al pase, 2 min por lado.', '1. Simmer the octopus for 40 min…\n2. Char on the grill at the pass, 2 min per side.')) + '"' + (can ? '' : ' disabled') + '>' + esc(c.method || '') + '</textarea></details>' : '') + (can && c.items.filter(i => i.src !== 'recipe').length >= 2 ? '<button type="button" class="linkbtn comp-sub" data-act="to-sub">' + icon('book') + esc(t('Guardar como subreceta', 'Save as a sub-recipe')) + '</button>' : '') + '</article>';
}
function compsHtml() {
 const can = editable();
 const quick = ROLES.filter(x => !cur.components.some(c => c.role === x[0]) || ['guarnicion', 'toque'].includes(x[0]));
 return (cur.components.length ? cur.components.map(compCard).join('') : '<p class="hint">' + esc(t('Un plato se monta por componentes: quién manda, la salsa, lo que da frescor, lo crujiente… Empieza por el protagonista.', 'A dish is built from components: what leads, the sauce, what brings freshness, the crunch… Start with the main element.')) + '</p>') +
  (can ? '<div class="add-comp" role="group" aria-label="' + esc(t('Añadir componente', 'Add component')) + '">' + quick.map(x => '<button type="button" class="pill" data-add-comp="' + x[0] + '">' + icon('plus') + esc(lbl(x)) + '</button>').join('') + '</div>' : '');
}

// ---------- Sabores que dominan ----------
const FIX_ROLE = {crujiente: 'crujiente', acido: 'fresco', fresco: 'fresco', color: 'fresco', umami: 'salsa', graso: 'cremoso', dulce: 'toque', amargo: 'toque', picante: 'toque'};
const ingName = id => { const i = state.kb.byId[id]; return i ? (en() ? i.en : i.es) : id; };
function analysisHtml() {
 const kb = state.kb;
 if (!kb) return '<h2>' + esc(t('Sabores que dominan', 'Leading flavours')) + '</h2>' + skeleton(3);
 const profile = dishProfile(kb, cur), advice = dishAdvice(kb, cur, profile), ctx = flavorContext(state.kitchen);
 let html = '<h2>' + esc(t('Sabores que dominan', 'Leading flavours')) + '</h2><p class="verdict">' + esc(verdictText(advice.verdict, profile)) + '</p>';
 if (profile.empty) return html + '<div class="analysis-empty">' + flavorPrint(null, {size: 150, labels: true}) + '</div>';
 html += '<div class="analysis-chart">' + flavorPrint(profile.axes, {size: 150, labels: true, title: t('Huella de sabor del plato', 'Flavour print of the dish')}) + flavorMeters(profile, {lacking: advice.verdict.lacking}) + '</div>';
 if (profile.unknown) html += '<p class="fine">' + esc(profile.unknown === 1 ? t('1 ingrediente sin perfil no cuenta en el cálculo: tócalo para decir a qué se parece.', '1 ingredient with no profile is not counted: tap it to say what it resembles.') : profile.unknown + t(' ingredientes sin perfil no cuentan en el cálculo: tócalos para decir a qué se parecen.', ' ingredients with no profile are not counted: tap them to say what they resemble.')) + '</p>';
 const notes = advice.notes;
 if (notes.length) html += '<h3>' + esc(t('Equilibrio', 'Balance')) + '</h3><ul class="notes">' + notes.map(n => '<li class="note note-' + n.level + '">' + icon(n.level === 'ok' ? 'check' : n.level === 'warn' ? 'alert' : 'info') + '<div><strong>' + esc(pick(n.title)) + '</strong><p>' + esc(pick(n.text)) + '</p></div></li>').join('') + '</ul>';
 const fixes = advice.verdict.lacking.map(fix => [fix, suggest(kb, cur, fix, ctx, 5)]).filter(([, list]) => list.length);
 if (fixes.length && editable()) {
  html += '<h3>' + esc(t('Para equilibrarlo', 'To balance it')) + '</h3>';
  for (const [fix, list] of fixes) html += '<div class="fix"><span class="fix-name">' + esc(lackName(fix).replace(/^./, c => c.toUpperCase())) + '</span><div class="chips">' + list.map(s => '<button type="button" class="chip chip-add' + (s.own || s.have ? ' chip-have' : '') + '" data-fix="' + fix + '" data-add="' + esc(s.id) + '">' + icon('plus') + esc(s.own ? s.recipe?.name || ingName(s.id) : ingName(s.id)) + (s.own ? '<small>' + esc(t('subreceta tuya', 'your sub-recipe')) + '</small>' : s.have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : s.season ? '<small>' + esc(t('de temporada', 'in season')) + '</small>' : '') + '</button>').join('') + '</div></div>';
 }
 // Lo que combina con los protagonistas y aún no está en el plato.
 const used = new Set(profile.ids), score = new Map();
 for (const id of (profile.mains.length ? profile.mains : profile.ids).slice(0, 4)) for (const p of [...pairings(kb, id, ctx).classic, ...pairings(kb, id, ctx).bold]) if (!used.has(p.id)) { const s = score.get(p.id) || {id: p.id, n: 0, have: p.have, own: p.own, bold: p.bold}; s.n += p.score + (p.have || p.own ? .6 : 0); score.set(p.id, s); }
 const pairs = [...score.values()].sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, 10);
 if (pairs.length) html += '<h3>' + esc(t('Combina con lo que llevas', 'Pairs with what you have')) + '</h3><div class="chips">' + pairs.map(p => '<button type="button" class="chip' + (editable() ? ' chip-add' : '') + (p.have || p.own ? ' chip-have' : '') + '" data-add="' + esc(p.id) + '"' + (editable() ? '' : ' disabled') + '>' + esc(ingName(p.id)) + (p.bold ? '<small>' + esc(t('atrevida', 'bold')) + '</small>' : p.have || p.own ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : '') + '</button>').join('') + '</div>';
 return html;
}

// ---------- Imagen ----------
function imagesHtml() {
 const can = editable(), imgs = cur.images.filter(i => i && i.path);
 let html = '<h2>' + esc(t('Imagen del plato', 'Dish image')) + '</h2>';
 if (imgs.length) {
  const cover = imgs.find(i => i.path === cur.cover_path) || imgs[imgs.length - 1];
  html += '<figure class="shot"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" width="1" height="1" data-shot="' + esc(cover.path) + '" alt="' + esc(t('Imagen del plato', 'Image of the dish')) + '"></figure>';
  if (imgs.length > 1) html += '<div class="thumbs">' + imgs.map(i => '<button type="button" class="thumb' + (i.path === cover.path ? ' active' : '') + '" data-thumb="' + esc(i.id || i.path) + '" aria-label="' + esc(t('Ver esta imagen', 'View this image')) + '"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" width="1" height="1" data-shot="' + esc(i.path) + '" alt=""></button>').join('') + '</div>';
  if (can) html += '<div class="row-actions row-left"><a class="btn ghost" data-open-shot href="#" target="_blank" rel="noopener">' + icon('down') + esc(t('Abrir', 'Open')) + '</a><button type="button" class="btn ghost" data-act="del-image" data-path="' + esc(cover.path) + '">' + icon('x') + esc(t('Quitar esta', 'Remove this one')) + '</button></div>';
 } else html += '<p class="hint">' + esc(t('Para ver el plato antes de cocinarlo: copia la descripción, pégala en ChatGPT (crea la imagen) y añade aquí la imagen que te dé. También puedes poner una foto tuya.', 'To see the dish before cooking it: copy the description, paste it into ChatGPT (it creates the image) and add the image it gives you here. You can also add a photo of your own.')) + '</p>';
 if (can) {
  html += '<div class="filters" role="group" aria-label="' + esc(t('Estilo de la imagen', 'Image style')) + '">' + IMAGE_STYLES.map(s => '<button type="button" class="pill' + (style === s[0] ? ' active' : '') + '" data-style="' + s[0] + '" aria-pressed="' + (style === s[0]) + '">' + esc(lbl(s)) + '</button>').join('') + '</div>' +
   '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="image">' + icon('copy') + esc(t('Copiar descripción para ChatGPT', 'Copy description for ChatGPT')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a>' +
   '<label class="btn ghost" for="imageFile">' + icon('image') + esc(t('Añadir imagen', 'Add image')) + '</label><input id="imageFile" class="sr" type="file" accept="image/*"><button type="button" class="btn ghost" data-act="sketch">' + icon('edit') + esc(t('Dibujar el emplatado', 'Sketch the plating')) + '</button></div>' +
   (iaOn() ? '<div class="plate-check"><p class="fine">' + esc(t('¿Ya lo has emplatado? Hazle una foto y ChatGPT la compara con la imagen del plato: qué está bien y qué corregir antes de que salga.', 'Plated it already? Take a photo and ChatGPT compares it with the dish image: what works and what to fix before it goes out.')) + '</p><label class="btn primary" for="plateFile">' + icon('image') + '<span>' + esc(t('Revisar el emplatado con una foto', 'Check the plating with a photo')) + '</span></label><input id="plateFile" class="sr" type="file" accept="image/*" capture="environment"></div>' : '');
 }
 return html;
}

// ---------- Revisar el emplatado: foto del pase frente a la imagen objetivo ----------
async function reviewPlate(file, label) {
 const dish = cur;
 label.classList.add('is-busy'); const was = label.lastChild.textContent; label.lastChild.textContent = t('ChatGPT está mirando el plato…', 'ChatGPT is looking at the plate…');
 try {
  const shot = await imageData(file), imgs = [shot];
  const target = (dish.images || []).find(i => i.path === dish.cover_path) || (dish.images || [])[dish.images.length - 1];
  if (target) { const url = await imageUrl(target.path); if (url) { try { imgs.push(await imageData(await (await fetch(url)).blob())); } catch {} } }
  const text = await askIa({images: imgs, text: 'Eres un jefe de cocina revisando el emplatado en el pase, con ojo práctico (no de concurso). La primera imagen es el plato tal como ha salido hoy.' + (imgs.length > 1 ? ' La segunda es la imagen de cómo queremos que sea.' : ' No hay imagen objetivo: júzgalo por la descripción.') +
   ' Di en texto corto: lo que está bien; lo que corregirías antes de que salga (ración, limpieza del borde, altura, color, salsa, brillo, temperatura que se vea), cada cosa en una línea que empiece por «- »; y termina con una línea «Nota: X/10». ' + (en() ? 'Write in British English.' : 'Escribe en español de España.') +
   '\n\nEL PLATO:\n' + JSON.stringify({...dishRequest(state.kb, dish), emplatado: dish.plating || dish.advice?.plating || ''})});
  const score = Number((text.match(/nota:\s*(\d+(?:[.,]\d)?)\s*\/\s*10/i) || [])[1]?.replace(',', '.')) || null;
  const sh = sheet({title: t('Revisión del emplatado', 'Plating check'), wide: true, body: '<div class="plate-compare"><figure><img src="' + shot + '" alt=""><figcaption>' + esc(t('Hoy', 'Today')) + '</figcaption></figure>' + (imgs[1] ? '<figure><img src="' + imgs[1] + '" alt=""><figcaption>' + esc(t('Objetivo', 'Target')) + '</figcaption></figure>' : '') + '</div><div class="msg-body">' + rich(text) + '</div>' +
   '<div class="row-actions"><button type="button" class="btn ghost" data-r="photo">' + icon('image') + esc(t('Guardar la foto en el plato', 'Save the photo in the dish')) + '</button><button type="button" class="btn primary" data-r="test">' + icon('check') + esc(t('Apuntarlo como prueba', 'Log it as a test')) + '</button></div>'});
  sh.el.addEventListener('click', async e => {
   const r = e.target.closest('[data-r]')?.dataset.r;
   if (!r || cur !== dish) return;
   e.target.closest('button').disabled = true;
   if (r === 'photo') { const blob = await (await fetch(shot)).blob(), path = await uploadImage(dish.id || 'nuevo', blob); dish.images = [...dish.images, {id: sid(), path, style: 'pase', at: new Date().toISOString()}].slice(-12); touch('images'); redrawImages(); toast(t('Foto guardada en el plato.', 'Photo saved in the dish.')); }
   if (r === 'test') { dish.tests = [...dish.tests, {id: sid(), at: dayKey(), rating: score ? Math.max(1, Math.min(5, Math.round(score / 2))) : null, text: t('Revisión del emplatado: ', 'Plating check: ') + clip(text, 1100), next: '', by: userName()}].slice(-200); touch('tests'); part('testsSec', testsHtml()); toast(t('Apuntado en las pruebas de cata.', 'Logged in the tasting tests.')); }
  });
 } catch (err) { toast(err?.message === 'image' ? t('No se pudo abrir esa foto.', 'That photo could not be opened.') : iaMessage(err), 'error', 7000); }
 finally { if (label.isConnected) { label.classList.remove('is-busy'); label.lastChild.textContent = was; } }
}

// ---------- Consejo ----------
function adviceHtml() {
 const a = cur.advice, can = editable();
 let html = '<h2>' + esc(t('Consejo', 'Advice')) + '</h2>';
 const manual = can ? '<div class="row-actions row-left"><button type="button" class="btn ' + (a ? 'ghost' : 'primary') + '" data-act="advice">' + icon('copy') + esc(t('1. Copiar la consulta', '1. Copy the request')) + '</button><a class="btn ghost" href="https://claude.ai/new" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a Claude', 'Ask Claude')) + icon('out') + '</a><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
  '<label class="mini" for="adviceReply">' + esc(t('2. Pega aquí la respuesta', '2. Paste the answer here')) + '</label><textarea id="adviceReply" rows="3" placeholder="' + esc(t('Pega la respuesta entera, tal cual', 'Paste the whole answer as it is')) + '"></textarea>' +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="adviceReply" data-then="[data-act=save-advice]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="save-advice">' + icon('check') + esc(t('3. Guardar el consejo', '3. Save the advice')) + '</button></div>' : '';
 const askAbout = cur.id ? '<a class="btn ghost" href="#/preguntar/' + esc(cur.id) + '">' + icon('chat') + esc(t('Preguntar sobre este plato', 'Ask about this dish')) + '</a>' : '';
 const ask = !can ? '' : iaOn()
  ? '<div class="row-actions row-left"><button type="button" class="btn ' + (a ? 'ghost' : 'primary') + '" data-act="advice-ia">' + icon('spark') + esc(a ? t('Pedir otro consejo a ChatGPT', 'Ask ChatGPT for new advice') : t('Pedir consejo a ChatGPT', 'Ask ChatGPT for advice')) + '</button>' + askAbout + '</div><details class="fold fold-quiet"><summary>' + esc(t('Hacerlo copiando y pegando', 'Do it by copy and paste')) + '</summary>' + manual + '</details>'
  : manual + (askAbout ? '<div class="row-actions row-left">' + askAbout + '</div>' : '');
 if (!a || !a.verdict && !(a.changes || []).length && !a.raw) {
  return html + '<p class="hint">' + esc(t('Pide una segunda opinión: qué funciona, qué cambiar, cómo darle tu sello, cómo sacarlo en el servicio y cómo emplatarlo sin complicarse. La app prepara la consulta con el plato y tu cocina; la contestan Claude o ChatGPT.', 'Ask for a second opinion: what works, what to change, how to make it yours, how to run it in service and how to plate it simply. The app prepares the request with the dish and your kitchen; Claude or ChatGPT answer it.')) + '</p>' + ask;
 }
 if (a.raw) html += '<div class="raw">' + esc(a.raw).split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('') + '</div>';
 else {
 html += '<p class="advice-lead">' + esc(a.verdict) + '</p>';
  if (a.works?.length) html += '<h3>' + esc(t('Lo que funciona', 'What works')) + '</h3><ul class="ticks">' + a.works.map(w => '<li>' + icon('check') + '<span>' + esc(w) + '</span></li>').join('') + '</ul>';
  if (a.changes?.length) html += '<h3>' + esc(t('Lo que cambiaría', 'What I would change')) + '</h3><ol class="changes">' + a.changes.map(c => '<li><strong>' + esc(c.what) + '</strong>' + (c.why ? '<p>' + esc(c.why) + '</p>' : '') + '<p class="how">' + esc(c.how) + '</p></li>').join('') + '</ol>';
  if (a.signature) html += '<div class="callout"><h3>' + esc(t('Dale tu sello', 'Make it yours')) + '</h3><p>' + esc(a.signature) + '</p></div>';
  const s = a.service || {};
  if (s.mise?.length || s.pass || s.risks?.length) html += '<h3>' + esc(t('Para el servicio', 'For service')) + '</h3>' + (s.mise?.length ? '<p class="mini">' + esc(t('Mise en place', 'Mise en place')) + '</p><ul class="plain">' + s.mise.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') + (s.pass ? '<p class="mini">' + esc(t('En el pase', 'At the pass')) + '</p><p>' + esc(s.pass) + '</p>' : '') + (s.risks?.length ? '<p class="mini">' + esc(t('Ojo con', 'Watch out for')) + '</p><ul class="plain">' + s.risks.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '');
  if (a.plating) html += '<h3>' + esc(t('Emplatado', 'Plating')) + '</h3><p>' + esc(a.plating) + '</p>';
  if (a.variants?.length) html += '<h3>' + esc(t('Variantes', 'Variants')) + '</h3><div class="variants">' + a.variants.map((v, k) => '<article class="variant">' + (v.label ? '<span class="kicker">' + esc(v.label) + '</span>' : '') + '<p>' + esc(v.idea) + '</p>' + (can ? '<button type="button" class="linkbtn" data-variant="' + k + '">' + esc(t('Abrir como plato nuevo', 'Open as a new dish')) + '</button>' : '') + '</article>').join('') + '</div>';
  if (a.names?.length) html += '<h3>' + esc(t('Nombres para la carta', 'Names for the menu')) + '</h3><div class="chips">' + a.names.map((n, k) => '<button type="button" class="chip' + (can ? ' chip-add' : '') + '" data-name="' + k + '"' + (can ? '' : ' disabled') + '>' + esc(en() && n.en ? n.en : n.es) + '</button>').join('') + '</div>' + (can ? '<p class="fine">' + esc(t('Toca un nombre para ponérselo al plato.', 'Tap a name to use it for the dish.')) + '</p>' : '');
  if (a.allergens?.length) html += '<h3>' + esc(t('Alérgenos probables', 'Likely allergens')) + '</h3><div class="chips">' + a.allergens.map(id => { const row = ALLERGENS.find(x => x[0] === id); return row ? '<span class="chip chip-static">' + esc(lbl(row)) + '</span>' : ''; }).join('') + '</div><p class="fine">' + esc(t('Es solo una pista: compruébalo siempre con las fichas de cada producto.', 'This is only a hint: always check it against each product\'s data sheet.')) + '</p>';
  if (a.issues?.length) html += '<p class="fine">' + esc(a.issues.join(' ')) + '</p>';
 }
 html += (a.at ? '<p class="fine">' + esc(t('Consejo del ', 'Advice from ') + shortDate(a.at)) + '</p>' : '') + (can ? (iaOn() ? ask : '<details class="fold"><summary>' + esc(t('Pedir otro consejo', 'Ask again')) + '</summary>' + ask + '</details>') : '');
 return html;
}

// ---------- Maridaje ----------
function pairingHtml() {
 const p = cur.pairing, can = editable();
 let html = '<h2>' + esc(t('Maridaje', 'Pairing')) + '</h2>' + (p?.text ? '<div class="msg-body">' + rich(p.text) + '</div><p class="fine">' + esc(t('Del ', 'From ') + shortDate(p.at)) + '</p>' : '<p class="hint">' + esc(t('Qué vino, qué bebida sin alcohol y qué cerveza o sidra van con este plato.', 'Which wine, which alcohol-free drink and which beer or cider go with this dish.')) + '</p>');
 if (!can) return html;
 if (iaOn()) return html + '<div class="row-actions row-left"><button type="button" class="btn ' + (p ? 'ghost' : 'primary') + '" data-act="pair-ia">' + icon('drop') + esc(p ? t('Otra propuesta', 'Another suggestion') : t('Proponer maridaje', 'Suggest a pairing')) + '</button></div>';
 return html + '<details class="fold"' + (p ? '' : ' open') + '><summary>' + esc(t('Pedirlo a ChatGPT', 'Ask ChatGPT')) + '</summary><div class="row-actions row-left"><button type="button" class="btn ghost" data-act="pair-copy">' + icon('copy') + esc(t('Copiar la consulta', 'Copy the request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
  '<label class="mini" for="pairReply">' + esc(t('Pega aquí la respuesta', 'Paste the answer here')) + '</label><textarea id="pairReply" rows="3"></textarea><div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="pairReply" data-then="[data-act=pair-save]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="pair-save">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div></details>';
}

// ---------- Pruebas de cata ----------
const stars = n => '<span class="stars" aria-label="' + n + ' ' + esc(t('de 5', 'out of 5')) + '">' + [1, 2, 3, 4, 5].map(k => '<i class="' + (k <= n ? 'on' : '') + '">' + icon('star') + '</i>').join('') + '</span>';
// Cómo ha ido evolucionando la nota del plato, prueba a prueba.
function testTrend(list) {
 if (list.length < 2) return '';
 const w = 280, h = 64, pad = 8, n = list.length, x = k => pad + k * (w - pad * 2) / (n - 1), y = r => h - pad - (r - 1) * (h - pad * 2) / 4;
 const pts = list.map((v, k) => x(k).toFixed(1) + ',' + y(v.rating).toFixed(1)).join(' ');
 const first = list[0].rating, last = list[n - 1].rating, avg = list.reduce((a, v) => a + v.rating, 0) / n;
 const word = last > first ? t('va a mejor', 'is improving') : last < first ? t('ha bajado', 'has dropped') : t('se mantiene', 'is steady');
 return '<figure class="test-trend"><svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(t('Notas de las pruebas, de la primera a la última: ', 'Test ratings, first to last: ') + list.map(v => v.rating).join(', ')) + '">' +
  [1, 3, 5].map(r => '<line class="tt-grid" x1="' + pad + '" x2="' + (w - pad) + '" y1="' + y(r) + '" y2="' + y(r) + '"/>').join('') +
  '<polyline class="tt-line" points="' + pts + '"/>' + list.map((v, k) => '<circle class="tt-dot" cx="' + x(k).toFixed(1) + '" cy="' + y(v.rating).toFixed(1) + '" r="3.5"/>').join('') + '</svg>' +
  '<figcaption>' + esc(n + t(' pruebas con nota, media ', ' rated tests, average ') + avg.toLocaleString(undefined, {maximumFractionDigits: 1}) + t(' de 5; ', ' out of 5; ') + word + '.') + '</figcaption></figure>';
}
function testsHtml() {
 const can = editable(), tests = [...cur.tests].filter(Boolean).reverse();
 let html = '<h2>' + esc(t('Pruebas de cata', 'Tasting tests')) + '</h2>';
 // Lo que te apuntaste para la próxima vez, arriba, antes de volver a cocinarlo.
 const pending = tests.find(x => x.next);
 if (pending) html += '<div class="callout test-pending"><h3>' + esc(t('Lo que te apuntaste para esta vez', 'What you noted for this time')) + '</h3><p>' + esc(pending.next) + '</p></div>';
 html += testTrend([...cur.tests].filter(x => x && x.rating));
 if (can) html += '<form class="test-form" id="testForm"><fieldset class="rating"><legend>' + esc(t('¿Cómo salió?', 'How did it go?')) + '</legend>' + [1, 2, 3, 4, 5].map(k => '<label><input type="radio" name="rating" value="' + k + '"><span>' + icon('star') + '<b class="sr">' + k + '</b></span></label>').join('') + '</fieldset>' +
  '<label for="testText">' + esc(t('Qué tal estaba', 'How it tasted')) + '</label><textarea id="testText" data-voice rows="2" maxlength="1200" placeholder="' + esc(t('Punto, sabor, textura, lo que dijo el equipo…', 'Doneness, flavour, texture, what the team said…')) + '"></textarea>' +
  '<label for="testNext">' + esc(t('Qué cambio la próxima vez', 'What I will change next time')) + '</label><textarea id="testNext" data-voice rows="2" maxlength="800" placeholder="' + esc(t('Menos sal en la salsa, más brasa…', 'Less salt in the sauce, more char…')) + '"></textarea>' +
  '<button type="submit" class="btn primary">' + icon('plus') + esc(t('Apuntar prueba', 'Log test')) + '</button></form>';
 if (!tests.length) html += '<p class="hint">' + esc(t('Cada vez que lo cocines, apunta cómo salió y qué cambiarías. Así se ve cómo evoluciona el plato.', 'Each time you cook it, log how it went and what you would change. That is how you see the dish evolve.')) + '</p>';
 else html += '<ol class="tests">' + tests.map(x => '<li><div class="test-head"><span class="test-date">' + esc(relDay(x.at || new Date())) + (x.by ? ', ' + esc(x.by) : '') + '</span>' + (x.rating ? stars(x.rating) : '') + (can ? '<button type="button" class="iconbtn" data-del-test="' + esc(x.id) + '" aria-label="' + esc(t('Quitar esta prueba', 'Remove this test')) + '">' + icon('x') + '</button>' : '') + '</div>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + (x.next ? '<p class="test-next"><strong>' + esc(t('Próxima vez: ', 'Next time: ')) + '</strong>' + esc(x.next) + '</p>' : '') + '</li>').join('') + '</ol>';
 return html;
}

// ---------- Compartir con el equipo (enlace de solo lectura) ----------
async function teamSheet() {
 if (!cur.id) { dirty.add('name'); await flush(); }
 if (!cur.id) { toast(t('Ponle nombre al plato primero.', 'Name the dish first.'), 'error'); return; }
 await flush();
 const dish = cur;
 const body = () => dish.share?.on
  ? '<p class="lead">' + esc(t('Quien tenga este enlace ve la ficha en su móvil: ingredientes, cantidades, elaboración, emplatado, subrecetas y alérgenos. No puede cambiar nada y no ve tus notas, consejos ni pruebas. Se actualiza sola cuando cambias el plato.', 'Anyone with this link sees the sheet on their phone: ingredients, quantities, method, plating, sub-recipes and allergens. They cannot change anything and do not see your notes, advice or tests. It updates itself when you change the dish.')) + '</p>' +
    '<p class="sync-code share-url">' + esc(shareUrl(dish)) + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-s="wa">' + icon('out') + esc(t('Enviar por WhatsApp', 'Send on WhatsApp')) + '</button><button type="button" class="btn ghost" data-s="copy">' + icon('copy') + esc(t('Copiar enlace', 'Copy link')) + '</button><a class="btn ghost" href="' + esc(shareUrl(dish)) + '" target="_blank" rel="noopener">' + icon('out') + esc(t('Ver como el equipo', 'View as the team')) + '</a></div>' +
    '<div class="set-group"><button type="button" class="btn danger" data-s="off">' + icon('x') + esc(t('Dejar de compartir', 'Stop sharing')) + '</button><p class="set-note">' + esc(t('El enlace deja de funcionar. Si vuelves a compartir, se usa el mismo enlace.', 'The link stops working. If you share again, the same link is used.')) + '</p></div>'
  : '<p class="lead">' + esc(t('Crea un enlace para que tu equipo vea la ficha de este plato en su móvil, en solo lectura. Se guarda en la base de datos de la app y se actualiza sola cuando cambias el plato. Tus notas, consejos y pruebas de cata no se comparten.', 'Create a link so your team can see this dish sheet on their phone, read-only. It is stored in the app database and updates itself when you change the dish. Your notes, advice and tasting tests are not shared.')) + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-s="on">' + icon('user') + esc(t('Crear enlace para el equipo', 'Create a link for the team')) + '</button></div>';
 const s = sheet({title: t('Compartir con el equipo', 'Share with the team'), wide: true, body: body()});
 s.el.addEventListener('click', async e => {
  const b = e.target.closest('[data-s]'), act = b?.dataset.s;
  if (!act) return;
  const busy = on => { b.disabled = on; b.classList.toggle('is-busy', on); };
  try {
   if (act === 'on') { busy(true); dish.share = await startShare(dish); touch('share'); await flush(); s.body.innerHTML = body(); part('fichaSec', fichaSecHtml()); toast(t('Enlace listo. Mándaselo al equipo.', 'Link ready. Send it to the team.')); }
   if (act === 'off') { busy(true); dish.share = await stopShare(dish); touch('share'); await flush(); s.body.innerHTML = body(); part('fichaSec', fichaSecHtml()); toast(t('Ya no se comparte.', 'No longer shared.')); }
   if (act === 'copy') { const done = await copy(shareUrl(dish)); toast(done ? t('Enlace copiado.', 'Link copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
   if (act === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(t('Ficha de «', 'Sheet for “') + dish.name + t('»: ', '”: ') + shareUrl(dish)), '_blank', 'noopener');
  } catch (err) { busy(false); toast(err.kind === 'offline' ? t('Sin conexión: inténtalo con internet.', 'Offline: try again with internet.') : t('No se pudo ahora. Prueba otra vez.', 'It did not work now. Try again.'), 'error', 6000); }
 });
}

// ---------- Ficha técnica ----------
function fichaSecHtml() {
 const can = editable(), from = cur.advice?.plating;
 return '<h2>' + esc(t('Ficha técnica', 'Recipe sheet')) + '</h2><p class="hint">' + esc(t('Pon la cantidad tocando cada ingrediente y escribe la elaboración en cada componente. Aquí van las raciones y el emplatado; luego imprímela o guárdala en PDF para el equipo.', 'Set quantities by tapping each ingredient and write the method in each component. Portions and plating go here; then print it or save it as PDF for the team.')) + '</p>' +
  '<div class="bench-meta"><label for="dishPortions">' + esc(t('Raciones', 'Portions')) + '</label><input id="dishPortions" value="' + esc(cur.portions || '') + '" maxlength="30" inputmode="text" placeholder="' + esc(t('p. ej. 1, 4, 10 pases', 'e.g. 1, 4, 10 covers')) + '"' + (can ? '' : ' disabled') + ' autocomplete="off"></div>' +
  '<label class="mini" for="dishPlating">' + esc(t('Emplatado', 'Plating')) + '</label><textarea id="dishPlating" data-voice rows="3" maxlength="2000" placeholder="' + esc(t('Plato, qué va debajo, qué encima, cómo se termina en el pase…', 'Plate, what goes underneath, what on top, how it is finished at the pass…')) + '"' + (can ? '' : ' disabled') + '>' + esc(cur.plating || '') + '</textarea>' +
  (can && from && !cur.plating ? '<button type="button" class="linkbtn" data-act="plating-from-advice">' + esc(t('Usar el emplatado del consejo', 'Use the plating from the advice')) + '</button>' : '') +
  '<div class="row-actions row-left">' + (cur.id ? '<a class="btn primary" href="#/cocinar/plato/' + esc(cur.id) + '">' + icon('flame') + esc(t('Cocinar paso a paso', 'Cook step by step')) + '</a>' : '') + '<button type="button" class="btn ghost" data-act="print">' + icon('down') + esc(t('Imprimir ficha o guardar en PDF', 'Print sheet or save as PDF')) + '</button><button type="button" class="btn ghost" data-act="share">' + icon('out') + esc(t('Enviar por WhatsApp', 'Send on WhatsApp')) + '</button><button type="button" class="btn ghost" data-act="team">' + icon('user') + esc(cur.share?.on ? t('Compartida con el equipo', 'Shared with the team') : t('Compartir con el equipo', 'Share with the team')) + '</button></div>';
}
const roleName = c => pick([role(c.role).es, role(c.role).en]);
// Las subrecetas propias del plato, con su receta, al final de la ficha.
function subsUsedHtml() {
 const ids = [...new Set(cur.components.flatMap(c => c.items.filter(i => i.src === 'recipe' && i.ref).map(i => i.ref)))], subs = ids.map(subById).filter(x => x && !x.deleted_at);
 return subs.map(x => '<section class="ficha-comp"><h2>' + esc(t('Subreceta: ', 'Sub-recipe: ') + x.name) + (x.yield ? '<small>' + esc(t('Rinde ', 'Yields ') + x.yield) + '</small>' : '') + '</h2>' + (x.items.length ? '<table><tbody>' + x.items.map(i => '<tr><td>' + esc(i.n) + '</td><td class="ficha-q">' + esc(i.q || '') + '</td></tr>').join('') + '</tbody></table>' : '') + (x.method ? '<div class="ficha-method">' + esc(x.method).split(/\n+/).map(l => '<p>' + l + '</p>').join('') + '</div>' : '') + '</section>').join('');
}
async function fichaPrintHtml() {
 const imgs = (cur.images || []).filter(i => i && i.path), cover = imgs.find(i => i.path === cur.cover_path) || imgs[imgs.length - 1];
 const url = cover ? await imageUrl(cover.path).catch(() => null) : null;
 const profile = state.kb ? dishProfile(state.kb, cur) : {empty: true}, advice = state.kb && !profile.empty ? dishAdvice(state.kb, cur, profile) : null;
 const course = COURSES.find(c => c[0] === cur.course), status = STATUSES.find(s => s[0] === cur.status);
 const meta = [course && cur.course !== 'otro' ? lbl(course) : '', cur.season ? (/^\d{4}$/.test(cur.season) ? t('Todo el año ', 'All year ') + cur.season : seasonLabel(cur.season)) : '', cur.portions ? t('Raciones: ', 'Portions: ') + cur.portions : '', status ? lbl(status) : ''].filter(Boolean);
 const comps = cur.components.filter(c => c.items.length || c.name || c.method);
 const allergens = (cur.advice?.allergens || []).map(id => ALLERGENS.find(x => x[0] === id)).filter(Boolean).map(lbl);
 const last = [...(cur.tests || [])].filter(Boolean).pop();
 return '<article class="ficha"><header class="ficha-head"><div><p class="ficha-kicker">' + esc(t('Ficha técnica', 'Recipe sheet')) + '</p><h1>' + esc(cur.name || t('Plato sin nombre', 'Untitled dish')) + '</h1>' + (cur.concept ? '<p class="ficha-concept">' + esc(cur.concept) + '</p>' : '') + (meta.length ? '<p class="ficha-meta">' + esc(meta.join(', ')) + '</p>' : '') + '</div>' +
  (url ? '<img src="' + esc(url) + '" alt="">' : !profile.empty ? flavorPrint(profile.axes, {size: 110, labels: true}) : '') + '</header>' +
  (comps.length ? comps.map(c => '<section class="ficha-comp"><h2>' + esc(roleName(c)) + (c.name ? ': ' + esc(c.name) : '') + (c.techniques.length ? '<small>' + esc(c.techniques.filter(technique).map(techName).join(', ')) + '</small>' : '') + '</h2>' +
   (c.items.length ? '<table><tbody>' + c.items.map(i => '<tr><td>' + esc(i.n) + '</td><td class="ficha-q">' + esc(i.q || '') + '</td></tr>').join('') + '</tbody></table>' : '') +
   (c.method ? '<div class="ficha-method">' + esc(c.method).split(/\n+/).map(l => '<p>' + l + '</p>').join('') + '</div>' : '') + '</section>').join('') : '') +
  subsUsedHtml() +
  (cur.plating ? '<section class="ficha-comp"><h2>' + esc(t('Emplatado', 'Plating')) + '</h2><div class="ficha-method">' + esc(cur.plating).split(/\n+/).map(l => '<p>' + l + '</p>').join('') + '</div></section>' : '') +
  (advice ? '<p class="ficha-line"><strong>' + esc(t('Sabor: ', 'Flavour: ')) + '</strong>' + esc(verdictText(advice.verdict, profile)) + '</p>' : '') +
  (allergens.length ? '<p class="ficha-line"><strong>' + esc(t('Alérgenos probables: ', 'Likely allergens: ')) + '</strong>' + esc(allergens.join(', ')) + ' <small>' + esc(t('(compruébalos con las fichas de producto)', '(check them against product sheets)')) + '</small></p>' : '') +
  (last ? '<p class="ficha-line"><strong>' + esc(t('Última prueba', 'Last test')) + ' (' + esc(shortDate(last.at || new Date())) + '): </strong>' + esc([last.text, last.next ? t('Próxima vez: ', 'Next time: ') + last.next : ''].filter(Boolean).join(', ')) + '</p>' : '') +
  (cur.notes ? '<p class="ficha-line"><strong>' + esc(t('Notas: ', 'Notes: ')) + '</strong>' + esc(cur.notes) + '</p>' : '') +
  '<footer class="ficha-foot">I+D, ' + esc(shortDate(new Date())) + '</footer></article>';
}
// La ficha en texto, para mandarla por WhatsApp al equipo.
function fichaText() {
 const lines = ['*' + (cur.name || t('Plato sin nombre', 'Untitled dish')) + '*'];
 if (cur.concept) lines.push('_' + cur.concept + '_');
 if (cur.portions) lines.push(t('Raciones: ', 'Portions: ') + cur.portions);
 for (const c of cur.components.filter(c => c.items.length || c.method)) {
  lines.push('', '*' + roleName(c) + (c.name ? ': ' + c.name : '') + '*' + (c.techniques.length ? ' (' + c.techniques.filter(technique).map(techName).join(', ') + ')' : ''));
  for (const i of c.items) lines.push('• ' + i.n + (i.q ? ' — ' + i.q : ''));
  if (c.method) lines.push(c.method.trim());
 }
 if (cur.plating) lines.push('', '*' + t('Emplatado', 'Plating') + '*', cur.plating.trim());
 const allergens = (cur.advice?.allergens || []).map(id => ALLERGENS.find(x => x[0] === id)).filter(Boolean).map(lbl);
 if (allergens.length) lines.push('', t('Alérgenos probables: ', 'Likely allergens: ') + allergens.join(', '));
 return lines.join('\n');
}
async function shareFicha() {
 await flush();
 const text = fichaText();
 if (matchMedia('(pointer:coarse)').matches && navigator.share) { try { await navigator.share({title: cur.name, text}); return; } catch (e) { if (e?.name === 'AbortError') return; } }
 window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}
async function printFicha() {
 await flush();
 let host = document.getElementById('printFicha');
 if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
 host.innerHTML = await fichaPrintHtml();
 const img = host.querySelector('img');
 if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 1500); });
 document.documentElement.classList.add('printing');
 const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
 addEventListener('afterprint', done);
 setTimeout(() => print(), 50);
}

// De dónde salió el plato.
function sourceHtml() {
 const s = cur.source;
 if (!s || !s.title && !s.url) return '';
 const link = (href, text, ext) => '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(text) + '</a>';
 if (s.kind === 'import') return '<p class="fine">' + icon('copy') + esc(t('Receta importada', 'Imported recipe')) + (s.url && /^https?:\/\//.test(s.url) ? ': ' + link(s.url, s.title && s.title !== 'Receta importada' ? s.title : s.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), true) : s.title && s.title !== 'Receta importada' ? ': ' + esc(s.title) : '') + '</p>';
 if (s.kind === 'variant') return '<p class="fine">' + icon('copy') + esc(t('Variante de ', 'Variant of ')) + (s.dish_id ? link('#/plato/' + s.dish_id, s.title) : esc(s.title)) + '</p>';
 if (s.kind === 'ideas') return '<p class="fine">' + icon('spark') + esc(t('Nació de una petición de ideas: ', 'Born from an ideas request: ')) + esc(s.title) + '</p>';
 return '<p class="fine">' + icon('radar') + esc(t('Nació de un aviso del radar: ', 'Born from a radar alert: ')) + (s.trend_id ? link('#/radar/' + s.trend_id, s.title) : esc(s.title)) + '</p>';
}

// ---------- Etiquetas ----------
const TAG_IDEAS = () => [t('vegetal', 'plant-based'), t('vegano', 'vegan'), t('sin gluten', 'gluten-free'), t('para compartir', 'to share'), t('para grupos', 'for groups'), t('brasa', 'grill'), t('verano', 'summer'), t('invierno', 'winter'), t('menú del día', 'set menu'), t('carta', 'menu'), t('de la casa', 'house classic')];
export const allTags = () => [...new Set(state.dishes.filter(d => !d.deleted_at).flatMap(d => d.tags || []))].sort((a, b) => a.localeCompare(b, 'es'));
function tagsHtml() {
 const can = editable(), have = cur.tags || [];
 const ideas = [...new Set([...allTags(), ...TAG_IDEAS()])].filter(x => !have.includes(x));
 return have.map(x => '<span class="tag">#' + esc(x) + (can ? '<button type="button" class="tag-x" data-untag="' + esc(x) + '" aria-label="' + esc(t('Quitar etiqueta ', 'Remove tag ') + x) + '">' + icon('x') + '</button>' : '') + '</span>').join('') +
  (can ? '<label class="sr" for="tagInput">' + esc(t('Añadir etiqueta', 'Add tag')) + '</label><input id="tagInput" class="tag-input" list="tagIdeas" maxlength="30" placeholder="' + esc(t('+ etiqueta', '+ tag')) + '" autocomplete="off" enterkeyhint="done"><datalist id="tagIdeas">' + ideas.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' : (have.length ? '' : ''));
}
function addTag(raw) {
 const v = String(raw || '').trim().replace(/^#/, '').toLowerCase().slice(0, 30);
 if (!v || (cur.tags || []).includes(v)) return false;
 cur.tags = [...(cur.tags || []), v].slice(0, 20); touch('tags'); part('tagsRow', tagsHtml()); $('#tagInput', root)?.focus();
 return true;
}

// ---------- Pantalla ----------
function headHtml() {
 const can = editable();
 const seasons = [...new Set([cur.season, seasonOf().key, (seasonOf().summer ? 'Invierno ' : 'Verano ') + seasonOf().year, String(seasonOf().year)].filter(Boolean))];
 return '<div class="bench-top"><label class="sr" for="dishStatus">' + esc(t('Estado', 'Status')) + '</label><select id="dishStatus" class="status-select status-' + esc(cur.status) + '"' + (can ? '' : ' disabled') + '>' + STATUSES.map(s => '<option value="' + s[0] + '"' + (s[0] === cur.status ? ' selected' : '') + '>' + esc(lbl(s)) + '</option>').join('') + '</select>' +
  '<span id="saveState" class="save" role="status"></span>' + (state.canEdit && !state.setupPending ? '<button type="button" class="iconbtn" data-act="more" aria-label="' + esc(t('Más acciones', 'More actions')) + '">' + icon('more') + '</button>' : '') + '</div>' +
  (cur.deleted_at ? '<div class="notice" role="status">' + icon('trash') + '<p><strong>' + esc(t('Está en la papelera.', 'It is in the bin.')) + '</strong> ' + esc(t('Recupéralo para seguir trabajando en él.', 'Restore it to keep working on it.')) + ' <button type="button" class="linkbtn" data-act="restore">' + esc(t('Recuperar', 'Restore')) + '</button></p></div>' : '') +
  '<label class="sr" for="dishName">' + esc(t('Nombre del plato', 'Dish name')) + '</label><textarea id="dishName" class="title-input" rows="1" maxlength="140" placeholder="' + esc(t('Nombre del plato', 'Dish name')) + '"' + (can ? '' : ' disabled') + ' autocomplete="off" enterkeyhint="done">' + esc(cur.name) + '</textarea>' +
  '<label class="sr" for="dishConcept">' + esc(t('La idea en una frase', 'The idea in one sentence')) + '</label><textarea id="dishConcept" data-voice class="concept-input" rows="2" maxlength="600" placeholder="' + esc(t('La idea en una frase: qué quieres que se sienta al comerlo', 'The idea in one sentence: what should it feel like to eat')) + '"' + (can ? '' : ' disabled') + '>' + esc(cur.concept) + '</textarea>' +
  '<div class="bench-meta"><label for="dishCourse">' + esc(t('Tipo', 'Type')) + '</label><select id="dishCourse"' + (can ? '' : ' disabled') + '>' + COURSES.map(c => '<option value="' + c[0] + '"' + (c[0] === cur.course ? ' selected' : '') + '>' + esc(lbl(c)) + '</option>').join('') + '</select>' +
  '<label for="dishSeason">' + esc(t('Temporada', 'Season')) + '</label><select id="dishSeason"' + (can ? '' : ' disabled') + '>' + seasons.map(s => '<option value="' + esc(s) + '"' + (s === cur.season ? ' selected' : '') + '>' + esc(/^\d{4}$/.test(s) ? t('Todo el año ', 'All year ') + s : seasonLabel(s)) + '</option>').join('') + '</select></div>' +
  '<div class="tags-row" id="tagsRow">' + tagsHtml() + '</div>' +
  sourceHtml();
}
export function render(params) {
 open(params);
 if (!ready) return '<a class="back" href="#/libreta">' + icon('left') + esc(t('Libreta', 'Notebook')) + '</a>' + skeleton(4);
 return '<a class="back" href="#/libreta">' + icon('left') + esc(t('Libreta', 'Notebook')) + '</a>' +
  '<nav class="jump dish-jump" aria-label="' + esc(t('Partes del plato', 'Parts of the dish')) + '">' +
  (editable() ? '<button type="button" class="jump-add" data-act="catalog">' + icon('plus') + esc(t('Añadir al plato', 'Add to dish')) + '</button>' : '') +
  [['compSec', t('Mesa', 'Workbench')], ['analysis', t('Sabores', 'Flavours')], ['fichaSec', t('Ficha', 'Sheet')], ['imgSec', t('Imagen', 'Image')], ['adviceSec', t('Consejo', 'Advice')], ['pairSec', t('Maridaje', 'Pairing')], ['testsSec', t('Catas', 'Tastings')], ['notesSec', t('Notas', 'Notes')]].map(([id, label]) => '<button type="button" data-jump="' + id + '">' + esc(label) + '</button>').join('') + '</nav><div class="bench dish-bench">' +
  '<header class="bench-head card" id="benchHead">' + headHtml() + '</header>' +
  '<section class="card dish-compose" id="compSec"><div class="compose-head"><div><h2>' + esc(t('Mesa de trabajo', 'Workbench')) + '</h2>' +
  (editable() ? '<p>' + esc(t('Añade ingredientes, elaboraciones y técnicas al plato.', 'Add ingredients, preparations and techniques to the dish.')) + '</p>' : '') + '</div>' +
  (editable() ? '<button type="button" class="btn primary compose-add" data-act="catalog">' + icon('plus') + esc(t('Añadir al plato', 'Add to dish')) + '</button>' : '') +
  '</div><div id="comps">' + compsHtml() + '</div></section>' +
  '<aside class="card analysis" id="analysis" aria-live="polite">' + analysisHtml() + '</aside>' +
  '<section class="card" id="fichaSec">' + fichaSecHtml() + '</section>' +
  '<section class="card" id="imgSec">' + imagesHtml() + '</section>' +
  '<section class="card" id="adviceSec">' + adviceHtml() + '</section>' +
  '<section class="card" id="pairSec">' + pairingHtml() + '</section>' +
  '<section class="card" id="testsSec">' + testsHtml() + '</section>' +
  '<section class="card" id="notesSec"><h2>' + esc(t('Notas', 'Notes')) + '</h2><label class="sr" for="dishNotes">' + esc(t('Notas del plato', 'Dish notes')) + '</label><textarea id="dishNotes" data-voice rows="4" maxlength="6000" placeholder="' + esc(t('Proveedor, cantidades que te han funcionado, de dónde vino la idea…', 'Supplier, quantities that worked, where the idea came from…')) + '"' + (editable() ? '' : ' disabled') + '>' + esc(cur.notes) + '</textarea></section></div>';
}
function paint() { if (!root?.isConnected) return; root.innerHTML = render([cur?.id || 'nuevo']); bind(); }
function paintMissing() { if (root?.isConnected) root.innerHTML = '<a class="back" href="#/libreta">' + icon('left') + esc(t('Libreta', 'Notebook')) + '</a>' + emptyState('book', t('Este plato no está', 'This dish is not here'), t('Puede que se haya movido o que no tengas conexión.', 'It may have moved, or you may be offline.'), '<a class="btn primary" href="#/libreta">' + esc(t('Ir a la libreta', 'Go to the notebook')) + '</a>'); }

const part = (id, html) => { const el = root && $('#' + id, root); if (el) el.innerHTML = html; };
function shots() { if (!root) return; $$('img[data-shot]', root).forEach(async img => { const url = await imageUrl(img.dataset.shot); if (img.isConnected && url) { img.src = url; const a = img.closest('.shot') && $('[data-open-shot]', root); if (a) a.href = url; } }); }
const redrawComps = () => { part('comps', compsHtml()); part('analysis', analysisHtml()); };
const redrawImages = () => { part('imgSec', imagesHtml()); shots(); };

// ---------- Ventanas ----------
function addItem(ci, item) {
 const c = cur.components[ci];
 if (!c || c.items.some(x => x.n === item.n && (x.ref || null) === (item.ref || null))) return false;
 if (c.role === 'principal' && !c.items.some(x => x.w === 3)) item.w = 3;
 if (['sal', 'sal-escamas'].includes(item.k)) item.w = 1;
 c.items.push(cleanItem(item)); touch('components'); redrawComps();
 return true;
}
function catalogSheet(initialId = '') {
 if (!ready || !editable()) return;
 const dish = cur;
 openDishCatalog(dish.components, ({target, role, component, item, technique, techniqueName}) => {
  if (cur !== dish || !editable()) return false;
  let index = target;
  if (index === null) {
   index = dish.components.length;
   dish.components.push(component ? {...component, id: sid()} : {id: sid(), role, name: techniqueName, items: [], techniques: []});
  }
  const destination = dish.components[index];
  if (!destination) return false;
  if (item && !addItem(index, item)) { toast(t('Este ingrediente ya está en el componente.', 'This ingredient is already in the component.')); return false; }
  if (technique) {
   if (destination.techniques.includes(technique)) { toast(t('Esta técnica ya está aplicada.', 'This technique is already applied.')); return false; }
   if (destination.techniques.length >= 6) { toast(t('Este componente ya tiene seis técnicas.', 'This component already has six techniques.'), 'error'); return false; }
   destination.techniques.push(technique);
  }
  if (!item) { touch('components'); redrawComps(); }
  toast(t('Añadido al plato.', 'Added to the dish.'));
  requestAnimationFrame(() => root?.querySelector('[data-comp="' + index + '"]')?.focus());
  return true;
 }, initialId);
}
function pickIngredient(ci, replaceIndex = null) {
 const c = cur.components[ci];
 if (!c) return;
 const s = sheet({title: replaceIndex === null ? t('Añadir a ', 'Add to ') + (c.name || pick([role(c.role).es, role(c.role).en])).toLowerCase() : t('¿A qué se parece?', 'What does it resemble?'), wide: true, body:
  '<label class="sr" for="ingSearch">' + esc(t('Buscar ingrediente', 'Search ingredient')) + '</label><div class="searchbox">' + icon('search') + '<input id="ingSearch" type="search" placeholder="' + esc(t('Busca en el catálogo: tus básicos salen primero', 'Search the catalogue: your staples come first')) + '" autocomplete="off" enterkeyhint="search"></div><div id="ingResults" class="results"></div>'});
 const input = $('#ingSearch', s.el), box = $('#ingResults', s.el);
 const draw = () => {
  const q = input.value.trim(), list = state.kb ? searchIngredients(state.kb, state.kitchen, q, {limit: 40, english: en()}) : [];
  const shown = replaceIndex === null ? list : list.filter(r => r.type === 'kb');
  box.innerHTML = shown.map((r, k) => '<button type="button" class="result" data-pick="' + k + '"><span>' + esc(r.label) + '</span><small>' + esc(r.type === 'recipe' ? t('subreceta tuya', 'your sub-recipe') : r.type === 'product' ? t('producto', 'product') : r.have ? t('de tus básicos', 'one of your staples') : '') + '</small></button>').join('') +
   (replaceIndex === null && q.length >= 2 && !shown.some(r => r.label.toLowerCase() === q.toLowerCase()) ? '<button type="button" class="result result-free" data-free>' + icon('plus') + '<span>' + esc(t('Añadir «', 'Add “') + q + t('» tal cual', '” as written')) + '</span><small>' + esc(t('sin perfil de sabor', 'no flavour profile')) + '</small></button>' : '') +
   (!shown.length && q.length < 2 ? '<p class="hint">' + esc(t('Escribe para buscar.', 'Type to search.')) + '</p>' : '');
  box._list = shown;
 };
 input.oninput = draw; draw();
 setTimeout(() => input.focus(), 250);
 box.onclick = e => {
  const b = e.target.closest('[data-pick],[data-free]');
  if (!b) return;
  if (replaceIndex !== null) { const r = box._list[Number(b.dataset.pick)]; const it = c.items[replaceIndex]; if (r && it) { it.k = r.item.k; touch('components'); redrawComps(); } s.close(); return; }
  const item = b.hasAttribute('data-free') ? {n: clip(input.value, 80), k: null, w: 2, src: 'free'} : {...box._list[Number(b.dataset.pick)].item};
  if (addItem(ci, item)) { b.classList.add('is-added'); b.disabled = true; toast(t('Añadido: ', 'Added: ') + item.n, 'info', 1600); input.value = ''; input.focus(); if (b.hasAttribute('data-free')) draw(); }
 };
}
function itemSheet(ci, ii) {
 const c = cur.components[ci], it = c?.items[ii];
 if (!it) return;
 const ing = it.k && state.kb?.byId[it.k], unknown = !it.k && !(it.mix && it.mix.length);
 const top = ing ? AXIS_IDS.slice(0, 8).map((id, k) => [id, ing.taste[k]]).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];
 let changedQty = false;
 const s = sheet({title: it.n, onClose: () => { if (changedQty) redrawComps(); }, body:
  '<label class="mini" for="itemQty">' + esc(t('Cantidad por ración', 'Quantity per portion')) + '</label><input id="itemQty" value="' + esc(it.q || '') + '" maxlength="30" placeholder="' + esc(t('p. ej. 120 g, 2 ud, c/s', 'e.g. 120 g, 2 pcs, to taste')) + '" autocomplete="off" enterkeyhint="done"' + (editable() ? '' : ' disabled') + '>' +
  (it.src === 'recipe' ? '<p class="fine">' + esc(t('Subreceta tuya', 'Your sub-recipe')) + (it.mix?.length ? ': ' + esc(it.mix.slice(0, 6).map(m => ingName(m[0])).join(', ')) : '') + '</p>' : '') +
  (top.length ? '<p class="fine">' + esc(t('Aporta sobre todo: ', 'Mostly brings: ')) + esc(top.map(x => axisName(x[0]).toLowerCase()).join(', ')) + '</p>' : '') +
  (unknown ? '<p class="hint">' + esc(t('No está en la tabla de sabores, así que no cuenta en el cálculo. Si se parece a algo conocido, dilo y contará.', 'It is not in the flavour table, so it is not counted. If it resembles something known, say so and it will count.')) + '</p><button type="button" class="btn ghost" data-act="map">' + icon('search') + esc(t('Decir a qué se parece', 'Say what it resembles')) + '</button>' : '') +
  '<fieldset class="choice"><legend>' + esc(t('Cuánto pesa en el plato', 'How much it weighs in the dish')) + '</legend>' + [[3, t('Protagonista', 'Lead')], [2, t('Normal', 'Normal')], [1, t('Un toque', 'A touch')]].map(([w, label]) => '<button type="button" class="pill' + (it.w === w ? ' active' : '') + '" data-w="' + w + '" aria-pressed="' + (it.w === w) + '">' + esc(label) + '</button>').join('') + '</fieldset>' +
  '<div class="row-actions">' + (entryForName(it.n) ? '<a class="btn ghost" href="#/biblioteca/' + esc(entryForName(it.n).id) + '">' + icon('library') + esc(t('En la Biblioteca', 'In the library')) + '</a>' : '') + (ing ? '<a class="btn ghost" href="#/sabores/' + esc(ing.id) + '">' + icon('wheel') + esc(t('Con qué combina', 'What it pairs with')) + '</a>' : '') + '<button type="button" class="btn danger" data-act="del-item">' + icon('x') + esc(t('Quitar', 'Remove')) + '</button></div>'});
 const qty = $('#itemQty', s.el);
 qty.oninput = () => { const v = clip(qty.value, 30); if (v) it.q = v; else delete it.q; changedQty = true; touch('components'); };
 qty.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); s.close(); } };
 s.el.onclick = e => {
  const w = e.target.closest('[data-w]'), act = e.target.closest('[data-act]')?.dataset.act;
  if (w) { it.w = Number(w.dataset.w); touch('components'); redrawComps(); s.close(); }
  if (act === 'del-item') { c.items.splice(ii, 1); touch('components'); redrawComps(); s.close(); }
  if (act === 'map') { s.close(); pickIngredient(ci, ii); }
 };
}
function techSheet(ci) {
 const c = cur.components[ci];
 if (!c) return;
 const s = sheet({title: t('Técnicas', 'Techniques'), body: '<p class="lead">' + esc(t('Cómo se cocina este componente. Cambia el perfil: la brasa ahúma, el encurtido da ácido, la fritura da crujiente…', 'How this component is cooked. It changes the profile: charcoal adds smoke, pickling adds acidity, frying adds crunch…')) + '</p><div class="chips" id="techChoices">' + techList().map(id => '<button type="button" class="pill' + (c.techniques.includes(id) ? ' active' : '') + '" data-tech="' + id + '" aria-pressed="' + c.techniques.includes(id) + '">' + esc(techName(id)) + '</button>').join('') + '</div><div class="row-actions"><button type="button" class="btn primary" data-close>' + esc(t('Hecho', 'Done')) + '</button></div>'});
 $('#techChoices', s.el).onclick = e => {
  const b = e.target.closest('[data-tech]');
  if (!b) return;
  const id = b.dataset.tech, on = !c.techniques.includes(id);
  c.techniques = on ? [...c.techniques, id].slice(0, 6) : c.techniques.filter(x => x !== id);
  b.classList.toggle('active', c.techniques.includes(id)); b.setAttribute('aria-pressed', c.techniques.includes(id));
  touch('components'); redrawComps();
 };
}
function addAs(kbId, fix = null) {
 const kb = state.kb, ing = kb?.byId[kbId];
 if (!ing) return;
 const own = state.kitchen?.subrecipes.find(x => x.kb === kbId);
 const item = own ? {n: own.name, k: own.kb, w: 2, src: 'recipe', ref: own.id, ...(own.mix.length ? {mix: own.mix} : {})} : {n: en() ? ing.en : ing.es, k: ing.id, w: 2, src: 'kb'};
 const wanted = FIX_ROLE[fix] || (ing.textures.includes('crujiente') && ['fruto-seco', 'cereal'].includes(ing.family) ? 'crujiente' : ['hierba', 'especia', 'condimento'].includes(ing.family) ? 'toque' : ['salsa'].includes(ing.family) ? 'salsa' : ['encurtido'].includes(ing.family) ? 'fresco' : 'guarnicion');
 let ci = cur.components.findIndex(c => c.role === wanted);
 if (ci < 0) { cur.components.push({id: sid(), role: wanted, name: '', techniques: [], items: []}); ci = cur.components.length - 1; }
 if (wanted === 'toque' || wanted === 'crujiente') item.w = wanted === 'toque' ? 1 : 2;
 if (addItem(ci, item)) toast(t('Añadido como ', 'Added as ') + pick([role(wanted).es, role(wanted).en]).toLowerCase() + ': ' + item.n);
}
function moreSheet() {
 const s = sheet({title: cur.name || t('Plato', 'Dish'), body: '<div class="menu-grid">' +
  (cur.id ? '<button type="button" class="tile" data-act="versions">' + icon('clock') + '<span>' + esc(t('Versiones anteriores', 'Earlier versions')) + '</span></button>' : '') +
  (cur.id ? '<button type="button" class="tile" data-act="dup">' + icon('copy') + '<span>' + esc(t('Duplicar como variante', 'Duplicate as a variant')) + '</span></button>' : '') +
  (cur.id ? '<a class="tile" href="#/cocinar/plato/' + esc(cur.id) + '">' + icon('flame') + '<span>' + esc(t('Cocinar paso a paso', 'Cook step by step')) + '</span></a>' : '') +
  '<button type="button" class="tile" data-act="share">' + icon('out') + '<span>' + esc(t('Enviar ficha por WhatsApp', 'Send sheet on WhatsApp')) + '</span></button>' +
  '<button type="button" class="tile" data-act="print">' + icon('down') + '<span>' + esc(t('Imprimir ficha o guardar en PDF', 'Print sheet or save as PDF')) + '</span></button>' +
  (cur.id && !cur.deleted_at ? '<button type="button" class="tile tile-danger" data-act="trash">' + icon('trash') + '<span>' + esc(t('Enviar a la papelera', 'Move to the bin')) + '</span></button>' : '') + '</div>' +
  ''});
 s.el.onclick = async e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  s.close();
  if (act === 'print') printFicha();
  if (act === 'share') shareFicha();
  if (act === 'versions') versionsSheet();
  if (act === 'dup') duplicate(cur.name + t(' (variante)', ' (variant)'), cur.concept);
  if (act === 'trash') {
   if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: lo encontrarás en la papelera de la libreta y podrás recuperarlo.', 'It is not deleted: you will find it in the notebook bin and can restore it.'), yes: t('Enviar a la papelera', 'Move to the bin'), danger: true})) return;
   try { await flush(); await trashDish(cur.id); toast(t('En la papelera.', 'Moved to the bin.')); go('libreta'); } catch (err) { toast(friendly(err), 'error'); }
  }
 };
}
// Versiones anteriores: qué cambió y volver a una. Las pruebas de cata y las fotos se quedan como están ahora.
const RESTORE = ['name', 'concept', 'course', 'season', 'status', 'tags', 'components', 'plating', 'portions', 'notes'];
function diffText(old, now) {
 const names = d => new Set((d.components || []).flatMap(c => (c.items || []).map(i => i.n)));
 const a = names(old), b = names(now), gone = [...a].filter(x => !b.has(x)), added = [...b].filter(x => !a.has(x)), out = [];
 if (old.name !== now.name) out.push(t('se llamaba «', 'was called “') + old.name + t('»', '”'));
 if (gone.length) out.push(t('tenía ', 'had ') + gone.slice(0, 5).join(', '));
 if (added.length) out.push(t('no tenía ', 'did not have ') + added.slice(0, 5).join(', '));
 if ((old.concept || '') !== (now.concept || '') && !out.length) out.push(t('otra idea del plato', 'a different idea'));
 if (!out.length && JSON.stringify(old.components) !== JSON.stringify(now.components)) out.push(t('cambios en cantidades, técnicas o elaboración', 'changes in quantities, techniques or method'));
 if (!out.length) out.push(t('cambios en notas, estado o emplatado', 'changes in notes, status or plating'));
 return out.join('; ');
}
async function versionsSheet() {
 await flush();
 const list = await dishVersions(cur.id), dish = cur;
 const s = sheet({title: t('Versiones anteriores', 'Earlier versions'), wide: true, body: list.length
  ? '<p class="lead">' + esc(t('Cómo estaba el plato antes de cada tanda de cambios. Al recuperar una, las pruebas de cata y las fotos se quedan como están, y lo de ahora también se guarda como versión.', 'How the dish was before each round of changes. Restoring keeps tasting tests and photos as they are, and the current state is saved as a version too.')) + '</p><ol class="versions">' +
    list.map((v, k) => '<li><div><strong>' + esc(relDay(v.at) + ', ' + new Date(v.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})) + '</strong><small>' + esc(diffText(v.data, dish)) + '</small></div><button type="button" class="btn ghost" data-v="' + k + '">' + icon('undo') + esc(t('Recuperar', 'Restore')) + '</button></li>').join('') + '</ol>'
  : '<p class="hint">' + esc(t('Aún no hay versiones anteriores. Se guardan solas mientras trabajas el plato (una cada 15 minutos como mucho).', 'No earlier versions yet. They are saved automatically while you work on the dish (at most one every 15 minutes).')) + '</p>'});
 s.el.addEventListener('click', async e => {
  const b = e.target.closest('[data-v]');
  if (!b || cur !== dish) return;
  const v = list[Number(b.dataset.v)];
  if (!await ask({title: t('¿Volver a esta versión?', 'Go back to this version?'), text: t('Lo de ahora queda guardado como otra versión, así que puedes deshacerlo.', 'The current state is saved as another version, so you can undo it.'), yes: t('Recuperar', 'Restore')})) return;
  await snapshotDish(dishById(dish.id), true);
  const patch = Object.fromEntries(RESTORE.filter(f => f in v.data).map(f => [f, v.data[f]]));
  await saveDish(dish.id, patch);
  s.close(); open([dish.id]); paint(); toast(t('Versión recuperada.', 'Version restored.'));
 });
}
async function duplicate(name, concept) {
 try {
  await flush();
  const copy = await createDish({name: clip(name, 140), concept: clip(concept, 600), course: cur.course, season: cur.season, tags: cur.tags, components: JSON.parse(JSON.stringify(cur.components)).map(c => ({...c, id: sid()})), source: cur.id ? {kind: 'variant', dish_id: cur.id, title: cur.name} : null});
  toast(t('Variante creada.', 'Variant created.')); go('plato/' + copy.id);
 } catch (err) { toast(friendly(err), 'error'); }
}

// ---------- Eventos ----------
// El nombre es un campo que crece: un nombre largo se ve entero, también en el móvil.
function fitName() { const x = root && $('#dishName', root); if (x) { x.style.height = 'auto'; x.style.height = x.scrollHeight + 'px'; } }
function bind() {
 if (!root || !ready) return;
 setSave(dirty.size ? 'dirty' : 'saved');
 fitName();
 shots();
 if (pendingCatalog && editable()) {
  const id = pendingCatalog;
  pendingCatalog = '';
  history.replaceState(null, '', '#/plato/' + (cur.id || 'nuevo'));
  const dish = cur;
  requestAnimationFrame(() => { if (root?.isConnected && cur === dish) catalogSheet(id); });
 }
}
export function mount(el, params) {
 root = el;
 pendingCatalog = params[1] === 'biblioteca' ? params[2] : '';
 bind();
 const onInput = e => {
  if (!ready || !editable()) return;
  const x = e.target;
  if (x.id === 'dishName') { if (/[\r\n]/.test(x.value)) x.value = x.value.replace(/[\r\n]+/g, ' '); fitName(); cur.name = x.value.slice(0, 140); touch('name'); document.title = (cur.name || t('Plato', 'Dish')) + ' · I+D'; }
  else if (x.id === 'dishConcept') { cur.concept = x.value.slice(0, 600); touch('concept'); }
  else if (x.id === 'dishNotes') { cur.notes = x.value.slice(0, 6000); touch('notes'); }
  else if (x.id === 'dishPlating') { cur.plating = x.value.slice(0, 2000); touch('plating'); const l = $('[data-act=plating-from-advice]', root); if (l) l.hidden = !!cur.plating.trim(); }
  else if (x.id === 'dishPortions') { cur.portions = x.value.slice(0, 30); touch('portions'); }
  else if (x.dataset.field === 'method') { const c = cur.components[Number(x.closest('[data-comp]').dataset.comp)]; if (c) { c.method = x.value.slice(0, 3000); touch('components'); } }
  else if (x.dataset.field === 'name') { const c = cur.components[Number(x.closest('[data-comp]').dataset.comp)]; if (c) { c.name = x.value.slice(0, 90); touch('components'); } }
 };
 const onChange = e => {
  if (!ready || !editable()) return;
  const x = e.target;
  if (x.id === 'dishStatus') { cur.status = x.value; x.className = 'status-select status-' + x.value; touch('status'); }
  else if (x.id === 'dishCourse') { cur.course = x.value; touch('course'); part('analysis', analysisHtml()); }
  else if (x.id === 'dishSeason') { cur.season = x.value; touch('season'); }
  else if (x.id === 'plateFile' && x.files[0]) { const f = x.files[0]; x.value = ''; reviewPlate(f, $('label[for=plateFile]', root)); }
  else if (x.id === 'imageFile' && x.files[0]) {
   shrinkImage(x.files[0]).then(async blob => {
    if (!cur.id) { dirty.add('name'); await flush(); }
    const path = await uploadImage(cur.id || 'nuevo', blob);
    cur.images = [...cur.images, {id: sid(), path, style, at: new Date().toISOString()}].slice(-12); cur.cover_path = path; touch('images', 'cover_path'); redrawImages(); toast(t('Imagen añadida.', 'Image added.'));
   }).catch(() => toast(t('No se pudo añadir la imagen. Prueba con otra.', 'The image could not be added. Try another one.'), 'error'));
  }
  else if (x.dataset.field === 'role') { const c = cur.components[Number(x.closest('[data-comp]').dataset.comp)]; if (c) { c.role = x.value; touch('components'); redrawComps(); } }
 };
 const onClick = async e => {
  if (!ready) return;
  const b = e.target.closest('button,a');
  if (!b || !root.contains(b)) return;
  const ci = b.closest('[data-comp]') ? Number(b.closest('[data-comp]').dataset.comp) : -1, act = b.dataset.act;
  if (b.dataset.jump) { document.getElementById(b.dataset.jump)?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}); return; }
  if (b.dataset.item) { const [a, i] = b.dataset.item.split(':').map(Number); itemSheet(a, i); return; }
  if (b.dataset.addComp) { cur.components.push({id: sid(), role: b.dataset.addComp, name: '', techniques: [], items: []}); touch('components'); redrawComps(); pickIngredient(cur.components.length - 1); return; }
  if (b.dataset.add) { addAs(b.dataset.add, b.dataset.fix || null); return; }
  if (b.dataset.style) { style = b.dataset.style; redrawImages(); return; }
  if (b.dataset.thumb) { const img = cur.images.find(i => (i.id || i.path) === b.dataset.thumb); if (img) { cur.cover_path = img.path; touch('cover_path'); redrawImages(); } return; }
  if (b.dataset.delTest) {
   if (!await ask({title: t('¿Quitar esta prueba?', 'Remove this test?'), text: t('Se quita solo este apunte de la libreta.', 'Only this entry is removed from the notebook.'), yes: t('Quitar', 'Remove'), danger: true})) return;
   removedTests.add(b.dataset.delTest); cur.tests = cur.tests.filter(x => x && x.id !== b.dataset.delTest); touch('tests'); part('testsSec', testsHtml()); return;
  }
  if (b.dataset.untag) { cur.tags = (cur.tags || []).filter(x => x !== b.dataset.untag); touch('tags'); part('tagsRow', tagsHtml()); return; }
  if (b.dataset.name !== undefined) { const n = cur.advice?.names?.[Number(b.dataset.name)]; if (n) { cur.name = en() && n.en ? n.en : n.es; $('#dishName', root).value = cur.name; fitName(); touch('name'); toast(t('Nombre cambiado.', 'Name changed.')); } return; }
  if (b.dataset.variant !== undefined) { const v = cur.advice?.variants?.[Number(b.dataset.variant)]; if (v) duplicate(cur.name + (v.label ? ' (' + v.label.toLowerCase() + ')' : t(' (variante)', ' (variant)')), v.idea); return; }
  if (act === 'catalog') catalogSheet();
  else if (act === 'add-item') pickIngredient(ci);
  else if (act === 'techs') techSheet(ci);
  else if (act === 'del-comp') {
   const c = cur.components[ci];
   if (c.items.length && !await ask({title: t('¿Quitar este componente?', 'Remove this component?'), text: t('Se quita del plato con sus ingredientes.', 'It is removed from the dish with its ingredients.'), yes: t('Quitar', 'Remove'), danger: true})) return;
   cur.components.splice(ci, 1); touch('components'); redrawComps();
  }
  else if (act === 'to-sub') {
   const c = cur.components[ci];
   if (!c) return;
   const made = await createSub({name: c.name || pick([role(c.role).es, role(c.role).en]) + (cur.name ? t(' de ', ' for ') + cur.name : ''), items: c.items.filter(i => i.src !== 'recipe').map(i => ({n: i.n, k: i.k || null, q: i.q || '', w: i.w})), method: c.method || ''});
   toast(t('Subreceta guardada en Mi cocina: ', 'Sub-recipe saved in My kitchen: ') + made.name);
  }
  else if (act === 'more') moreSheet();
  else if (act === 'print') printFicha();
  else if (act === 'share') shareFicha();
  else if (act === 'team') teamSheet();
  else if (act === 'plating-from-advice') { cur.plating = clip(cur.advice?.plating, 2000); touch('plating'); part('fichaSec', fichaSecHtml()); }
  else if (act === 'restore') { try { await restoreDish(cur.id); cur.deleted_at = null; toast(t('Recuperado.', 'Restored.')); paint(); } catch (err) { toast(friendly(err), 'error'); } }
  else if (act === 'advice') {
   if (cur.components.reduce((n, c) => n + c.items.length, 0) < 2) { toast(t('Añade al menos dos ingredientes al plato.', 'Add at least two ingredients to the dish.'), 'error'); return; }
   const done = await copy(advicePrompt(cur));
   toast(done ? t('Consulta copiada. Pégala en Claude o en ChatGPT.', 'Request copied. Paste it into Claude or ChatGPT.') : t('No se pudo copiar. Prueba otra vez.', 'It could not be copied. Please try again.'), done ? 'info' : 'error');
  }
  else if (act === 'advice-ia') {
   if (cur.components.reduce((n, c) => n + c.items.length, 0) < 2) { toast(t('Añade al menos dos ingredientes al plato.', 'Add at least two ingredients to the dish.'), 'error'); return; }
   const dish = cur; b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('ChatGPT está mirando el plato…', 'ChatGPT is looking at the dish…');
   try {
    const advice = adviceFromReply(await askIa({text: advicePrompt(dish), json: true}));
    if (!advice) throw Object.assign(Error('empty'), {kind: 'empty'});
    dish.advice = advice;
    if (cur === dish) { touch('advice'); part('adviceSec', adviceHtml()); if (!$('#fichaSec', root)?.contains(document.activeElement)) part('fichaSec', fichaSecHtml()); toast(t('Consejo guardado en el plato.', 'Advice saved in the dish.')); }
    else if (dish.id) { await saveDish(dish.id, {advice}); toast(t('Consejo guardado en «', 'Advice saved in “') + dish.name + t('».', '”.')); }
   } catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Pedir consejo a ChatGPT', 'Ask ChatGPT for advice'); } }
  }
  else if (act === 'pair-copy') { const done = await copy(pairingPrompt(cur)); toast(done ? t('Consulta copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  else if (act === 'pair-save') { const text = ($('#pairReply', root)?.value || '').trim(); if (!text) { toast(t('Pega primero la respuesta.', 'Paste the answer first.'), 'error'); return; } cur.pairing = {text: text.slice(0, 4000), at: new Date().toISOString()}; touch('pairing'); part('pairSec', pairingHtml()); toast(t('Maridaje guardado.', 'Pairing saved.')); }
  else if (act === 'pair-ia') {
   if (cur.components.reduce((n, c) => n + c.items.length, 0) < 2) { toast(t('Añade al menos dos ingredientes al plato.', 'Add at least two ingredients to the dish.'), 'error'); return; }
   const dish = cur; b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('Pensando el maridaje…', 'Thinking of a pairing…');
   try { const text = await askIa({text: pairingPrompt(dish)}); dish.pairing = {text: text.trim().slice(0, 4000), at: new Date().toISOString()}; if (cur === dish) { touch('pairing'); part('pairSec', pairingHtml()); } else if (dish.id) await saveDish(dish.id, {pairing: dish.pairing}); }
   catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Proponer maridaje', 'Suggest a pairing'); } }
  }
  else if (act === 'save-advice') {
   const advice = adviceFromReply($('#adviceReply', root).value);
   if (!advice) { toast(t('Pega primero la respuesta.', 'Paste the answer first.'), 'error'); return; }
   cur.advice = advice; touch('advice'); part('adviceSec', adviceHtml()); if (!$('#fichaSec', root)?.contains(document.activeElement)) part('fichaSec', fichaSecHtml()); toast(t('Consejo guardado en el plato.', 'Advice saved in the dish.'));
  }
  else if (act === 'sketch') {
   const {sketchSheet} = await import('../sketch.js');
   sketchSheet(async blob => {
    try {
     if (!cur.id) { dirty.add('name'); await flush(); }
     const path = await uploadImage(cur.id || 'nuevo', blob);
     cur.images = [...cur.images, {id: sid(), path, style: 'boceto', at: new Date().toISOString()}].slice(-12); cur.cover_path = path; touch('images', 'cover_path'); redrawImages(); toast(t('Boceto guardado en el plato.', 'Sketch saved to the dish.'));
    } catch (err) { toast(friendly(err), 'error'); }
   });
  }
  else if (act === 'image') {
   const done = await copy(imagePrompt(cur, style));
   toast(done ? t('Descripción copiada. Pégala en ChatGPT y añade aquí la imagen que te dé.', 'Description copied. Paste it into ChatGPT and add the image it gives you here.') : t('No se pudo copiar. Prueba otra vez.', 'It could not be copied. Please try again.'), done ? 'info' : 'error');
  }
  else if (act === 'del-image') {
   if (!await ask({title: t('¿Quitar esta imagen?', 'Remove this image?'), text: t('Se quita del plato. Puedes crear otra cuando quieras.', 'It is removed from the dish. You can create another at any time.'), yes: t('Quitar', 'Remove'), danger: true})) return;
   const gone = cur.images.find(i => i.path === b.dataset.path);
   if (gone?.id) removedImages.add(gone.id);
   cur.images = cur.images.filter(i => i.path !== b.dataset.path);
   if (cur.cover_path === b.dataset.path) cur.cover_path = cur.images.length ? cur.images[cur.images.length - 1].path : null;
   touch('images', 'cover_path'); redrawImages();
  }
 };
 root.addEventListener('keydown', e => { if (e.target.id === 'tagInput' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addTag(e.target.value); } });
 root.addEventListener('change', e => { if (e.target.id === 'tagInput' && e.target.value) addTag(e.target.value); });
 const onSubmit = e => {
  if (e.target.id !== 'testForm') return;
  e.preventDefault();
  const f = e.target, rating = Number(new FormData(f).get('rating')) || null, text = clip($('#testText', f).value, 1200), next = clip($('#testNext', f).value, 800);
  if (!rating && !text && !next) { toast(t('Pon una nota o escribe cómo salió.', 'Give it a rating or write how it went.'), 'error'); return; }
  cur.tests = [...cur.tests, {id: sid(), at: dayKey(), rating, text, next, by: userName()}].slice(-200);
  touch('tests');
  if (cur.status === 'idea') { cur.status = 'pruebas'; touch('status'); const sel = $('#dishStatus', root); if (sel) { sel.value = 'pruebas'; sel.className = 'status-select status-pruebas'; } toast(t('Prueba apuntada. El plato pasa a «En pruebas».', 'Test logged. The dish moves to “Testing”.')); }
  else toast(t('Prueba apuntada.', 'Test logged.'));
  part('testsSec', testsHtml());
 };
 const onHide = () => { if (document.hidden) flush(); };
 el.addEventListener('input', onInput); el.addEventListener('change', onChange); el.addEventListener('click', onClick); el.addEventListener('submit', onSubmit);
 document.addEventListener('visibilitychange', onHide); addEventListener('online', flush);
 return () => {
  flush();
  el.removeEventListener('input', onInput); el.removeEventListener('change', onChange); el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit);
  document.removeEventListener('visibilitychange', onHide); removeEventListener('online', flush);
  root = null;
 };
}
// Llegan datos nuevos (la tabla de sabores, la cocina): solo se repinta el análisis, nunca lo que se está escribiendo.
export function onData(what, el, params) {
 if (!root) return;
 if (!ready) { open(params); if (ready) paint(); return; }
 if (what !== 'load' && what !== 'settings') return;
 if (!$('#comps', root)?.contains(document.activeElement)) part('comps', compsHtml());
 part('analysis', analysisHtml());
}

// La ficha de cualquier plato (para el recetario completo), sin tocar el plato que esté abierto.
export async function fichaFor(dish) {
 const keep = cur;
 cur = {...dish, components: (dish.components || []).map(c => ({...c, techniques: c.techniques || [], items: c.items || []}))};
 try { return await fichaPrintHtml(); } finally { cur = keep; }
}
