// I+D · Biblioteca: el cerebro de cocina. Se entra por una pregunta («¿Qué quieres saber?»), se busca o se elige un estante,
// y cada entrada se lee por partes (pestañas), sin soltar toda la información de golpe. Las versiones propias nunca se borran.
import {t, en, relDay, shortDate} from '../i18n.js';
import {esc, icon, $, $$, toast, clip, sheet, shareText} from '../ui.js';
import {docById, saveDoc} from '../store.js';
import {state, saberMine, addSaberVersion, saveSaberEntry, trashSaberEntry, liveSubs, liveDishes, addSaberGuide, uploadImage, imageUrl} from '../store.js';
import {entries, entryById, search, searchInfo, backlinks, CATS, slug, builtIds} from '../saber/index.js';
import {attachSuggest} from './ksuggest.js';
import {iaOn, askIa, iaMessage, makeImage} from '../ia.js';
import {shrinkImage} from '../ai.js';
import {copy, parseReply} from '../ai.js';
import {emptyState, thermScale, tempMarks} from './shared.js';
import {go} from '../nav.js';
import {technique} from '../flavor-core.js';
import {pathsHtml} from './paths.js';
import {cardsFor} from './train.js';
import {bookSheet, printBook} from './kbook.js';
import {compareSheet} from './kcompare.js';
import {GLOSSARY} from '../saber/glosario.js';
// «Para ti»: fichas que casan con los intereses de Mi cocina (brasa, marisco, México, fermentos…).
const INTEREST_WORDS = {'brasa': 'brasa', 'verdura a la brasa': 'verduras brasa', 'pescado y marisco': 'pescado marisco', 'postres': 'crema|merengue|helado|flao', 'asia': 'dashi|tempura|miso|ponzu', 'mexico': 'chiles', 'méxico': 'chiles', 'casqueria': 'casqueria', 'casquería': 'casqueria', 'encurtidos y fermentos': 'fermentacion|encurtidos', 'sin alcohol': 'maridaje sin alcohol', 'cocina ibicenca': 'ibicenca|flao|almendra', 'para compartir': 'picada'};
function forYouHtml() {
 const ints = (state.settings?.interests || []).map(x => String(x).toLowerCase());
 if (!ints.length) return '';
 const seen = new Set(), out = [];
 for (const i of ints) for (const e of (INTEREST_WORDS[i] || i).split('|').flatMap(q => search(q, 3))) if (!seen.has(e.id)) { seen.add(e.id); out.push([i, e]); }
 return out.length ? '<section class="sec"><h2 class="day">' + esc(t('Para ti, según tus intereses', 'For you, from your interests')) + '</h2><div class="chips kforyou">' + out.slice(0, 18).map(([, e]) => '<a class="chip" href="' + href(e.id) + '">' + esc(e.name) + '</a>').join('') + '</div><p class="fine">' + esc(t('Cambia tus intereses en Mi cocina.', 'Change your interests in My kitchen.')) + '</p></section>' : '';
}

let query = '', category = '', fixes = false, activeTab = null, tabFor = '';
const SEEN = 'id-cocina-biblioteca-vistas';
const FAVORITES = 'id-cocina-biblioteca-favoritas';
export const title = params => (params[0] === 'diccionario' ? t('Diccionario de cocina', 'Kitchen dictionary') : params[0] === 'estante' ? shelfName(params[1]) : params[0] ? entryById(params[0])?.name || t('Biblioteca', 'Library') : t('Biblioteca', 'Library'));
export const presetSaber = q => { query = String(q || ''); category = ''; fixes = false; };
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SHELF = {
 salsas: ['drop', t('Madres y derivadas, emulsiones, salsas españolas y del mundo.', 'Mother sauces and derivatives, emulsions, Spanish and world sauces.')],
 tecnicas: ['flame', t('Fuego y brasa, punto de la carne, baja temperatura, confitado, fritura, curado, fermentación, ahumado, espumas, crujientes y técnicas de verdura.', 'Fire and embers, meat doneness, low temperature, confit, frying, curing, fermentation, smoking, foams, crisps and vegetable techniques.')],
 dulce: ['star', t('Cremas, merengues, caramelo, ganache, helados, masas quebradas, pasta fresca, masa madre y dulces de la isla.', 'Creams, meringues, caramel, ganache, ice cream, shortcrust, fresh pasta, sourdough and island sweets.')],
 producto: ['box', t('Arroces, marisco, pescado, cortes de vacuno, maduración, especias, hierbas y aceite de oliva.', 'Rice, shellfish, fish, beef cuts, dry-ageing, spices, herbs and olive oil.')],
 creatividad: ['spark', t('Construir un plato, contraste, acidez, umami, ritmo de un menú, contar un plato, maridaje sin alcohol y cocina ibicenca.', 'Building a dish, contrast, acidity, umami, pacing a menu, describing a dish, non-alcoholic pairing and Ibizan cooking.')],
 fondos: ['pan', t('Fondos claros y oscuros, fumets, jugos, glasas y consomés.', 'Light and dark stocks, fish stocks, jus, glazes and consommés.')],
 bases: ['leaf', t('Sofritos, picadas, aromáticos, salmueras, marinadas y aliños.', 'Sofritos, picadas, aromatics, brines, marinades and dressings.')],
 conceptos: ['spark', t('Roux, ligazones y emulsiones: el porqué de las cosas.', 'Roux, thickeners and emulsions: why things work.')],
 cortes: ['flame', t('Cortes de verdura y despiece de carnes, aves y pescados.', 'Vegetable cuts and butchery of meat, poultry and fish.')],
 mias: ['user', t('Lo que has añadido tú.', 'What you have added.')]
};
const shelfName = id => { const c = CATS.find(x => x[0] === id); return c ? (en() ? c[2] : c[1]) : t('Estante', 'Shelf'); };
const href = (id, tab) => '#/biblioteca/' + esc(id) + (tab ? '/' + tab : '');

// Texto con enlaces: [[id]] o [[id|texto]] a otras entradas; lo que no existe se queda como texto.
function linked(text) {
 const source = String(text || '');
 let html = '', end = 0;
 for (const match of source.matchAll(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g)) {
  const [syntax, id, label] = match, entry = entryById(id.trim());
  const labelHtml = esc(label || entry?.name || id);
  html += esc(source.slice(end, match.index)) + (entry ? '<a class="kref" href="' + href(entry.id) + '">' + labelHtml + '</a>' : labelHtml);
  end = match.index + syntax.length;
 }
 return html + esc(source.slice(end));
}
const para = text => String(text || '').split(/\n{2,}/).filter(Boolean).map(p => '<p>' + linked(p).replace(/\n/g, '<br>') + '</p>').join('');
const flat = text => linked(text).replace(/<a[^>]*>|<\/a>/g, '');

