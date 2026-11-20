// I+D · Dictar en vez de escribir (con las manos ocupadas). Debajo de cada recuadro marcado con data-voice aparece «Dictar»;
// lo dicho se añade al final del texto y se guarda como si se hubiera escrito. Solo si el navegador sabe reconocer la voz.
import {t, en} from './i18n.js';
import {esc, icon, toast} from './ui.js';

const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
let active = null;
export const voiceSupported = () => !!Rec;

function stop() { try { active?.rec.stop(); } catch {} }
function start(box, btn) {
 if (active) { const same = active.box === box; stop(); if (same) return; }
 const rec = new Rec();
 rec.lang = en() ? 'en-GB' : 'es-ES'; rec.continuous = true; rec.interimResults = true;
 const base = box.value, sep = base && !/\s$/.test(base) ? (/[.!?]$/.test(base.trim()) ? ' ' : '. ') : '';
 let done = '';
 rec.onresult = e => {
  let live = '';
  for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) done += r[0].transcript; else live += r[0].transcript; }
  const said = (done + live).trim();
  box.value = base + (said ? sep + said.charAt(0).toUpperCase() + said.slice(1) : '');
  box.dispatchEvent(new Event('input', {bubbles: true}));
 };
 rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast(t('Permite el micrófono para dictar.', 'Allow the microphone to dictate.'), 'error'); };
 rec.onend = () => { btn.classList.remove('is-on'); btn.lastChild.textContent = t('Dictar', 'Dictate'); if (active?.rec === rec) active = null; };
 try { rec.start(); } catch { return; }
 active = {rec, box};
 btn.classList.add('is-on'); btn.lastChild.textContent = t('Escuchando… toca para parar', 'Listening… tap to stop');
}
function enhance(root) {
 if (!Rec) return;
 for (const box of root.querySelectorAll('textarea[data-voice]:not([data-voiced])')) {
  if (box.disabled) continue;
  box.setAttribute('data-voiced', '');
  box.insertAdjacentHTML('afterend', '<button type="button" class="voice-btn">' + icon('mic') + '<span>' + esc(t('Dictar', 'Dictate')) + '</span></button>');
  box.nextElementSibling.addEventListener('click', e => start(box, e.currentTarget));
 }
}
export function startVoice() {
 if (!Rec) return;
 enhance(document.body);
 new MutationObserver(() => enhance(document.body)).observe(document.body, {childList: true, subtree: true});
 addEventListener('hashchange', stop);
}
