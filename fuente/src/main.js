// I+D · arranque, menú y navegación. La app vive entera en este ordenador: no hay cuentas ni servidores.
import './lab.css';
import {applyPrefs, prefs, setPref, isDark, t} from './i18n.js';
import {$, $$, esc, icon, sheet, toast, closeSheets, friendly} from './ui.js';
import {presetRecipe} from './views/create.js';
import {lastCopied} from './ai.js';
import {state, loadAll, onChange, unseenTrends, exportBackup, importBackup} from './store.js';
import * as home from './views/home.js';
import * as radar from './views/radar.js';
import * as create from './views/create.js';
import * as dish from './views/dish.js';
import * as notebook from './views/notebook.js';
import * as flavors from './views/flavors.js';
import * as kitchenView from './views/kitchen-view.js';
import * as ask from './views/ask.js';
import * as menus from './views/menus.js';
import * as sub from './views/sub.js';
import * as season from './views/season.js';
import * as saber from './views/saber.js';
import * as tools from './views/tools.js';
import * as cook from './views/cook.js';
import * as journal from './views/journal.js';
import * as career from './views/career.js';
import * as train from './views/train.js';
import * as lab from './views/lab.js';
import * as catalog from './views/catalog.js';
import * as styleView from './views/style.js';
import {startTimers} from './timers.js';
import {startFinder} from './finder.js';
import {markRead} from './views/paths.js';
import {startVoice} from './voice.js';
import {iaSheet} from './views/ia-sheet.js';
import {syncSheet, syncLine} from './views/sync-sheet.js';
import {startAutoSync, syncOn, syncStatus} from './sync.js';
import {iaOn, iaConfig, saveIa, askIa} from './ia.js';
import {radarPrompt, trendsFromReply} from './ai.js';
import {addTrends} from './store.js';

const VIEWS = {hoy: home, radar, crear: create, plato: dish, libreta: notebook, sabores: flavors, cocina: kitchenView, preguntar: ask, menus, subreceta: sub, temporada: season, biblioteca: saber, saber, herramientas: tools, cocinar: cook, diario: journal, trayectoria: career, entrenar: train, laboratorio: lab, catalogo: catalog, estilo: styleView};
const NAV = [['hoy', 'flame', () => t('Hoy', 'Today')], ['radar', 'radar', () => t('Radar', 'Radar')], ['crear', 'plus', () => t('Crear', 'Create')], ['libreta', 'book', () => t('Libreta', 'Notebook')], ['biblioteca', 'library', () => t('Biblioteca', 'Library')]];
const app = () => $('#app');
let current = {name: '', params: [], cleanup: null};

