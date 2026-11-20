// I+D · Mi cocina: lo que el cocinero cuenta de su casa (equipo, estilo, sello, lo que no quiere) y el catálogo con el que
// trabaja la app. Con esto se afinan los consejos, las ideas y la búsqueda de tendencias.
import {EQUIPMENT, cleanProfile} from '../ai-core.js';
import {t, en} from '../i18n.js';
import {esc, icon, $, toast, friendly, clip} from '../ui.js';
import {state, saveSettings, liveSubs, createSub, saveSub} from '../store.js';
import {flavorPrint} from '../ui.js';
import {dishProfile} from '../flavor-core.js';
import {go} from '../nav.js';
import {skeleton} from './shared.js';

let draft = null, dirty = false;
export const title = () => t('Mi cocina', 'My kitchen');
const lbl = row => (en() ? row[2] : row[1]);
const AVOID = () => [t('espumas y aires', 'foams and airs'), t('esferificaciones', 'spherifications'), t('emplatar con pinzas', 'tweezer plating'), t('flores comestibles', 'edible flowers'), t('polvos y tierras', 'powders and soils'), t('más de seis elementos', 'more than six elements'), t('técnicas de laboratorio', 'lab techniques'), t('raciones pequeñas', 'tiny portions')];
export const INTERESTS = () => [t('brasa', 'charcoal'), t('verdura a la brasa', 'vegetables over fire'), t('pescado y marisco', 'fish and shellfish'), t('casquería', 'offal'), t('encurtidos y fermentos', 'pickles and ferments'), t('cocina ibicenca', 'Ibizan cooking'), t('para compartir', 'sharing plates'), t('brunch', 'brunch'), t('postres', 'desserts'), t('Asia', 'Asia'), t('México', 'Mexico'), t('sin alcohol', 'alcohol-free')];

function start() {
 draft = cleanProfile(state.settings);
 dirty = false;
}
const tags = (key, options) => { const all = [...new Set([...options, ...draft[key]])]; return '<div class="chips" data-tags="' + key + '">' + all.map(x => '<button type="button" class="pill' + (draft[key].includes(x) ? ' active' : '') + '" data-tag="' + esc(x) + '" aria-pressed="' + draft[key].includes(x) + '">' + esc(x) + '</button>').join('') + '</div><div class="addrow"><label class="sr" for="add-' + key + '">' + esc(t('Añadir otro', 'Add another')) + '</label><input id="add-' + key + '" maxlength="60" placeholder="' + esc(t('Añadir otro…', 'Add another…')) + '" autocomplete="off" enterkeyhint="done"><button type="button" class="btn ghost" data-add-tag="' + key + '">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></div>'; };

