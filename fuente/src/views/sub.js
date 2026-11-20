// I+D · Una subreceta propia (tu romesco, tu fondo oscuro, tus encurtidos): ingredientes con cantidad, elaboración, lo que rinde
// y a qué sabe. Se usa como un ingrediente más en los platos, que la toman con su sabor. Nada se borra: va a la papelera.
import {dishProfile} from '../flavor-core.js';
import {searchIngredients} from '../kitchen.js';
import {t, en} from '../i18n.js';
import {esc, icon, $, sheet, toast, ask, flavorPrint, flavorMeters, verdictText, clip} from '../ui.js';
import {state, subById, saveSub} from '../store.js';
import {dishAdvice} from '../flavor-core.js';
import {emptyState} from './shared.js';
import {go} from '../nav.js';

export const title = params => subById(params[0])?.name || t('Subreceta', 'Sub-recipe');
const pseudo = x => ({components: [{role: 'salsa', techniques: [], items: x.items.map(i => ({n: i.n, k: i.k || null, w: i.w || 2}))}]});
const usedIn = id => state.dishes.filter(d => !d.deleted_at && d.components.some(c => c.items.some(i => i.ref === id)));

function flavourHtml(x) {
 const kb = state.kb;
 if (!kb) return '';
 const p = dishProfile(kb, pseudo(x));
 if (p.empty) return '<h2>' + esc(t('A qué sabe', 'What it tastes like')) + '</h2><p class="hint">' + esc(t('Añade ingredientes del catálogo y verás su sabor. Así, en los platos, cuenta con su sabor real.', 'Add ingredients from the catalogue to see its flavour. Then dishes count it with its real flavour.')) + '</p>';
 return '<h2>' + esc(t('A qué sabe', 'What it tastes like')) + '</h2><p class="verdict">' + esc(verdictText(dishAdvice(kb, pseudo(x), p).verdict, p)) + '</p><div class="analysis-chart">' + flavorPrint(p.axes, {size: 130, labels: true}) + flavorMeters(p, {lacking: []}) + '</div>';
}
function itemsHtml(x) {
 return (x.items.length ? '<ul class="sub-items">' + x.items.map((i, k) => '<li><span class="sub-n">' + esc(i.n) + (i.k ? '' : '<small>' + esc(t('sin perfil', 'no profile')) + '</small>') + '</span><label class="sr" for="sq' + k + '">' + esc(t('Cantidad', 'Quantity')) + '</label><input id="sq' + k + '" class="sub-q" data-q="' + k + '" value="' + esc(i.q || '') + '" maxlength="30" placeholder="' + esc(t('cantidad', 'qty')) + '" autocomplete="off"><button type="button" class="iconbtn" data-del="' + k + '" aria-label="' + esc(t('Quitar', 'Remove')) + '">' + icon('x') + '</button></li>').join('') + '</ul>'
  : '<p class="hint">' + esc(t('Empieza por los ingredientes, con su cantidad para lo que rinde.', 'Start with the ingredients, with their quantity for the yield.')) + '</p>') +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="add">' + icon('plus') + esc(t('Ingrediente', 'Ingredient')) + '</button></div>';
}
export function render(params) {
 const x = subById(params[0]);
 const back = '<a class="back" href="#/cocina">' + icon('left') + esc(t('Mi cocina', 'My kitchen')) + '</a>';
 if (!x) return back + emptyState('book', t('Esta subreceta no está', 'This sub-recipe is not here'), t('Puede que se haya movido.', 'It may have moved.'));
 const uses = usedIn(x.id);
 return back + (x.deleted_at ? '<div class="notice" role="status">' + icon('trash') + '<p><strong>' + esc(t('Está en la papelera.', 'It is in the bin.')) + '</strong> <button type="button" class="linkbtn" data-act="restore">' + esc(t('Recuperar', 'Restore')) + '</button></p></div>' : '') + '<div class="bench">' +
  '<header class="card bench-head"><div class="bench-top"><span class="kicker">' + esc(t('Subreceta', 'Sub-recipe')) + '</span><button type="button" class="iconbtn" data-act="trash" aria-label="' + esc(t('Enviar a la papelera', 'Move to the bin')) + '" style="margin-left:auto">' + icon('trash') + '</button></div>' +
  '<label class="sr" for="subName">' + esc(t('Nombre', 'Name')) + '</label><input id="subName" class="title-input sub-title" value="' + esc(x.name) + '" maxlength="90" autocomplete="off">' +
  '<div class="bench-meta"><label for="subYield">' + esc(t('Rinde', 'Yields')) + '</label><input id="subYield" value="' + esc(x.yield) + '" maxlength="40" placeholder="' + esc(t('p. ej. 1 litro, 20 raciones', 'e.g. 1 litre, 20 portions')) + '" autocomplete="off"></div></header>' +
  '<section class="card" id="subItems"><h2>' + esc(t('Ingredientes', 'Ingredients')) + '</h2>' + itemsHtml(x) + '</section>' +
  '<aside class="card analysis" id="subFlavour">' + flavourHtml(x) + '</aside>' +
  '<section class="card"><h2>' + esc(t('Elaboración', 'Method')) + '</h2><label class="sr" for="subMethod">' + esc(t('Elaboración', 'Method')) + '</label><textarea id="subMethod" rows="6" maxlength="4000" data-voice placeholder="' + esc(t('1. Asar los pimientos y los tomates en la brasa…', '1. Roast the peppers and tomatoes over the coals…')) + '">' + esc(x.method) + '</textarea></section>' +
  '<section class="card"><h2>' + esc(t('Se usa en', 'Used in')) + '</h2>' + (uses.length ? '<div class="chips">' + uses.map(d => '<a class="chip" href="#/plato/' + esc(d.id) + '">' + esc(d.name) + '</a>').join('') + '</div>' : '<p class="hint">' + esc(t('Aún en ningún plato. En un plato, añade un ingrediente y búscala por su nombre: sale la primera.', 'Not in any dish yet. In a dish, add an ingredient and search it by name: it comes up first.')) + '</p>') + '</section>' +
  '<section class="card"><h2>' + esc(t('Notas', 'Notes')) + '</h2><label class="sr" for="subNotes">' + esc(t('Notas', 'Notes')) + '</label><textarea id="subNotes" rows="3" maxlength="3000" data-voice placeholder="' + esc(t('Cuánto dura, cómo se guarda, trucos…', 'How long it keeps, how to store it, tips…')) + '">' + esc(x.notes) + '</textarea></section></div>';
}
function pick(id, onAdd) {
 const s = sheet({title: t('Añadir ingrediente', 'Add ingredient'), wide: true, body: '<div class="searchbox">' + icon('search') + '<input id="subSearch" type="search" placeholder="' + esc(t('Busca en el catálogo o escríbelo tal cual', 'Search the catalogue or type it as it is')) + '" autocomplete="off"></div><div id="subResults" class="results"></div>'});
 const input = $('#subSearch', s.el), box = $('#subResults', s.el);
 const draw = () => {
  const q = input.value.trim(), list = state.kb ? searchIngredients(state.kb, state.kitchen, q, {limit: 30, english: en()}).filter(r => r.type === 'kb') : [];
  box.innerHTML = list.map((r, k) => '<button type="button" class="result" data-pick="' + k + '"><span>' + esc(r.label) + '</span></button>').join('') + (q.length >= 2 && !list.some(r => r.label.toLowerCase() === q.toLowerCase()) ? '<button type="button" class="result result-free" data-free>' + icon('plus') + '<span>' + esc(t('Añadir «', 'Add “') + q + t('» tal cual', '” as written')) + '</span></button>' : '');
  box._list = list;
 };
 input.oninput = draw; draw(); setTimeout(() => input.focus(), 200);
 box.onclick = e => {
  const b = e.target.closest('[data-pick],[data-free]');
  if (!b) return;
  const item = b.hasAttribute('data-free') ? {n: clip(input.value, 80), k: null, q: '', w: 2} : {n: box._list[Number(b.dataset.pick)].label, k: box._list[Number(b.dataset.pick)].item.k, q: '', w: 2};
  onAdd(item); toast(t('Añadido: ', 'Added: ') + item.n, 'info', 1400); input.value = ''; draw(); input.focus();
 };
}
export function mount(root, params) {
 const id = params[0], timers = {};
 // Cada cambio se guarda medio segundo después de dejar de escribir; al salir de la pantalla se guarda lo pendiente.
 const later = (key, fn) => { clearTimeout(timers[key]?.h); timers[key] = {fn, h: setTimeout(() => { delete timers[key]; fn(); }, 500)}; };
 const redraw = () => { const x = subById(id); if (!x || !root.isConnected) return; $('#subItems', root).innerHTML = '<h2>' + esc(t('Ingredientes', 'Ingredients')) + '</h2>' + itemsHtml(x); $('#subFlavour', root).innerHTML = flavourHtml(x); };
 root.addEventListener('input', e => {
  const x = subById(id), el = e.target;
  if (!x) return;
  if (el.id === 'subName') later('name', () => saveSub(id, {name: clip(el.value, 90) || t('Subreceta', 'Sub-recipe')}));
  if (el.id === 'subYield') later('yield', () => saveSub(id, {yield: clip(el.value, 40)}));
  if (el.id === 'subMethod') later('method', () => saveSub(id, {method: el.value.slice(0, 4000)}));
  if (el.id === 'subNotes') later('notes', () => saveSub(id, {notes: el.value.slice(0, 3000)}));
  if (el.dataset.q !== undefined) later('q' + el.dataset.q, () => { const items = subById(id).items.map((i, k) => (k === Number(el.dataset.q) ? {...i, q: clip(el.value, 30)} : i)); saveSub(id, {items}); });
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const x = subById(id);
  if (!x) return;
  if (b.dataset.act === 'add') pick(id, item => { saveSub(id, {items: [...subById(id).items, item]}); redraw(); });
  if (b.dataset.del) { const items = x.items.slice(); items.splice(Number(b.dataset.del), 1); await saveSub(id, {items}); redraw(); }
  if (b.dataset.act === 'trash') {
   if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: la recuperas desde Mi cocina. Los platos que la usan no cambian.', 'It is not deleted: restore it from My kitchen. Dishes that use it do not change.'), yes: t('Enviar a la papelera', 'Move to the bin'), danger: true})) return;
   await saveSub(id, {deleted_at: new Date().toISOString()}); toast(t('En la papelera.', 'Moved to the bin.')); go('cocina');
  }
  if (b.dataset.act === 'restore') { await saveSub(id, {deleted_at: null}); root.innerHTML = render(params); toast(t('Recuperada.', 'Restored.')); }
 });
 return () => { for (const k of Object.keys(timers)) { clearTimeout(timers[k].h); timers[k].fn(); } };
}
export function onData(what, el, params) { if (['load', 'remote', 'subs'].includes(what) && el && !el.querySelector('#subName')) el.innerHTML = render(params); }
