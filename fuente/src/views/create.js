// I+D · Crear: tres formas de empezar un plato (desde cero, con un producto de casa o pidiendo ideas a la IA).
// Las ideas de la IA son borradores: solo entran en la libreta cuando el cocinero abre una.
import {COURSES, dishProfile} from '../flavor-core.js';
import {ideaToDish, recipeToDish} from '../ai-core.js';
import {searchIngredients} from '../kitchen.js';
import {role, technique} from '../flavor-core.js';
import {t, en, seasonOf} from '../i18n.js';
import {esc, icon, $, toast, flavorPrint, uid, friendly} from '../ui.js';
import {state, createDish} from '../store.js';
import {ideasPrompt, ideasFromReply, importPrompt, recipeFromReply, copy} from '../ai.js';
import {go} from '../nav.js';
import {iaOn, askIa, iaMessage, imageData} from '../ia.js';
import {trText, adoptIdea, sectionHead} from './shared.js';

let form = {brief: '', course: '', lead: '', wants: []}, result = null, lastTrend = '', recipe = null, recipeText = '';
export const title = params => (params[0] === 'llegado' ? t('Ha llegado género', 'New produce in') : params[0] === 'ideas' ? t('Dame ideas', 'Give me ideas') : params[0] === 'importar' ? t('Importar receta', 'Import a recipe') : t('Crear', 'Create'));
const lbl = row => (en() ? row[2] : row[1]);
const WANTS = () => [
 ['brasa', t('Con la brasa', 'Over charcoal')], ['compartir', t('Para compartir', 'To share')], ['vegetal', t('Vegetal', 'Plant-based')], ['temporada', t('De temporada', 'Seasonal')],
 ['aprovechamiento', t('De aprovechamiento', 'Zero waste')], ['rapido', t('Rápido en el pase', 'Fast at the pass')], ['atrevido', t('Algo atrevido', 'Something bold')]
];

function launcher() {
 const kb = state.kb, pantry = state.kitchen?.pantry || new Set();
 const leads = kb ? kb.list.filter(i => pantry.has(i.id) && ['carne', 'ave', 'pescado', 'marisco', 'verdura', 'seta', 'queso'].includes(i.family)).slice(0, 60).sort((a, b) => (en() ? a.en.localeCompare(b.en) : a.es.localeCompare(b.es, 'es'))).slice(0, 24) : [];
 return '<header class="page-head"><h1>' + esc(t('Crear', 'Create')) + '</h1><p>' + esc(t('Empieza como quieras. Todo acaba en la mesa de trabajo, donde ves qué sabores dominan y qué le falta al plato.', 'Start however you like. Everything ends at the workbench, where you see which flavours lead and what the dish lacks.')) + '</p></header>' +
  '<div class="tiles tiles-3 tiles-6">' +
  '<a class="tile tile-big" href="#/plato/nuevo">' + icon('plus') + '<strong>' + esc(t('Desde cero', 'From scratch')) + '</strong><span>' + esc(t('Un plato en blanco para montarlo por componentes', 'A blank dish to build from components')) + '</span></a>' +
  '<a class="tile tile-big tile-ember" href="#/crear/ideas">' + icon('spark') + '<strong>' + esc(t('Dame ideas', 'Give me ideas')) + '</strong><span>' + esc(t('Di qué buscas y saca tres propuestas para tu cocina', 'Say what you want and get three proposals for your kitchen')) + '</span></a>' +
  '<a class="tile tile-big" href="#/sabores">' + icon('wheel') + '<strong>' + esc(t('Desde una combinación', 'From a pairing')) + '</strong><span>' + esc(t('Explora qué va con qué y tira del hilo', 'Explore what goes with what and follow the thread')) + '</span></a>' +
  '<a class="tile tile-big" href="#/crear/importar">' + icon('copy') + '<strong>' + esc(t('Importar receta', 'Import a recipe')) + '</strong><span>' + esc(t('De una captura de TikTok, Instagram, una web o un libro', 'From a TikTok or Instagram screenshot, a website or a book')) + '</span></a>' +
  '<a class="tile tile-big" href="#/crear/llegado">' + icon('box') + '<strong>' + esc(t('Ha llegado género', 'New produce in')) + '</strong><span>' + esc(t('Una foto de lo que ha entrado y tres platos para sacarle partido', 'A photo of what came in and three dishes to make the most of it')) + '</span></a>' +
  '<a class="tile tile-big" href="#/menus">' + icon('book') + '<strong>' + esc(t('Montar una carta o menú', 'Build a menu')) + '</strong><span>' + esc(t('Junta platos y mira si el conjunto está equilibrado', 'Put dishes together and check the whole is balanced')) + '</span></a></div>' +
  '<section class="sec">' + sectionHead(t('Con un producto', 'From a product'), '', t('Elige quién manda en el plato y empieza por ahí.', 'Choose what leads the dish and start there.')) +
  '<label class="sr" for="leadSearch">' + esc(t('Buscar producto', 'Search product')) + '</label><div class="searchbox">' + icon('search') + '<input id="leadSearch" type="search" placeholder="' + esc(t('Pulpo, alcachofa, carrillera…', 'Octopus, artichoke, pork cheek…')) + '" autocomplete="off" enterkeyhint="search"></div><div id="leadResults" class="chips"></div>' +
  (leads.length ? '<p class="mini">' + esc(t('Tus básicos', 'Your staples')) + '</p><div class="chips">' + leads.map(i => '<a class="chip chip-have" href="#/plato/nuevo/' + esc(i.id) + '">' + esc(en() ? i.en : i.es) + '</a>').join('') + '</div>' : '') + '</section>';
}