function parseHash(hash = location.hash) {
 const parts = String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });
 return {name: VIEWS[parts[0]] ? parts[0] : 'hoy', params: VIEWS[parts[0]] ? parts.slice(1) : []};
}
function shell() {
 const item = ([id, ic, label]) => '<a class="nav-item' + (id === 'crear' ? ' nav-create' : '') + '" href="#/' + id + '" data-nav="' + id + '">' + icon(ic) + '<span>' + esc(label()) + '</span><i class="badge" data-badge="' + id + '" hidden></i></a>';
 app().innerHTML = '<div class="lab">' +
  '<a class="skip-link" href="#view">' + esc(t('Saltar al contenido', 'Skip to content')) + '</a>' +
  '<aside class="rail" aria-label="' + esc(t('Menú', 'Menu')) + '"><a class="wordmark" href="#/hoy" aria-label="I+D">I<b>+</b>D</a><div class="rail-rest">' + esc(t('Cuaderno de cocina', 'Kitchen notebook')) + '</div>' +
   '<button type="button" class="rail-find" data-act="finder">' + icon('search') + '<span>' + esc(t('Buscar', 'Search')) + '</span><kbd>Ctrl K</kbd></button>' +
   '<nav class="rail-nav" aria-label="' + esc(t('Secciones', 'Sections')) + '">' + NAV.map(item).join('') + '<span class="rail-sep" aria-hidden="true"></span><a class="nav-item" href="#/laboratorio" data-nav="laboratorio">' + icon('spark') + '<span>' + esc(t('Laboratorio', 'Lab')) + '</span></a><a class="nav-item" href="#/diario" data-nav="diario">' + icon('edit') + '<span>' + esc(t('Diario', 'Journal')) + '</span></a><a class="nav-item" href="#/trayectoria" data-nav="trayectoria">' + icon('star') + '<span>' + esc(t('Trayectoria', 'Career')) + '</span></a><a class="nav-item" href="#/entrenar" data-nav="entrenar">' + icon('brain') + '<span>' + esc(t('Entrenar', 'Train')) + '</span></a><span class="rail-sep" aria-hidden="true"></span><a class="nav-item" href="#/sabores" data-nav="sabores">' + icon('wheel') + '<span>' + esc(t('Sabores', 'Flavours')) + '</span></a><a class="nav-item" href="#/temporada" data-nav="temporada">' + icon('leaf') + '<span>' + esc(t('Temporada', 'Season')) + '</span></a><a class="nav-item" href="#/herramientas" data-nav="herramientas">' + icon('bolt') + '<span>' + esc(t('Herramientas', 'Tools')) + '</span></a><a class="nav-item" href="#/preguntar" data-nav="preguntar">' + icon('chat') + '<span>' + esc(t('Preguntar', 'Ask')) + '</span></a><a class="nav-item" href="#/cocina" data-nav="cocina">' + icon('pan') + '<span>' + esc(t('Mi cocina', 'My kitchen')) + '</span></a></nav>' +
   '<div class="rail-foot"><button type="button" class="rail-link" data-act="menu">' + icon('gear') + '<span>' + esc(t('Ajustes', 'Settings')) + '</span></button></div></aside>' +
  '<header class="top"><a class="wordmark" href="#/hoy" aria-label="I+D">I<b>+</b>D</a><span class="top-rest">' + esc(t('Cuaderno de cocina', 'Kitchen notebook')) + '</span><a class="top-ask" href="#/preguntar" data-nav="preguntar">' + icon('chat') + '<span>' + esc(t('Preguntar', 'Ask')) + '</span></a><button type="button" class="iconbtn" data-act="finder" aria-label="' + esc(t('Buscar en todo', 'Search everything')) + '">' + icon('search') + '</button><button type="button" class="iconbtn" data-act="menu" aria-label="' + esc(t('Más y ajustes', 'More and settings')) + '">' + icon('menu') + '</button></header>' +
  '<div id="notices"></div><main id="view" tabindex="-1"></main><nav class="tabs" aria-label="' + esc(t('Secciones', 'Sections')) + '">' + NAV.map(item).join('') + '</nav></div>';
 $('.skip-link', app()).onclick = e => {
  e.preventDefault();
  const view = $('#view');
  view.scrollIntoView({block: 'start'});
  view.focus({preventScroll: true});
 };
 $$('[data-act=menu]', app()).forEach(b => { b.onclick = () => menu({nav: !!b.closest('.top')}); });
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
 const active = ['plato', 'menus', 'cocinar', 'catalogo'].includes(current.name) ? 'libreta' : current.name === 'subreceta' ? 'cocina' : current.name === 'saber' ? 'biblioteca' : current.name === 'estilo' ? 'trayectoria' : current.name;
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
 document.title = (view.title?.(next.params) || 'I+D') + ' — I+D';
 markNav(); badges(); notices();
 if (next.name === 'biblioteca' && next.params[0] && next.params[0] !== 'estante') setTimeout(() => markRead(next.params[0]), 1500);
 scrollTo(0, scroll);
 if (!same) root.focus({preventScroll: true});
}
let pendingRefresh = false;
new MutationObserver(() => { if (pendingRefresh && !document.documentElement.classList.contains('has-sheet')) { pendingRefresh = false; refresh('load'); } }).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
function refresh(what) {
 badges(); notices();
 const view = VIEWS[current.name];
 if (!view || !$('#view')) return;
 if (view.onData) { view.onData(what, $('#view'), current.params); return; }
 if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && $('#view').contains(document.activeElement)) return;
 // Con una ventana abierta no se repinta (cerrarla de golpe molesta): se repinta al cerrarla.
 if (document.documentElement.classList.contains('has-sheet')) { pendingRefresh = true; return; }
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
// Ajustes: filas claras por apartados. En el móvil (botón de arriba) lleva también los accesos que no caben abajo.
function menu({nav = false} = {}) {
 const cfg = iaConfig(), on = iaOn(), when = state.lastBackup ? new Date(state.lastBackup).toLocaleDateString(prefs.lang === 'en' ? 'en-GB' : 'es-ES', {day: 'numeric', month: 'long'}) : '';
 const days = state.lastBackup ? Math.floor((Date.now() - new Date(state.lastBackup).getTime()) / 86400000) : null, live = state.dishes.filter(d => !d.deleted_at).length;
 const rowItem = (tag, attrs, ic, title, sub, end = icon('right'), extra = '') => '<' + tag + ' class="set-row" ' + attrs + '><span class="set-ic">' + icon(ic) + '</span><span class="set-text"><strong>' + esc(title) + '</strong>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + end + '</' + tag + '>' + extra;
 const sw = onOff => '<span class="switch' + (onOff ? ' on' : '') + '" aria-hidden="true"><i></i></span>';
 const s = sheet({title: nav ? t('Más', 'More') : t('Ajustes', 'Settings'), body:
  (nav ? '<div class="set-group"><p class="set-label">' + esc(t('Ir a', 'Go to')) + '</p>' +
   rowItem('a', 'href="#/preguntar" data-go', 'chat', t('Preguntar', 'Ask'), esc(on ? t('ChatGPT contesta aquí mismo', 'ChatGPT answers right here') : t('Pregunta lo que quieras de cocina', 'Ask anything about cooking'))) +
   rowItem('a', 'href="#/laboratorio" data-go', 'spark', t('Laboratorio creativo', 'Creative lab'), esc(t('Chispas, mecanismos de creación y tu cuaderno de ideas', 'Sparks, creative mechanisms and your idea notebook'))) +
   rowItem('a', 'href="#/diario" data-go', 'edit', t('Diario de cocina', 'Kitchen journal'), esc(t('Qué salió bien, qué falló y qué has aprendido', 'What went well, what went wrong and what you learned'))) +
   rowItem('a', 'href="#/trayectoria" data-go', 'star', t('Mi trayectoria', 'My career'), esc(t('Experiencia, técnicas, objetivos y tu dossier', 'Experience, techniques, goals and your dossier'))) +
   rowItem('a', 'href="#/entrenar" data-go', 'brain', t('Entrenar', 'Train'), esc(t('Tarjetas de repaso: proporciones, fallos, recetas base', 'Review cards: ratios, faults, base recipes'))) +
   rowItem('a', 'href="#/herramientas" data-go', 'bolt', t('Herramientas', 'Tools'), esc(t('Escalar recetas, temporizadores, mermas, salmueras', 'Scale recipes, timers, yields, brines'))) +
   rowItem('a', 'href="#/sabores" data-go', 'wheel', t('Sabores', 'Flavours'), esc(t('Qué combina con qué y por qué', 'What goes with what and why'))) +
   rowItem('a', 'href="#/temporada" data-go', 'leaf', t('Temporada', 'Season'), esc(t('Qué entra, qué está en su punto y qué se va', 'What comes in, what is at its best and what is leaving'))) +
   rowItem('a', 'href="#/cocina" data-go', 'pan', t('Mi cocina', 'My kitchen'), esc(t('Tus básicos, tu equipo y lo que no quieres', 'Your staples, equipment and what you avoid'))) + '</div>' : '') +
  '<div class="set-group"><p class="set-label">ChatGPT</p>' +
  rowItem('button', 'type="button" data-act="ia"', 'chat', on ? t('ChatGPT en la app', 'ChatGPT in the app') : t('Conectar ChatGPT a la app', 'Connect ChatGPT to the app'),
   on ? esc(t('Conectado, ', 'Connected, ') + (cfg.choice === 'smart' ? t('el más listo', 'the smartest') : t('rápido', 'fast')) + (cfg.daily === false ? '' : t(', con radar diario', ', with daily radar'))) : esc(t('Para preguntar, leer capturas y buscar tendencias sin copiar ni pegar', 'To ask, read screenshots and find trends without copy and paste'))) + '</div>' +
  '<div class="set-group"><p class="set-label">' + esc(t('Tus datos', 'Your data')) + '</p>' +
  rowItem('button', 'type="button" data-act="sync"', 'refresh', t('Sincronizar PC y móvil', 'Sync PC and phone'), esc(syncLine())) +
  rowItem('button', 'type="button" data-act="backup"', 'down', t('Descargar copia de seguridad', 'Download a backup'), esc(when ? t('Última: ', 'Last: ') + when : t('Aún no has hecho ninguna', 'You have not made one yet')) + ', ' + esc(live === 1 ? t('1 plato', '1 dish') : live + t(' platos', ' dishes')), '') +
  rowItem('label', 'for="restoreFile"', 'undo', t('Recuperar una copia', 'Restore a backup'), esc(t('Nunca borra nada: solo añade lo que falte', 'Never deletes anything: only adds what is missing')), '', '<input id="restoreFile" class="sr" type="file" accept="application/json,.json">') +
  '<p class="set-note">' + esc(syncOn() ? t('Tus platos están en este aparato y en tu libreta sincronizada. La copia de seguridad es un archivo extra por si acaso.', 'Your dishes are on this device and in your synced notebook. The backup is an extra file just in case.') : t('Tus platos se guardan en este aparato. Para tenerlos también en el otro, activa la sincronización.', 'Your dishes are saved on this device. To have them on the other one too, turn on sync.')) + '</p></div>' +
  '<div class="set-group"><p class="set-label">' + esc(t('Pantalla', 'Display')) + '</p>' +
  rowItem('button', 'type="button" data-act="theme" role="switch" aria-checked="' + isDark() + '"', isDark() ? 'moon' : 'sun', t('Modo noche', 'Night mode'), esc(t('Más cómodo con poca luz', 'Easier in low light')), sw(isDark())) +
  '<div class="set-row set-static"><span class="set-ic">' + icon('search') + '</span><span class="set-text"><strong>' + esc(t('Tamaño de letra', 'Text size')) + '</strong></span><span class="seg seg-sm">' + [['normal', t('Normal', 'Normal')], ['grande', t('Grande', 'Large')], ['enorme', t('Muy grande', 'Extra large')]].map(([id, label]) => '<button type="button" class="seg-btn' + (prefs.size === id ? ' active' : '') + '" data-size="' + id + '" aria-pressed="' + (prefs.size === id) + '">' + esc(label) + '</button>').join('') + '</span></div>' +
  '<div class="set-row set-static"><span class="set-ic">' + icon('globe') + '</span><span class="set-text"><strong>' + esc(t('Idioma', 'Language')) + '</strong></span><span class="seg seg-sm">' + [['es', 'Español'], ['en', 'English']].map(([id, label]) => '<button type="button" class="seg-btn' + ((prefs.lang === 'en' ? 'en' : 'es') === id ? ' active' : '') + '" data-lang="' + id + '" lang="' + id + '">' + label + '</button>').join('') + '</span></div></div>'});
 $$('[data-go]', s.el).forEach(a => { a.onclick = () => s.close(); });
 $('[data-act=backup]', s.el).onclick = () => { s.close(); backup(); };
 $('[data-act=ia]', s.el).onclick = () => { s.close(); setTimeout(() => iaSheet(() => route({keepScroll: true})), 250); };
 $('[data-act=sync]', s.el).onclick = () => { s.close(); setTimeout(() => syncSheet(), 250); };
 $('[data-act=theme]', s.el).onclick = e => { setPref('theme', isDark() ? 'light' : 'dark'); const b = e.currentTarget; b.setAttribute('aria-checked', isDark()); b.querySelector('.switch').classList.toggle('on', isDark()); b.querySelector('.set-ic').innerHTML = icon(isDark() ? 'moon' : 'sun'); };
 $$('[data-size]', s.el).forEach(b => { b.onclick = () => { setPref('size', b.dataset.size); $$('[data-size]', s.el).forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); }); }; });
 $$('[data-lang]', s.el).forEach(b => { b.onclick = () => { if ((prefs.lang === 'en' ? 'en' : 'es') === b.dataset.lang) return; setPref('lang', b.dataset.lang); s.close(); shell(); route(); }; });
 $('#restoreFile', s.el).onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { const r = await importBackup(await file.text()); s.close(); toast(t('Copia recuperada: ' + r.added + ' platos añadidos y ' + r.updated + ' puestos al día.', 'Backup restored: ' + r.added + ' dishes added and ' + r.updated + ' updated.')); }
  catch { toast(t('Ese archivo no es una copia de esta app.', 'That file is not a backup from this app.'), 'error'); }
 };
}
// «Preguntar a ChatGPT / Claude»: copia la consulta (con el botón de copiar de su misma fila) y abre el chat con ella ya escrita.
// Si la consulta es muy larga para un enlace, el chat se abre vacío y basta con pegar: ya está copiada.
const CHAT_MAX = 9000;
function chatClick(e) {
 const a = e.target.closest('a[data-chat]');
 if (!a) return;
 const trigger = a.closest('.row-actions')?.querySelector('button');
 if (!trigger) return;
 e.preventDefault();
 const before = lastCopied;
 trigger.click();
 if (lastCopied === before) return; // falta algo (la app ya lo ha dicho): no se abre el chat
 const base = a.getAttribute('href'), q = encodeURIComponent(lastCopied.text);
 const fits = q.length <= CHAT_MAX;
 window.open(fits ? base + (base.includes('?') ? '&' : '?') + 'q=' + q : base, '_blank', 'noopener');
 if (!fits) setTimeout(() => toast(t('La consulta ya está copiada: en el chat, mantén pulsado y pega.', 'The request is already copied: in the chat, long-press and paste.'), 'info', 6000), 400);
}
// «Pegar y leer»: trae lo copiado al recuadro y lo procesa de un toque.
async function pasteClick(e) {
 const b = e.target.closest('[data-paste]');
 if (!b) return;
 const box = document.getElementById(b.dataset.paste);
 if (!box) return;
 let text = '';
 try { text = await navigator.clipboard.readText(); } catch {}
 if (!text.trim()) { box.focus(); toast(t('No puedo leer lo copiado desde aquí: mantén pulsado el recuadro y pega.', 'I cannot read the clipboard here: long-press the box and paste.'), 'error', 6000); return; }
 box.value = text; box.dispatchEvent(new Event('input', {bubbles: true}));
 b.closest('.row-actions')?.querySelector(b.dataset.then)?.click();
}