// Lo último que has abierto (solo en este aparato).
const storedIds = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const seen = () => storedIds(SEEN);
// Las favoritas viajan entre el PC y el móvil (documento «favoritas:lista»); las antiguas de este aparato se conservan.
const FAV_DOC = 'favoritas:lista';
const favorites = () => { const d = docById(FAV_DOC); return Array.isArray(d?.ids) ? d.ids : storedIds(FAVORITES); };
// Nuevo en la Biblioteca: fichas que aún no has visto en la lista (por aparato). La primera vez cuentan como nuevas
// las últimas que se han añadido.
const KNOWN = 'id-cocina-biblioteca-conocidas';
const RECENT = ['flao', 'greixonera', 'orelletes-y-bunyols', 'glaseado-de-verduras', 'asado-de-verduras', 'encurtidos-rapidos', 'tempura', 'ponzu-y-salsas-citricas', 'miso-y-koji', 'ceviche-y-crudos', 'pato', 'cordero', 'legumbres', 'salazones-y-huevas', 'pollo-y-aves', 'chocolate-y-templado', 'hojaldre', 'bizcochos', 'quesos-en-cocina', 'citricos', 'tomate', 'gelificantes-y-espesantes', 'esferificacion', 'papillote-y-vapor', 'tarta-de-queso', 'crema-catalana-y-flan', 'mousses-y-cremosos', 'sable-y-galletas', 'brioche', 'masas-laminadas-fermentadas', 'tejas-y-crujientes-dulces', 'frutas-en-almibar', 'fruta-asada', 'coulis-y-geles-de-fruta', 'caldo-de-roca', 'caldo-de-verduras-tostadas', 'fondo-oscuro-de-ave', 'grasas-infusionadas', 'sales-aromaticas', 'tomate-confitado', 'salsa-tahina-limon', 'ensalada-de-hierbas', 'labneh', 'crema-ajo-asado', 'menu-de-temporada', 'producto-de-la-isla', 'catas-y-notas', 'de-la-tecnica-al-plato'];
const known = () => { try { const v = localStorage.getItem(KNOWN); if (v) return new Set(JSON.parse(v)); } catch {} return new Set(entries().map(e => e.id).filter(id => !RECENT.includes(id))); };
const fresh = () => { const k = known(); return entries().filter(e => !e.mine && !k.has(e.id)); };
// Una ficha al azar, mejor una que aún no hayas leído.
function randomEntry() {
 const read = docById('lectura:estado')?.read || {}, all = entries().filter(e => !e.mine), unread = all.filter(e => !read[e.id]);
 const pool = unread.length ? unread : all;
 return pool[Math.floor(Math.random() * pool.length)];
}
const markSeen = id => { try { localStorage.setItem(SEEN, JSON.stringify([id, ...seen().filter(x => x !== id)].slice(0, 8))); } catch {} };