export function render() {
 if (!draft || !dirty) start();
 const s = state.kitchen?.stats, can = true;
 let html = '<header class="page-head"><h1>' + esc(t('Mi cocina', 'My kitchen')) + '</h1><p>' + esc(t('Cuéntame cómo es tu cocina. Con esto se afinan los consejos, las ideas y la búsqueda de tendencias.', 'Tell me what your kitchen is like. It sharpens the advice, the ideas and the trend search.')) + '</p></header>';
 if (s) html += '<div class="stats"><div class="stat"><strong>' + s.catalogue + '</strong><span>' + esc(t('productos en el catálogo', 'products in the catalogue')) + '</span></div><div class="stat"><strong>' + s.known + '</strong><span>' + esc(t('básicos de tu cocina', 'staples of your kitchen')) + '</span></div><div class="stat"><strong>' + s.families + '</strong><span>' + esc(t('familias de producto', 'product families')) + '</span></div></div><p class="fine">' + esc(t('Si un producto no está, escríbelo tal cual al montar el plato: se guarda igual.', 'If a product is missing, type it as it is when building the dish: it is saved all the same.')) + '</p>';
 else html += skeleton(1);
 // Mis subrecetas
 const subs = liveSubs(), binned = state.subs.filter(x => x.deleted_at);
 const subAxes = x => { const p = state.kb ? dishProfile(state.kb, {components: [{role: 'salsa', techniques: [], items: x.items.map(i => ({n: i.n, k: i.k || null, w: i.w || 2}))}]}) : null; return p && !p.empty ? p.axes : null; };
 html += '<section class="card subs-card"><div class="subs-head"><h2>' + esc(t('Mis subrecetas', 'My sub-recipes')) + '</h2><button type="button" class="btn ghost" data-act="new-sub">' + icon('plus') + esc(t('Nueva', 'New')) + '</button></div>' +
  (subs.length ? '<div class="sub-list">' + subs.map(x => '<a class="sub-card" href="#/subreceta/' + esc(x.id) + '">' + flavorPrint(subAxes(x), {size: 40}) + '<span><strong>' + esc(x.name) + '</strong><small>' + esc([x.items.length + t(' ingredientes', ' ingredients'), x.yield ? t('rinde ', 'yields ') + x.yield : ''].filter(Boolean).join(' · ')) + '</small></span></a>').join('') + '</div>'
   : '<p class="hint">' + esc(t('Tus salsas, fondos, encurtidos y bases de la casa. Se usan en los platos como un ingrediente más, con su sabor y su receta (también en la ficha impresa). Desde un plato puedes guardar un componente como subreceta.', 'Your house sauces, stocks, pickles and bases. Dishes use them as one more ingredient, with their flavour and recipe (also on the printed sheet). From a dish you can save a component as a sub-recipe.')) + '</p>') +
  (binned.length ? '<p class="fine">' + esc(t('En la papelera: ', 'In the bin: ')) + binned.map(x => '<button type="button" class="linkbtn" data-restore-sub="' + esc(x.id) + '">' + esc(x.name) + ' · ' + esc(t('recuperar', 'restore')) + '</button>').join(' ') + '</p>' : '') + '</section>';
 const dis = can ? '' : ' disabled';
 html += '<form id="kitchenForm" class="card form"><h2>' + esc(t('Lo que tú me cuentas', 'What you tell me')) + '</h2>' +
  '<label for="kName">' + esc(t('Cómo te llamo', 'What I call you')) + '</label><input id="kName" data-key="name" value="' + esc(draft.name) + '" maxlength="40" placeholder="' + esc(t('Tu nombre', 'Your name')) + '" autocomplete="given-name"' + dis + '>' +
  '<fieldset class="choice"><legend>' + esc(t('Tu equipo', 'Your equipment')) + '</legend>' + EQUIPMENT.map(e => '<button type="button" class="pill' + (draft.equipment.includes(e[0]) ? ' active' : '') + '" data-equip="' + e[0] + '" aria-pressed="' + draft.equipment.includes(e[0]) + '"' + dis + '>' + esc(lbl(e)) + '</button>').join('') + '</fieldset>' +
  '<label for="kOther">' + esc(t('Otro equipo', 'Other equipment')) + '</label><input id="kOther" data-key="other_equipment" value="' + esc(draft.other_equipment) + '" maxlength="200" placeholder="' + esc(t('Lo que no esté en la lista', 'Anything not on the list')) + '" autocomplete="off"' + dis + '>' +
  '<label for="kStyle">' + esc(t('Tu estilo', 'Your style')) + '</label><textarea id="kStyle" data-key="style" rows="3" maxlength="400" placeholder="' + esc(t('Brasa y producto. Mediterráneo, raciones generosas, platos que se entienden a la primera…', 'Charcoal and produce. Mediterranean, generous portions, dishes you understand at first sight…')) + '"' + dis + '>' + esc(draft.style) + '</textarea>' +
  '<label for="kSign">' + esc(t('Tu sello: qué hace que un plato sea de la casa', 'Your signature: what makes a dish yours')) + '</label><textarea id="kSign" data-key="signature" rows="3" maxlength="500" placeholder="' + esc(t('El Josper, un guiño belga, producto de Ibiza, una salsa propia en cada plato…', 'The Josper, a Belgian touch, Ibizan produce, a house sauce on every plate…')) + '"' + dis + '>' + esc(draft.signature) + '</textarea>' +
  '<fieldset class="choice"><legend>' + esc(t('No quiero', 'I do not want')) + '</legend>' + (can ? tags('avoid', AVOID()) : '<p>' + esc(draft.avoid.join(', ') || '—') + '</p>') + '</fieldset>' +
  '<fieldset class="choice"><legend>' + esc(t('En el radar me interesa', 'On the radar I care about')) + '</legend>' + (can ? tags('interests', INTERESTS()) : '<p>' + esc(draft.interests.join(', ') || '—') + '</p>') + '</fieldset>' +
  '<label for="kService">' + esc(t('El servicio', 'Service')) + '</label><input id="kService" data-key="service" value="' + esc(draft.service) + '" maxlength="300" placeholder="' + esc(t('Cubiertos en un día fuerte, cuántos sois en el pase…', 'Covers on a busy day, how many of you at the pass…')) + '" autocomplete="off"' + dis + '>' +
  (can ? '<div class="row-actions row-left"><button type="submit" class="btn primary" id="kSave">' + icon('check') + esc(t('Guardar', 'Save')) + '</button><span class="fine" id="kState">' + esc(dirty ? t('Cambios sin guardar', 'Unsaved changes') : '') + '</span></div>' : '<p class="fine">' + esc(t('Tu cuenta puede verlo, pero no cambiarlo.', 'Your account can view this but not change it.')) + '</p>') + '</form>';
 return html;
}

