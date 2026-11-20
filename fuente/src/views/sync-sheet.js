// I+D · Sincronizar el PC y el móvil: empezar en un aparato, unirse con el código en el otro, y ver cómo va.
import {t, relDay} from '../i18n.js';
import {esc, icon, $, sheet, toast} from '../ui.js';
import {syncConfig, syncOn, syncStatus, onSync, pretty, startSync, joinSync, stopSync, syncNow} from '../sync.js';
import {copy} from '../ai.js';

const errText = k => (k === 'missing' ? t('Ese código no corresponde a ninguna libreta. Revísalo (son 24 letras y números).', 'That code does not match any notebook. Check it (24 letters and numbers).')
 : k === 'code' ? t('El código tiene 24 letras y números. Pégalo entero.', 'The code has 24 letters and numbers. Paste all of it.')
 : k === 'offline' ? t('Sin conexión: se sincronizará cuando vuelva internet.', 'Offline: it will sync when the internet is back.')
 : k === 'full' ? t('No se pueden crear más libretas.', 'No more notebooks can be created.')
 : t('No se pudo sincronizar ahora. Se reintentará solo.', 'It could not sync right now. It will retry by itself.'));
export function syncLine() {
 const st = syncStatus();
 if (!st.on) return t('Apagado: cada aparato tiene sus propios platos', 'Off: each device has its own dishes');
 if (st.state === 'syncing') return t('Sincronizando…', 'Syncing…');
 if (st.state === 'error') return errText(st.error);
 const at = st.last ? new Date(st.last) : null;
 return at ? t('Al día, ', 'Up to date, ') + (Date.now() - at < 90000 ? t('hace un momento', 'just now') : relDay(at) + ' ' + at.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})) : t('Activado', 'On');
}

export function syncSheet(onDone = null) {
 const body = () => {
  if (!syncOn()) return '<p class="lead">' + esc(t('Con la sincronización, lo que apuntas en el PC aparece en el móvil y al revés: platos, cartas, fotos, lo guardado del radar y «Mi cocina». Se guarda en una base de datos propia de esta app, que solo se abre con tu código.', 'With sync, what you note on the PC appears on the phone and vice versa: dishes, menus, photos, saved radar alerts and “My kitchen”. It is stored in a database of its own, opened only with your code.')) + '</p>' +
   '<div class="set-group"><p class="set-label">' + esc(t('En el primer aparato', 'On the first device')) + '</p><button type="button" class="btn primary" data-act="start">' + icon('refresh') + esc(t('Empezar a sincronizar aquí', 'Start syncing here')) + '</button><p class="set-note">' + esc(t('Te dará un código para el otro aparato.', 'It will give you a code for the other device.')) + '</p></div>' +
   '<div class="set-group"><p class="set-label">' + esc(t('En el segundo aparato', 'On the second device')) + '</p><label class="sr" for="syncCode">' + esc(t('Código de sincronización', 'Sync code')) + '</label><input id="syncCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX">' +
   '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="join">' + icon('check') + esc(t('Unir este aparato', 'Join this device')) + '</button></div><p class="set-note">' + esc(t('Se juntan los platos de los dos aparatos: no se pierde nada de ninguno.', 'The dishes from both devices are merged: nothing is lost from either.')) + '</p></div>';
  const code = syncConfig().code, st = syncStatus();
  return '<div class="notice ' + (st.state === 'error' ? '' : 'notice-ok') + '" role="status" id="syncState">' + icon(st.state === 'error' ? 'alert' : 'check') + '<p>' + esc(syncLine()) + '</p></div>' +
   '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="now">' + icon('refresh') + esc(t('Sincronizar ahora', 'Sync now')) + '</button></div>' +
   '<div class="set-group"><p class="set-label">' + esc(t('Código para tus otros aparatos', 'Code for your other devices')) + '</p><p class="sync-code" id="syncCodeShow">' + esc(pretty(code)) + '</p>' +
   '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="copy">' + icon('copy') + esc(t('Copiar', 'Copy')) + '</button><a class="btn ghost" href="https://wa.me/?text=' + encodeURIComponent(t('Código de I+D: ', 'I+D code: ') + pretty(code)) + '" target="_blank" rel="noopener noreferrer">' + icon('out') + esc(t('Enviarme por WhatsApp', 'Send to myself on WhatsApp')) + '</a></div>' +
   '<p class="set-note">' + esc(t('En el otro aparato: Ajustes → Sincronizar → pega este código. Guárdalo como una contraseña: quien lo tenga puede ver tu libreta.', 'On the other device: Settings → Sync → paste this code. Keep it like a password: whoever has it can see your notebook.')) + '</p></div>' +
   '<div class="set-group"><button type="button" class="btn danger" data-act="stop">' + icon('x') + esc(t('Dejar de sincronizar este aparato', 'Stop syncing this device')) + '</button><p class="set-note">' + esc(t('Este aparato se queda con todo lo que tiene; solo deja de enviar y recibir cambios.', 'This device keeps everything it has; it just stops sending and receiving changes.')) + '</p></div>';
 };
 const s = sheet({title: t('Sincronizar PC y móvil', 'Sync PC and phone'), wide: true, body: body()});
 const paint = () => { if (s.el.isConnected) s.body.innerHTML = body(); };
 const off = onSync(() => { const el = $('#syncState', s.el); if (el) { el.className = 'notice ' + (syncStatus().state === 'error' ? '' : 'notice-ok'); el.querySelector('p').textContent = syncLine(); } });
 const obs = new MutationObserver(() => { if (!s.el.isConnected) { off(); obs.disconnect(); onDone?.(); } }); obs.observe(document.body, {childList: true, subtree: true});
 s.el.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'), act = b?.dataset.act;
  if (!act) return;
  const busy = on => { b.disabled = on; b.classList.toggle('is-busy', on); };
  if (act === 'start') { busy(true); try { await startSync(); paint(); toast(t('Sincronización activada. Ahora pon el código en el otro aparato.', 'Sync is on. Now enter the code on the other device.')); } catch (err) { toast(errText(err.kind), 'error', 7000); busy(false); } }
  if (act === 'join') { busy(true); try { await joinSync($('#syncCode', s.el).value); paint(); toast(t('Aparato unido: ya tienes aquí lo de los dos.', 'Device joined: you now have everything from both here.')); } catch (err) { toast(errText(err.kind), 'error', 7000); busy(false); } }
  if (act === 'now') { busy(true); try { await syncNow(); toast(t('Sincronizado.', 'Synced.')); } catch (err) { toast(errText(err.kind), 'error', 6000); } busy(false); }
  if (act === 'copy') { const done = await copy(pretty(syncConfig().code)); toast(done ? t('Código copiado.', 'Code copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error'); }
  if (act === 'stop') { stopSync(); paint(); toast(t('Este aparato ya no se sincroniza. Tus platos siguen aquí.', 'This device no longer syncs. Your dishes are still here.')); }
 });
 return s;
}
