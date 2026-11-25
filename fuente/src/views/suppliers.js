// I+D · Proveedores y productores: quién te trae cada cosa, cómo contactarle, qué tal trabaja y qué tiene de temporada.
// Sin precios. El pedido de «Producción y pedido» se agrupa por proveedor con lo que aquí apuntas.
// Cada proveedor es un documento «proveedor:…» (copia y sincronización); quitar uno lo manda a la papelera.
import {t, en} from '../i18n.js';
import {esc, icon, $, $$, toast, sheet, ask, friendly, safeUrl} from '../ui.js';
import {liveDocs, docById, saveDoc, trashDoc} from '../store.js';

export const title = () => t('Proveedores', 'Suppliers');
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const suppliers = () => liveDocs('proveedor').sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
const products = s => String(s.products || '').split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
// El proveedor de un ingrediente: el primero cuyo producto aparece en el nombre (o al revés).
export function supplierFor(name) {
 const n = norm(name);
 if (!n) return null;
 for (const s of suppliers()) for (const p of products(s)) { const q = norm(p); if (q && (n.includes(q) || q.includes(n))) return s; }
 return null;
}
const TYPES = [['pescado', 'Pescado y marisco', 'Fish and shellfish'], ['carne', 'Carne', 'Meat'], ['verdura', 'Fruta y verdura', 'Fruit and veg'], ['lacteos', 'Lácteos y huevos', 'Dairy and eggs'], ['seco', 'Secos y despensa', 'Dry goods'], ['bebida', 'Bebidas', 'Drinks'], ['otro', 'Otros', 'Other']];
const typeName = id => { const r = TYPES.find(x => x[0] === id) || TYPES[TYPES.length - 1]; return en() ? r[2] : r[1]; };
const tel = v => String(v || '').replace(/[^\d+]/g, '');

