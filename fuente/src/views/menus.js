// I+D · Cartas y menús: platos de la libreta en orden, para ver si el conjunto está equilibrado (sabores que se repiten,
// el mismo producto en varios platos, demasiada brasa, nada crujiente, alérgenos…). Nada se borra: un menú va a la papelera.
import {COURSES, dishProfile, technique, AXIS_IDS} from '../flavor-core.js';
import {ALLERGENS} from '../ai-core.js';
import {t, en, relDay, shortDate, seasonLabel} from '../i18n.js';
import {esc, icon, $, $$, sheet, toast, ask, flavorPrint, axisName, clip} from '../ui.js';
import {state, dishById, liveMenus, menuById, createMenu, saveMenu} from '../store.js';
import {dishRequest} from '../ai-core.js';
import {copy, menuPairingPrompt} from '../ai.js';
import {iaOn, askIa, iaMessage} from '../ia.js';
import {rich} from './ask.js';
import {emptyState, dishAllergens} from './shared.js';
import {go} from '../nav.js';

export const title = params => (params[0] ? menuById(params[0])?.name || t('Menú', 'Menu') : t('Cartas y menús', 'Menus'));
const lbl = row => (en() ? row[2] : row[1]);
const courseName = id => lbl(COURSES.find(c => c[0] === id) || COURSES[COURSES.length - 1]);
const KINDS = () => [['degustacion', t('Menú degustación', 'Tasting menu')], ['carta', t('Carta', 'À la carte menu')]];
const textKey = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const kindName = k => (KINDS().find(x => x[0] === k) || KINDS()[0])[1];
// Lo que está en casi todos los platos no cuenta como «repetido».
const BASIC = new Set(['sal', 'sal-escamas', 'aove', 'aceite-girasol', 'pimienta', 'ajo', 'cebolla', 'limon', 'mantequilla', 'azucar', 'agua', 'vinagre-jerez', 'perejil']);
const GRILL = new Set(['brasa', 'josper', 'ofyr']);

export const tabs = active => '<div class="seg book-tabs" role="tablist"><a class="seg-btn' + (active === 'platos' ? ' active' : '') + '" href="#/libreta" role="tab" aria-selected="' + (active === 'platos') + '">' + esc(t('Platos', 'Dishes')) + '</a><a class="seg-btn' + (active === 'menus' ? ' active' : '') + '" href="#/menus" role="tab" aria-selected="' + (active === 'menus') + '">' + esc(t('Cartas y menús', 'Menus')) + (liveMenus().length ? '<span class="count">' + liveMenus().length + '</span>' : '') + '</a></div>';