function ideaResult(idea, k) {
 const draft = state.kb ? ideaToDish(state.kb, state.kitchen, idea) : null, profile = draft ? dishProfile(state.kb, draft) : null;
 const comps = idea.components.map(c => { const r = role(c.role), techs = c.techniques.map(technique).filter(Boolean).map(x => (en() ? x.en : x.es)); return '<li><span class="comp-role">' + esc(en() ? r.en : r.es) + '</span><span><strong>' + esc(c.name) + '</strong>' + (techs.length ? ' · ' + esc(techs.join(', ')) : '') + '<br><small>' + esc(c.items.join(', ')) + '</small></span></li>'; }).join('');
 return '<article class="idea-card idea-result"><div class="idea-top"><div><span class="kicker">' + esc(lbl(COURSES.find(c => c[0] === idea.course) || COURSES[COURSES.length - 1])) + '</span><h3>' + esc(idea.name) + '</h3></div>' + (profile && !profile.empty ? flavorPrint(profile.axes, {size: 60}) : '') + '</div>' +
  (idea.line ? '<p>' + esc(idea.line) + '</p>' : '') + '<ul class="comp-list">' + comps + '</ul>' +
  (idea.why ? '<p class="fine"><strong>' + esc(t('Por qué funciona: ', 'Why it works: ')) + '</strong>' + esc(idea.why) + '</p>' : '') + (idea.twist ? '<p class="fine"><strong>' + esc(t('Lo que lo hace tuyo: ', 'What makes it yours: ')) + '</strong>' + esc(idea.twist) + '</p>' : '') +
  (state.canEdit ? '<button type="button" class="btn primary" data-open="' + k + '">' + icon('book') + esc(t('Abrir en la mesa de trabajo', 'Open at the workbench')) + '</button>' : '') + '</article>';
}
function ideasPage(trendId) {
 const trend = trendId ? state.trends.find(x => x.id === trendId) : null;
 if ((trendId || '') !== lastTrend) { result = null; lastTrend = trendId || ''; }
 const can = state.canEdit && !state.setupPending, on = iaOn();
 let html = '<a class="back" href="' + (trend ? '#/radar/' + esc(trend.id) : '#/crear') + '">' + icon('left') + esc(trend ? t('Aviso', 'Alert') : t('Crear', 'Create')) + '</a><header class="page-head"><h1>' + esc(t('Dame ideas', 'Give me ideas')) + '</h1><p>' + esc(t('Cuenta qué buscas, copia la petición y pégala en Claude o en ChatGPT. Luego pega aquí su respuesta y la app te monta las tres propuestas.', 'Say what you are after, copy the request and paste it into Claude or ChatGPT. Then paste the answer here and the app builds the three proposals.')) + '</p></header>';
 if (trend) html += '<div class="notice">' + icon('radar') + '<p><strong>' + esc(t('A partir del aviso: ', 'Based on the alert: ')) + '</strong>' + esc(trText(trend, 'title')) + '</p></div>';
 html += '<form id="ideasForm" class="card form"><label for="brief">' + esc(t('¿Qué buscas?', 'What are you after?')) + '</label><textarea id="brief" rows="3" maxlength="600" placeholder="' + esc(t('Un entrante de invierno para compartir con alcachofa, que no sea otra alcachofa a la brasa sin más…', 'A winter starter to share with artichoke, that is not just another grilled artichoke…')) + '">' + esc(form.brief) + '</textarea>' +
  '<div class="form-row"><div><label for="ideaCourse">' + esc(t('Tipo de plato', 'Type of dish')) + '</label><select id="ideaCourse"><option value="">' + esc(t('Cualquiera', 'Any')) + '</option>' + COURSES.filter(c => c[0] !== 'otro').map(c => '<option value="' + c[0] + '"' + (form.course === c[0] ? ' selected' : '') + '>' + esc(lbl(c)) + '</option>').join('') + '</select></div>' +
  '<div><label for="ideaLead">' + esc(t('Producto principal (opcional)', 'Main product (optional)')) + '</label><input id="ideaLead" value="' + esc(form.lead) + '" maxlength="80" placeholder="' + esc(t('Pulpo, calabaza…', 'Octopus, pumpkin…')) + '" autocomplete="off"></div></div>' +
  '<fieldset class="choice"><legend>' + esc(t('Que sea…', 'Make it…')) + '</legend>' + WANTS().map(([id, label]) => '<button type="button" class="pill' + (form.wants.includes(id) ? ' active' : '') + '" data-want="' + id + '" aria-pressed="' + form.wants.includes(id) + '">' + esc(label) + '</button>').join('') + '</fieldset>' +
  (on ? '<div class="row-actions row-left"><button type="submit" class="btn primary">' + icon('spark') + esc(t('Pedir ideas a ChatGPT', 'Ask ChatGPT for ideas')) + '</button></div><details class="fold fold-quiet"><summary>' + esc(t('Hacerlo copiando y pegando', 'Do it by copy and paste')) + '</summary>' : '') +
  '<div class="row-actions row-left"><button type="button" class="btn ' + (on ? 'ghost' : 'primary') + '" data-act="copy-ideas">' + icon('copy') + esc(t('1 · Copiar la petición', '1 · Copy the request')) + '</button><a class="btn ghost" href="https://claude.ai/new" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a Claude', 'Ask Claude')) + icon('out') + '</a><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
  '<label class="mini" for="ideasReply">' + esc(t('2 · Pega aquí la respuesta', '2 · Paste the answer here')) + '</label><textarea id="ideasReply" rows="4" placeholder="' + esc(t('Pega la respuesta entera, tal cual', 'Paste the whole answer as it is')) + '"></textarea>' +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="ideasReply" data-then="[data-act=read-ideas]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="read-ideas">' + icon('spark') + esc(t('3 · Ver las propuestas', '3 · See the proposals')) + '</button></div>' +
  (on ? '</details>' : '') + '</form>';
 if (result) html += '<section class="sec" id="ideaResults">' + sectionHead(t('Propuestas', 'Proposals'), '', t('Son borradores: abre la que te guste y cámbiala a tu manera.', 'These are drafts: open the one you like and make it yours.')) + '<div class="idea-list">' + result.ideas.map(ideaResult).join('') + '</div>' + (result.issues.length ? '<p class="fine">' + esc(result.issues.join(' ')) + '</p>' : '') + '</section>';
 return html;
}

