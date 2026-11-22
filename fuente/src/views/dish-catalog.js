import {searchIngredients} from '../kitchen.js';
import {entries} from '../saber/index.js';
import {TECHNIQUES, technique, ROLES} from '../flavor-core.js';
import {t, en} from '../i18n.js';
import {state} from '../store.js';
import {esc, icon, $, sheet, clip} from '../ui.js';

const normalize = value => String(value || '').toLowerCase().normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const plain = (value, names) => String(value || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => label || names.get(id)?.name || id);
const label = row => en() ? row[2] : row[1];

const recipeName = entry => en() && entry.name_en ? entry.name_en : entry.name;

function recipeComponent(entry, role, names) {
 const {base} = entry;
 const cleanText = value => plain(value, names);
 const byName = new Map((state.kb?.list || []).flatMap(i => [i.es, i.en, ...i.syn].map(name => [normalize(name), i.id])));
 const items = base.items.map(([name]) => {
  const n = cleanText(name);
  return {n, k: byName.get(normalize(n)) || null, src: 'library', w: 2};
 });
 const recipe = base.items.map(([name, amount]) => [cleanText(name), amount].filter(Boolean).join(' — '));
 const method = [base.for && t('Receta base para ', 'Base recipe for ') + base.for, recipe.join('\n'), (base.steps || []).map((step, i) => (i + 1) + '. ' + cleanText(step)).join('\n\n')].filter(Boolean).join('\n\n');
 return {name: clip(recipeName(entry), 90), role, catalog_id: entry.id, items, method: method.slice(0, 3000), techniques: (entry.techniques || []).filter(id => technique(id)).slice(0, 6)};
}

