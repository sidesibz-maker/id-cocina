// I+D · temporizadores de cocina. Varios a la vez, con nombre. Siguen contando aunque cambies de pantalla o cierres la app
// (se guarda la hora a la que acaban, en este aparato). Al terminar: sonido, vibración, aviso en pantalla y, si el
// navegador lo permite, una notificación.
import {t} from './i18n.js';
import {toast, uid, icon, esc} from './ui.js';

const KEY = 'id-cocina-temporizadores';
let list = [], ticking = null, audio = null;
const watchers = new Set();
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(x => x && x.id) : []; } catch { return []; } };
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
const tell = () => { watchers.forEach(fn => { try { fn(); } catch {} }); chip(); };
export const onTimers = fn => { watchers.add(fn); return () => watchers.delete(fn); };
export const timers = () => list.slice();
// Segundos que le quedan (0 si ha terminado); si está en pausa, lo que le quedaba al parar.
export const left = x => (x.paused != null ? x.paused : Math.max(0, Math.ceil((x.end - Date.now()) / 1000)));
export const clock = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(r).padStart(2, '0'); };

export function addTimer(name, seconds) {
 const total = Math.max(1, Math.min(48 * 3600, Math.round(seconds)));
 const x = {id: uid(), name: String(name || '').trim().slice(0, 60) || t('Temporizador', 'Timer'), total, end: Date.now() + total * 1000, paused: null, done: false};
 list.push(x); write(); unlock(); run(); tell();
 if (typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} }
 return x;
}
export function pauseTimer(id) { const x = list.find(v => v.id === id); if (!x || x.done) return; if (x.paused != null) { x.end = Date.now() + x.paused * 1000; x.paused = null; } else x.paused = left(x); write(); run(); tell(); }
export function restartTimer(id) { const x = list.find(v => v.id === id); if (!x) return; x.end = Date.now() + x.total * 1000; x.paused = null; x.done = false; write(); unlock(); run(); tell(); }
export function removeTimer(id) { list = list.filter(v => v.id !== id); write(); tell(); }

// El sonido solo puede empezar tras un toque: se prepara al crear el temporizador.
function unlock() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch {} }
function beep() {
 try {
  if (!audio) return;
  const now = audio.currentTime;
  for (let k = 0; k < 6; k++) {
   const o = audio.createOscillator(), g = audio.createGain(), at = now + k * .32;
   o.type = 'square'; o.frequency.value = k % 2 ? 880 : 1175;
   g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.25, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + .26);
   o.connect(g).connect(audio.destination); o.start(at); o.stop(at + .28);
  }
 } catch {}
}
function finish(x) {
 x.done = true; write();
 const text = t('Tiempo: ', 'Time is up: ') + x.name;
 toast(text, 'info', 12000); beep();
 try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch {}
 try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification('I+D', {body: text, tag: x.id}); } catch {}
}
function tick() {
 let changed = false;
 for (const x of list) if (!x.done && x.paused == null && left(x) === 0) { finish(x); changed = true; }
 if (!list.some(x => !x.done && x.paused == null)) { clearInterval(ticking); ticking = null; }
 if (changed) tell(); else { watchers.forEach(fn => { try { fn(true); } catch {} }); chip(); }
}
function run() { if (!ticking && list.some(x => !x.done && x.paused == null)) ticking = setInterval(tick, 500); }

// Un aviso pequeño, siempre a la vista, con el temporizador que antes acaba.
function chip() {
 let el = document.getElementById('timerChip');
 const live = list.filter(x => !x.done && x.paused == null).sort((a, b) => a.end - b.end), ended = list.filter(x => x.done);
 if (!live.length && !ended.length) { el?.remove(); return; }
 if (!el) { el = document.createElement('a'); el.id = 'timerChip'; el.className = 'timer-chip'; el.href = '#/herramientas/temporizadores'; document.body.append(el); }
 const first = live[0];
 el.classList.toggle('is-done', !first);
 const html = icon('clock') + '<span>' + (first ? esc(first.name) + ' <b>' + clock(left(first)) + '</b>' + (live.length > 1 ? ' <small>+' + (live.length - 1) + '</small>' : '') : esc(t('Tiempo: ', 'Time is up: ') + ended[0].name)) + '</span>';
 if (el.innerHTML !== html) el.innerHTML = html;
 el.setAttribute('aria-label', t('Temporizadores', 'Timers'));
}
export function startTimers() {
 list = read();
 // Los que acabaron con la app cerrada se dan por terminados sin sonar.
 for (const x of list) if (!x.done && x.paused == null && left(x) === 0) x.done = true;
 write(); run(); chip();
 addEventListener('storage', e => { if (e.key === KEY) { list = read(); run(); tell(); } });
}