// ---------- Importar una receta ----------
// Lo que llega al compartir desde otra app del móvil (TikTok, Instagram, el navegador…) entra ya pegado y leído.
export function presetRecipe(text) { recipeText = String(text || '').slice(0, 20000); const r = recipeFromReply(recipeText); recipe = r && r.components.length ? r : null; }
function recipePreview(r) {
 const draft = state.kb ? recipeToDish(state.kb, state.kitchen, r) : null, profile = draft ? dishProfile(state.kb, draft) : null;
 const comps = r.components.map(c => { const ro = role(c.role); return '<li><span class="comp-role">' + esc(en() ? ro.en : ro.es) + '</span><span>' + (c.name ? '<strong>' + esc(c.name) + '</strong><br>' : '') + '<small>' + esc(c.items.map(i => !i.qty ? i.name : /^[\d½¼¾]/.test(i.qty) ? i.qty + ' ' + i.name : i.name + ' ' + i.qty).join(' · ')) + '</small>' + (c.method ? '<br><small class="pre">' + esc(c.method.split('\n').length + t(' pasos', ' steps')) + '</small>' : '') + '</span></li>'; }).join('');
 return '<article class="idea-card idea-result" id="recipePreview"><div class="idea-top"><div><span class="kicker">' + esc(t('Así queda', 'This is how it looks')) + (r.portions ? ' · ' + esc(t('raciones: ', 'portions: ') + r.portions) : '') + '</span><h3>' + esc(r.name || t('Receta importada', 'Imported recipe')) + '</h3></div>' + (profile && !profile.empty ? flavorPrint(profile.axes, {size: 60}) : '') + '</div>' +
  (r.concept ? '<p>' + esc(r.concept) + '</p>' : '') + '<ul class="comp-list">' + comps + '</ul>' + (r.plating ? '<p class="fine"><strong>' + esc(t('Emplatado: ', 'Plating: ')) + '</strong>' + esc(r.plating) + '</p>' : '') +
  (r.issues?.length ? '<p class="fine">' + esc(r.issues.join(' ')) + '</p>' : '') +
  '<button type="button" class="btn primary" data-act="save-recipe">' + icon('book') + esc(t('Guardar en la libreta', 'Save to the notebook')) + '</button></article>';
}
function importPage() {
 return '<a class="back" href="#/crear">' + icon('left') + esc(t('Crear', 'Create')) + '</a><header class="page-head"><h1>' + esc(t('Importar receta', 'Import a recipe')) + '</h1><p>' + esc(t('¿Has visto una receta en TikTok, Instagram o una web? Tráetela a la libreta con sus cantidades y pasos, y luego hazla tuya.', 'Seen a recipe on TikTok, Instagram or a website? Bring it into the notebook with its quantities and steps, then make it yours.')) + '</p></header>' +
  '<div class="card form" id="importForm"><h2>' + esc(t('Si es una captura o un vídeo', 'If it is a screenshot or a video')) + '</h2>' +
  (iaOn() ? '<p class="fine">' + esc(t('Elige la captura (o varias, si la receta ocupa más de una) y ChatGPT la lee y la monta.', 'Choose the screenshot (or several, if the recipe spans more than one) and ChatGPT reads and builds it.')) + '</p><div class="row-actions row-left"><label class="btn primary" for="recipeShot">' + icon('image') + '<span>' + esc(t('Elegir captura o foto', 'Choose screenshot or photo')) + '</span></label><input id="recipeShot" class="sr" type="file" accept="image/*" multiple></div><details class="fold fold-quiet"><summary>' + esc(t('Hacerlo copiando y pegando', 'Do it by copy and paste')) + '</summary>' : '') +
  '<ol class="steps-list"><li>' + esc(t('Pulsa «Preguntar a ChatGPT» (o a Claude): se abre con la instrucción ya escrita.', 'Tap “Ask ChatGPT” (or Claude): it opens with the instruction already written.')) + '</li><li>' + esc(t('Adjunta allí la captura (o pega el enlace o el texto del vídeo) y envía.', 'Attach the screenshot there (or paste the link or the video text) and send.')) + '</li><li>' + esc(t('Copia lo que conteste, vuelve aquí y pulsa «Pegar y leer».', 'Copy its answer, come back here and tap “Paste and read”.')) + '</li></ol>' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="copy-import">' + icon('copy') + esc(t('Copiar la instrucción', 'Copy the instruction')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a><a class="btn ghost" href="https://claude.ai/new" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a Claude', 'Ask Claude')) + icon('out') + '</a></div>' +
  (iaOn() ? '</details>' : '') +
  '<h2>' + esc(t('Si es texto, pégalo tal cual', 'If it is text, paste it as it is')) + '</h2><p class="fine">' + esc(t('La descripción del vídeo, una web, un mensaje… La app separa ingredientes, cantidades y pasos sin conexión.', 'The video caption, a website, a message… The app separates ingredients, quantities and steps offline.')) + '</p>' +
  '<label class="sr" for="recipeReply">' + esc(t('Respuesta o texto de la receta', 'Answer or recipe text')) + '</label><textarea id="recipeReply" rows="7" placeholder="' + esc(t('Pega aquí la respuesta de ChatGPT o Claude, o el texto de la receta', 'Paste the ChatGPT or Claude answer here, or the recipe text')) + '">' + esc(recipeText) + '</textarea>' +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="recipeReply" data-then="[data-act=read-recipe]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="read-recipe">' + icon('spark') + esc(t('Leer la receta', 'Read the recipe')) + '</button></div></div>' +
  (recipe ? '<section class="sec">' + recipePreview(recipe) + '</section>' : '');
}
function mountImport(root) {
 root.addEventListener('input', e => { if (e.target.id === 'recipeReply') recipeText = e.target.value; });
 root.addEventListener('change', e => { if (e.target.id === 'recipeShot' && e.target.files.length) readShots([...e.target.files]).finally(() => { e.target.value = ''; }); });
 // Lee una o varias capturas con ChatGPT (elegidas en la galería o pegadas en el recuadro).
 async function readShots(all) {
  const files = all.slice(0, 4), label = $('label[for=recipeShot]', root);
  label?.classList.add('is-busy'); if (label) label.lastChild.textContent = t('ChatGPT está leyendo la receta…', 'ChatGPT is reading the recipe…');
  try {
   const images = [];
   for (const f of files) images.push(await imageData(f));
   const r = recipeFromReply(await askIa({text: importPrompt() + '\n\nTe paso ' + (images.length === 1 ? 'la captura' : 'las ' + images.length + ' capturas, en orden') + '.', images, json: true}));
   if (!r || !r.components.length) throw Object.assign(Error('empty'), {kind: 'empty'});
   recipe = r; root.innerHTML = importPage(); $('#recipePreview', root)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (err) {
   toast(err?.message === 'image' ? t('No se pudo abrir esa imagen.', 'That image could not be opened.') : err?.kind === 'empty' ? t('ChatGPT no ha encontrado una receta en esa imagen.', 'ChatGPT found no recipe in that image.') : iaMessage(err), 'error', 7000);
   if (label?.isConnected) { label.classList.remove('is-busy'); label.lastChild.textContent = t('Elegir captura o foto', 'Choose screenshot or photo'); }
  }
 }
 root.addEventListener('paste', e => {
  if (e.target.id !== 'recipeReply' || !e.clipboardData) return;
  const pics = [...e.clipboardData.items].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
  if (pics.length && !e.clipboardData.getData('text') && iaOn()) { e.preventDefault(); readShots(pics); return; }
  if (pics.length && !e.clipboardData.getData('text')) { e.preventDefault(); toast(t('Eso es una imagen: pégala en ChatGPT o Claude con la instrucción y trae aquí lo que conteste.', 'That is an image: paste it into ChatGPT or Claude with the instruction and bring back the answer.'), 'error', 6000); }
 });
 root.addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'copy-import') { const done = await copy(importPrompt()); toast(done ? t('Instrucción copiada. Pégala en ChatGPT o Claude junto a la captura.', 'Instruction copied. Paste it into ChatGPT or Claude with the screenshot.') : t('No se pudo copiar. Prueba otra vez.', 'It could not be copied. Please try again.'), done ? 'info' : 'error'); }
  if (act === 'read-recipe') {
   const text = $('#recipeReply', root).value;
   let r = null;
   // Con ChatGPT conectado, un texto normal (no su respuesta en JSON) lo lee ChatGPT; si falla, lo lee la app.
   if (iaOn() && text.trim() && !/^\s*[{[`]/.test(text) && !/```/.test(text)) {
    const b = e.target.closest('button'); b.disabled = true; b.classList.add('is-busy');
    try { r = recipeFromReply(await askIa({text: importPrompt() + '\n\nLA RECETA:\n' + text.slice(0, 20000), json: true})); } catch (err) { toast(iaMessage(err) + ' ' + t('La leo yo sin ChatGPT.', 'I will read it without ChatGPT.'), 'error', 6000); }
    finally { if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); } }
   }
   r = r && r.components.length ? r : recipeFromReply(text);
   if (!r || !r.components.length) { toast(t('No encuentro ingredientes en ese texto. Pega la receta entera o la respuesta de la IA.', 'I cannot find ingredients in that text. Paste the whole recipe or the AI answer.'), 'error'); return; }
   recipe = r; root.innerHTML = importPage(); $('#recipePreview', root)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  if (act === 'save-recipe' && recipe) {
   if (!state.kb) { toast(t('Un momento: se está cargando la tabla de sabores.', 'One moment: the flavour table is loading.')); return; }
   const b = e.target.closest('button'); b.disabled = true;
   try { const dish = await createDish({...recipeToDish(state.kb, state.kitchen, recipe, () => uid().slice(0, 8)), season: seasonOf().key}); recipe = null; recipeText = ''; toast(t('En tu libreta: ', 'In your notebook: ') + dish.name); go('plato/' + dish.id); }
   catch (err) { b.disabled = false; toast(friendly(err), 'error'); }
  }
 });
}

