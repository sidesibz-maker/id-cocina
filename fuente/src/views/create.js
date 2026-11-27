// I+D · Crear: un plato se crea conversando (idea, sabores, plato); además, importar una receta, género recién llegado o plato en blanco.
// Las ideas de la IA son borradores: solo entran en la libreta cuando el cocinero abre una.
import {COURSES, dishProfile} from '../flavor-core.js';
import {ideaToDish, recipeToDish} from '../ai-core.js';
import {role, technique, matchName, inSeason, AROMAS, AXES, dishAdvice, suggest, norm} from '../flavor-core.js';
import {flavorContext} from '../kitchen.js';
import {search, entries, entryById} from '../saber/index.js';
import {AI_TECHS} from '../ai-core.js';
import {t, en, seasonOf} from '../i18n.js';
import {esc, icon, $, toast, flavorPrint, uid, friendly} from '../ui.js';
import {state, createDish} from '../store.js';
import {ideasPrompt, ideasFromReply, importPrompt, recipeFromReply, copy} from '../ai.js';
import {go} from '../nav.js';
import {iaOn, askIa, iaMessage, imageData} from '../ia.js';
import {trText, adoptIdea, sectionHead} from './shared.js';

let form = {brief: '', course: '', lead: '', wants: []}, result = null, lastTrend = '', recipe = null, recipeText = '';
export const title = params => (params[0] === 'llegado' ? t('Ha llegado género', 'New produce in') : params[0] === 'ideas' ? t('Dame ideas', 'Give me ideas') : params[0] === 'importar' ? t('Importar receta', 'Import a recipe') : t('Crear un plato', 'Create a dish'));
const lbl = row => (en() ? row[2] : row[1]);
const WANTS = () => [
 ['brasa', t('Con la brasa', 'Over charcoal')], ['compartir', t('Para compartir', 'To share')], ['vegetal', t('Vegetal', 'Plant-based')], ['temporada', t('De temporada', 'Seasonal')],
 ['aprovechamiento', t('De aprovechamiento', 'Zero waste')], ['rapido', t('Rápido en el pase', 'Fast at the pass')], ['atrevido', t('Algo atrevido', 'Something bold')]
];