// ---------- Inicio: «¿Qué quieres saber?» ----------
function row(e, tab) {
 return '<li><a class="krow" href="' + href(e.id, tab) + '"><span class="krow-name">' + esc(e.name) + (saberMine(e.id)?.versions?.length ? '<span class="kmine">' + esc(t('tu versión', 'your version')) + '</span>' : '') + '</span><span class="krow-sum">' + flat(clip(e.summary || '', 160)) + '</span></a></li>';
}
const hasSearch = () => !!(query.trim() || category || fixes);
// La Biblioteca no se acaba: lo que no está escrito tal cual, se escribe ahora con el mismo formato que las demás.
const exactEntry = q => { const n = norm(q).replace(/[^a-z0-9ñ ]+/g, ' ').trim(); return entries().find(e => [e.name, ...(e.aka || [])].some(x => norm(x).replace(/[^a-z0-9ñ ]+/g, ' ').trim() === n)) || null; };
function createBlock(q, alone) {
 const title = alone ? t('«', '“') + q + t('» aún no está en tu Biblioteca', '” is not in your library yet') : t('¿Buscas «', 'Looking for “') + q + t('» tal cual?', '” exactly?');
 const sub = iaOn() ? t('ChatGPT escribe ahora su ficha completa, con el mismo formato que las demás: receta base o método, proporciones según el uso, temperaturas, claves, errores, conservación y servicio. Se queda guardada en tu Biblioteca y en el móvil.', 'ChatGPT writes its full entry now, in the same format as the rest. It stays in your library and on your phone.')
  : t('Copia la petición, pégala en ChatGPT y pega aquí su respuesta: la ficha queda guardada en tu Biblioteca. Para hacerlo en un paso, conecta ChatGPT en Ajustes.', 'Copy the request, paste it into ChatGPT and paste its answer here. To do it in one step, connect ChatGPT in Settings.');
 return '<section class="kcreate' + (alone ? ' is-alone' : '') + '" aria-labelledby="kcreateT"><h2 id="kcreateT">' + esc(title) + '</h2><p>' + esc(sub) + '</p>' +
  (iaOn() ? '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="create-ia">' + icon('spark') + '<span>' + esc(t('Escribir la ficha de «', 'Write the entry for “') + q + t('»', '”')) + '</span></button></div><p class="fine" id="kcreateStatus" role="status"></p>'
   : '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="create-copy">' + icon('copy') + esc(t('1. Copiar la petición', '1. Copy the request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" target="_blank" rel="noopener">' + icon('out') + esc(t('2. Abrir ChatGPT', '2. Open ChatGPT')) + '</a></div>' +
     '<label class="mini" for="kReply">' + esc(t('3. Pega aquí la respuesta de ChatGPT', '3. Paste the ChatGPT answer here')) + '</label><textarea id="kReply" rows="5"></textarea><div class="row-actions row-left"><button type="button" class="btn ghost" data-act="create-save">' + icon('check') + esc(t('4. Guardar la ficha', '4. Save the entry')) + '</button></div>') + '</section>';
}
function results() {
 const q = query.trim();
 if (!hasSearch()) return {status: '', html: ''};
 const info = q ? searchInfo(q, Infinity, {category, fixes}) : null;
 const list = q ? info.list :
  entries().filter(e => (!category || e.cat === category) && (!fixes || e.errors?.length)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
 const status = list.length === 1 ? t('1 entrada', '1 entry') : list.length + t(' entradas', ' entries');
 if (list.length) { const rows = list.map(e => row(e, fixes ? 'trucos' : undefined)), offer = q.length >= 3 && !category && !fixes && !info?.guessed && !exactEntry(q) ? createBlock(q, false) : '', cut = Math.min(5, rows.length);
  const dym = info?.guessed ? '<p class="kdym">' + esc(t('No hay nada escrito como «', 'Nothing is written as “') + q + t('». Quizá buscas ', '”. Maybe you mean ')) + '<a href="' + href(list[0].id) + '">' + esc(list[0].name) + '</a>' + esc(list.length > 1 ? t(' o alguna de estas:', ' or one of these:') : '.') + '</p>' : '';
  return {status, html: dym + '<ul class="krows">' + rows.slice(0, cut).join('') + '</ul>' + offer + (rows.length > cut ? '<ul class="krows">' + rows.slice(cut).join('') + '</ul>' : '')}; }
 if (category || fixes) return {status: t('No hay coincidencias con estos filtros.', 'No matches with these filters.'), html: ''};
 return {status, html: createBlock(q, true)};
}
const STARTERS = ['bechamel', 'mayonesa', 'fumet', 'holandesa', 'romesco', 'jugo-de-carne'];
const GUIDES = [
 ['Técnicas para verduras', 'Vegetable techniques', t('Dora con dos zonas de calor o usa vapor antes de marcar.', 'Brown in two heat zones or steam before grilling.'), ['verduras-a-la-brasa', 'verduras-al-vapor', 'escaldado-de-verduras'], 'metodo'],
 ['Salsas que se cortan', 'Split sauces', t('Distingue si falló la emulsión en frío o al calentarla.', 'Check whether the emulsion broke cold or over heat.'), ['mayonesa', 'holandesa'], 'trucos'],
 ['Jugos para carnes a la brasa', 'Jus for grilled meats', t('Consulta el fondo de partida y cómo llevarlo a un jugo de servicio.', 'Look up the starting stock and how to turn it into a jus for service.'), ['fondo-oscuro', 'jugo-de-carne'], 'receta'],
 ['Contrastes para la brasa', 'Contrasts for grilled dishes', t('Elige entre una base cremosa, un acabado crujiente y un aliño ácido.', 'Choose a creamy base, a crunchy finish or a sharp dressing.'), ['crema-berenjena-brasa', 'migas-limon', 'vinagreta-piparras'], 'receta'],
 ['Guarniciones listas para el pase', 'Sides ready for service', t('Añade una verdura asada, un puré o una salsa fría a tu plato.', 'Add a roast vegetable, a purée or a chilled sauce to your dish.'), ['patata-chafada-brasa', 'crema-garbanzos-comino', 'pimientos-asados-alinados'], 'receta'],
 ['Salsas para pescado y verdura', 'Sauces for fish and vegetables', t('Elige entre una salsa de frutos secos y una emulsión caliente de mantequilla.', 'Choose between a nut sauce and a warm butter emulsion.'), ['romesco', 'beurre-blanc', 'alino-alcaparras-limon'], 'receta']
];
function homeHtml() {
 const all = entries(), filtering = hasSearch(), result = results();
 const last = seen().map(entryById).filter(Boolean).slice(0, 4), mineList = Object.values(state.saber || {}).filter(x => x?.versions?.length && !x.deleted_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 4).map(x => entryById(x.id)).filter(Boolean);
 const saved = favorites().map(entryById).filter(Boolean);
 const trash = Object.values(state.saber || {}).filter(x => x?.custom && x.deleted_at);
 const shelves = CATS.map(([id]) => [id, all.filter(e => (e.cat || 'conceptos') === id).length]).filter(([, n]) => n);
 return '<section class="kwelcome"><h1>' + esc(t('¿Qué quieres saber?', 'What do you want to know?')) + '</h1><p>' + esc(t('Cualquier elaboración, técnica o producto. Si aún no está escrita, se escribe al momento con el mismo formato que las demás.', 'Any preparation, technique or product. If it is not written yet, it gets written right away in the same format.')) + '</p>' +
  '<label class="sr" for="saberQ">' + esc(t('Buscar en la Biblioteca', 'Search the library')) + '</label><div class="searchbox searchbox-big kask">' + icon('search') + '<input id="saberQ" type="search" aria-controls="saberRes" value="' + esc(query) + '" placeholder="' + esc(t('Migas crujientes, coliflor, grumos…', 'Crunchy crumbs, cauliflower, lumps…')) + '" autocomplete="off" enterkeyhint="search"></div>' +
  '<div class="ksearch-filters"><label for="saberCategory">' + esc(t('Estante', 'Shelf')) + '</label><select id="saberCategory"><option value="">' + esc(t('Todos los estantes', 'All shelves')) + '</option>' + shelves.map(([id]) => '<option value="' + esc(id) + '"' + (category === id ? ' selected' : '') + '>' + esc(shelfName(id)) + '</option>').join('') + '</select><label class="kfix-filter"><input id="saberFixes" type="checkbox"' + (fixes ? ' checked' : '') + '> ' + esc(t('Buscar errores y soluciones', 'Search mistakes and fixes')) + '</label></div>' +
  '<div class="kstart"' + (filtering ? ' hidden' : '') + '><span class="kstart-label">' + esc(t('Para empezar', 'To start')) + '</span>' + STARTERS.map(entryById).filter(Boolean).map(e => '<a class="kchip" href="' + href(e.id) + '">' + esc(e.name) + '</a>').join('') + '<button type="button" class="kchip" data-act="random-entry">' + esc(t('Una ficha al azar', 'A random entry')) + '</button></div></section>' +
  '<p class="fine kresult-status" id="saberStatus" role="status">' + esc(result.status) + '</p><div id="saberRes">' + result.html + '</div>' +
  '<div class="khome"' + (filtering ? ' hidden' : '') + '>' +
  (() => { const nw = fresh(); return nw.length ? '<section class="sec knew"><header class="sec-head"><div><h2>' + esc(t('Nuevo en la Biblioteca', 'New in the library')) + '</h2><p>' + esc(nw.length === 1 ? t('1 ficha que aún no has visto.', '1 entry you have not seen yet.') : nw.length + t(' fichas que aún no has visto.', ' entries you have not seen yet.')) + '</p></div><button type="button" class="linkbtn" data-act="seen-new">' + esc(t('Marcar como vistas', 'Mark as seen')) + '</button></header><div class="chips">' + nw.map(e => '<a class="chip" href="' + href(e.id) + '">' + esc(e.name) + '</a>').join('') + '</div></section>' : ''; })() +
  (saved.length ? '<section class="sec"><h2 class="day">' + esc(t('Favoritas', 'Favourites')) + '</h2><ul class="krows">' + saved.map(e => row(e)).join('') + '</ul></section>' : '') +
  forYouHtml() + pathsHtml() +
  '<section class="sec"><h2 class="day">' + esc(t('Consultas de cocina', 'Kitchen reference')) + '</h2><div class="kguides">' + GUIDES.map(([es, english, hint, ids, tab]) => '<section class="kguide"><h3>' + esc(t(es, english)) + '</h3><p>' + esc(hint) + '</p><div class="chips">' + ids.map(entryById).filter(Boolean).map(e => '<a class="chip" href="' + href(e.id, tab) + '">' + esc(e.name) + '</a>').join('') + '</div></section>').join('') + '</div></section>' +
  (last.length ? '<section class="sec"><h2 class="day">' + esc(t('Lo último que has consultado', 'Recently opened')) + '</h2><ul class="krows">' + last.map(e => row(e)).join('') + '</ul></section>' : '') +
  '<section class="sec"><h2 class="day">' + esc(t('Los estantes', 'The shelves')) + '</h2><div class="kshelves">' + shelves.map(([id, n]) => '<a class="kshelf" href="#/biblioteca/estante/' + id + '">' + icon((SHELF[id] || SHELF.conceptos)[0]) + '<strong>' + esc(shelfName(id)) + '</strong><span>' + esc((SHELF[id] || SHELF.conceptos)[1]) + '</span><small>' + esc((n === 1 ? t('1 entrada', '1 entry') : n + t(' entradas', ' entries')) + ((r => r ? t(', ', ', ') + r + t(' leídas', ' read') : '')(all.filter(e => (e.cat || 'conceptos') === id && (docById('lectura:estado')?.read || {})[e.id]).length))) + '</small></a>').join('') + '</div></section>' +
  '<section class="sec kbook-cta"><div><h2 class="day">' + esc(t('Diccionario de cocina', 'Kitchen dictionary')) + '</h2><p>' + esc(GLOSSARY.length + t(' términos del oficio, de abatir a umami.', ' trade terms, from blast-chill to umami.')) + '</p></div><a class="btn ghost" href="#/biblioteca/diccionario">' + icon('library') + esc(t('Abrir el diccionario', 'Open the dictionary')) + '</a></section>' +
  '<section class="sec kbook-cta"><div><h2 class="day">' + esc(t('Tu libro de cocina', 'Your cookbook')) + '</h2><p>' + esc(t('Tus favoritas, tus versiones, una ruta o un estante, en un documento para imprimir o guardar en PDF.', 'Your favourites, your versions, a path or a shelf, in one document to print or save as PDF.')) + '</p></div><button type="button" class="btn ghost" data-act="kbook">' + icon('down') + esc(t('Preparar mi libro', 'Prepare my book')) + '</button></section>' +
  (mineList.length ? '<section class="sec"><h2 class="day">' + esc(t('Con tu versión', 'With your version')) + '</h2><ul class="krows">' + mineList.map(e => row(e)).join('') + '</ul></section>' : '') +
  (trash.length ? '<details class="sec kbin"><summary>' + esc(t('Papelera de la Biblioteca', 'Library bin')) + ' (' + trash.length + ')</summary><ul>' + trash.map(x => '<li><span>' + esc(x.custom.name) + '</span><button type="button" class="btn ghost" data-restore-entry="' + esc(x.id) + '">' + esc(t('Recuperar', 'Restore')) + '</button></li>').join('') + '</ul></details>' : '') +
  '<p class="fine">' + esc(t(all.length + ' entradas, escritas para esta app con palabras propias. Lo que añades tú lleva tu nombre y su historia.', all.length + ' entries, written for this app in its own words. What you add keeps your name and its history.')) + '</p></div>';
}

// ---------- Un estante ----------
function shelfHtml(id) {
 const list = entries().filter(e => (e.cat || 'conceptos') === id), groups = [...new Set(list.map(e => e.group || ''))];
 return '<a class="back" href="#/biblioteca">' + icon('left') + esc(t('Biblioteca', 'Library')) + '</a><header class="page-head"><h1>' + esc(shelfName(id)) + '</h1><p>' + esc((SHELF[id] || SHELF.conceptos)[1]) + '</p></header>' +
  (groups.filter(Boolean).length > 1 ? '<nav class="chips kgroup-index" aria-label="' + esc(t('Grupos de este estante', 'Groups in this shelf')) + '">' + groups.map((g, i) => g ? '<button type="button" class="chip" data-kgroup="' + i + '">' + esc(g) + '</button>' : '').join('') + '</nav>' : '') +
  (list.length ? groups.map((g, i) => '<section class="kgroup-sec" id="kgroup-' + i + '" tabindex="-1">' + (g ? '<h2 class="day">' + esc(g) + '<span class="count">' + list.filter(e => (e.group || '') === g).length + '</span></h2>' : '') + '<ul class="krows">' + list.filter(e => (e.group || '') === g).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(e => row(e)).join('') + '</ul></section>').join('') : emptyState('book', t('Este estante está vacío', 'This shelf is empty'), t('Vuelve a la Biblioteca y busca lo que necesites.', 'Go back to the library and search for what you need.')));
}

// ---------- Una entrada, por partes ----------
function inDishes(e) {
 const names = [e.name, ...(e.aka || [])].map(norm);
 const dishes = state.dishes.filter(d => !d.deleted_at && d.components.some(c => c.catalog_id === e.id || c.items.some(i => names.includes(norm(i.n))) || names.includes(norm(c.name))));
 const subs = liveSubs().filter(x => names.some(n => norm(x.name).includes(n)));
 return {dishes, subs};
}
function mineHtml(e) {
 const m = saberMine(e.id), vs = (m?.versions || []).slice().reverse(), last = vs[0];
 const steps = (e.base?.steps || e.method || []).map((step, i) => (i + 1) + '. ' + step).join('\n');
 const start = last ? last.text : (e.base ? (e.base.for ? t('Para ', 'For ') + e.base.for + '\n' : '') + (e.base.items || []).map(x => '- ' + x[0] + ': ' + x[1]).join('\n') + '\n\n' + steps : steps);
 return '<div id="kMine">' +
  (last ? '<div class="kversion"><p class="fine">' + esc(t('Tu última versión, ', 'Your latest version, ') + relDay(last.at).toLowerCase() + (last.by ? t(', de ', ', by ') + last.by : '')) + (last.why ? '. ' + esc(last.why) : '') + '</p><div class="kv-text">' + esc(last.text) + '</div></div>' : '<p class="hint">' + esc(t('Escribe cómo lo haces tú: tus proporciones, tus trucos, para qué platos lo cambias. Cada vez que guardes queda una versión nueva y la anterior se guarda en el historial.', 'Write how you make it: your ratios, your tricks, which dishes you change it for. Each save is a new version and the previous one stays in the history.')) + '</p>') +
  '<label class="mini" for="kText">' + esc(last ? t('Cambiarla', 'Change it') : (e.method?.length ? t('Empieza desde el método base', 'Start from the base method') : t('Empieza desde la receta base', 'Start from the base recipe'))) + '</label><textarea id="kText" rows="8" maxlength="8000" data-voice>' + esc(start) + '</textarea>' +
  '<label class="mini" for="kWhy">' + esc(t('Qué cambias y por qué (opcional)', 'What you change and why (optional)')) + '</label><input id="kWhy" maxlength="300" placeholder="' + esc(t('p. ej. más espesa para las croquetas de jamón', 'e.g. thicker for the ham croquettes')) + '" autocomplete="off">' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="save-version">' + icon('check') + esc(t('Guardar como versión nueva', 'Save as a new version')) + '</button></div>' +
  (vs.length > 1 ? '<h3 class="kh3">' + esc(t('Cómo ha ido cambiando', 'How it has changed')) + '</h3><ol class="khistory">' + vs.slice(1).map(v => '<li><details><summary><strong>' + esc(shortDate(v.at)) + '</strong>' + (v.why ? ' ' + esc(v.why) : '') + '</summary><div class="kv-text">' + esc(v.text) + '</div></details></li>').join('') + '</ol>' : '') + '</div>';
}
// Solo se multiplican medidas inequívocas. Los rangos, fracciones y «al gusto» quedan como referencia.
const metricAmount = /^(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|cl|dl|l)$/i;
function batchFactor(root) {
 const value = $('#kBatch', root)?.value || '1';
 if (value !== 'custom') return Number(value);
 const text = $('#kBatchCustom', root).value.trim();
 const factor = /^(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)$/.test(text) ? Number(text.replace(',', '.')) : NaN;
 return Number.isFinite(factor) && factor > 0 ? factor : null;
}
function recipeTable(base) {
 const canScale = base.items.some(([, quantity]) => metricAmount.test(quantity));
 return (canScale ? '<div class="kbatch"><label for="kBatch">' + esc(t('Multiplicar la receta base', 'Scale the base recipe')) + '</label><select id="kBatch">' +
  [0.5, 1, 1.5, 2, 3, 4, 5, 10].map(factor => '<option value="' + factor + '"' + (factor === 1 ? ' selected' : '') + '>× ' + factor.toLocaleString(en() ? 'en' : 'es') + '</option>').join('') + '<option value="custom">' + esc(t('Otra cantidad', 'Custom amount')) + '</option></select>' +
  '<div class="kbatch-custom" id="kBatchBox" hidden><label for="kBatchCustom">' + esc(t('Multiplicador', 'Multiplier')) + '</label><input type="text" inputmode="decimal" id="kBatchCustom" maxlength="16" value="1" autocomplete="off" aria-describedby="kBatchError"><span id="kBatchError" class="fine" role="status"></span></div>' +
  '<p class="fine">' + esc(t('Se ajustan los pesos y volúmenes simples. Las demás cantidades, los tiempos y las temperaturas son los de la receta base.', 'Simple weights and volumes are scaled. Other amounts, times and temperatures are from the base recipe.')) + '</p></div>' : '') +
  '<table class="ktable" id="kRecipeIngredients"><caption>' + esc(t('Receta base para ', 'Base recipe for ') + (base.for || '')) + '</caption><tbody>' +
  base.items.map(([ingredient, quantity], i) => '<tr><th scope="row">' + linked(ingredient) + '</th><td class="q" data-quantity="' + esc(quantity || '') + '">' + esc(quantity || '') +
  '</td><td class="kprep-cell" hidden><label class="kprep-check"><input type="checkbox" data-kprep aria-labelledby="kprep-label-' + i + '"><span id="kprep-label-' + i + '">' + esc(t('Listo', 'Ready')) + '<span class="sr"> ' + flat(ingredient) + '</span></span></label></td></tr>').join('') + '</tbody></table><p id="kPrepStatus" class="fine" role="status"></p>';
}
function recipeActions(hasSteps, id = '') {
 return '<div class="krecipe-actions">' + (id ? '<a class="btn primary" href="#/cocinar/biblioteca/' + esc(id) + '">' + esc(t('Cocinar paso a paso', 'Cook step by step')) + '</a>' : '') + '<button type="button" class="btn ghost" data-act="copy-recipe">' + esc(t('Copiar receta', 'Copy recipe')) + '</button>' +
  '<button type="button" class="btn ghost" data-act="cook-mode" aria-pressed="false" aria-controls="kRecipeIngredients' + (hasSteps ? ' kRecipeSteps' : '') + '">' + esc(t('Modo cocina', 'Cooking mode')) + '</button></div>';
}
function recipeSteps(steps) {
 return steps.length ? '<p id="kStepStatus" class="fine" role="status"></p><ol id="kRecipeSteps" class="ksteps">' + steps.map((step, i) =>
   '<li><span class="kstep-text">' + linked(step) + '</span><label class="kstep-check" hidden><input type="checkbox" data-kstep aria-label="' +
    esc(t('Paso ' + (i + 1) + ' completado', 'Step ' + (i + 1) + ' complete')) + '"><span>' + esc(t('Hecho', 'Done')) + '</span></label></li>').join('') + '</ol>' : '';
}
function panels(e) {
 const out = [['que', t('Qué es', 'What it is'), '<h2 class="sr">' + esc(t('Qué es', 'What it is')) + '</h2>' + para(e.what)]];
 if (e.base && (e.base.items || []).length) out.push(['receta', t('Receta', 'Recipe'), '<h2 class="sr">' + esc(t('Receta base', 'Base recipe')) + '</h2>' + recipeActions(e.base.steps?.length, e.id) + recipeTable(e.base) + recipeSteps(e.base.steps || [])]);
 if (e.method?.length) out.push(['metodo', t('Cómo hacerlo', 'Method'), '<h2 class="sr">' + esc(t('Cómo hacerlo', 'Method')) + '</h2><ol class="ksteps">' + e.method.map(step => '<li>' + linked(step) + '</li>').join('') + '</ol>']);
 if ((e.ratios || []).length) out.push(['uso', t('Según el uso', 'By use'), '<h2 class="sr">' + esc(t('Cómo cambia según para qué', 'How it changes by use')) + '</h2>' + thermScale(tempMarks(e, 6), {label: e.name}) + '<table class="ktable kratios"><thead><tr><th>' + esc(t('Para', 'For')) + '</th><th>' + esc(t('Cómo cambia', 'How it changes')) + '</th></tr></thead><tbody>' + e.ratios.map(r => '<tr><td><strong>' + linked(r.use) + '</strong></td><td class="kval">' + linked(String(r.ratio || '').replace(/(\d)\s*-\s*(\d)/g, '$1–$2')) + (r.note ? '<small>' + linked(r.note) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table>']);
 if ((e.variants || []).length) out.push(['variantes', t('Variantes', 'Variants'), '<h2 class="sr">' + esc(t('Variantes y derivadas', 'Variants and derivatives')) + '</h2><ul class="kvariants">' + e.variants.map(v => '<li>' + (v.id && entryById(v.id) ? '<a class="kref" href="' + href(v.id) + '">' + esc(v.name) + '</a>' : '<strong>' + esc(v.name) + '</strong>') + (v.note ? ' ' + linked(v.note) : '') + '</li>').join('') + '</ul>']);
 if ((e.keys || []).length || (e.errors || []).length) out.push(['trucos', t('Trucos y errores', 'Tips and mistakes'), ((e.keys || []).length ? '<h2 class="kh3">' + esc(t('Claves', 'Key points')) + '</h2><ul class="kbullets">' + e.keys.map(x => '<li>' + linked(x) + '</li>').join('') + '</ul>' : '') + ((e.errors || []).length ? '<h2 class="kh3">' + esc(t('Errores y cómo arreglarlos', 'Mistakes and fixes')) + '</h2><dl class="kerrors">' + e.errors.map(x => '<dt>' + linked(x.p) + '</dt><dd>' + linked(x.fix) + '</dd>').join('') + '</dl>' : '')]);
 if (e.history || (e.uses || []).length) out.push(['historia', t('Historia y usos', 'History and uses'), (e.history ? '<h2 class="kh3">' + esc(t('Historia y evolución', 'History and evolution')) + '</h2>' + para(e.history) : '') + ((e.uses || []).length ? '<h2 class="kh3">' + esc(t('Usos', 'Uses')) + '</h2><p>' + e.uses.map(linked).join(', ') + '.</p>' : '')]);
 if (e.keep || e.pro) out.push(['servicio', t('Conservación y servicio', 'Keeping and service'), (e.keep ? '<h2 class="kh3">' + esc(t('Conservación', 'Keeping')) + '</h2>' + para(e.keep) : '') + (e.pro ? '<h2 class="kh3">' + esc(t('En producción y en el pase', 'In production and at the pass')) + '</h2>' + para(e.pro) : '')]);
 const n = saberMine(e.id)?.versions?.length || 0;
 out.push(['tuya', t('Tu versión', 'Your version') + (n ? ' (' + n + ')' : ''), mineHtml(e)]);
 return out;
}
// Imagen guía: una ilustración por ficha, creada con ChatGPT y guardada con la ficha (las anteriores se conservan).
function guidePrompt(e) {
 const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, (m, x) => entryById(x)?.name || x);
 const items = (e.base?.items || []).slice(0, 8).map(x => plain(x[0])).join(', ');
 const step = (e.method || e.base?.steps || [])[Math.min(1, (e.method || e.base?.steps || []).length - 1)] || '';
 const isTech = !e.base?.items?.length && (e.method || []).length;
 return 'Fotografía realista de cocina profesional para una guía técnica de cocineros: ' + e.name + '. ' + plain(e.summary) + ' ' +
  (isTech ? 'Muestra el momento clave de la técnica: ' + plain(step) + ' ' : 'Muestra la elaboración terminada, bien hecha, en un recipiente de cocina profesional' + (items ? ' (lleva ' + items + ')' : '') + '. ') +
  'Encuadre cenital o a 45 grados, luz natural lateral, fondo de piedra o acero oscuro, textura y punto de cocción muy visibles. Sin texto, sin letras, sin logotipos, sin personas ni caras; como mucho unas manos con guantes si la técnica lo pide.';
}
function guideHtml(e) {
 const g = (saberMine(e.id)?.guides || []).at(-1);
 if (!g) return '';
 return '<figure class="kguide-img"><img data-img="' + esc(g.path) + '" alt="' + esc(t('Imagen guía de ', 'Guide image of ') + e.name) + '"><figcaption>' + esc(t('Ilustración generada con ChatGPT el ', 'Illustration generated with ChatGPT on ') + shortDate(g.at) + t('. No es una foto real: úsala como guía.', '. Not a real photo: use it as a guide.')) + '</figcaption></figure>';
}
function entryHtml(id, tab) {
 const e = entryById(id);
 const back = '<a class="back" href="#/biblioteca">' + icon('left') + esc(hasSearch() ? t('Volver a la búsqueda', 'Back to search') : t('Biblioteca', 'Library')) + '</a>';
 if (!e) return back + emptyState('book', t('Esta entrada no está', 'This entry is not here'), t('Búscala en la Biblioteca.', 'Search for it in the library.'));
 const saved = favorites().includes(id);
 const list = panels(e), on = list.some(p => p[0] === tab) ? tab : list[0][0];
 const {dishes, subs} = inDishes(e), rel = [...new Set([...(e.related || []), ...backlinks(e.id).map(x => x.id)])].map(entryById).filter(x => x && x.id !== e.id);
 return '<div class="kentry-back">' + (hasSearch() ? back : '') + '<a class="back" href="#/biblioteca/estante/' + esc(e.cat || 'conceptos') + '">' + icon('left') + esc(shelfName(e.cat || 'conceptos')) + '</a></div><article class="kentry">' +
  '<header class="page-head"><h1>' + esc(e.name) + '</h1>' + (e.aka?.length ? '<p class="kaka">' + esc(t('También: ', 'Also: ') + e.aka.join(', ')) + '</p>' : '') + '<div class="kentry-acts"><button type="button" class="linkbtn" data-act="favorite" aria-pressed="' + saved + '">' + icon('star') + esc(saved ? t('Quitar de favoritas', 'Remove from favourites') : t('Guardar en favoritas', 'Save to favourites')) + '</button>' + (cardsFor(e.id) ? '<a class="linkbtn" href="#/entrenar/ficha/' + esc(e.id) + '">' + icon('brain') + esc(t('Repasar esta ficha', 'Review this entry')) + '</a>' : '') + (iaOn() ? '<button type="button" class="linkbtn" data-act="guide-img">' + icon('image') + '<span>' + esc((saberMine(e.id)?.guides || []).length ? t('Otra imagen guía', 'Another guide image') : t('Crear imagen guía', 'Create guide image')) + '</span></button>' : '') + '<span class="kentry-tools"><button type="button" class="linkbtn" data-act="share-entry">' + esc(t('Compartir', 'Share')) + '</button><button type="button" class="linkbtn" data-act="compare-entry">' + esc(t('Comparar', 'Compare')) + '</button><button type="button" class="linkbtn" data-act="print-entry">' + icon('down') + esc(t('Imprimir', 'Print')) + '</button>' + '</span>' + ((e.base?.items?.length || technique(e.technique)) && state.canEdit && !state.setupPending ? '<button type="button" class="btn primary k-use" data-act="use-recipe">' + icon('plus') + esc(technique(e.technique) ? t('Aplicar técnica a un plato', 'Apply technique to a dish') : t('Usar en un plato', 'Use in a dish')) + '</button>' : '') + '</div></header>' +
  guideHtml(e) +
  (e.source === 'chatgpt' ? '<p class="fine kgen">' + icon('spark') + esc(t('Ficha escrita con ChatGPT', 'Entry written with ChatGPT') + (e.created_at ? t(' el ', ' on ') + shortDate(e.created_at) : '') + t('. Revísala y, si algo no te cuadra, escribe tu versión.', '. Check it and, if something is off, write your version.')) + '</p>' : '') +
  (e.summary ? '<div class="kbody"><p class="lead">' + linked(e.summary) + '</p></div>' : '') +
  '<div class="ktabs" role="tablist" aria-label="' + esc(t('Partes de la entrada', 'Parts of the entry')) + '">' + list.map(([pid, label]) => '<button type="button" role="tab" id="kt-' + pid + '" aria-controls="kp-' + pid + '" aria-selected="' + (pid === on) + '" tabindex="' + (pid === on ? 0 : -1) + '" class="ktab' + (pid === on ? ' active' : '') + '" data-ktab="' + pid + '">' + esc(label) + '</button>').join('') + '</div>' +
  list.map(([pid, , body]) => '<section class="kpanel" role="tabpanel" tabindex="0" id="kp-' + pid + '" aria-labelledby="kt-' + pid + '"' + (pid === on ? '' : ' hidden') + '>' + body + '</section>').join('') +
  ((dishes.length || subs.length) ? '<section class="sec ksec-mine"><h2 class="day">' + esc(t('En tu cocina', 'In your kitchen')) + '</h2><div class="chips">' + dishes.map(d => '<a class="chip" href="#/plato/' + esc(d.id) + '">' + esc(d.name) + '<small>' + esc(t('plato', 'dish')) + '</small></a>').join('') + subs.map(x => '<a class="chip" href="#/subreceta/' + esc(x.id) + '">' + esc(x.name) + '<small>' + esc(t('subreceta', 'sub-recipe')) + '</small></a>').join('') + '</div></section>' : '') +
  (rel.length ? '<section class="sec"><h2 class="day">' + esc(t('Para seguir leyendo', 'Keep reading')) + '</h2><div class="chips">' + rel.slice(0, 10).map(x => '<a class="chip" href="' + href(x.id) + '">' + esc(x.name) + '</a>').join('') + '</div></section>' : '') +
  (e.mine ? '<p class="fine center"><button type="button" class="linkbtn" data-act="trash-entry">' + esc(t('Enviar esta entrada a la papelera', 'Move this entry to the bin')) + '</button></p>' : '') + '</article>';
}

// ---------- Diccionario de cocina: términos del oficio, de la A a la Z ----------
function dictHtml(focus) {
 const list = GLOSSARY.slice().sort((a, b) => a[0].localeCompare(b[0], 'es'));
 return '<a class="back" href="#/biblioteca">' + icon('left') + esc(t('Biblioteca', 'Library')) + '</a><header class="page-head"><h1>' + esc(t('Diccionario de cocina', 'Kitchen dictionary')) + '</h1><p>' + esc(t('Las palabras del oficio en una o dos frases. Cuando hay ficha, enlaza para saber más.', 'The words of the trade in a sentence or two. Where there is an entry, it links to learn more.')) + '</p></header>' +
  '<div class="searchbox"><label class="sr" for="dictQ">' + esc(t('Buscar un término', 'Find a term')) + '</label>' + icon('search') + '<input id="dictQ" type="search" autocomplete="off" placeholder="' + esc(t('Napar, desglasar, brunoise…', 'Napar, deglaze, brunoise…')) + '"></div>' +
  '<p class="fine" id="dictStatus" role="status"></p><dl class="kdict">' + list.map(([w, d, id]) => '<div class="kdict-row' + (norm(w) === norm(focus) ? ' is-focus' : '') + '" id="dict-' + esc(slug(w)) + '" data-w="' + esc(norm(w + ' ' + d)) + '"><dt>' + esc(w) + '</dt><dd>' + esc(d) + (id && entryById(id) ? ' <a class="kref" href="' + href(id) + '">' + esc(t('Ficha: ', 'Entry: ') + entryById(id).name) + '</a>' : '') + '</dd></div>').join('') + '</dl>';
}
export const render = params => {
 if (params[0] === 'buscar') { presetSaber(params[1] ? decodeURIComponent(params[1]) : ''); params.length = 0; }
 if (params[0] === 'diccionario') return dictHtml(params[1] ? decodeURIComponent(params[1]) : '');
 if (params[0] === 'estante') return shelfHtml(params[1]);
 if (params[0]) { if (tabFor !== params[0]) { tabFor = params[0]; activeTab = null; } return entryHtml(params[0], params[1] || activeTab); }
 return homeHtml();
};

// ---------- Crear una entrada que falta (con ChatGPT) ----------
function createPrompt(topic) {
 const ids = entries().map(e => e.id).join(', ');
 return 'Escribe la ficha de cocina profesional de «' + topic + '» para la Biblioteca de un jefe de cocina de un restaurante mediterráneo de brasa en Ibiza. Español de España, tono de cocinero a cocinero: claro, práctico, sin adornos. Texto ORIGINAL con tus palabras (no copies ni parafrasees libros ni webs). Medidas métricas (g, ml, l, °C, minutos) y proporciones reales de cocina profesional. Escribe siempre las temperaturas como «NN °C» o «NN–NN °C». No inventes historia, nombres ni fechas dudosas: si no es seguro, generaliza. Entre 400 y 700 palabras en total. ' +
  'Si «' + topic + '» es una elaboración con ingredientes, rellena "base" (receta base con cantidades y pasos); si es una técnica o un producto, deja "base" en null y rellena "method" con los pasos. ' +
  'Responde SOLO con un objeto JSON válido con estas claves: {"name": nombre correcto con mayúscula inicial,"aka":[otros nombres con los que se busca],"cat": uno de "salsas"|"fondos"|"bases"|"conceptos"|"tecnicas"|"dulce"|"producto"|"creatividad"|"cortes","group": subgrupo corto,"summary": una frase,"what": 2-4 frases,"base":{"for":"para cuánto","items":[["ingrediente","cantidad"]],"steps":["paso con tiempos y temperaturas"]} o null,"method":["paso"] o [],"ratios":[{"use":"para qué","ratio":"cómo cambia (con °C si aplica)","note":"nota"}],"variants":[{"id": null o un id de la lista,"name","note"}],"keys":[4-6 claves],"errors":[{"p":"problema","fix":"cómo se arregla"}],"history": 2-3 frases,"uses":[...],"keep":"conservación y regeneración","pro":"en producción y en el pase","related":[ids de la lista]}. ' +
  'En los textos puedes enlazar otras fichas como [[id]] o [[id|texto]], SOLO con estos ids: ' + ids + '.';
}

function entryFromReply(text, topic) {
 const v = parseReply(text);
 if (!v || typeof v !== 'object' || Array.isArray(v) || !String(v.name || topic).trim()) return null;
 const name = clip(String(v.name || topic), 80), taken = new Set(entries().map(e => e.id).concat(builtIds()));
 let id = slug(name) || 'entrada', n = 2;
 while (taken.has(id)) id = slug(name) + '-' + n++;
 const s = x => (typeof x === 'string' ? x.slice(0, 3000) : '');
 const arr = x => (Array.isArray(x) ? x : []);
 return {id, name, aka: arr(v.aka).map(String).slice(0, 8), cat: ['salsas', 'fondos', 'bases', 'conceptos', 'cortes', 'tecnicas', 'dulce', 'producto', 'creatividad'].includes(v.cat) ? v.cat : 'conceptos', group: s(v.group).slice(0, 60), summary: s(v.summary), what: s(v.what),
  base: v.base && typeof v.base === 'object' && Array.isArray(v.base.items) && v.base.items.length ? {for: s(v.base.for), items: arr(v.base.items).filter(Array.isArray).map(x => [String(x[0] || ''), String(x[1] || '')]).slice(0, 30), steps: arr(v.base.steps).map(String).slice(0, 20)} : null,
  method: arr(v.method).map(String).filter(Boolean).slice(0, 20),
  ratios: arr(v.ratios).filter(x => x && x.use).map(x => ({use: String(x.use), ratio: String(x.ratio || ''), note: String(x.note || '')})).slice(0, 12),
  variants: arr(v.variants).filter(x => x && x.name).map(x => ({id: x.id && entryById(String(x.id)) ? String(x.id) : null, name: String(x.name), note: String(x.note || '')})).slice(0, 12),
  keys: arr(v.keys).map(String).slice(0, 8), errors: arr(v.errors).filter(x => x && x.p).map(x => ({p: String(x.p), fix: String(x.fix || '')})).slice(0, 8),
  history: s(v.history), uses: arr(v.uses).map(String).slice(0, 12), keep: s(v.keep), pro: s(v.pro), related: arr(v.related).map(String).filter(x => entryById(x)).slice(0, 12), source: 'chatgpt', created_at: new Date().toISOString()};
}

export function mount(root, params) {
 const repaint = () => { if (root.isConnected) root.innerHTML = render(params); };
 if (params[0] === 'diccionario') {
  const dq = $('#dictQ', root);
  dq?.addEventListener('input', () => { const q = norm(dq.value).trim(); let n = 0; $$('.kdict-row', root).forEach(row => { row.hidden = !!q && !row.dataset.w.includes(q); if (!row.hidden) n++; }); $('#dictStatus', root).textContent = q ? (n === 1 ? t('1 término', '1 term') : n + t(' términos', ' terms')) : ''; });
  if (params[1]) setTimeout(() => $('.kdict-row.is-focus', root)?.scrollIntoView({block: 'center'}), 50);
  return null;
 }
 if (params[0] && params[0] !== 'estante' && entryById(params[0])) markSeen(params[0]);
 const showTab = id => {
  activeTab = id; params[1] = id;
  $$('[data-ktab]', root).forEach(b => { const on = b.dataset.ktab === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $$('.kpanel', root).forEach(p => { p.hidden = p.id !== 'kp-' + id; });
  history.replaceState(null, '', '#/biblioteca/' + params[0] + '/' + id);
 };
 const refreshResults = () => {
  const result = results();
  $('#saberRes', root).innerHTML = result.html;
  $('#saberStatus', root).textContent = result.status;
  $$('.khome, .kstart', root).forEach(x => { x.hidden = hasSearch(); });
 };
 const stepStatus = () => {
  const steps = $$('[data-kstep]', root), done = steps.filter(box => box.checked).length;
  const status = $('#kStepStatus', root);
  if (status) status.textContent = t(done + ' de ' + steps.length + ' pasos hechos', done + ' of ' + steps.length + ' steps done');
 };
 const prepStatus = () => {
  const items = $$('[data-kprep]', root), done = items.filter(box => box.checked).length;
  $('#kPrepStatus', root).textContent = t(done + ' de ' + items.length + ' ingredientes preparados', done + ' of ' + items.length + ' ingredients ready');
 };
 const changeBatch = (showError = true) => {
  const custom = $('#kBatchCustom', root), useCustom = $('#kBatch', root).value === 'custom';
  $('#kBatchBox', root).hidden = !useCustom;
  const factor = batchFactor(root);
  custom.setAttribute('aria-invalid', factor === null);
  $('#kBatchError', root).textContent = factor === null && showError ? t('Escribe un número mayor que cero, como 1,25.', 'Enter a number greater than zero, such as 1.25.') : '';
  if (factor === null) return;
  let reset = false;
  $$('[data-quantity]', root).forEach(cell => {
   const original = cell.dataset.quantity, amount = original.match(metricAmount);
   const value = amount && factor !== 1 ? (Number(amount[1].replace(',', '.')) * factor).toLocaleString(en() ? 'en' : 'es', {maximumSignificantDigits: 8}) + ' ' + amount[2] : original;
   if (cell.textContent === value) return;
   cell.textContent = value;
   const row = cell.closest('tr'), check = $('[data-kprep]', row);
   if (check.checked) { check.checked = false; row.classList.remove('kprep-done'); reset = true; }
  });
  if (reset && $('[data-act=cook-mode]', root).getAttribute('aria-pressed') === 'true') prepStatus();
 };
 root.addEventListener('change', e => {
  if (e.target.hasAttribute('data-kprep')) {
   e.target.closest('tr').classList.toggle('kprep-done', e.target.checked);
   prepStatus();
   return;
  }
  if (e.target.hasAttribute('data-kstep')) {
   e.target.closest('li').classList.toggle('kstep-done', e.target.checked);
   stepStatus();
   return;
  }
  if (e.target.id === 'saberCategory' || e.target.id === 'saberFixes') {
   category = $('#saberCategory', root).value;
   fixes = $('#saberFixes', root).checked;
   refreshResults();
   return;
  }
  if (e.target.id === 'kBatch' || e.target.id === 'kBatchCustom') changeBatch();
 });
 const hydrate = () => $$('img[data-img]', root).forEach(async img => { const u = await imageUrl(img.dataset.img); if (u && img.isConnected) { img.src = u; img.removeAttribute('data-img'); } });
 hydrate(); new MutationObserver(hydrate).observe(root, {childList: true, subtree: true});
 root.addEventListener('focusin', e => { if (e.target.id === 'saberQ') attachSuggest(e.target, {onPick: en2 => { query = ''; go('biblioteca/' + en2.id); }}); });
 root.addEventListener('input', e => {
  if (e.target.id === 'kBatchCustom') { changeBatch(false); return; }
  if (e.target.id !== 'saberQ') return;
  query = e.target.value;
  refreshResults();
 });
 root.addEventListener('keydown', e => {
  if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const result = e.target.closest('#saberRes .krow');
  if (e.target.id === 'saberQ' || result) {
   const hits = $$('#saberRes .krow', root);
   if (hits.length && e.target.id === 'saberQ' && e.key === 'Enter') { e.preventDefault(); hits[0].click(); return; }
   if (hits.length && (e.key === 'ArrowDown' || (result && e.key === 'ArrowUp'))) {
    e.preventDefault();
    const i = hits.indexOf(result) + (e.key === 'ArrowDown' ? 1 : -1);
    (i < 0 ? $('#saberQ', root) : hits[Math.min(i, hits.length - 1)]).focus();
   }
  }
  const tab = e.target.closest('[data-ktab]');
  if (tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
   e.preventDefault();
   const all = $$('[data-ktab]', root), i = all.indexOf(tab);
   const next = e.key === 'Home' ? all[0] : e.key === 'End' ? all.at(-1) : all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
   showTab(next.dataset.ktab);
   next.focus();
  }
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.kgroup !== undefined) {
   const group = $('#kgroup-' + b.dataset.kgroup, root);
   group?.scrollIntoView({block: 'start'});
   group?.focus({preventScroll: true});
   return;
  }
  if (b.dataset.restoreEntry) {
   await trashSaberEntry(b.dataset.restoreEntry, true);
   repaint();
   toast(t('Entrada recuperada.', 'Entry restored.'));
   return;
  }
  if (b.dataset.ktab) { showTab(b.dataset.ktab); return; }
  const act = b.dataset.act, id = params[0];
  if (act === 'guide-img' && entryById(id)) {
   const e2 = entryById(id), label = b.querySelector('span');
   b.disabled = true; b.classList.add('is-busy'); if (label) label.textContent = t('Creando la imagen… (hasta un minuto)', 'Creating the image… (up to a minute)');
   try {
    const blob = await shrinkImage(await makeImage(guidePrompt(e2)));
    const path = await uploadImage('saber', blob);
    await addSaberGuide(id, path); repaint(); toast(t('Imagen guía guardada en la ficha.', 'Guide image saved in the entry.'));
   } catch (err) { toast(err?.detail === 'verify' ? t('OpenAI pide verificar tu organización para crear imágenes: entra en platform.openai.com → Settings → Organization → Verify.', 'OpenAI asks you to verify your organisation to create images.') : iaMessage(err), 'error', 9000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); if (label) label.textContent = t('Crear imagen guía', 'Create guide image'); } }
   return;
  }
  if (act === 'kbook') { bookSheet(favorites()); return; }
  if (act === 'random-entry') { const e2 = randomEntry(); if (e2) location.hash = href(e2.id); return; }
  if (act === 'seen-new') { try { localStorage.setItem(KNOWN, JSON.stringify(entries().map(e => e.id))); } catch {} b.closest('.knew')?.remove(); return; }
  if (act === 'compare-entry' && entryById(id)) { compareSheet(id); return; }
  if (act === 'share-entry' && entryById(id)) { const e2 = entryById(id), pl = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, (m, x) => entryById(x)?.name || x); shareText(e2.name, [pl(e2.summary), (e2.keys || []).map(k => '- ' + pl(k)).join('\n'), t('Desde mi cuaderno I+D.', 'From my R&D notebook.')].filter(Boolean).join('\n\n')); return; }
  if (act === 'print-entry' && entryById(id)) { printBook(entryById(id).name, [entryById(id)]); return; }
  if (act === 'cook-mode') {
   const on = b.getAttribute('aria-pressed') === 'false';
   b.setAttribute('aria-pressed', on);
   $$('.kstep-check, .kprep-cell', root).forEach(control => { control.hidden = !on; });
   if (on) { prepStatus(); stepStatus(); }
   else {
    $('#kPrepStatus', root).textContent = '';
    const status = $('#kStepStatus', root);
    if (status) status.textContent = '';
   }
   return;
  }
  if (act === 'copy-recipe') {
   const recipe = entryById(id);
   const factor = batchFactor(root);
   if (factor === null) { changeBatch(); $('#kBatchCustom', root).focus(); return; }
   const base = $('#kp-receta caption', root).textContent;
   const batch = factor === 1 ? base : t('Tanda ×', 'Batch ×') + factor.toLocaleString(en() ? 'en' : 'es', {maximumSignificantDigits: 16}) + ' (' + base + ')';
   const ingredients = $$('#kRecipeIngredients tbody tr', root).map(row => [$('th', row), $('[data-quantity]', row)].map(cell => cell.textContent.trim()).filter(Boolean).join(' — '));
   const steps = $$('#kRecipeSteps .kstep-text', root).map((step, i) => (i + 1) + '. ' + step.innerText.trim());
   const done = await copy([recipe.name, batch, ingredients.join('\n'), steps.join('\n')].filter(Boolean).join('\n\n'), {forChat: false});
   if (b.isConnected) b.focus({preventScroll: true});
   toast(done ? t('Receta copiada.', 'Recipe copied.') : t('No se pudo copiar.', 'Could not copy.'), done ? 'info' : 'error');
   return;
  }
  if (act === 'use-recipe' && id) {
   const dishes = liveDishes();
   const selection = sheet({title: t('¿En qué plato?', 'Which dish?'), body:
    '<label class="sr" for="kDish">' + esc(t('Elige el plato', 'Choose the dish')) + '</label><select id="kDish"><option value="nuevo">' + esc(t('En un plato nuevo', 'In a new dish')) + '</option>' +
    dishes.map(dish => '<option value="' + esc(dish.id) + '">' + esc(dish.name) + '</option>').join('') + '</select><div class="row-actions"><button type="button" class="btn primary" data-use-go>' + esc(t('Abrir mesa de trabajo', 'Open workbench')) + '</button></div>'});
   $('[data-use-go]', selection.el).onclick = () => {
    const dish = $('#kDish', selection.el).value;
    selection.close();
    go('plato/' + dish + '/biblioteca/' + id);
   };
   return;
  }
  if (act === 'favorite' && id) {
   const saved = favorites(), on = !saved.includes(id);
   try {
    const ids = on ? [id, ...saved] : saved.filter(x => x !== id);
    saveDoc('favoritas', FAV_DOC, {ids});
    try { localStorage.setItem(FAVORITES, JSON.stringify(ids)); } catch {}
    b.setAttribute('aria-pressed', on);
    b.innerHTML = icon('star') + esc(on ? t('Quitar de favoritas', 'Remove from favourites') : t('Guardar en favoritas', 'Save to favourites'));
   } catch { toast(t('No se pudo guardar la selección.', 'Could not save this selection.'), 'error'); }
   return;
  }
  if (act === 'save-version' && id) {
   const text = ($('#kText', root)?.value || '').trim();
   if (!text) { toast(t('Escribe tu versión primero.', 'Write your version first.'), 'error'); return; }
   const last = saberMine(id)?.versions?.slice(-1)[0];
   if (last && last.text === text) { toast(t('No has cambiado nada.', 'Nothing has changed.')); return; }
   await addSaberVersion(id, text, clip($('#kWhy', root)?.value || '', 300));
   activeTab = params[1] = 'tuya'; repaint(); toast(t('Versión guardada. La anterior queda en el historial.', 'Version saved. The previous one stays in the history.'));
  }
  if (act === 'trash-entry' && id) { await trashSaberEntry(id); toast(t('En la papelera.', 'Moved to the bin.')); go('biblioteca'); }
  if (act === 'create-copy') { const done = await copy(createPrompt(query.trim())); toast(done ? t('Petición copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  if (act === 'create-save') {
   const entry = entryFromReply($('#kReply', root)?.value || '', query.trim());
   if (!entry) { toast(t('No encuentro la entrada en esa respuesta. Pega la respuesta entera.', 'I cannot find the entry in that answer. Paste the whole answer.'), 'error'); return; }
   await saveSaberEntry(entry); query = ''; go('biblioteca/' + entry.id); toast(t('Entrada guardada en tu Biblioteca.', 'Entry saved in your library.'));
  }
  if (act === 'create-ia') {
   const topic = query.trim(), have = exactEntry(topic);
   if (have) { query = ''; go('biblioteca/' + have.id); return; }
   const st = $('#kcreateStatus', root); if (st) st.textContent = t('Escribiendo la ficha con el modelo más listo de ChatGPT. Puede tardar un minuto o dos; no cierres esta pantalla.', 'Writing the entry with the smartest ChatGPT model. It can take a minute or two; keep this screen open.');
   b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('ChatGPT está escribiendo la ficha…', 'ChatGPT is writing the entry…');
   try {
    const entry = entryFromReply(await askIa({text: createPrompt(topic), json: true, smart: true, effort: 'medium'}), topic);
    if (!entry) throw Object.assign(Error('empty'), {kind: 'empty'});
    await saveSaberEntry(entry); query = ''; go('biblioteca/' + entry.id); toast(t('Entrada escrita por ChatGPT. Revísala y añade tu versión.', 'Entry written by ChatGPT. Check it and add your version.'));
   } catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Escribir la ficha de «', 'Write the entry for “') + topic + t('»', '”'); } if (st) st.textContent = ''; }
  }
 });
 if (!params[0] && matchMedia('(min-width: 960px)').matches) setTimeout(() => $('#saberQ', root)?.focus(), 50);
 return null;
}
// Se repinta al llegar datos, salvo si estás escribiendo en un campo de esta pantalla (para no quitarte el foco).
export function onData(what, el, params) { const a = document.activeElement, typing = el?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a?.tagName || ''); if (['saber', 'remote', 'load'].includes(what) && el && !typing) el.innerHTML = render(params); }