// ---------- Ha llegado género: fotos o texto de lo que ha entrado → tres platos ----------
let arrived = {text: '', photos: []};
function arrivedPage() {
 const on = iaOn();
 return '<a class="back" href="#/crear">' + icon('left') + esc(t('Crear', 'Create')) + '</a><header class="page-head"><h1>' + esc(t('Ha llegado género', 'New produce in')) + '</h1><p>' + esc(t('Haz una foto de lo que ha entrado (pescado de lonja, una caja de setas, la verdura de hoy) o escríbelo, y te propone tres platos con tus básicos y tu brasa.', 'Take a photo of what came in (fish from the market, a box of mushrooms, today\'s vegetables) or write it, and get three dishes with your staples and your grill.')) + '</p></header>' +
  '<form id="arrivedForm" class="card form">' +
  (on ? '<div class="row-actions row-left"><label class="btn ghost" for="arrivedPhoto">' + icon('image') + '<span>' + esc(t('Hacer foto o elegir', 'Take or choose photo')) + '</span></label><input id="arrivedPhoto" class="sr" type="file" accept="image/*" multiple></div><div id="arrivedPics" class="pending">' + arrived.photos.map((_, k) => '<span class="chip chip-static">' + icon('image') + esc(t('Foto ', 'Photo ') + (k + 1)) + '<button type="button" class="iconbtn" data-unpic="' + k + '" aria-label="' + esc(t('Quitar foto', 'Remove photo')) + '">' + icon('x') + '</button></span>').join('') + '</div>' : '') +
  '<label for="arrivedText">' + esc(t('Qué ha llegado (y cuánto, si importa)', 'What came in (and how much, if it matters)')) + '</label><textarea id="arrivedText" data-voice rows="3" maxlength="600" placeholder="' + esc(t('6 kg de rape, una caja de níscalos, calabaza de la huerta…', '6 kg of monkfish, a box of saffron milk caps, pumpkin from the garden…')) + '">' + esc(arrived.text) + '</textarea>' +
  (on ? '<div class="row-actions row-left"><button type="submit" class="btn primary">' + icon('spark') + esc(t('Proponer platos', 'Suggest dishes')) + '</button></div>'
   : '<p class="fine">' + esc(t('Con ChatGPT conectado (Ajustes) basta con la foto. Sin conectar: escribe lo que ha llegado, pulsa «Preguntar a ChatGPT», adjunta allí la foto si quieres, y trae la respuesta.', 'With ChatGPT connected (Settings) a photo is enough. Without it: write what came in, tap “Ask ChatGPT”, attach the photo there if you like, and bring back the answer.')) + '</p><div class="row-actions row-left"><button type="button" class="btn primary" data-act="copy-arrived">' + icon('copy') + esc(t('Copiar la petición', 'Copy the request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
     '<label class="mini" for="ideasReply">' + esc(t('Pega aquí la respuesta', 'Paste the answer here')) + '</label><textarea id="ideasReply" rows="3"></textarea><div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="ideasReply" data-then="[data-act=read-ideas]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="read-ideas">' + icon('spark') + esc(t('Ver las propuestas', 'See the proposals')) + '</button></div>') +
  '</form>' + (result && result.from === 'arrived' ? '<section class="sec" id="ideaResults">' + sectionHead(t('Propuestas', 'Proposals'), '', t('Son borradores: abre la que te guste y cámbiala a tu manera.', 'These are drafts: open the one you like and make it yours.')) + '<div class="idea-list">' + result.ideas.map(ideaResult).join('') + '</div>' + (result.issues.length ? '<p class="fine">' + esc(result.issues.join(' ')) + '</p>' : '') + '</section>' : '');
}
const arrivedBrief = () => t('Ha llegado este género a la cocina', 'This produce has just come into the kitchen') + (arrived.text.trim() ? ': ' + arrived.text.trim() : '') + (arrived.photos.length ? t(' (mira las fotos: identifica el producto, su calidad y cantidad aproximada)', ' (look at the photos: identify the product, its quality and rough quantity)') : '') + t('. Propón platos para sacarle partido esta semana, aprovechándolo entero.', '. Suggest dishes to make the most of it this week, using all of it.');
function mountArrived(root) {
 const repaint = () => { if (root.isConnected) { root.innerHTML = arrivedPage(); } };
 root.addEventListener('input', e => { if (e.target.id === 'arrivedText') arrived.text = e.target.value; });
 root.addEventListener('change', async e => {
  if (e.target.id !== 'arrivedPhoto') return;
  for (const f of [...e.target.files].slice(0, 3 - arrived.photos.length)) { try { arrived.photos.push(await imageData(f)); } catch { toast(t('No se pudo abrir esa imagen.', 'That image could not be opened.'), 'error'); } }
  arrived.text = $('#arrivedText', root)?.value || arrived.text; repaint();
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.unpic) { arrived.photos.splice(Number(b.dataset.unpic), 1); repaint(); return; }
  if (b.dataset.act === 'copy-arrived') {
   if (!arrived.text.trim()) { toast(t('Escribe qué ha llegado.', 'Write what came in.'), 'error'); return; }
   const done = await copy(ideasPrompt({brief: arrivedBrief()})); toast(done ? t('Petición copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error');
  }
  if (b.dataset.act === 'read-ideas') { const clean = ideasFromReply($('#ideasReply', root).value); if (!clean.ideas.length) { toast(t('No encuentro las propuestas en ese texto.', 'I cannot find the proposals in that text.'), 'error'); return; } result = {...clean, from: 'arrived'}; repaint(); $('#ideaResults', root)?.scrollIntoView({behavior: 'smooth', block: 'start'}); }
  const open = b.closest('[data-open]');
  if (open && result) { const idea = result.ideas[Number(open.dataset.open)]; if (idea) { open.disabled = true; await adoptIdea(idea, {kind: 'ideas', title: arrived.text.slice(0, 140) || t('Género recién llegado', 'Fresh produce')}); } }
 });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'arrivedForm') return;
  e.preventDefault();
  if (!arrived.text.trim() && !arrived.photos.length) { toast(t('Haz una foto o escribe qué ha llegado.', 'Take a photo or write what came in.'), 'error'); return; }
  const b = e.submitter || $('#arrivedForm button[type=submit]', root); b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('ChatGPT está mirando el género…', 'ChatGPT is looking at the produce…');
  try {
   const clean = ideasFromReply(await askIa({text: ideasPrompt({brief: arrivedBrief()}), images: arrived.photos, json: true}));
   if (!clean.ideas.length) throw Object.assign(Error('empty'), {kind: 'empty'});
   result = {...clean, from: 'arrived'}; repaint(); $('#ideaResults', root)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Proponer platos', 'Suggest dishes'); } }
 });
}