// ---------- Crear: la mesa de ideas ----------
// En el centro, el plato y cómo va (qué sabores mandan y qué le falta). Alrededor estallan ideas sacadas solo de la
// base de la app: la tabla de sabores (combinaciones, aromas, texturas, temporada), las técnicas y las recetas de la
// Biblioteca. Sin ChatGPT. Se arrastran al plato (o se tocan en el móvil) y cada vez que entra algo se recalcula todo.
const BKEY = 'id-cocina-crear';
const fresh0 = () => ({brief: '', items: [], name: '', named: false, course: ''});
let board = (() => { try { const v = JSON.parse(localStorage.getItem(BKEY) || 'null'); return v && Array.isArray(v.items) ? {...fresh0(), ...v, items: v.items.filter(x => x.k !== 'idea')} : null; } catch { return null; } })() || fresh0();
let past = (() => { try { const v = JSON.parse(localStorage.getItem(BKEY) || 'null'); return Array.isArray(v?.past) ? v.past : []; } catch { return []; } })();
let cards = [];
const keep = () => { try { localStorage.setItem(BKEY, JSON.stringify({...board, past: past.slice(0, 10)})); } catch {} };
const ingName = id => { const i = state.kb?.byId[id]; return i ? (en() ? i.en : i.es) : id; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1), lo = id => ingName(id).toLowerCase();
const day = () => new Date().toISOString().slice(0, 10), hash = v => [...String(v)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const month = () => new Date().getMonth() + 1;
const aroma = id => (AROMAS[id] ? AROMAS[id][en() ? 1 : 0] : id);
const and = list => (list.length > 1 ? list.slice(0, -1).join(', ') + t(' y ', ' and ') + list.at(-1) : list[0] || '');
const COURSE_WORDS = [['postre', /\b(postre|dulce|tarta|helado|dessert)\b/i], ['entrante', /\b(entrante|starter)\b/i], ['picar', /\b(picar|compartir|tapa|snack)\b/i], ['principal', /\b(principal|segundo|main)\b/i]];
const FIX_ROLE = {acido: 'fresco', fresco: 'fresco', crujiente: 'crujiente', graso: 'salsa', umami: 'toque', color: 'toque'};
// Productos de temporada para empezar (cambian cada día; primero los que tienes en tus básicos).
function seasonal(n = 8) {
 const kb = state.kb; if (!kb) return [];
 const pantry = state.kitchen?.pantry || new Set(), sweet = board.course === 'postre';
 const fams = sweet ? ['fruta', 'fruto-seco', 'dulce', 'lacteo'] : ['verdura', 'fruta', 'pescado', 'marisco', 'seta', 'carne', 'ave'];
 return kb.list.filter(i => fams.includes(i.family) && (sweet && i.family !== 'fruta' ? true : inSeason(i, month()))).map(i => ({i, k: (pantry.has(i.id) ? 0 : 1) + (hash(i.id + day()) % 1000) / 1000})).sort((a, b) => a.k - b.k).slice(0, n).map(x => x.i.id);
}
// Productos que se reconocen en lo que escribe el cocinero.
function found(text) {
 const kb = state.kb, out = [];
 if (!kb) return out;
 for (const chunk of String(text).split(/[,.;:\n]|\s+(?:y|e|con|o|más|mas|and|with)\s+/i)) {
  const words = chunk.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) for (let n = Math.min(3, words.length - i); n >= 1; n--) { const id = matchName(kb, words.slice(i, i + n).join(' ')); if (id) { if (!out.includes(id)) out.push(id); i += n - 1; break; } }
 }
 return out;
}
// Ingredientes de la tabla que hay en el plato (también los de las recetas de la Biblioteca que se han arrastrado).
const REC_IX = new Map();
function recIds(e) {
 if (!REC_IX.has(e.id)) REC_IX.set(e.id, [...new Set((e.base?.items || []).map(x => matchName(state.kb, String(x[0]))).filter(Boolean))]);
 return REC_IX.get(e.id);
}
const ings = () => board.items.filter(x => x.k === 'ing').map(x => x.id);
const plateIds = () => [...new Set([...ings(), ...board.items.filter(x => x.k === 'rec').flatMap(x => { const e = entryById(x.id); return e ? recIds(e) : []; })])];
function draftDish() { return state.kb ? {...ideaToDish(state.kb, state.kitchen, toIdea(), () => 'x'), course: board.course || 'otro'} : null; }
// Las ideas que estallan alrededor del plato, por grupos. Cada tarjeta: {k, id, label, why, role, items}.
function burst() {
 const kb = state.kb;
 if (!kb) return [];
 const have = ings(), all0 = plateIds(), pantry = state.kitchen?.pantry || new Set(), ctx = flavorContext(state.kitchen);
 const ing = (id, why, role = 'guarnicion') => ({k: 'ing', id, label: cap(ingName(id)), why, role});
 if (!have.length && !all0.length) {
  const out = [['start', board.course === 'postre' ? t('Para un postre', 'For a dessert') : t('De temporada para empezar', 'In season to start with'), seasonal(8).map(id => ing(id, board.course === 'postre' ? t('para empezar el postre', 'to start the dessert') : t('de temporada', 'in season'), 'principal'))]];
  const basics = kb.list.filter(i => pantry.has(i.id) && ['carne', 'ave', 'pescado', 'marisco', 'verdura', 'seta'].includes(i.family)).map(i => ({i, k: hash(i.id + day())})).sort((a, b) => a.k - b.k).slice(0, 8).map(x => ing(x.i.id, t('de tus básicos', 'one of your staples'), 'principal'));
  if (basics.length) out.push(['basics', t('Tus básicos', 'Your staples'), basics]);
  return out;
 }
 const main = have[0] || all0[0], M = kb.byId[main], inPlate = new Set(all0), score = new Map(), bold = new Set(), links = new Map();
 all0.forEach(id => { const w = id === main ? 1.6 : have.includes(id) ? 1 : .5; for (const [pid, l] of kb.links[id] || []) { if (inPlate.has(pid)) continue; score.set(pid, (score.get(pid) || 0) + l.score * w); links.set(pid, (links.get(pid) || 0) + 1); if (l.bold) bold.add(pid); } });
 const all = [...score].map(([id, s]) => ({id, i: kb.byId[id], s: s + (links.get(id) > 1 ? links.get(id) * .8 : 0) + (pantry.has(id) ? .4 : 0) + (inSeason(kb.byId[id], month()) ? .4 : 0)})).filter(x => x.i).sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));
 const used = new Set(), plain = ['condimento', 'grasa'], tasty = id => !plain.includes(kb.byId[id]?.family);
 // Por qué combina: aromas que comparte con el protagonista, lo que une, o el contraste que aporta.
 const why = x => {
  const common = M ? x.i.aromas.filter(a => M.aromas.includes(a)).slice(0, 2).map(aroma) : [];
  if ([...inPlate].filter(h => tasty(h) && kb.links[h]?.has(x.id)).length > 1) return t('va con ' + and([...inPlate].filter(h => tasty(h) && kb.links[h]?.has(x.id)).slice(0, 3).map(lo)), 'goes with ' + and([...inPlate].filter(h => tasty(h) && kb.links[h]?.has(x.id)).slice(0, 3).map(lo)));
  if (common.length) return t('comparte notas de ' + and(common) + ' con ' + lo(main), 'shares ' + and(common) + ' notes with ' + lo(main));
  if (M && x.i.taste[2] >= 3 && M.taste[5] >= 3) return t('su acidez corta la grasa de ' + lo(main), 'its acidity cuts the richness of ' + lo(main));
  if (M && x.i.textures.includes('crujiente') && !M.textures.includes('crujiente')) return t('contraste crujiente con ' + lo(main), 'a crunchy contrast to ' + lo(main));
  return pantry.has(x.id) ? t('lo tienes en tus básicos', 'one of your staples') : inSeason(x.i, month()) ? t('de temporada', 'in season') : t('combinación clásica con ' + lo(main), 'a classic match for ' + lo(main));
 };
 const take = (fn, n, role) => { const out = []; for (const x of all) { if (out.length >= n) break; if (used.has(x.id) || !fn(x.i, x)) continue; used.add(x.id); out.push(ing(x.id, why(x), role)); } return out; };
 const out = [];
 // Lo que le falta al plato según su equilibrio (tabla de sabores) y qué lo arregla, mirando también lo que combina.
 const dish = draftDish(), adv = dish ? dishAdvice(kb, dish) : {notes: []};
 for (const n of adv.notes.filter(n => n.level !== 'ok' && n.fix).slice(0, 2)) {
  const list = suggest(kb, dish, n.fix, ctx, 8).filter(s => !inPlate.has(s.id) && !used.has(s.id)).slice(0, 5);
  list.forEach(s => used.add(s.id));
  if (list.length) out.push(['need-' + n.fix, n.title[en() ? 1 : 0], list.map(s => ing(s.id, s.affinity ? t('arregla eso y combina con ' + lo(main), 'fixes it and goes with ' + lo(main)) : s.have ? t('lo arregla; lo tienes', 'fixes it; you have it') : t('lo arregla', 'fixes it'), FIX_ROLE[n.fix] || 'toque'))]);
 }
 out.push(['goes', t('Le va muy bien', 'Goes really well'), take(i => !plain.includes(i.family), 6)]);
 out.push(['fresh', t('Frescor y ácido', 'Freshness and acidity'), take(i => i.taste[2] >= 3 || ['encurtido', 'hierba'].includes(i.family), 4, 'fresco')]);
 out.push(['crunch', t('Crujiente', 'Crunch'), take(i => i.textures.includes('crujiente') || i.family === 'fruto-seco', 4, 'crujiente')]);
 out.push(['creamy', t('Cremoso', 'Creamy'), take(i => i.textures.includes('cremoso') || ['lacteo', 'queso'].includes(i.family), 4, 'cremoso')]);
 out.push(['bold', t('Algo atrevido', 'Something bold'), take((i, x) => bold.has(x.id) && !plain.includes(i.family), 4)]);
 // Cómo cocinarlo: técnicas que la tabla asocia al protagonista y lo que aporta cada una.
 const done = new Set(board.items.filter(x => x.k === 'tech').map(x => x.id));
 const gives = tech => { const r = technique(tech), parts = []; const top = r.mods.map((v, k) => [v, k]).filter(([v]) => v >= .7).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, k]) => AXES[k][en() ? 2 : 1].toLowerCase()); if (top.length) parts.push(t('aporta ', 'adds ') + and(top)); if (r.textures.length) parts.push(t('deja ', 'makes it ') + and(r.textures.slice(0, 2))); if (r.fresh >= 1) parts.push(t('mantiene el frescor', 'keeps it fresh')); return parts.join(t('; ', '; ')) || t('para ' + lo(main), 'for ' + lo(main)); };
 const techs = [...new Set([...(M?.tech || []), 'brasa', 'crudo', 'confitado', 'encurtido', 'ahumado', 'tostado'])].filter(id => technique(id) && !done.has(id)).slice(0, 6);
 out.push(['tech', t('Cómo cocinarlo', 'How to cook it'), techs.map(id => ({k: 'tech', id, label: en() ? technique(id).en : technique(id).es, why: gives(id)}))]);
 // Recetas de la Biblioteca que encajan: las que llevan lo que ya tienes o lo que combina con ello.
 const inRec = new Set(board.items.filter(x => x.k === 'rec').map(x => x.id)), plateWords = have.map(id => ingName(id).toLowerCase());
 const recs = [];
 for (const e of entries()) {
  if (!e.base?.items?.length || !['salsas', 'fondos', 'bases', 'dulce'].includes(e.cat) || inRec.has(e.id) || plateWords.some(w => e.name.toLowerCase().includes(w))) continue;
  if ((board.course === 'postre') !== (e.cat === 'dulce')) continue;
  const ids = recIds(e); if (!ids.length) continue;
  let s = 0; const hits = [];
  for (const id of ids) { if (inPlate.has(id)) continue; const l = [...inPlate].reduce((n, h) => n + (kb.links[h]?.get(id)?.score || 0), 0); if (l) { s += l; if (tasty(id)) hits.push(id); } }
  if (s && hits.length) recs.push({e, s: s / Math.sqrt(ids.length), hits});
 }
 recs.sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
 out.push(['recipes', t('Recetas de la Biblioteca', 'Library recipes'), recs.slice(0, 6).map(({e, hits}) => ({k: 'rec', id: e.id, label: e.name, why: t('lleva ' + and(hits.slice(0, 2).map(lo)) + ', que va con ' + lo(main), 'has ' + and(hits.slice(0, 2).map(lo)) + ', which goes with ' + lo(main)), role: e.cat === 'salsas' ? 'salsa' : e.cat === 'dulce' ? 'cremoso' : 'guarnicion', items: e.base.items.slice(0, 6).map(x => String(x[0]).replace(/\s*\(.*\)$/, ''))}))]);
 return out.filter(c => c[2].length);
}
function autoName() {
 if (board.named && board.name) return board.name;
 const main = board.items.find(x => x.k !== 'tech'), tech = board.items.find(x => x.k === 'tech');
 if (!main) return '';
 const rest = board.items.filter(x => x !== main && x.k !== 'tech' && !x.label.toLowerCase().includes(main.label.toLowerCase())).map(x => x.label.toLowerCase());
 return main.label + (tech ? ' ' + tech.label.toLowerCase().replace(/^(brasa|plancha)$/, 'a la $1') : '') + (rest.length ? t(' con ', ' with ') + and(rest.slice(0, 2)) : '');
}
function toIdea() {
 const techs = board.items.filter(x => x.k === 'tech').map(x => x.id), parts = board.items.filter(x => x.k !== 'tech');
 return {name: autoName() || t('Plato nuevo', 'New dish'), line: board.brief.slice(0, 240), course: board.course || 'otro', why: '', twist: '',
  components: parts.map((x, k) => ({role: k ? (x.role || 'guarnicion') : 'principal', name: x.label, techniques: k ? [] : techs.filter(id => AI_TECHS.includes(id)), items: x.items?.length ? x.items : [x.label]}))};
}
function add(card) {
 if (!card || board.items.some(x => x.k === card.k && x.id === card.id)) return;
 board.items.push({k: card.k, id: card.id || card.label, label: card.label, role: board.items.some(x => x.k !== 'tech') ? (card.role || 'guarnicion') : 'principal', ...(card.items ? {items: card.items} : {})});
 keep();
}
function cardHtml(c, key, k) {
 return '<button type="button" class="bcard bcard-' + c.k + '" draggable="true" data-add="' + key + ':' + k + '" style="--i:' + k + '">' + icon(c.k === 'tech' ? 'flame' : c.k === 'rec' ? 'book' : 'plus') + '<span><strong>' + esc(c.label) + '</strong>' + (c.why ? '<small>' + esc(c.why) + '</small>' : '') + '</span></button>';
}
// Cómo va el plato: su huella de sabor, qué manda y las notas de equilibrio de la tabla.
function readingHtml() {
 const dish = draftDish();
 if (!dish) return '';
 const adv = dishAdvice(state.kb, dish), p = adv.profile;
 if (p.empty) return '';
 const dom = p.dominant.map(id => AXES.find(a => a[0] === id)?.[en() ? 2 : 1].toLowerCase()).filter(Boolean);
 const notes = [...adv.notes.filter(n => n.level !== 'ok').slice(0, 3), ...adv.notes.filter(n => n.level === 'ok').slice(0, 2)];
 return '<div class="bread"><div class="bread-top">' + flavorPrint(p.axes, {size: 64}) + '<p>' + esc(dom.length ? t('Manda el ', 'Led by ') + and(dom) + '.' : t('Todavía no destaca ningún sabor.', 'No flavour stands out yet.')) + '</p></div>' +
  (notes.length ? '<ul class="bnotes">' + notes.map(n => '<li class="is-' + n.level + '">' + icon(n.level === 'ok' ? 'check' : 'spark') + '<span><strong>' + esc(n.title[en() ? 1 : 0]) + '</strong><small>' + esc(n.text[en() ? 1 : 0]) + '</small></span></li>').join('') + '</ul>' : '') + '</div>';
}
function plateHtml() {
 const can = state.canEdit && !state.setupPending, name = autoName();
 return '<section class="bplate" id="bPlate" aria-labelledby="bPlateH">' +
  '<form id="bStart" class="bstart"><label for="bBrief" id="bPlateH">' + esc(board.items.length ? t('Añade algo más', 'Add something else') : t('Empieza por algo', 'Start with something')) + '</label><div class="bstart-row"><input id="bBrief" autocomplete="off" maxlength="300" placeholder="' + esc(t('Pulpo, un postre con higos, cordero y algo ácido…', 'Octopus, a fig dessert, lamb and something sharp…')) + '"><button type="submit" class="btn' + (board.items.length ? '' : ' primary') + '">' + icon('plus') + '<span>' + esc(t('Poner', 'Add')) + '</span></button></div></form>' +
  '<div class="bdish' + (board.items.length ? '' : ' is-empty') + '" id="bDish" aria-live="polite">' +
  (board.items.length ? '<label class="sr" for="bName">' + esc(t('Nombre del plato', 'Dish name')) + '</label><input id="bName" class="bname" value="' + esc(name) + '" maxlength="120">' +
   '<ul class="bitems">' + board.items.map((x, k) => '<li class="bitem bitem-' + x.k + '"><span>' + (k === board.items.findIndex(y => y.k !== 'tech') ? '<small>' + esc(t('manda', 'leads')) + '</small>' : '') + esc(x.label) + (x.items?.length && x.k === 'rec' ? '<small>' + esc(x.items.slice(0, 4).join(', ')) + '</small>' : '') + '</span><button type="button" class="iconbtn" data-drop="' + k + '" aria-label="' + esc(t('Quitar ', 'Remove ') + x.label) + '">' + icon('x') + '</button></li>').join('') + '</ul>' + readingHtml()
   : '<p>' + esc(t('Arrastra aquí lo que te guste, o tócalo.', 'Drag here what you like, or tap it.')) + '</p>') + '</div>' +
  (board.items.length ? '<div class="bacts">' + (can ? '<button type="button" class="btn primary" data-act="b-save">' + icon('book') + esc(t('Guardar en mis platos', 'Save to my dishes')) + '</button>' : '') + '<button type="button" class="linkbtn" data-act="b-new">' + esc(t('Empezar otro', 'Start another')) + '</button></div>' : '') +
  '</section>';
}
function studio() {
 cards = burst();
 const groups = cards.map(([key, label, list]) => '<section class="bgroup bgroup-' + key.replace(/^need-.*/, 'need') + '" data-group="' + esc(key) + '" aria-label="' + esc(label) + '"><h2>' + esc(label) + '</h2><div class="bcards">' + list.map((c, k) => cardHtml(c, key, k)).join('') + '</div></section>').join('');
 return '<header class="page-head"><h1>' + esc(t('Crear un plato', 'Create a dish')) + '</h1><p>' + esc(t('Pon algo en el plato y la app te guía con su tabla de sabores, sus técnicas y las recetas de la Biblioteca: qué le va, qué le falta y por qué. Arrastra o toca lo que te guste.', 'Put something on the plate and the app guides you with its flavour table, techniques and library recipes: what goes, what is missing and why. Drag or tap what you like.')) + '</p></header>' +
  '<div class="bang' + (board.items.length ? ' has-dish' : '') + '">' + plateHtml() + groups + '</div>' +
  '<nav class="cother" aria-label="' + esc(t('Otras formas de empezar', 'Other ways to start')) + '"><span>' + esc(t('También:', 'Also:')) + '</span><a href="#/crear/importar">' + esc(t('Importar una receta', 'Import a recipe')) + '</a><a href="#/crear/llegado">' + esc(t('Ha llegado género', 'New produce in')) + '</a><a href="#/plato/nuevo">' + esc(t('Plato en blanco', 'Blank dish')) + '</a></nav>';
}
function mountStudio(root) {
 const paint = () => { if (root.isConnected) root.innerHTML = studio(); };
 const cardOf = v => { const [key, k] = String(v || '').split(':'); return (cards.find(c => c[0] === key)?.[2] || [])[Number(k)] || null; };
 root.addEventListener('submit', e => {
  if (e.target.id !== 'bStart') return;
  e.preventDefault();
  const text = $('#bBrief', root).value.trim();
  if (!text) { $('#bBrief', root).focus(); return; }
  if (!state.kb) { toast(t('Un momento: se está cargando la tabla de sabores.', 'One moment: the flavour table is loading.')); return; }
  const course = COURSE_WORDS.find(([, re]) => re.test(text));
  if (course && !board.course) board.course = course[0];
  board.brief = board.brief ? board.brief + '. ' + text : text;
  const ids = found(text);
  for (const id of ids) add({k: 'ing', id, label: cap(ingName(id)), role: 'guarnicion'});
  // Si dice una receta de la Biblioteca por su nombre (romesco, alioli…), también entra.
  if (!ids.length) { const e2 = search(text, 1)[0]; if (e2 && e2.base?.items?.length && norm(e2.name).includes(norm(text).split(' ')[0])) add({k: 'rec', id: e2.id, label: e2.name, role: e2.cat === 'salsas' ? 'salsa' : 'guarnicion', items: e2.base.items.slice(0, 6).map(x => String(x[0]).replace(/\s*\(.*\)$/, ''))}); }
  keep();
  if (!board.items.length && !course) toast(t('No reconozco ningún producto ahí. Prueba con uno concreto (pulpo, calabaza, cordero…) o toca uno de abajo.', 'I do not recognise a product there. Try a specific one (octopus, pumpkin, lamb…) or tap one below.'), 'info', 6000);
  paint(); $('#bBrief', root)?.focus();
 });
 root.addEventListener('click', async e => {
  const c = e.target.closest('[data-add]'), d = e.target.closest('[data-drop]'), act = e.target.closest('[data-act]')?.dataset.act;
  if (c) { add(cardOf(c.dataset.add)); paint(); $('#bDish', root)?.classList.add('is-hit'); return; }
  if (d) { board.items.splice(Number(d.dataset.drop), 1); const first = board.items.find(x => x.k !== 'tech'); if (first) first.role = 'principal'; keep(); paint(); return; }
  if (act === 'b-save' && board.items.length) {
   const b = e.target.closest('button'); b.disabled = true;
   const idea = toIdea(), dish = await adoptIdea(idea, {kind: 'crear', title: (board.brief || idea.name).slice(0, 140)});
   if (dish) { past = [{at: new Date().toISOString(), ...board, dish: dish.id}, ...past]; board = fresh0(); keep(); }
   else if (b.isConnected) b.disabled = false;
   return;
  }
  if (act === 'b-new') { if (board.items.length) past = [{at: new Date().toISOString(), ...board}, ...past]; board = fresh0(); keep(); paint(); return; }
 });
 root.addEventListener('input', e => { if (e.target.id === 'bName') { board.name = e.target.value; board.named = !!e.target.value.trim(); keep(); } });
 // Arrastrar ideas al plato (en el móvil se tocan).
 root.addEventListener('dragstart', e => { const c = e.target.closest?.('[data-add]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.add); e.dataTransfer.effectAllowed = 'copy'; root.classList.add('is-dragging'); });
 root.addEventListener('dragend', () => { root.classList.remove('is-dragging'); $('#bPlate', root)?.classList.remove('is-over'); });
 root.addEventListener('dragover', e => { const p = e.target.closest?.('#bPlate'); if (!p) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; p.classList.add('is-over'); });
 root.addEventListener('dragleave', e => { const p = e.target.closest?.('#bPlate'); if (p && !p.contains(e.relatedTarget)) p.classList.remove('is-over'); });
 root.addEventListener('drop', e => { const p = e.target.closest?.('#bPlate'); if (!p) return; e.preventDefault(); add(cardOf(e.dataTransfer.getData('text/plain'))); paint(); $('#bDish', root)?.classList.add('is-hit'); });
}

function ideaResult(idea, k) {
 const draft = state.kb ? ideaToDish(state.kb, state.kitchen, idea) : null, profile = draft ? dishProfile(state.kb, draft) : null;
 const comps = idea.components.map(c => { const r = role(c.role), techs = c.techniques.map(technique).filter(Boolean).map(x => (en() ? x.en : x.es)); return '<li><span class="comp-role">' + esc(en() ? r.en : r.es) + '</span><span><strong>' + esc(c.name) + '</strong>' + (techs.length ? ', ' + esc(techs.join(', ')) : '') + '<br><small>' + esc(c.items.join(', ')) + '</small></span></li>'; }).join('');
 return '<article class="idea-card idea-result"><div class="idea-top"><div><h3>' + esc(idea.name) + '</h3><span class="kicker">' + esc(lbl(COURSES.find(c => c[0] === idea.course) || COURSES[COURSES.length - 1])) + '</span></div>' + (profile && !profile.empty ? flavorPrint(profile.axes, {size: 60}) : '') + '</div>' +
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
  '<div class="row-actions row-left"><button type="button" class="btn ' + (on ? 'ghost' : 'primary') + '" data-act="copy-ideas">' + icon('copy') + esc(t('1. Copiar la petición', '1. Copy the request')) + '</button><a class="btn ghost" href="https://claude.ai/new" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a Claude', 'Ask Claude')) + icon('out') + '</a><a class="btn ghost" href="https://chatgpt.com/" data-chat target="_blank" rel="noopener noreferrer">' + esc(t('Preguntar a ChatGPT', 'Ask ChatGPT')) + icon('out') + '</a></div>' +
  '<label class="mini" for="ideasReply">' + esc(t('2. Pega aquí la respuesta', '2. Paste the answer here')) + '</label><textarea id="ideasReply" rows="4" placeholder="' + esc(t('Pega la respuesta entera, tal cual', 'Paste the whole answer as it is')) + '"></textarea>' +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-paste="ideasReply" data-then="[data-act=read-ideas]">' + icon('copy') + esc(t('Pegar y leer', 'Paste and read')) + '</button><button type="button" class="btn primary" data-act="read-ideas">' + icon('spark') + esc(t('3. Ver las propuestas', '3. See the proposals')) + '</button></div>' +
  (on ? '</details>' : '') + '</form>';
 if (result) html += '<section class="sec" id="ideaResults">' + sectionHead(t('Propuestas', 'Proposals'), '', t('Son borradores: abre la que te guste y cámbiala a tu manera.', 'These are drafts: open the one you like and make it yours.')) + '<div class="idea-list">' + result.ideas.map(ideaResult).join('') + '</div>' + (result.issues.length ? '<p class="fine">' + esc(result.issues.join(' ')) + '</p>' : '') + '</section>';
 return html;
}

// ---------- Importar una receta ----------
// Lo que llega al compartir desde otra app del móvil (TikTok, Instagram, el navegador…) entra ya pegado y leído.
export function presetRecipe(text) { recipeText = String(text || '').slice(0, 20000); const r = recipeFromReply(recipeText); recipe = r && r.components.length ? r : null; }
function recipePreview(r) {
 const draft = state.kb ? recipeToDish(state.kb, state.kitchen, r) : null, profile = draft ? dishProfile(state.kb, draft) : null;
 const comps = r.components.map(c => { const ro = role(c.role); return '<li><span class="comp-role">' + esc(en() ? ro.en : ro.es) + '</span><span>' + (c.name ? '<strong>' + esc(c.name) + '</strong><br>' : '') + '<small>' + esc(c.items.map(i => !i.qty ? i.name : /^[\d½¼¾]/.test(i.qty) ? i.qty + ' ' + i.name : i.name + ' ' + i.qty).join(', ')) + '</small>' + (c.method ? '<br><small class="pre">' + esc(c.method.split('\n').length + t(' pasos', ' steps')) + '</small>' : '') + '</span></li>'; }).join('');
 return '<article class="idea-card idea-result" id="recipePreview"><div class="idea-top"><div><h3>' + esc(r.name || t('Receta importada', 'Imported recipe')) + '</h3><span class="kicker">' + esc(t('Así queda', 'This is how it looks')) + (r.portions ? ', ' + esc(t('raciones: ', 'portions: ') + r.portions) : '') + '</span></div>' + (profile && !profile.empty ? flavorPrint(profile.axes, {size: 60}) : '') + '</div>' +
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

export const render = params => (params[0] === 'llegado' ? arrivedPage() : params[0] === 'ideas' ? ideasPage(params[1]) : params[0] === 'importar' ? importPage() : studio());

export function mount(root, params) {
 if (params[0] === 'importar') { mountImport(root); return null; }
 if (params[0] === 'llegado') { mountArrived(root); return null; }
 if (params[0] !== 'ideas') { mountStudio(root); return null; }
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
// Mientras se escribe no se repinta la pantalla. Al empezar, cuando llega la tabla de sabores, salen las ideas.
export function onData(what, root, params = []) {
 if (['importar', 'llegado', 'ideas'].includes(params[0]) || !root) return;
 const a = document.activeElement;
 if (a && root.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
 if (root.querySelector('#bPlate')) root.innerHTML = studio();
}