export function mount(root) {
 const mark = () => { dirty = true; const el = $('#kState', root); if (el) el.textContent = t('Cambios sin guardar', 'Unsaved changes'); };
 root.addEventListener('input', e => { const key = e.target.dataset?.key; if (key) { draft[key] = e.target.value; mark(); } });
 root.addEventListener('click', async e => {
  if (e.target.closest('[data-act=new-sub]')) { const made = await createSub({name: t('Subreceta nueva', 'New sub-recipe')}); go('subreceta/' + made.id); return; }
  const rs = e.target.closest('[data-restore-sub]');
  if (rs) { await saveSub(rs.dataset.restoreSub, {deleted_at: null}); toast(t('Recuperada.', 'Restored.')); return; }
  const eq = e.target.closest('[data-equip]');
  if (eq) { const id = eq.dataset.equip; draft.equipment = draft.equipment.includes(id) ? draft.equipment.filter(x => x !== id) : [...draft.equipment, id]; eq.classList.toggle('active', draft.equipment.includes(id)); eq.setAttribute('aria-pressed', draft.equipment.includes(id)); mark(); return; }
  const tag = e.target.closest('[data-tag]');
  if (tag) { const key = tag.closest('[data-tags]').dataset.tags, v = tag.dataset.tag; draft[key] = draft[key].includes(v) ? draft[key].filter(x => x !== v) : [...draft[key], v].slice(0, 16); tag.classList.toggle('active', draft[key].includes(v)); tag.setAttribute('aria-pressed', draft[key].includes(v)); mark(); return; }
  const add = e.target.closest('[data-add-tag]');
  if (add) {
   const key = add.dataset.addTag, input = $('#add-' + key, root), v = clip(input.value, 60);
   if (!v) return;
   if (!draft[key].includes(v)) draft[key] = [...draft[key], v].slice(0, 16);
   input.value = ''; mark();
   const box = $('[data-tags="' + key + '"]', root);
   if (box && ![...box.children].some(b => b.dataset.tag === v)) box.insertAdjacentHTML('beforeend', '<button type="button" class="pill active" data-tag="' + esc(v) + '" aria-pressed="true">' + esc(v) + '</button>');
  }
 });
 root.addEventListener('keydown', e => { if (e.key === 'Enter' && /^add-/.test(e.target.id || '')) { e.preventDefault(); $('[data-add-tag="' + e.target.id.slice(4) + '"]', root)?.click(); } });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'kitchenForm') return;
  e.preventDefault();
  const b = $('#kSave', root);
  b.disabled = true;
  try { const clean = cleanProfile(draft); await saveSettings(clean); draft = clean; dirty = false; $('#kState', root).textContent = ''; toast(t('Guardado. Lo tendré en cuenta desde ahora.', 'Saved. I will take it into account from now on.')); }
  catch (err) { toast(friendly(err, t('No se pudo guardar. Inténtalo de nuevo.', 'It could not be saved. Please try again.')), 'error'); }
  finally { if (b.isConnected) b.disabled = false; }
 });
 return null;
}
// Mientras se rellena el formulario no se repinta (se perdería lo escrito); al llegar la cocina sí, si no hay cambios.
export function onData(what, root) { if (!dirty && ['load', 'subs', 'remote'].includes(what)) { root.innerHTML = render(); } }
