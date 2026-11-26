// I+D · Por descubrir: la lista de lo que quieres conocer para crecer (libros, restaurantes, cocineros, stages, viajes).
// Cada cosa es un documento «descubrir:…»; al marcarla como hecha puedes apuntar qué te llevas, y queda en «Descubierto».
import {t, en} from '../i18n.js';
import {esc, icon, $, toast, sheet} from '../ui.js';
import {liveDocs, saveDoc, docById, trashDoc} from '../store.js';

export const KINDS = [['libro', 'Libro', 'Book'], ['restaurante', 'Restaurante', 'Restaurant'], ['cocinero', 'Cocinero', 'Chef'], ['stage', 'Stage', 'Stage'], ['viaje', 'Viaje o mercado', 'Trip or market'], ['otro', 'Otro', 'Other']];
const kindName = k => { const r = KINDS.find(x => x[0] === k) || KINDS.at(-1); return en() ? r[2] : r[1]; };

export function discoverHtml() {
 const all = liveDocs('descubrir'), open = all.filter(x => !x.done_at).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), done = all.filter(x => x.done_at).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
 const item = x => '<li class="cdisc-item' + (x.done_at ? ' is-done' : '') + '"><span class="cdisc-kind">' + esc(kindName(x.kind)) + '</span><strong>' + esc(x.title) + '</strong>' + (x.note ? '<span class="fine">' + esc(x.note) + '</span>' : '') + (x.takeaway ? '<span>' + esc(t('Me llevo: ', 'I take away: ') + x.takeaway) + '</span>' : '') +
  '<span class="cdisc-acts">' + (x.done_at ? '' : '<button type="button" class="linkbtn" data-disc-done="' + esc(x.id) + '">' + icon('check') + esc(t('Hecho', 'Done')) + '</button>') + '<button type="button" class="linkbtn" data-disc-trash="' + esc(x.id) + '">' + esc(t('A la papelera', 'To the bin')) + '</button></span></li>';
 return '<section class="sec cdisc"><header class="sec-head"><div><h2>' + esc(t('Por descubrir', 'To discover')) + '</h2><p>' + esc(t('Libros, restaurantes, cocineros, stages y viajes que quieres conocer. Cuando lo hagas, apunta qué te llevas.', 'Books, restaurants, chefs, stages and trips you want to know. When you do, note what you take away.')) + '</p></div></header>' +
  '<form id="discNew" class="card cdisc-form"><div class="tpair"><div class="tfield"><label for="discKind">' + esc(t('Qué es', 'What it is')) + '</label><select id="discKind">' + KINDS.map(k => '<option value="' + k[0] + '">' + esc(en() ? k[2] : k[1]) + '</option>').join('') + '</select></div>' +
  '<div class="tfield"><label for="discTitle">' + esc(t('Nombre', 'Name')) + '</label><input id="discTitle" maxlength="140" autocomplete="off" placeholder="' + esc(t('p. ej. un libro de fermentación, un restaurante de producto…', 'e.g. a book on fermentation, a produce-led restaurant…')) + '"></div></div>' +
  '<div class="tfield"><label for="discNote">' + esc(t('Por qué te interesa (opcional)', 'Why it interests you (optional)')) + '</label><input id="discNote" maxlength="300" autocomplete="off"></div><div class="row-actions"><button type="submit" class="btn primary">' + icon('plus') + esc(t('Añadir', 'Add')) + '</button></div></form>' +
  (open.length ? '<ul class="cdisc-list">' + open.map(item).join('') + '</ul>' : '') +
  (done.length ? '<h3 class="kh3">' + esc(t('Descubierto', 'Discovered')) + '</h3><ul class="cdisc-list">' + done.map(item).join('') + '</ul>' : '') + '</section>';
}

export function bindDiscover(root) {
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'discNew') return;
  e.preventDefault();
  const title = $('#discTitle', root).value.trim();
  if (!title) { toast(t('Escribe el nombre.', 'Write the name.'), 'error'); return; }
  document.activeElement?.blur();
  await saveDoc('descubrir', null, {kind: $('#discKind', root).value, title, note: $('#discNote', root).value.trim()});
  toast(t('Apuntado en «Por descubrir».', 'Added to “To discover”.'));
 });
 root.addEventListener('click', async e => {
  const d = e.target.closest('[data-disc-done]'), tr = e.target.closest('[data-disc-trash]');
  if (d) { const x = docById(d.dataset.discDone); if (!x) return; doneSheet(x); }
  if (tr) { await trashDoc(tr.dataset.discTrash); toast(t('En la papelera.', 'Moved to the bin.')); }
 });
}

function doneSheet(x) {
 const s = sheet({title: t('¿Qué te llevas?', 'What do you take away?'), body: '<p class="lead">' + esc(x.title) + '</p><div class="tfield"><label for="discTake">' + esc(t('Una idea, una técnica, un plato que te marcó (opcional)', 'An idea, a technique, a dish that stayed with you (optional)')) + '</label><textarea id="discTake" rows="3" maxlength="600" data-voice></textarea></div><div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('check') + esc(t('Marcar como hecho', 'Mark as done')) + '</button></div>'});
 $('[data-ok]', s.el).onclick = async () => { const take = $('#discTake', s.el).value.trim(); s.close(); await saveDoc('descubrir', x.id, {done_at: new Date().toISOString(), takeaway: take}); toast(t('A «Descubierto».', 'Moved to “Discovered”.')); };
}
