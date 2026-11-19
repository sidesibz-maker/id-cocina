// I+D · arranque, menú y navegación. La app vive entera en este ordenador: no hay cuentas ni servidores.
import './lab.css';
import {applyPrefs, prefs, setPref, isDark, t} from './i18n.js';
import {$, $$, esc, icon, sheet, toast, closeSheets, friendly} from './ui.js';
import {presetRecipe} from './views/create.js';
import {state, loadAll, onChange, unseenTrends, exportBackup, importBackup} from './store.js';
import * as home from './views/home.js';
import * as radar from './views/radar.js';
import * as create from './views/create.js';
import * as dish from './views/dish.js';
import * as notebook from './views/notebook.js';
import * as flavors from './views/flavors.js';
import * as kitchenView from './views/kitchen-view.js';

const VIEWS = {hoy: home, radar, crear: create, plato: dish, libreta: notebook, sabores: flavors, cocina: kitchenView};
const NAV = [['hoy', 'flame', () => t('Hoy', 'Today')], ['radar', 'radar', () => t('Radar', 'Radar')], ['crear', 'plus', () => t('Crear', 'Create')], ['libreta', 'book', () => t('Libreta', 'Notebook')], ['sabores', 'wheel', () => t('Sabores', 'Flavours')]];
const app = () => $('#app');
let current = {name: '', params: [], cleanup: null};