export const render = params => (params[0] === 'llegado' ? arrivedPage() : params[0] === 'ideas' ? ideasPage(params[1]) : params[0] === 'importar' ? importPage() : launcher());

export function mount(root, params) {
 if (params[0] === 'importar') { mountImport(root); return null; }
 if (params[0] === 'llegado') { mountArrived(root); return null; }
 if (params[0] !== 'ideas') {
  const input = $('#leadSearch', root), box = $('#leadResults', root);
  if (input) input.oninput = () => {
   const q = input.value.trim();
   box.innerHTML = q.length < 2 || !state.kb ? '' : searchIngredients(state.kb, state.kitchen, q, {limit: 12, english: en()}).filter(r => r.item.k).map(r => '<a class="chip' + (r.have ? ' chip-have' : '') + '" href="#/plato/nuevo/' + esc(r.item.k) + '">' + esc(r.label) + (r.type === 'recipe' ? '<small>' + esc(t('subreceta tuya', 'your sub-recipe')) + '</small>' : r.have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : '') + '</a>').join('') || '<p class="hint">' + esc(t('No lo encuentro en la tabla. Empieza desde cero y escríbelo tal cual.', 'I cannot find it in the table. Start from scratch and type it as it is.')) + '</p>';
  };
  return null;
 }
 const trend = params[1] ? state.trends.find(x => x.id === params[1]) : null;
 const repaint = () => { if (root.isConnected) { root.innerHTML = ideasPage(params[1]); } };
 root.addEventListener('input', e => { if (e.target.id === 'brief') form.brief = e.target.value; if (e.target.id === 'ideaLead') form.lead = e.target.value; });
 root.addEventListener('change', e => { if (e.target.id === 'ideaCourse') form.course = e.target.value; });
 root.addEventListener('click', async e => {
  const want = e.target.closest('[data-want]');
  if (want) { const id = want.dataset.want; form.wants = form.wants.includes(id) ? form.wants.filter(x => x !== id) : [...form.wants, id]; want.classList.toggle('active', form.wants.includes(id)); want.setAttribute('aria-pressed', form.wants.includes(id)); return; }
  const openBtn = e.target.closest('[data-open]');
  if (openBtn && result) { const idea = result.ideas[Number(openBtn.dataset.open)]; if (!idea) return; openBtn.disabled = true; await adoptIdea(idea, trend ? {kind: 'radar', trend_id: trend.id, title: trend.title} : {kind: 'ideas', title: form.brief.slice(0, 140) || idea.name}); if (openBtn.isConnected) openBtn.disabled = false; }
 });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'ideasForm') return;
  e.preventDefault();
  if (iaOn()) { askIdeas(e.submitter || $('#ideasForm button[type=submit]', root)); return; }
  copyIdeas();
 });
 root.addEventListener('click', e => { if (e.target.closest('[data-act=copy-ideas]')) copyIdeas(); });
 const hasBrief = () => form.brief.trim() || form.lead.trim() || trend || form.wants.length;
 async function askIdeas(b) {
  if (!hasBrief()) { toast(t('Cuenta algo: qué buscas o con qué producto.', 'Say something: what you are after or which product.'), 'error'); return; }
  b.disabled = true; b.classList.add('is-busy'); const label = b.lastChild.textContent; b.lastChild.textContent = t('ChatGPT está pensando platos…', 'ChatGPT is thinking up dishes…');
  try {
   const clean = ideasFromReply(await askIa({text: ideasPrompt({...form, trend}), json: true}));
   if (!clean.ideas.length) throw Object.assign(Error('empty'), {kind: 'empty'});
   result = clean; repaint(); $('#ideaResults', root)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = label; } }
 }
 async function copyIdeas() {
  if (!form.brief.trim() && !form.lead.trim() && !trend && !form.wants.length) { toast(t('Cuenta algo: qué buscas o con qué producto.', 'Say something: what you are after or which product.'), 'error'); return; }
  const done = await copy(ideasPrompt({...form, trend}));
  toast(done ? t('Petición copiada. Pégala en Claude o en ChatGPT.', 'Request copied. Paste it into Claude or ChatGPT.') : t('No se pudo copiar. Prueba otra vez.', 'It could not be copied. Please try again.'), done ? 'info' : 'error');
 }
 root.addEventListener('click', e => {
  if (!e.target.closest('[data-act=read-ideas]')) return;
  const clean = ideasFromReply($('#ideasReply', root).value);
  if (!clean.ideas.length) { toast(t('No encuentro las propuestas en ese texto. Pega la respuesta entera.', 'I cannot find the proposals in that text. Paste the whole answer.'), 'error'); return; }
  result = clean; repaint(); $('#ideaResults', root)?.scrollIntoView({behavior: 'smooth', block: 'start'});
 });
 return null;
}
// Mientras se escribe la petición no se repinta la pantalla.
export function onData() {}