export function openDishCatalog(components, onAdd, initialId = '') {
 const allEntries = entries();
 const recipes = allEntries.filter(e => e.base?.items?.length);
 const names = new Map(allEntries.map(e => [e.id, e]));
 const recipeIndex = recipes.map(entry => ({entry, keys: [entry.name, entry.name_en, ...(entry.aka || [])].filter(Boolean).map(normalize), text: normalize([entry.name, entry.name_en, ...(entry.aka || []), entry.summary, ...entry.base.items.map(([name]) => name)].join(' '))}));
 const techs = [...TECHNIQUES, ...['josper', 'ofyr'].filter(id => state.settings?.equipment?.includes(id)).map(id => [id, technique(id).es, technique(id).en])];
 const guides = allEntries.filter(entry => technique(entry.technique));
 const guideResult = entry => ({kind: 'tech', id: entry.technique, text: recipeName(entry), detail: plain(entry.summary, names)});
 const types = [
  ['all', t('Todo', 'All')],
  ['ingredient', t('Ingredientes', 'Ingredients')],
  ['recipe', t('Elaboraciones', 'Preparations')],
  ['tech', t('Técnicas', 'Techniques')]
 ];
 const roleOptions = ROLES.map(row => '<option value="' + row[0] + '">' + esc(label(row)) + '</option>').join('');
 const dialog = sheet({title: t('Añadir a la mesa de trabajo', 'Add to the workbench'), wide: true, body:
  '<div class="dish-catalog"><label for="catalogQ">' + esc(t('Buscar en el catálogo', 'Search the catalogue')) + '</label><div class="searchbox">' + icon('search') +
  '<input id="catalogQ" type="search" aria-controls="catalogResults" maxlength="120" autocomplete="off" placeholder="' + esc(t('Cebolla encurtida, alcachofa, brasa…', 'Pickled onion, artichoke, charcoal grill…')) + '"></div>' +
  '<div class="catalog-types" role="group" aria-label="' + esc(t('Tipo de resultado', 'Result type')) + '">' + types.map(([kind, title]) => '<button type="button" class="pill' + (kind === 'all' ? ' active' : '') + '" data-catalog-kind="' + kind + '" aria-pressed="' + (kind === 'all') + '">' + esc(title) + '</button>').join('') + '</div>' +
  '<p id="catalogStatus" class="sr" role="status"></p><div id="catalogResults" class="catalog-results"></div><div id="catalogChoice" class="catalog-choice" hidden></div>' +
  '</div>'});
 const input = $('#catalogQ', dialog.el), box = $('#catalogResults', dialog.el), choice = $('#catalogChoice', dialog.el), status = $('#catalogStatus', dialog.el);
 let kind = 'all', current = [], selected = null, lastResult = null;
 function draw() {
  const q = normalize(input.value), words = q.split(' ').filter(Boolean);
  const match = text => words.every(word => text.includes(word));
  const exactRecipe = candidate => !!q && candidate.keys.includes(q);
  const startsRecipe = candidate => candidate.keys.some(key => key.startsWith(q));
  const preparations = recipeIndex.filter(x => match(x.text))
   .sort((a, b) => Number(exactRecipe(b)) - Number(exactRecipe(a)) || Number(startsRecipe(b)) - Number(startsRecipe(a)) || a.entry.name.localeCompare(b.entry.name, 'es'))
   .slice(0, kind === 'all' && !q ? 4 : 30)
   .map(candidate => ({kind: 'recipe', text: recipeName(candidate.entry), exact: exactRecipe(candidate), detail: plain(candidate.entry.summary, names), entry: candidate.entry}));
  const ingredients = state.kb ? searchIngredients(state.kb, state.kitchen, input.value, {limit: kind === 'all' && !q ? 5 : 30, english: en()})
   .map(result => ({kind: 'ingredient', text: result.label, exact: normalize(result.label) === q, detail: result.type === 'recipe' ? t('Subreceta propia', 'Your sub-recipe') : '', item: result.item})) : [];
  const guideHits = guides.filter(entry => match(normalize([entry.name, entry.name_en, ...(entry.aka || [])].join(' '))))
   .map(entry => ({...guideResult(entry), exact: !!q && [entry.name, entry.name_en, ...(entry.aka || [])].some(name => normalize(name) === q)}));
  const techniques = [...guideHits, ...techs.filter(row => match(normalize(row.join(' '))))
   .map(row => ({kind: 'tech', text: label(row), exact: !!q && normalize(label(row)) === q, id: row[0]}))]
   .sort((a, b) => Number(b.exact) - Number(a.exact)).slice(0, kind === 'all' && !q ? 4 : 30);
  const all = [...preparations, ...ingredients, ...techniques];
  current = (kind === 'all' ? all.sort((a, b) => Number(b.exact) - Number(a.exact)) : all.filter(result => result.kind === kind));
  if (q && kind !== 'tech' && kind !== 'recipe' && !current.some(result => result.exact)) current.push({kind: 'ingredient', text: clip(input.value, 80), detail: t('Añadir con este nombre', 'Add with this name'), item: {n: clip(input.value, 80), k: null, src: 'free', w: 2}});
  status.textContent = current.length === 1 ? t('1 resultado mostrado', '1 result shown') : t(current.length + ' resultados mostrados', current.length + ' results shown');
  const labels = {recipe: t('Elaboración', 'Preparation'), ingredient: t('Ingrediente', 'Ingredient'), tech: t('Técnica', 'Technique')};
  box.innerHTML = current.map((result, i) => '<button type="button" class="catalog-result" data-catalog-pick="' + i + '"><span><strong>' + esc(result.text) + '</strong>' +
   (result.detail ? '<small>' + esc(clip(result.detail, 140)) + '</small>' : '') + '</span><span class="catalog-tag">' + labels[result.kind] + '</span></button>').join('') ||
   '<p class="hint">' + esc(t('No hay coincidencias. Prueba con otra palabra.', 'No matches. Try another word.')) + '</p>';
 }
 function select(result) {
  selected = result;
  lastResult = current.indexOf(result);
  box.hidden = true; choice.hidden = false;
  const target = result.kind === 'recipe' ? '' :
   '<label for="catalogTarget">' + esc(t('Dónde añadirlo', 'Where to add it')) + '</label><select id="catalogTarget"><option value="">' + esc(t('Nuevo componente', 'New component')) + '</option>' +
   components.map((c, i) => '<option value="' + i + '">' + esc(c.name || label(ROLES.find(row => row[0] === c.role) || ROLES[0]) + ' ' + (i + 1)) + '</option>').join('') + '</select>';
  const base = result.entry?.base;
  const preview = base ? '<details class="catalog-preview"><summary>' + esc(t('Ver ingredientes y cantidades', 'See ingredients and amounts')) + '</summary>' +
   (base.for ? '<p class="fine">' + esc(base.for) + '</p>' : '') +
   '<ul>' + base.items.map(([name, amount]) => '<li><span>' + esc(plain(name, names)) + '</span><strong>' + esc(amount) + '</strong></li>').join('') + '</ul></details>' : '';
  choice.innerHTML = '<h3 tabindex="-1">' + esc(result.text) + '</h3>' + (result.detail ? '<p>' + esc(result.detail) + '</p>' : '') + preview + target +
   '<div id="catalogRoleWrap"><label for="catalogRole">' + esc(t('Papel en el plato', 'Role in the dish')) + '</label><select id="catalogRole">' + roleOptions + '</select></div>' +
   '<div class="row-actions"><button type="button" class="btn ghost" data-catalog-back>' + esc(t('Volver a los resultados', 'Back to results')) + '</button><button type="button" class="btn primary" data-catalog-add>' + icon('plus') + esc(t('Añadir al plato', 'Add to dish')) + '</button></div>';
  const role = $('#catalogRole', choice);
  role.value = result.entry?.role || (result.entry?.cat === 'salsas' ? 'salsa' : components.length ? 'guarnicion' : 'principal');
  const targetSelect = $('#catalogTarget', choice);
  if (result.kind === 'tech' && components.length) targetSelect.value = '0';
  const sync = () => { $('#catalogRoleWrap', choice).hidden = !!targetSelect?.value; };
  if (targetSelect) targetSelect.onchange = sync;
  sync();
  $('h3', choice).focus();
 }
 const reset = () => { selected = null; choice.hidden = true; box.hidden = false; };
 input.oninput = () => { reset(); draw(); };
 dialog.el.addEventListener('keydown', e => {
  if (selected || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const result = e.target.closest('[data-catalog-pick]');
  if (e.target !== input && !result) return;
  if (e.target === input && e.key === 'Enter' && current.length) {
   e.preventDefault(); select(current[0]); return;
  }
  if (!current.length || !(e.key === 'ArrowDown' || (result && ['ArrowUp', 'Home', 'End'].includes(e.key)))) return;
  e.preventDefault();
  const i = result ? Number(result.dataset.catalogPick) : -1;
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? current.length - 1 : Math.min(i + (e.key === 'ArrowUp' ? -1 : 1), current.length - 1);
  (j < 0 ? input : box.children[j]).focus();
 });
 dialog.el.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.catalogKind) {
   kind = b.dataset.catalogKind;
   for (const tab of dialog.el.querySelectorAll('[data-catalog-kind]')) { tab.classList.toggle('active', tab === b); tab.setAttribute('aria-pressed', tab === b); }
   reset(); draw();
  }
  if (b.dataset.catalogPick !== undefined) select(current[Number(b.dataset.catalogPick)]);
  if (b.hasAttribute('data-catalog-back')) { reset(); (box.children[lastResult] || input).focus(); }
  if (b.hasAttribute('data-catalog-add') && selected) {
   const target = $('#catalogTarget', choice)?.value;
   const role = $('#catalogRole', choice).value;
   const component = selected.kind === 'recipe' ? recipeComponent(selected.entry, role, names) : null;
   if (onAdd({target: target ? Number(target) : null, role, component, item: selected.item, technique: selected.id, techniqueName: selected.kind === 'tech' ? selected.text : ''})) dialog.close();
  }
 });
 const initial = initialId && recipes.find(entry => entry.id === initialId);
 const initialGuide = initialId && guides.find(entry => entry.id === initialId);
 if (initial || initialGuide) {
  input.value = recipeName(initial || initialGuide);
  draw();
  const result = initial ? {kind: 'recipe', text: recipeName(initial), detail: plain(initial.summary, names), entry: initial} : guideResult(initialGuide);
  select(result);
  lastResult = current.findIndex(hit => hit.kind === result.kind && hit.text === result.text);
  requestAnimationFrame(() => $('h3', choice)?.focus());
 } else {
  draw(); requestAnimationFrame(() => { if (dialog.el.classList.contains('in')) input.focus(); });
 }
}