function parseHash(hash = location.hash) {
 const parts = String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });
 return {name: VIEWS[parts[0]] ? parts[0] : 'hoy', params: VIEWS[parts[0]] ? parts.slice(1) : []};
}
function shell() {
 const item = ([id, ic, label]) => '<a class="nav-item' + (id === 'crear' ? ' nav-create' : '') + '" href="#/' + id + '" data-nav="' + id + '">' + icon(ic) + '<span>' + esc(label()) + '</span><i class="badge" data-badge="' + id + '" hidden></i></a>';
 app().innerHTML = '<div class="lab">' +
  '<aside class="rail"><a class="wordmark" href="#/hoy" aria-label="I+D">I<b>+</b>D</a><div class="rail-rest">' + esc(t('Cuaderno de cocina', 'Kitchen notebook')) + '</div>' +
   '<nav class="rail-nav" aria-label="' + esc(t('Secciones', 'Sections')) + '">' + NAV.map(item).join('') + '<a class="nav-item" href="#/cocina" data-nav="cocina">' + icon('pan') + '<span>' + esc(t('Mi cocina', 'My kitchen')) + '</span></a></nav>' +
   '<div class="rail-foot"><button type="button" class="rail-link" data-act="menu">' + icon('down') + '<span>' + esc(t('Copia de seguridad y pantalla', 'Backup and display')) + '</span></button></div></aside>' +
  '<header class="top"><a class="wordmark" href="#/hoy" aria-label="I+D">I<b>+</b>D</a><span class="top-rest">' + esc(t('Cuaderno de cocina', 'Kitchen notebook')) + '</span><button type="button" class="iconbtn" data-act="menu" aria-label="' + esc(t('Menú', 'Menu')) + '">' + icon('menu') + '</button></header>' +
  '<div id="notices"></div><main id="view" tabindex="-1"></main><nav class="tabs" aria-label="' + esc(t('Secciones', 'Sections')) + '">' + NAV.map(item).join('') + '</nav></div>';
 $$('[data-act=menu]', app()).forEach(b => { b.onclick = menu; });
}
// Aviso para no olvidarse de la copia: los datos están solo en este ordenador.
function notices() {
 const host = $('#notices');
 if (!host) return;
 const live = state.dishes.filter(d => !d.deleted_at).length, days = state.lastBackup ? Math.floor((Date.now() - new Date(state.lastBackup).getTime()) / 86400000) : null;
 host.innerHTML = live >= 3 && (days === null || days > 14) ? '<div class="notice" role="status">' + icon('info') + '<p><strong>' + esc(t('Haz una copia de seguridad.', 'Make a backup.')) + '</strong> ' + esc(days === null ? t('Tu libreta está solo en este ordenador y aún no tiene copia.', 'Your notebook lives only on this computer and has no backup yet.') : t('La última copia es de hace ' + days + ' días.', 'The last backup was ' + days + ' days ago.')) + ' <button type="button" class="linkbtn" id="noticeBackup">' + esc(t('Descargar copia', 'Download backup')) + '</button></p></div>' : '';
 const b = $('#noticeBackup'); if (b) b.onclick = backup;
}
function badges() {
 const n = unseenTrends();
 $$('[data-badge=radar]').forEach(b => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); b.setAttribute('aria-label', n + ' ' + t('avisos nuevos', 'new alerts')); });
}
function markNav() {
 const active = current.name === 'plato' ? 'libreta' : current.name;
 $$('[data-nav]').forEach(a => { const on = a.dataset.nav === active; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function route({keepScroll = false} = {}) {
 const next = parseHash(), view = VIEWS[next.name];
 let root = $('#view');
 if (!root) return;
 const same = next.name === current.name && next.params.join('/') === current.params.join('/'), scroll = same || keepScroll ? scrollY : 0;
 current.cleanup?.();
 closeSheets();
 // Cada pantalla estrena contenedor: así lo que escuchaba la anterior no sigue vivo en la siguiente.
 const fresh = root.cloneNode(false); root.replaceWith(fresh); root = fresh;
 current = {name: next.name, params: next.params, cleanup: null};
 root.className = 'view view-' + next.name;
 root.innerHTML = view.render(next.params);
 current.cleanup = view.mount?.(root, next.params) || null;
 document.title = (view.title?.(next.params) || 'I+D') + ' · I+D';
 markNav(); badges(); notices();
 scrollTo(0, scroll);
 if (!same) root.focus({preventScroll: true});
}
function refresh(what) {
 badges(); notices();
 const view = VIEWS[current.name];
 if (!view || !$('#view')) return;
 if (view.onData) { view.onData(what, $('#view'), current.params); return; }
 if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && $('#view').contains(document.activeElement)) return;
 route({keepScroll: true});
}
async function backup() {
 try {
  const blob = await exportBackup(), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'id-cocina-copia-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(a); a.click(); a.remove();
  toast(t('Copia descargada. Guárdala donde guardes tus copias.', 'Backup downloaded. Keep it where you keep your backups.')); notices();
 } catch (e) { toast(friendly(e), 'error'); }
}
function menu() {
 const s = sheet({title: t('Copia de seguridad y pantalla', 'Backup and display'), body:
  '<p class="lead">' + esc(t('Todo lo que apuntas se guarda en este ordenador, en este navegador. Descarga una copia de vez en cuando: es un archivo con tus platos y sus imágenes.', 'Everything you note is saved on this computer, in this browser. Download a backup now and then: one file with your dishes and their images.')) + '</p>' +
  '<div class="menu-grid"><button type="button" class="tile" data-act="backup">' + icon('down') + '<span>' + esc(t('Descargar copia', 'Download backup')) + '</span></button>' +
  '<label class="tile" for="restoreFile">' + icon('undo') + '<span>' + esc(t('Recuperar una copia', 'Restore a backup')) + '</span></label><input id="restoreFile" class="sr" type="file" accept="application/json,.json">' +
  '<button type="button" class="tile" data-act="theme" aria-pressed="' + isDark() + '">' + icon(isDark() ? 'sun' : 'moon') + '<span>' + esc(isDark() ? t('Modo día', 'Day mode') : t('Modo noche', 'Night mode')) + '</span></button>' +
  '<button type="button" class="tile" data-act="lang" lang="' + (prefs.lang === 'en' ? 'es' : 'en') + '">' + icon('globe') + '<span>' + (prefs.lang === 'en' ? 'Español' : 'English') + '</span></button></div>' +
  '<p class="fine">' + esc(state.lastBackup ? t('Última copia: ', 'Last backup: ') + new Date(state.lastBackup).toLocaleDateString(prefs.lang === 'en' ? 'en-GB' : 'es-ES') : t('Aún no has descargado ninguna copia.', 'You have not downloaded a backup yet.')) + ' ' + esc(t('Recuperar una copia nunca borra nada: añade lo que falte.', 'Restoring a backup never deletes anything: it adds what is missing.')) + '</p>'});
 $('[data-act=backup]', s.el).onclick = () => { s.close(); backup(); };
 $('[data-act=theme]', s.el).onclick = () => { setPref('theme', isDark() ? 'light' : 'dark'); s.close(); };
 $('[data-act=lang]', s.el).onclick = () => { setPref('lang', prefs.lang === 'en' ? 'es' : 'en'); s.close(); shell(); route(); };
 $('#restoreFile', s.el).onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { const r = await importBackup(await file.text()); s.close(); toast(t('Copia recuperada: ' + r.added + ' platos añadidos y ' + r.updated + ' puestos al día.', 'Backup restored: ' + r.added + ' dishes added and ' + r.updated + ' updated.')); }
  catch { toast(t('Ese archivo no es una copia de esta app.', 'That file is not a backup from this app.'), 'error'); }
 };
}
async function start() {
 const shared = new URLSearchParams(location.search);
 if (['title', 'text', 'url'].some(k => shared.get(k))) { const keys = shared.get('text') ? ['text', 'url'] : ['title', 'url']; presetRecipe([...new Set(keys.map(k => (shared.get(k) || '').trim()).filter(Boolean))].join('\n')); history.replaceState(null, '', location.pathname + '#/crear/importar'); }
 applyPrefs();
 shell();
 route();
 onChange(refresh);
 addEventListener('hashchange', () => route());
 await loadAll();
}
start();