export function render() {
 const list = suppliers();
 return '<a class="back" href="#/cocina">' + icon('left') + esc(t('Mi cocina', 'My kitchen')) + '</a><header class="page-head page-head-row"><div><h1>' + esc(t('Proveedores', 'Suppliers')) + '</h1><p>' + esc(t('Quién te trae cada cosa, cómo localizarle y qué tal trabaja. El pedido de Producción se agrupa por proveedor con lo que apuntes aquí.', 'Who brings you what, how to reach them and how they work. The Production order is grouped by supplier with what you note here.')) + '</p></div><button type="button" class="btn primary" data-act="new">' + icon('plus') + esc(t('Nuevo proveedor', 'New supplier')) + '</button></header>' +
  (list.length ? '<div class="searchbox"><label class="sr" for="spq">' + esc(t('Buscar proveedor o producto', 'Search supplier or product')) + '</label>' + icon('search') + '<input id="spq" type="search" autocomplete="off" placeholder="' + esc(t('Busca un proveedor o un producto: gamba, cordero, quesos…', 'Search a supplier or a product: prawn, lamb, cheese…')) + '"></div>' +
   TYPES.map(([id]) => { const g = list.filter(s => (s.kind || 'otro') === id); return g.length ? '<section class="sec spgroup"><h2 class="day">' + esc(typeName(id)) + '<span class="count">' + g.length + '</span></h2><div class="spcards">' + g.map(card).join('') + '</div></section>' : ''; }).join('')
  : '<div class="empty">' + icon('box') + '<h3>' + esc(t('Aún no tienes proveedores', 'No suppliers yet')) + '</h3><p>' + esc(t('Apunta tu pescadero, tu carnicero, la huerta… con lo que te sirven. Así el pedido sale ordenado por proveedor.', 'Note your fishmonger, butcher, grower… with what they supply. The order then comes out sorted by supplier.')) + '</p><button type="button" class="btn primary" data-act="new">' + icon('plus') + esc(t('Nuevo proveedor', 'New supplier')) + '</button></div>');
}
function card(s) {
 const stars = Number(s.rating) || 0, web = safeUrl(s.web);
 return '<article class="spcard" data-text="' + esc(norm([s.name, s.products, s.notes, s.contact].join(' '))) + '"><header><strong>' + esc(s.name) + '</strong>' + (stars ? '<span class="sprating" aria-label="' + esc(stars + t(' de 5', ' out of 5')) + '">' + '★'.repeat(stars) + '<i>' + '★'.repeat(5 - stars) + '</i></span>' : '') + '</header>' +
  (products(s).length ? '<p class="spprod">' + esc(products(s).join(', ')) + '</p>' : '') +
  ((s.days || s.contact) ? '<p class="fine">' + esc([s.contact, s.days ? t('Reparte: ', 'Delivers: ') + s.days : ''].filter(Boolean).join('. ')) + '</p>' : '') +
  (s.notes ? '<p class="spnotes">' + esc(s.notes) + '</p>' : '') +
  '<div class="row-actions row-left">' + (tel(s.phone) ? '<a class="btn ghost" href="tel:' + esc(tel(s.phone)) + '">' + esc(t('Llamar', 'Call')) + '</a><a class="btn ghost" href="https://wa.me/' + esc(tel(s.phone).replace(/^\+/, '')) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' : '') + (web ? '<a class="btn ghost" href="' + esc(web) + '" target="_blank" rel="noopener noreferrer">' + icon('out') + 'Web</a>' : '') + '<button type="button" class="btn ghost" data-edit="' + esc(s.id) + '">' + icon('edit') + esc(t('Editar', 'Edit')) + '</button></div></article>';
}
function form(id = null) {
 const x = id ? docById(id) || {} : {};
 const f = (key, label, ph = '', type = 'text') => '<div class="tfield"><label for="sp-' + key + '">' + esc(label) + '</label><input id="sp-' + key + '" type="' + type + '" maxlength="300" autocomplete="off" value="' + esc(x[key] || '') + '" placeholder="' + esc(ph) + '"></div>';
 const s = sheet({title: id ? x.name : t('Nuevo proveedor', 'New supplier'), wide: true, body: '<form id="spform">' + f('name', t('Nombre', 'Name'), t('Pescados Juan, Huerta de Sant Mateu…', 'Juan’s Fish, Sant Mateu farm…')) +
  '<div class="tfield"><label for="sp-kind">' + esc(t('Qué es', 'Type')) + '</label><select id="sp-kind">' + TYPES.map(([v, es, eng]) => '<option value="' + v + '"' + ((x.kind || 'otro') === v ? ' selected' : '') + '>' + esc(en() ? eng : es) + '</option>').join('') + '</select></div>' +
  '<div class="tfield"><label for="sp-products">' + esc(t('Qué te sirve (separado por comas)', 'What they supply (comma separated)')) + '</label><textarea id="sp-products" rows="2" maxlength="1500" placeholder="' + esc(t('gamba roja, calamar, lubina, rape', 'red prawn, squid, sea bass, monkfish')) + '">' + esc(x.products || '') + '</textarea></div>' +
  '<div class="tpair">' + f('phone', t('Teléfono', 'Phone'), '', 'tel') + f('contact', t('Persona de contacto o correo', 'Contact person or email')) + '</div>' +
  '<div class="tpair">' + f('days', t('Días de reparto y hora de pedido', 'Delivery days and order cut-off'), t('Lunes a sábado, pedir antes de las 20:00', 'Mon to Sat, order before 8 pm')) + f('web', t('Web', 'Website'), 'https://', 'url') + '</div>' +
  '<fieldset class="tfield"><legend class="jlegend">' + esc(t('Qué tal trabaja', 'How good they are')) + '</legend><div class="seg sprate">' + [0, 1, 2, 3, 4, 5].map(k => '<label class="seg-btn' + ((Number(x.rating) || 0) === k ? ' active' : '') + '"><input type="radio" class="sr" name="sprating" value="' + k + '"' + ((Number(x.rating) || 0) === k ? ' checked' : '') + '>' + (k ? '★'.repeat(k) : esc(t('Sin nota', 'No rating'))) + '</label>').join('') + '</div></fieldset>' +
  '<div class="tfield"><label for="sp-notes">' + esc(t('Notas', 'Notes')) + '</label><textarea id="sp-notes" rows="3" maxlength="2000" data-voice placeholder="' + esc(t('Calidad, qué tiene de temporada, en qué falla, a quién preguntar…', 'Quality, what is in season with them, where they fall short, who to ask…')) + '">' + esc(x.notes || '') + '</textarea></div>' +
  '<div class="row-actions">' + (id ? '<button type="button" class="btn danger" data-del>' + icon('trash') + esc(t('A la papelera', 'To the bin')) + '</button>' : '') + '<button type="submit" class="btn primary">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div></form>'});
 s.el.addEventListener('change', e => { const r = e.target.closest('input[name=sprating]'); if (r) $$('.sprate .seg-btn', s.el).forEach(l => l.classList.toggle('active', l.contains(r))); });
 $('#spform', s.el).onsubmit = async e => {
  e.preventDefault();
  const v = k => ($('#sp-' + k, s.el)?.value || '').trim();
  if (!v('name')) { toast(t('Pon al menos el nombre.', 'Enter at least the name.'), 'error'); return; }
  try { await saveDoc('proveedor', id, {name: v('name').slice(0, 120), kind: v('kind'), products: v('products'), phone: v('phone'), contact: v('contact'), days: v('days'), web: v('web'), notes: v('notes'), rating: Number(s.el.querySelector('input[name=sprating]:checked')?.value) || 0}); s.close(); toast(t('Guardado.', 'Saved.')); }
  catch (err) { toast(friendly(err), 'error'); }
 };
 const del = $('[data-del]', s.el);
 if (del) del.onclick = async () => { if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: queda guardado.', 'It is not deleted: it stays saved.'), yes: t('A la papelera', 'To the bin'), danger: true})) return; await trashDoc(id); s.close(); };
}
export function mount(root) {
 root.addEventListener('click', e => { if (e.target.closest('[data-act=new]')) form(); const ed = e.target.closest('[data-edit]'); if (ed) form(ed.dataset.edit); });
 root.addEventListener('input', e => {
  if (e.target.id !== 'spq') return;
  const q = norm(e.target.value);
  $$('.spcard', root).forEach(c => { c.hidden = !!q && !c.dataset.text.includes(q); });
  $$('.spgroup', root).forEach(g => { g.hidden = !$$('.spcard', g).some(c => !c.hidden); });
 });
 return null;
}
