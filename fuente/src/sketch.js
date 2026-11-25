// I+D · Boceto de emplatado: dibujar el plato con el dedo, el lápiz o el ratón antes de montarlo. Un plato redondo de
// guía, cuatro tintas, grosor, deshacer y borrar. Se guarda como imagen del plato (PNG).
import {t} from './i18n.js';
import {esc, icon, $, $$, sheet} from './ui.js';

// Colores de tinta del propio tema: se leen de los tokens para que el dibujo case con la app.
const INKS = [['--ink', 'Tinta', 'Ink'], ['--ember', 'Bermellón', 'Vermilion'], ['--gold', 'Oro', 'Gold'], ['--ok-ink', 'Verde', 'Green']];
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor';

export function sketchSheet(onSave) {
 const s = sheet({title: t('Boceto de emplatado', 'Plating sketch'), wide: true, body:
  '<p class="fine">' + esc(t('Dibuja con el dedo, el lápiz o el ratón. El círculo es el plato.', 'Draw with your finger, pen or mouse. The circle is the plate.')) + '</p>' +
  '<div class="skbar"><div class="seg" role="group" aria-label="' + esc(t('Color', 'Colour')) + '">' + INKS.map(([v, es, en], k) => '<button type="button" class="seg-btn skink' + (k ? '' : ' active') + '" data-ink="' + v + '" aria-pressed="' + !k + '"><i style="background:var(' + v + ')"></i>' + esc(t(es, en)) + '</button>').join('') + '</div>' +
  '<div class="seg" role="group" aria-label="' + esc(t('Grosor', 'Thickness')) + '">' + [[2, t('Fino', 'Fine')], [6, t('Medio', 'Medium')], [16, t('Grueso', 'Thick')]].map(([w, l], k) => '<button type="button" class="seg-btn" data-w="' + w + '" aria-pressed="' + (k === 1) + '"' + (k === 1 ? ' data-on' : '') + '>' + esc(l) + '</button>').join('') + '</div>' +
  '<button type="button" class="btn ghost" data-sk="undo">' + icon('undo') + esc(t('Deshacer', 'Undo')) + '</button><button type="button" class="btn ghost" data-sk="clear">' + icon('x') + esc(t('Borrar todo', 'Clear')) + '</button></div>' +
  '<canvas id="skCanvas" class="skcanvas" width="900" height="900" aria-label="' + esc(t('Lienzo para dibujar el emplatado', 'Canvas to draw the plating')) + '"></canvas>' +
  '<div class="row-actions"><button type="button" class="btn primary" data-sk="save">' + icon('check') + esc(t('Guardar en el plato', 'Save to the dish')) + '</button></div>'});
 const cv = $('#skCanvas', s.el), ctx = cv.getContext('2d'), strokes = [];
 let ink = '--ink', width = 6, cur = null;
 $$('[data-w]', s.el).forEach(b => b.classList.toggle('active', b.hasAttribute('data-on')));
 const paint = () => {
  ctx.fillStyle = token('--paper-2'); ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = token('--line2'); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(450, 450, 400, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(450, 450, 300, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  for (const st of strokes) {
   ctx.strokeStyle = token(st.ink); ctx.fillStyle = token(st.ink); ctx.lineWidth = st.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
   if (st.pts.length === 1) { ctx.beginPath(); ctx.arc(st.pts[0][0], st.pts[0][1], st.w / 2, 0, Math.PI * 2); ctx.fill(); continue; }
   ctx.beginPath(); ctx.moveTo(st.pts[0][0], st.pts[0][1]); for (const [x, y] of st.pts.slice(1)) ctx.lineTo(x, y); ctx.stroke();
  }
 };
 const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
 cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = {ink, w: width * (e.pressure && e.pointerType === 'pen' ? .5 + e.pressure : 1), pts: [at(e)]}; strokes.push(cur); paint(); });
 cv.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(at(e)); paint(); });
 const end = () => { cur = null; };
 cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
 s.el.addEventListener('click', e => {
  const i = e.target.closest('[data-ink]'), w = e.target.closest('[data-w]'), a = e.target.closest('[data-sk]')?.dataset.sk;
  if (i) { ink = i.dataset.ink; $$('[data-ink]', s.el).forEach(b => { const on = b === i; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); }
  if (w) { width = Number(w.dataset.w); $$('[data-w]', s.el).forEach(b => { const on = b === w; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); }
  if (a === 'undo') { strokes.pop(); paint(); }
  if (a === 'clear') { strokes.length = 0; paint(); }
  if (a === 'save') { if (!strokes.length) { s.close(); return; } cv.toBlob(blob => { s.close(); if (blob) onSave(blob); }, 'image/png'); }
 });
 paint();
 return s;
}