async function start() {
 document.addEventListener('click', chatClick, true);
 document.addEventListener('click', pasteClick);
 const shared = new URLSearchParams(location.search);
 if (['title', 'text', 'url'].some(k => shared.get(k))) { const keys = shared.get('text') ? ['text', 'url'] : ['title', 'url']; presetRecipe([...new Set(keys.map(k => (shared.get(k) || '').trim()).filter(Boolean))].join('\n')); history.replaceState(null, '', location.pathname + '#/crear/importar'); }
 applyPrefs();
 startTimers();
 startFinder();
 // Otras pantallas piden abrir los ajustes de ChatGPT o de sincronización.
 document.addEventListener('id-open', e => { if (e.detail === 'ia') iaSheet(() => route({keepScroll: true})); if (e.detail === 'sync') syncSheet(() => route({keepScroll: true})); });
 shell();
 route();
 onChange(refresh);
 addEventListener('hashchange', () => route());
 await loadAll();
 startAutoSync();
 startVoice();
 dailyRadar();
}
// Con ChatGPT conectado, el radar se pone al día solo una vez al día (al abrir la app), sin molestar.
async function dailyRadar() {
 const cfg = iaConfig(), today = new Date().toISOString().slice(0, 10);
 if (!iaOn() || cfg.daily === false || cfg.lastRadar === today || navigator.onLine === false) return;
 saveIa({lastRadar: today});
 try {
  const found = trendsFromReply(await askIa({text: radarPrompt(), web: true}));
  const added = found.length ? addTrends(found) : 0;
  if (added) toast(t('Radar al día: ', 'Radar updated: ') + added + t(' avisos nuevos.', ' new alerts.'));
 } catch { saveIa({lastRadar: cfg.lastRadar || null}); }
}
start();
