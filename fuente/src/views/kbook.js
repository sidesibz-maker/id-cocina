// I+D · Tu libro de cocina: las fichas de la Biblioteca que elijas (favoritas, las que tienen tu versión, tus entradas,
// una ruta o un estante) en un solo documento con portada e índice, para imprimir o guardar en PDF.
// Cada ficha lleva tu última versión debajo de la base, que es lo que la hace tuya.
import {t, en, shortDate} from '../i18n.js';
import {esc, icon, $, $$, toast, sheet} from '../ui.js';
import {state, saberMine, docById} from '../store.js';
import {entries, entryById, CATS} from '../saber/index.js';
import {PATHS} from './paths.js';

const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, (m, id) => entryById(id)?.name || id);
const txt = v => esc(plain(v));
const paras = v => String(v || '').split(/\n{2,}/).filter(Boolean).map(p => '<p>' + txt(p).replace(/\n/g, '<br>') + '</p>').join('');

function groups(favs) {
 const all = entries();
 return {
  fav: favs.map(entryById).filter(Boolean),
  mine: all.filter(e => saberMine(e.id)?.versions?.length),
  own: all.filter(e => e.mine)
 };
}

export function pageFor(e) {
 const m = saberMine(e.id), last = (m?.versions || []).at(-1);
 const out = ['<article class="kbook-entry"><p class="ficha-kicker">' + esc((CATS.find(c => c[0] === (e.cat || 'conceptos')) || [, ''])[en() ? 2 : 1] || '') + '</p><h2>' + esc(e.name) + '</h2>'];
 if (e.summary) out.push('<p class="kbook-lead">' + txt(e.summary) + '</p>');
 if (e.what) out.push(paras(e.what));
 if (e.base?.items?.length) out.push('<h3>' + esc(t('Receta base', 'Base recipe') + (e.base.for ? t(' para ', ' for ') + e.base.for : '')) + '</h3><table class="kbook-table"><tbody>' + e.base.items.map(([n, q]) => '<tr><th scope="row">' + txt(n) + '</th><td>' + esc(q || '') + '</td></tr>').join('') + '</tbody></table>' + (e.base.steps?.length ? '<ol>' + e.base.steps.map(s => '<li>' + txt(s) + '</li>').join('') + '</ol>' : ''));
 if (e.method?.length) out.push('<h3>' + esc(t('Cómo hacerlo', 'Method')) + '</h3><ol>' + e.method.map(s => '<li>' + txt(s) + '</li>').join('') + '</ol>');
 if (e.ratios?.length) out.push('<h3>' + esc(t('Según el uso', 'By use')) + '</h3><table class="kbook-table"><tbody>' + e.ratios.map(r => '<tr><th scope="row">' + txt(r.use) + '</th><td>' + txt(r.ratio) + (r.note ? '<br><small>' + txt(r.note) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table>');
 if (e.keys?.length) out.push('<h3>' + esc(t('Claves', 'Key points')) + '</h3><ul>' + e.keys.map(k => '<li>' + txt(k) + '</li>').join('') + '</ul>');
 if (e.errors?.length) out.push('<h3>' + esc(t('Errores y cómo arreglarlos', 'Mistakes and fixes')) + '</h3><dl class="kbook-errors">' + e.errors.map(x => '<dt>' + txt(x.p) + '</dt><dd>' + txt(x.fix) + '</dd>').join('') + '</dl>');
 if (last) out.push('<section class="kbook-mine"><h3>' + esc(t('Mi versión', 'My version')) + ' <small>' + esc(shortDate(last.at)) + (last.why ? ', ' + esc(last.why) : '') + '</small></h3><div class="kv-text">' + esc(last.text) + '</div></section>');
 return out.join('') + '</article>';
}

export function bookSheet(favs) {
 const g = groups(favs), opt = (id, label, n, on) => '<label class="chip' + (on && n ? ' chip-have' : '') + '"><input type="checkbox" class="sr" value="' + id + '"' + (on && n ? ' checked' : '') + (n ? '' : ' disabled') + '>' + esc(label) + ' <small>' + n + '</small></label>';
 const s = sheet({title: t('Tu libro de cocina', 'Your cookbook'), wide: true, body: '<p class="lead">' + esc(t('Las fichas que elijas, con tu versión de cada una, en un documento con portada e índice. Para tu archivo, para estudiar sin pantalla o para formar a alguien.', 'The entries you choose, each with your version, in one document with a cover and contents. For your files, to study away from the screen or to train someone.')) + '</p>' +
  '<fieldset class="tfield"><legend class="jlegend">' + esc(t('Qué fichas entran', 'Which entries go in')) + '</legend><div class="chips kbk">' + opt('fav', t('Favoritas', 'Favourites'), g.fav.length, true) + opt('mine', t('Con tu versión', 'With your version'), g.mine.length, true) + opt('own', t('Tus entradas', 'Your entries'), g.own.length, true) + '</div></fieldset>' +
  '<div class="tfield"><label for="kbkPath">' + esc(t('Añadir una ruta de aprendizaje', 'Add a learning path')) + '</label><select id="kbkPath"><option value="">' + esc(t('Ninguna', 'None')) + '</option>' + PATHS.map(p => '<option value="' + p[0] + '">' + esc(en() ? p[2] : p[1]) + '</option>').join('') + '</select></div>' +
  '<div class="tfield"><label for="kbkShelf">' + esc(t('Añadir un estante entero', 'Add a whole shelf')) + '</label><select id="kbkShelf"><option value="">' + esc(t('Ninguno', 'None')) + '</option>' + CATS.filter(c => entries().some(e => (e.cat || 'conceptos') === c[0])).map(c => '<option value="' + c[0] + '">' + esc(en() ? c[2] : c[1]) + '</option>').join('') + '</select></div>' +
  '<div class="tfield"><label for="kbkTitle">' + esc(t('Título', 'Title')) + '</label><input id="kbkTitle" maxlength="80" value="' + esc(t('Mi libro de cocina', 'My cookbook')) + '"></div>' +
  '<div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('down') + esc(t('Preparar e imprimir', 'Prepare and print')) + '</button></div>'});
 s.el.addEventListener('change', e => { const c = e.target.closest('.kbk input'); if (c) c.closest('.chip').classList.toggle('chip-have', c.checked); });
 $('[data-ok]', s.el).onclick = async () => {
  const want = new Set($$('.kbk input:checked', s.el).map(x => x.value)), seen = new Set(), list = [];
  const add = e => { if (e && !seen.has(e.id)) { seen.add(e.id); list.push(e); } };
  for (const k of ['fav', 'mine', 'own']) if (want.has(k)) g[k].forEach(add);
  const path = PATHS.find(p => p[0] === $('#kbkPath', s.el).value);
  if (path) path[5].map(entryById).forEach(add);
  const shelf = $('#kbkShelf', s.el).value;
  if (shelf) entries().filter(e => (e.cat || 'conceptos') === shelf).sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(add);
  if (!list.length) { toast(t('Elige al menos un grupo de fichas.', 'Choose at least one group of entries.'), 'error'); return; }
  const title = $('#kbkTitle', s.el).value.trim() || t('Mi libro de cocina', 'My cookbook');
  s.close();
  printBook(title, list);
 };
 return s;
}

export function printBook(title, list) {
 const who = docById('carrera:perfil') || {}, name = who.name || state.settings?.name || '';
 let host = document.getElementById('printFicha');
 if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
 host.innerHTML = list.length === 1 ? '<div class="book-page">' + pageFor(list[0]) + '</div>' : '<section class="book-cover"><p class="ficha-kicker">I+D</p><h1>' + esc(title) + '</h1>' + (name ? '<p class="book-who">' + esc(name) + (who.place ? ', ' + esc(who.place) : '') + '</p>' : '') + '<p class="ficha-meta">' + esc(list.length + (list.length === 1 ? t(' ficha', ' entry') : t(' fichas', ' entries'))) + '</p></section>' +
  '<section class="book-index"><h2>' + esc(t('Índice', 'Contents')) + '</h2><ol>' + list.map(e => '<li>' + esc(e.name) + '</li>').join('') + '</ol></section>' +
  list.map(e => '<div class="book-page">' + pageFor(e) + '</div>').join('');
 document.documentElement.classList.add('printing');
 const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
 addEventListener('afterprint', done);
 setTimeout(() => print(), 60);
}