// ---------- El ritmo del menú: intensidad de cada pase, dibujada ----------
// Intensidad = media de los tres sabores más fuertes del plato (0 a 10). Un buen menú sube, descansa y termina limpio.
function intensity(p) { if (!p || p.empty) return null; const v = Object.values(p.axes || {}).map(Number).filter(Number.isFinite).sort((x, y) => y - x).slice(0, 3); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
function rhythmHtml(rows) {
 const pts = rows.map((r, k) => ({k, d: r.d, v: intensity(r.p), dom: (r.p?.dominant || []).map(id => axisName(id).toLowerCase())})).filter(x => x.v != null);
 if (pts.length < 3) return '';
 const narrow = typeof innerWidth === 'number' && innerWidth < 640, w = narrow ? 360 : 640, h = narrow ? 200 : 180, px = narrow ? 32 : 40, py = 24, n = pts.length, x = i => px + i * (w - px * 2) / (n - 1), y = v => h - py - v / 10 * (h - py * 2);
 const line = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
 // Avisos de ritmo: tres pases seguidos subiendo sin descanso, o el final más intenso que el centro.
 const notes = [];
 for (let i = 2; i < n; i++) if (pts[i].v > pts[i - 1].v && pts[i - 1].v > pts[i - 2].v && pts[i].v >= 6.5) { notes.push(t('Del pase ', 'From course ') + (i - 1) + t(' al ', ' to ') + (i + 1) + t(' la intensidad sube sin descanso: mete algo fresco o ácido en medio.', ' intensity climbs without a break: put something fresh or sour in between.')); break; }
 const peak = pts.reduce((m, p) => (p.v > m.v ? p : m), pts[0]);
 if (peak.k === pts[n - 1].k && n > 3) notes.push(t('El pase más intenso es el último: el final suele funcionar mejor si limpia.', 'The most intense course is the last: menus usually end better on something cleansing.'));
 if (pts[0].v >= 7) notes.push(t('Empieza muy fuerte: el primer bocado suele ir mejor ligero, para abrir el apetito.', 'It starts very strong: a light first bite usually opens the appetite better.'));
 return '<section class="card mrhythm"><h2>' + esc(t('El ritmo del menú', 'The rhythm of the menu')) + '</h2><p class="hint">' + esc(t('Intensidad de cada pase según su perfil de sabor. Lo ideal: subir poco a poco, con descansos, y terminar limpio.', 'Intensity of each course from its flavour profile. Ideally: build up gradually, with breaks, and end clean.')) + '</p>' +
  '<svg viewBox="0 0 ' + w + ' ' + h + '" class="mrsvg" role="img" aria-label="' + esc(t('Intensidad por pase: ', 'Intensity per course: ') + pts.map((p, i) => (i + 1) + ' ' + p.d.name + ' ' + p.v.toFixed(1)).join(', ')) + '">' +
  [0, 5, 10].map(v => '<line class="mr-grid" x1="' + px + '" x2="' + (w - px) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="mr-ax" x="' + (px - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>').join('') +
  '<polyline class="mr-line" points="' + line + '"/>' + pts.map((p, i) => '<circle class="mr-dot" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="5"/><text class="mr-n" x="' + x(i).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">' + (i + 1) + '</text>').join('') + '</svg>' +
  '<ol class="mrlist">' + pts.map(p => '<li><strong>' + esc(p.d.name) + '</strong><span>' + esc(p.dom.length ? t('domina ', 'led by ') + p.dom.join(', ') : t('suave', 'gentle')) + '</span></li>').join('') + '</ol>' +
  (notes.length ? '<ul class="notes">' + notes.map(x => '<li class="note note-tip">' + icon('info') + '<p>' + esc(x) + '</p></li>').join('') + '</ul>' : '<p class="fine">' + icon('check') + esc(t('El ritmo está bien llevado.', 'The pacing works.')) + '</p>') + '</section>';
}

// ---------- Análisis del conjunto ----------
function analyse(menu) {
 const kb = state.kb, rows = menu.items.flatMap(({dish_id}, itemIndex) => {
  const d = dishById(dish_id);
  return d && !d.deleted_at ? [{d, itemIndex, p: kb ? dishProfile(kb, d) : null}] : [];
 });
 const notes = [];
 const say = (level, text, passes = []) => notes.push({level, text, passes});
 if (rows.length < 2) return {rows, notes, allergens: []};
 const ordered = menu.kind === 'degustacion';
 // Sabor que manda, seguido
 if (ordered) {
  for (let i = 1; i < rows.length; i++) {
   const a = rows[i - 1].p?.dominant?.[0], b = rows[i].p?.dominant?.[0];
   if (a && a === b) say('warn', t('Los platos ' + i + ' y ' + (i + 1) + ' van seguidos y los dos los domina el ' + axisName(a).toLowerCase() + '. Separa uno o cambia su acompañamiento.', 'Dishes ' + i + ' and ' + (i + 1) + ' come one after the other and both are led by ' + axisName(a).toLowerCase() + '. Move one or change its garnish.'), [i, i + 1]);
  }
  for (let i = 2; i < rows.length; i++) if ([rows[i - 2], rows[i - 1], rows[i]].every(r => (r.p?.axes?.graso || 0) >= 6.5)) say('warn', t('Los platos ' + (i - 1) + ' a ' + (i + 1) + ' son muy grasos seguidos: mete algo ácido o fresco en medio.', 'Dishes ' + (i - 1) + ' to ' + (i + 1) + ' are very rich in a row: put something sharp or fresh between them.'), [i - 1, i, i + 1]);
  const last = rows[rows.length - 1].d;
  if (!rows.some(({d}) => d.course === 'postre')) say('tip', t('No hay postre.', 'There is no dessert.'));
  else if (last.course !== 'postre') say('tip', t('El postre no está al final.', 'The dessert is not at the end.'));
 }
 // Producto repetido
 const seen = new Map();
 rows.forEach(({d}, k) => { for (const id of new Set(d.components.flatMap(c => c.items.map(i => i.k)).filter(Boolean))) { if (BASIC.has(id)) continue; seen.set(id, [...(seen.get(id) || []), k + 1]); } });
 const rep = [...seen.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
 for (const [id, where] of rep.slice(0, 5)) { const name = state.kb?.byId[id] ? (en() ? state.kb.byId[id].en : state.kb.byId[id].es) : id; say(where.length > 2 ? 'warn' : 'tip', t(name + ' sale en ' + where.length + ' platos (' + where.join(', ') + ').', name + ' appears in ' + where.length + ' dishes (' + where.join(', ') + ').'), where); }
 // Brasa
 const grill = rows.filter(({d}) => d.components.some(c => c.techniques.some(x => GRILL.has(x)))).length;
 if (grill / rows.length > .6 && rows.length >= 3) say('tip', t(grill + ' de ' + rows.length + ' platos llevan brasa. Es tu sello, pero alguno crudo, encurtido o al vapor da descanso.', grill + ' of ' + rows.length + ' dishes use the grill. It is your signature, but something raw, pickled or steamed gives a rest.'));
 // Texturas y frescor
 if (!rows.some(r => r.p?.textures?.has?.('crujiente') || r.d.components.some(c => c.role === 'crujiente'))) say('tip', t('Ningún plato tiene crujiente.', 'No dish has any crunch.'));
 if (!rows.some(r => (r.p?.axes?.acido || 0) >= 5 || (r.p?.axes?.fresco || 0) >= 5)) say('tip', t('Le falta un plato ácido o fresco que limpie.', 'It lacks a sharp or fresh dish to cleanse.'));
 // Platos sin perfil
 const blank = rows.filter(r => !r.p || r.p.empty).length;
 if (blank) say('info', t(blank + ' plato(s) sin ingredientes reconocidos no cuentan en el análisis.', blank + ' dish(es) with no recognised ingredients are not counted.'));
 if (!notes.some(n => n.level === 'warn')) say('ok', t('No hay choques claros entre los platos.', 'No clear clashes between the dishes.'));
 // Alérgenos (los que dijo el consejo de cada plato)
 const allergens = ALLERGENS.map(a => [a, rows.map((r, k) => ((r.d.advice?.allergens || []).includes(a[0]) ? k + 1 : 0)).filter(Boolean)]).filter(([, w]) => w.length);
 return {rows, notes, allergens};
}
function menuPrompt(menu) {
 const dishes = menu.items.map(x => dishById(x.dish_id)).filter(d => d && !d.deleted_at);
 return 'Eres un jefe de cocina con oficio. Mira este ' + (menu.kind === 'carta' ? 'conjunto de platos para una carta' : 'menú degustación, en este orden,') + ' de un restaurante de brasa mediterráneo y dime, en texto normal, corto y práctico: si el conjunto está equilibrado, qué se repite o choca, el ritmo' + (menu.kind === 'carta' ? ' y si cubre bien entrantes, principales y postres' : ' y el orden') + ', y los 3 cambios que harías primero. ' + (en() ? 'Write in British English.' : 'Escribe en español de España.') + '\n\n' + (menu.kind === 'carta' ? 'CARTA' : 'MENÚ') + ' «' + menu.name + '»:\n' + JSON.stringify(dishes.map((d, k) => ({n: k + 1, ...dishRequest(state.kb, d)})));
}

// ---------- Pantallas ----------
function listPage() {
 const menus = liveMenus(), trashed = state.menus.filter(m => m.deleted_at);
 return '<header class="page-head page-head-row"><div><h1>' + esc(t('Cartas y menús', 'Menus')) + '</h1><p>' + esc(t('Junta platos en una carta o un menú degustación y mira si el conjunto está equilibrado.', 'Put dishes together in a menu and check that the whole is balanced.')) + '</p></div><button type="button" class="btn primary" data-act="new">' + icon('plus') + esc(t('Nuevo', 'New')) + '</button></header>' + tabs('menus') +
  (menus.length ? '<div class="menu-list">' + menus.map(m => { const n = m.items.filter(x => dishById(x.dish_id)).length; return '<a class="menu-card" href="#/menus/' + esc(m.id) + '"><span class="kicker">' + esc(kindName(m.kind)) + '</span><strong>' + esc(m.name) + '</strong><span class="menu-meta">' + esc((n === 1 ? t('1 plato', '1 dish') : n + t(' platos', ' dishes')) + ', ' + relDay(m.updated_at)) + '</span><span class="menu-dots">' + m.items.map(x => dishById(x.dish_id)).filter(Boolean).slice(0, 10).map(d => flavorPrint(d.flavor?.axes, {size: 28})).join('') + '</span></a>'; }).join('') + '</div>'
   : emptyState('book', t('Aún no hay cartas ni menús', 'No menus yet'), state.dishes.some(d => !d.deleted_at) ? t('Crea uno y añade platos de tu libreta: la app te dirá qué se repite, qué choca y qué falta.', 'Create one and add dishes from your notebook: the app tells you what repeats, clashes or is missing.') : t('Primero crea algunos platos en la libreta.', 'First create some dishes in the notebook.'), '<button type="button" class="btn primary" data-act="new">' + icon('plus') + esc(t('Nuevo menú', 'New menu')) + '</button>')) +
  (trashed.length ? '<section class="sec"><h2 class="day">' + esc(t('Papelera', 'Bin')) + '</h2><ul class="bin">' + trashed.map(m => '<li><div><strong>' + esc(m.name) + '</strong><small>' + esc(kindName(m.kind)) + '</small></div><button type="button" class="btn ghost" data-restore="' + esc(m.id) + '">' + icon('undo') + esc(t('Recuperar', 'Restore')) + '</button></li>').join('') + '</ul></section>' : '');
}
function comparison(menu) {
 const result = analyse(menu);
 return '<section><h3>' + esc(menu.name) + '</h3><ol>' + result.rows.map(({d}) => '<li>' + esc(d.name) + '</li>').join('') + '</ol><ul>' +
  result.notes.filter(n => n.level !== 'ok').map(n => '<li>' + esc(n.text) + '</li>').join('') + '</ul></section>';
}
function editPage(id) {
 const m = menuById(id);
 if (!m) return '<a class="back" href="#/menus">' + icon('left') + esc(t('Cartas y menús', 'Menus')) + '</a>' + emptyState('book', t('Este menú no está', 'This menu is not here'), t('Puede que se haya movido.', 'It may have moved.'));
 const a = analyse(m), on = iaOn(), others = liveMenus().filter(menu => menu.id !== id);
 const dishRow = ({d, p, itemIndex}, k) => '<li class="mrow" data-k="' + k + '" tabindex="-1"><span class="mrow-n">' + (k + 1) + '</span>' + flavorPrint(p && !p.empty ? p.axes : d.flavor?.axes, {size: 44}) + '<a class="mrow-main" href="#/plato/' + esc(d.id) + '"><strong>' + esc(d.name) + '</strong><small>' + esc([courseName(d.course), p?.dominant?.length ? t('domina ', 'led by ') + p.dominant.map(x => axisName(x).toLowerCase()).join(' y ') : ''].filter(Boolean).join(', ')) + '</small></a>' +
  '<span class="mrow-act"><button type="button" class="iconbtn" data-up="' + itemIndex + '" aria-label="' + esc(t('Subir', 'Move up')) + '"' + (k ? '' : ' disabled') + '>' + '↑</button><button type="button" class="iconbtn" data-down="' + itemIndex + '" aria-label="' + esc(t('Bajar', 'Move down')) + '"' + (k < a.rows.length - 1 ? '' : ' disabled') + '>' + '↓</button><button type="button" class="iconbtn" data-out="' + itemIndex + '" aria-label="' + esc(t('Quitar del menú', 'Remove from menu')) + '">' + icon('x') + '</button></span><label class="mrow-tasting"><span>' + esc(t('Nota de cata', 'Tasting note')) + '</span><textarea rows="2" maxlength="1000" data-tasting="' + itemIndex + '">' + esc(m.items[itemIndex].tasting || '') + '</textarea></label></li>';
 return '<a class="back" href="#/menus">' + icon('left') + esc(t('Cartas y menús', 'Menus')) + '</a><div class="bench menu-bench">' +
  '<header class="card bench-head"><div class="bench-top"><label class="sr" for="menuKind">' + esc(t('Tipo', 'Type')) + '</label><select id="menuKind" class="status-select">' + KINDS().map(([k, l]) => '<option value="' + k + '"' + (m.kind === k ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select><button type="button" class="btn ghost sala-btn" data-act="sala">' + icon('down') + esc(t('Imprimir para la sala', 'Print for the dining room')) + '</button><button type="button" class="iconbtn" data-act="more" aria-label="' + esc(t('Enviar a la papelera', 'Move to the bin')) + '">' + icon('trash') + '</button></div>' +
  '<label class="sr" for="menuName">' + esc(t('Nombre', 'Name')) + '</label><input id="menuName" class="title-input" value="' + esc(m.name) + '" maxlength="120" autocomplete="off"><div class="row-actions row-left"><button type="button" class="btn ghost" data-act="duplicate">' + esc(t('Duplicar para probar', 'Duplicate to test')) + '</button></div></header>' +
  '<section class="card"><div class="row-actions row-left"><button type="button" class="btn primary" data-act="add">' + icon('plus') + esc(t('Añadir platos', 'Add dishes')) + '</button></div><h2>' + esc(t('Platos', 'Dishes')) + (a.rows.length ? '<span class="count">' + a.rows.length + '</span>' : '') + '</h2>' + (a.rows.length ? '<ol class="mrows">' + a.rows.map(dishRow).join('') + '</ol>' : '<p class="hint">' + esc(t('Añade platos de tu libreta. En un menú degustación, el orden cuenta.', 'Add dishes from your notebook. In a tasting menu, the order matters.')) + '</p>') +
  '</section>' +
  '<aside class="card analysis"><h2>' + esc(t('¿Está equilibrado?', 'Is it balanced?')) + '</h2>' + (a.rows.length < 2 ? '<p class="hint">' + esc(t('Con dos platos o más, aquí verás qué se repite, qué choca y qué falta.', 'With two dishes or more, you will see here what repeats, clashes or is missing.')) + '</p>' :
   '<ul class="notes">' + a.notes.map(n => '<li class="note note-' + (n.level === 'warn' ? 'warn' : n.level === 'ok' ? 'ok' : 'tip') + '">' + icon(n.level === 'ok' ? 'check' : n.level === 'warn' ? 'alert' : 'info') + '<div><p>' + esc(n.text) + '</p>' + (n.passes.length ? '<button type="button" class="linkbtn" data-passes="' + n.passes.join(',') + '" aria-pressed="false">' + esc(t('Marcar estos pases', 'Highlight these courses')) + '</button>' : '') + '</div></li>').join('') + '</ul>' +
   (a.allergens.length ? '<h3>' + esc(t('Alérgenos (según el consejo de cada plato)', 'Allergens (from each dish\'s advice)')) + '</h3><div class="chips">' + a.allergens.map(([al, w]) => '<span class="chip chip-static">' + esc(lbl(al)) + '<small>' + esc(w.join(', ')) + '</small></span>').join('') + '</div>' : '')) +
   '<details><summary>' + esc(t('Consejos y cómo corregir el menú', 'Tips and how to correct the menu')) + '</summary><dl>' +
   '<dt><strong>' + esc(t('Los platos seguidos saben parecido', 'Consecutive dishes taste similar')) + '</strong></dt><dd>' + esc(t('El paladar se acostumbra al mismo sabor. Separa los platos o cambia el aliño de uno y vuelve a catarlos en orden.', 'The palate adapts to the same flavour. Separate the dishes or change one dressing and taste them in order again.')) + '</dd>' +
   '<dt><strong>' + esc(t('El menú se hace pesado', 'The menu feels heavy')) + '</strong></dt><dd>' + esc(t('Varios bocados grasos seguidos pierden contraste. Prueba una guarnición fresca o un encurtido entre los pases más intensos.', 'Several rich bites in a row lose contrast. Try a fresh garnish or a pickle between the richest courses.')) + '</dd>' +
   '<dt><strong>' + esc(t('Las texturas se parecen', 'Textures feel too similar')) + '</strong></dt><dd>' + esc(t('Si todo es blando, cada bocado se parece al anterior. Prueba un crujiente y añádelo al pase si se ablanda con la salsa.', 'If everything is soft, each bite feels like the previous one. Try a crisp element and add it at service if the sauce softens it.')) + '</dd>' +
   '</dl></details></aside>' +
  rhythmHtml(a.rows) +
  (others.length ? '<section class="card"><h2>' + esc(t('Comparar menús', 'Compare menus')) + '</h2><label for="menuCompare">' + esc(t('Comparar con', 'Compare with')) + '</label><select id="menuCompare"><option value="">' + esc(t('Elige un menú', 'Choose a menu')) + '</option>' + others.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('') + '</select><div id="menuComparison" class="menu-comparison" aria-live="polite"></div></section>' : '') +
  '<section class="card" id="menuAdvice"><h2>' + esc(t('Opinión de ChatGPT', 'ChatGPT\'s view')) + '</h2>' + (m.advice?.text ? '<div class="msg-body">' + rich(m.advice.text) + '</div><p class="fine">' + esc(t('Del ', 'From ') + shortDate(m.advice.at)) + '</p>' : '<p class="hint">' + esc(t('Una segunda opinión sobre el conjunto: ritmo, repeticiones y qué cambiaría.', 'A second opinion on the whole: rhythm, repetitions and what to change.')) + '</p>') +
   (a.rows.length >= 2 ? (on ? '<div class="row-actions row-left"><button type="button" class="btn ' + (m.advice ? 'ghost' : 'primary') + '" data-act="advice">' + icon('spark') + esc(m.advice ? t('Pedir otra opinión', 'Ask again') : t('Pedir opinión a ChatGPT', 'Ask ChatGPT')) + '</button></div>' : '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="copy">' + icon('copy') + esc(t('Copiar la consulta', 'Copy the request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>') : '') + '</section>' +
  '<section class="card" id="menuPair"><h2>' + esc(t('Maridaje del menú', 'Menu pairing')) + '</h2>' + (m.pairing?.text ? '<div class="msg-body">' + rich(m.pairing.text) + '</div>' : '<p class="hint">' + esc(t('Un vino para cada plato y una alternativa sin alcohol para todo el menú.', 'A wine for each dish and an alcohol-free option for the whole menu.')) + '</p>') +
   (a.rows.length >= 1 ? (on ? '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="pair">' + icon('drop') + esc(m.pairing ? t('Otra propuesta', 'Another suggestion') : t('Proponer maridaje', 'Suggest a pairing')) + '</button></div>' : '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="pair-copy">' + icon('copy') + esc(t('Copiar la consulta de maridaje', 'Copy the pairing request')) + '</button><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>') : '') + '</section>' +
  '<section class="card"><h2>' + esc(t('Notas', 'Notes')) + '</h2><label class="sr" for="menuNotes">' + esc(t('Notas del menú', 'Menu notes')) + '</label><textarea id="menuNotes" data-voice rows="3" maxlength="4000" placeholder="' + esc(t('Para cuándo es, bebidas, cambios pendientes…', 'When it is for, drinks, pending changes…')) + '">' + esc(m.notes) + '</textarea></section></div>';
}
// ---------- Para la sala: la carta o el menú, limpio y bonito, con los alérgenos ----------
const ORDER = ['picar', 'entrante', 'principal', 'guarnicion', 'postre', 'brunch', 'salsa', 'otro'];
function salaHtml(m) {
 const dishes = m.items.map(x => dishById(x.dish_id)).filter(d => d && !d.deleted_at);
 const al = d => dishAllergens(d).names;
 const item = d => '<div class="sala-dish"><h3>' + esc(d.name) + '</h3>' + (d.concept ? '<p>' + esc(d.concept) + '</p>' : '') + (al(d).length ? '<small>' + esc(t('Alérgenos: ', 'Allergens: ') + al(d).join(', ')) + '</small>' : '') + '</div>';
 let body = '';
 if (m.kind === 'carta') {
  for (const c of ORDER) { const list = dishes.filter(d => (d.course || 'otro') === c); if (list.length) body += '<section class="sala-sec"><h2>' + esc(courseName(c)) + '</h2>' + list.map(item).join('') + '</section>'; }
 } else body = '<section class="sala-sec">' + dishes.map(item).join('<div class="sala-sep"></div>') + '</section>';
 return '<article class="sala"><header><p class="sala-kicker">' + esc(kindName(m.kind)) + '</p><h1>' + esc(m.name) + '</h1></header>' + body +
  '<footer>' + esc(t('Consulte al personal de sala por alérgenos e intolerancias.', 'Please ask our staff about allergens and intolerances.')) + '</footer></article>';
}
async function printSala(m) {
 let host = document.getElementById('printFicha');
 if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
 host.innerHTML = salaHtml(m);
 document.documentElement.classList.add('printing');
 const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
 addEventListener('afterprint', done);
 setTimeout(() => print(), 50);
}

export const render = params => (params[0] ? editPage(params[0]) : listPage());

function pickDishes(m, done) {
 let q = '', course = '', season = '';
 const seasons = [...new Set(state.dishes.filter(d => !d.deleted_at).map(d => d.season).filter(Boolean))].sort();
 const chosen = new Set(m.items.map(x => x.dish_id));
 const draw = () => state.dishes.filter(d => !d.deleted_at && (!course || d.course === course) && (!season || d.season === season) && (!q || textKey(d.name + ' ' + (d.concept || '')).includes(q))).map(d => '<label class="pick"><input type="checkbox" value="' + esc(d.id) + '"' + (chosen.has(d.id) ? ' checked' : '') + '>' + flavorPrint(d.flavor?.axes, {size: 32}) + '<span><strong>' + esc(d.name) + '</strong><small>' + esc(courseName(d.course)) + '</small></span></label>').join('') || '<p class="hint">' + esc(t('No hay platos con esos filtros.', 'No dishes match these filters.')) + '</p>';
 const s = sheet({title: t('Añadir platos', 'Add dishes'), wide: true, body: '<label class="sr" for="pickQ">' + esc(t('Buscar plato', 'Search dish')) + '</label><div class="searchbox">' + icon('search') + '<input id="pickQ" type="search" placeholder="' + esc(t('Buscar plato', 'Search dish')) + '" autocomplete="off"></div><div class="menu-filters"><label>' + esc(t('Tipo de pase', 'Course')) + '<select id="pickCourse"><option value="">' + esc(t('Todos', 'All')) + '</option>' + COURSES.map(c => '<option value="' + esc(c[0]) + '">' + esc(lbl(c)) + '</option>').join('') + '</select></label><label>' + esc(t('Temporada', 'Season')) + '<select id="pickSeason"><option value="">' + esc(t('Todas', 'All')) + '</option>' + seasons.map(key => '<option value="' + esc(key) + '">' + esc(/^\d{4}$/.test(key) ? t('Todo el año ', 'All year ') + key : seasonLabel(key)) + '</option>').join('') + '</select></label></div><div id="pickList" class="pick-list">' + draw() + '</div><div class="row-actions"><button type="button" class="btn primary" data-act="ok">' + icon('check') + esc(t('Listo', 'Done')) + '</button></div>'});
 const refresh = () => { $('#pickList', s.el).innerHTML = draw(); };
 $('#pickQ', s.el).oninput = e => { q = textKey(e.target.value).trim(); refresh(); };
 $('#pickCourse', s.el).onchange = e => { course = e.target.value; refresh(); };
 $('#pickSeason', s.el).onchange = e => { season = e.target.value; refresh(); };
 $('#pickList', s.el).onchange = e => { if (e.target.checked) chosen.add(e.target.value); else chosen.delete(e.target.value); };
 $('[data-act=ok]', s.el).onclick = () => { s.close(); const keep = m.items.filter(x => chosen.has(x.dish_id)), have = new Set(keep.map(x => x.dish_id)); done([...keep, ...[...chosen].filter(id => !have.has(id)).map(dish_id => ({dish_id}))]); };
}
export function mount(root, params) {
 const id = params[0];
 const repaint = () => { if (root.isConnected) root.innerHTML = render(params); };
 const patch = async p => { await saveMenu(id, p); repaint(); };
 root.addEventListener('input', e => {
  if (!id) return;
  if (e.target.dataset.tasting !== undefined) {
   const index = Number(e.target.dataset.tasting), items = menuById(id)?.items.slice();
   if (items?.[index]) {
    items[index] = {...items[index], tasting: e.target.value.slice(0, 1000)};
    saveMenu(id, {items});
   }
  }
  if (e.target.id === 'menuName') saveMenu(id, {name: clip(e.target.value, 120) || t('Menú sin nombre', 'Untitled menu')});
  if (e.target.id === 'menuNotes') saveMenu(id, {notes: e.target.value.slice(0, 4000)});
 });
 root.addEventListener('change', e => {
  if (id && e.target.id === 'menuKind') patch({kind: e.target.value});
  if (e.target.id === 'menuCompare') {
   const other = menuById(e.target.value);
   $('#menuComparison', root).innerHTML = other ? comparison(menuById(id)) + comparison(other) : '';
  }
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = id ? menuById(id) : null;
  if (b.dataset.act === 'new') { const made = await createMenu({name: t('Menú nuevo', 'New menu'), kind: 'degustacion'}); go('menus/' + made.id); return; }
  if (b.dataset.restore) { await saveMenu(b.dataset.restore, {deleted_at: null}); repaint(); toast(t('Recuperado.', 'Restored.')); return; }
  if (!m) return;
  if (b.dataset.act === 'duplicate') {
   b.disabled = true;
   const suffix = t(' (prueba)', ' (test)');
   const made = await createMenu({name: m.name.slice(0, 120 - suffix.length) + suffix, kind: m.kind, notes: m.notes, items: structuredClone(m.items)});
   go('menus/' + made.id);
   return;
  }
  if (b.dataset.passes) {
   const on = b.getAttribute('aria-pressed') !== 'true';
   const passes = b.dataset.passes.split(',').map(Number);
   $$('[data-passes]', root).forEach(button => button.setAttribute('aria-pressed', button === b && on));
   const rows = $$('.mrow', root);
   rows.forEach((row, i) => row.classList.toggle('mrow-highlight', on && passes.includes(i + 1)));
   if (on) rows[passes[0] - 1]?.focus();
   return;
  }
  const items = m.items.slice();
  if (b.dataset.up !== undefined || b.dataset.down !== undefined) {
   const direction = b.dataset.up !== undefined ? 'up' : 'down';
   const index = Number(b.dataset[direction]);
   const rows = analyse(m).rows;
   const position = rows.findIndex(row => row.itemIndex === index);
   const target = rows[position + (direction === 'up' ? -1 : 1)]?.itemIndex;
   if (target === undefined) return;
   [items[index], items[target]] = [items[target], items[index]];
   await patch({items});
   const next = root.querySelector('[data-' + direction + '="' + target + '"]:not(:disabled)');
   (next || root.querySelector('[data-out="' + target + '"]'))?.focus();
   return;
  }
  if (b.dataset.out) { items.splice(Number(b.dataset.out), 1); patch({items}); }
  if (b.dataset.act === 'add') pickDishes(m, next => patch({items: next}));
  if (b.dataset.act === 'copy') { const done = await copy(menuPrompt(m)); toast(done ? t('Consulta copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  const dishesOf = () => m.items.map(x => dishById(x.dish_id)).filter(d => d && !d.deleted_at);
  if (b.dataset.act === 'pair-copy') { const done = await copy(menuPairingPrompt(m, dishesOf())); toast(done ? t('Consulta copiada.', 'Request copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  if (b.dataset.act === 'pair') {
   b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('Pensando el maridaje…', 'Thinking of a pairing…');
   try { const text = await askIa({text: menuPairingPrompt(m, dishesOf())}); await saveMenu(id, {pairing: {text: text.trim(), at: new Date().toISOString()}}); repaint(); }
   catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Proponer maridaje', 'Suggest a pairing'); } }
  }
  if (b.dataset.act === 'advice') {
   b.disabled = true; b.classList.add('is-busy'); b.lastChild.textContent = t('ChatGPT está mirando el menú…', 'ChatGPT is looking at the menu…');
   try { const text = await askIa({text: menuPrompt(m)}); await saveMenu(id, {advice: {text: text.trim(), at: new Date().toISOString()}}); repaint(); }
   catch (err) { toast(iaMessage(err), 'error', 7000); if (b.isConnected) { b.disabled = false; b.classList.remove('is-busy'); b.lastChild.textContent = t('Pedir opinión a ChatGPT', 'Ask ChatGPT'); } }
  }
  if (b.dataset.act === 'sala') { if (!m.items.some(x => dishById(x.dish_id))) { toast(t('Añade platos primero.', 'Add dishes first.'), 'error'); return; } printSala(m); return; }
  if (b.dataset.act === 'more') {
   if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: lo encontrarás abajo, en Cartas y menús, y podrás recuperarlo. Los platos no se tocan.', 'It is not deleted: you will find it below in Menus and can restore it. The dishes are not touched.'), yes: t('Enviar a la papelera', 'Move to the bin'), danger: true})) return;
   await saveMenu(id, {deleted_at: new Date().toISOString()}); toast(t('En la papelera.', 'Moved to the bin.')); go('menus');
  }
 });
 return null;
}
export function onData(what, el, params) { if (!el) return; if (!params[0] || !el.querySelector('#menuName')) el.innerHTML = render(params); }
