// I+D · Comparar dos fichas de la Biblioteca lado a lado (bechamel y velouté, confitado y baja temperatura…):
// en qué se parecen y en qué cambian la base, las proporciones y las claves.
import {t, en} from '../i18n.js';
import {esc, $, sheet} from '../ui.js';
import {entries, entryById, CATS} from '../saber/index.js';

const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, (m, id) => entryById(id)?.name || id);
const shelf = e => { const c = CATS.find(x => x[0] === (e.cat || 'conceptos')); return c ? (en() ? c[2] : c[1]) : ''; };
const list = items => (items.length ? '<ul>' + items.map(x => '<li>' + esc(plain(x)) + '</li>').join('') + '</ul>' : '<p class="fine">—</p>');

function rows(a, b) {
 const part = (label, f) => '<tr class="kcmp-part"><th colspan="2" scope="colgroup">' + esc(label) + '</th></tr><tr><td>' + f(a) + '</td><td>' + f(b) + '</td></tr>';
 return part(t('Qué es', 'What it is'), e => '<p>' + esc(plain(e.summary || '')) + '</p>') +
  part(t('Estante', 'Shelf'), e => '<p>' + esc(shelf(e)) + '</p>') +
  part(t('Receta base', 'Base recipe'), e => (e.base?.items?.length ? (e.base.for ? '<p class="fine">' + esc(t('Para ', 'For ') + e.base.for) + '</p>' : '') + list(e.base.items.map(([n, q]) => n + (q ? ': ' + q : ''))) : e.method?.length ? list(e.method.slice(0, 4)) : '<p class="fine">—</p>')) +
  part(t('Según el uso', 'By use'), e => list((e.ratios || []).map(r => r.use + ': ' + r.ratio))) +
  part(t('Claves', 'Key points'), e => list(e.keys || [])) +
  part(t('Errores típicos', 'Typical mistakes'), e => list((e.errors || []).map(x => x.p)));
}

export function compareSheet(firstId) {
 const a = entryById(firstId);
 if (!a) return;
 const all = entries().filter(e => e.id !== a.id).sort((x, y) => ((y.cat === a.cat) - (x.cat === a.cat)) || x.name.localeCompare(y.name, 'es'));
 const near = (a.related || []).find(id => entryById(id)) || all[0]?.id;
 const s = sheet({title: t('Comparar fichas', 'Compare entries'), wide: true, body:
  '<div class="tfield"><label for="kcmpB">' + esc(t('Comparar «', 'Compare “') + a.name + t('» con', '” with')) + '</label><select id="kcmpB">' + all.map(e => '<option value="' + esc(e.id) + '"' + (e.id === near ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</select></div>' +
  '<div class="kcmp-wrap"><table class="kcmp"><thead><tr><th scope="col">' + esc(a.name) + '</th><th scope="col" id="kcmpName"></th></tr></thead><tbody id="kcmpRows"></tbody></table></div>'});
 const paint = () => { const b = entryById($('#kcmpB', s.el).value); if (!b) return; $('#kcmpName', s.el).textContent = b.name; $('#kcmpRows', s.el).innerHTML = rows(a, b); };
 $('#kcmpB', s.el).addEventListener('change', paint);
 paint();
 return s;
}
