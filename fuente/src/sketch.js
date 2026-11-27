// I+D · Boceto de emplatado: dibujar el plato con el dedo, el lápiz o el ratón antes de montarlo. Se elige la forma del
// plato (llano, hondo, rectangular o pizarra), se dibuja con cuatro tintas y tres grosores, y se colocan etiquetas con
// los componentes del plato tocando donde va cada uno. Deshacer y borrar. Se guarda como imagen del plato (PNG).
import {t} from './i18n.js';
import {esc, icon, $, $$, sheet} from './ui.js';

// Colores de tinta del propio tema: se leen de los tokens para que el dibujo case con la app.
const INKS = [['--ink', 'Tinta', 'Ink'], ['--ember', 'Bermellón', 'Vermilion'], ['--gold', 'Oro', 'Gold'], ['--ok-ink', 'Verde', 'Green']];
const PLATES = [['llano', 'Llano', 'Flat'], ['hondo', 'Hondo', 'Bowl'], ['rect', 'Rectangular', 'Rectangular'], ['pizarra', 'Pizarra', 'Slate']];
const token = (name, fallback = '#888') => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function sketchSheet(onSave, {labels = []} = {}) {
 const s = sheet({title: t('Boceto de emplatado', 'Plating sketch'), wide: true, body:
  '<p class="fine">' + esc(t('Elige el plato, dibuja con el dedo, el lápiz o el ratón y, si quieres, toca una etiqueta y luego el sitio del plato donde va.', 'Choose the plate, draw with your finger, pen or mouse and, if you like, tap a label and then the spot on the plate where it goes.')) + '</p>' +
  '<div class="skbar"><div class="seg" role="group" aria-label="' + esc(t('Plato', 'Plate')) + '">' + PLATES.map(([v, es, en], k) => '<button type="button" class="seg-btn' + (k ? '' : ' active') + '" data-plate="' + v + '" aria-pressed="' + !k + '">' + esc(t(es, en)) + '</button>').join('') + '</div></div>' +
  '<div class="skbar"><div class="seg" role="group" aria-label="' + esc(t('Color', 'Colour')) + '">' + INKS.map(([v, es, en], k) => '<button type="button" class="seg-btn skink' + (k ? '' : ' active') + '" data-ink="' + v + '" aria-pressed="' + !k + '"><i style="background:var(' + v + ')"></i>' + esc(t(es, en)) + '</button>').join('') + '</div>' +
  '<div class="seg" role="group" aria-label="' + esc(t('Grosor', 'Thickness')) + '">' + [[2, t('Fino', 'Fine')], [6, t('Medio', 'Medium')], [16, t('Grueso', 'Thick')]].map(([w, l], k) => '<button type="button" class="seg-btn' + (k === 1 ? ' active' : '') + '" data-w="' + w + '" aria-pressed="' + (k === 1) + '">' + esc(l) + '</button>').join('') + '</div>' +
  '<button type="button" class="btn ghost" data-sk="undo">' + icon('undo') + esc(t('Deshacer', 'Undo')) + '</button><button type="button" class="btn ghost" data-sk="clear">' + icon('x') + esc(t('Borrar todo', 'Clear')) + '</button></div>' +
  (labels.length ? '<div class="sklabels" role="group" aria-label="' + esc(t('Etiquetas del plato', 'Dish labels')) + '"><span class="mini">' + esc(t('Etiquetas:', 'Labels:')) + '</span>' + labels.map((l, k) => '<button type="button" class="chip" data-label="' + k + '" aria-pressed="false">' + icon('tag') + esc(l) + '</button>').join('') + '</div>' : '') +
  '<canvas id="skCanvas" class="skcanvas" width="900" height="900" aria-label="' + esc(t('Lienzo para dibujar el emplatado', 'Canvas to draw the plating')) + '"></canvas>' +
  '<div class="row-actions"><button type="button" class="btn primary" data-sk="save">' + icon('check') + esc(t('Guardar en el plato', 'Save to the dish')) + '</button></div>'});
 const cv = $('#skCanvas', s.el), ctx = cv.getContext('2d'), strokes = [];
 let ink = '--ink', width = 6, cur = null, plate = 'llano', label = null;
 const drawPlate = () => {
  const line = token('--line2', '#999');
  ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.setLineDash([]);
  if (plate === 'llano') { ctx.beginPath(); ctx.arc(450, 450, 400, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(450, 450, 300, 0, Math.PI * 2); ctx.stroke(); }
  if (plate === 'hondo') { ctx.beginPath(); ctx.arc(450, 450, 410, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(450, 450, 240, 0, Math.PI * 2); ctx.stroke(); }
  if (plate === 'rect') { ctx.beginPath(); ctx.roundRect(60, 230, 780, 440, 36); ctx.stroke(); ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.roundRect(130, 300, 640, 300, 20); ctx.stroke(); }
  if (plate === 'pizarra') { ctx.fillStyle = token('--soft', '#ddd'); ctx.fillRect(70, 200, 760, 500); ctx.lineWidth = 2; ctx.strokeRect(70, 200, 760, 500); }
  ctx.setLineDash([]);
 };
 const paint = () => {
  ctx.fillStyle = token('--card', '#fff'); ctx.fillRect(0, 0, cv.width, cv.height);
  drawPlate();
  for (const st of strokes) {
   ctx.strokeStyle = token(st.ink); ctx.fillStyle = token(st.ink); ctx.lineWidth = st.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
   if (st.text) {
    ctx.beginPath(); ctx.arc(st.pts[0][0], st.pts[0][1], 9, 0, Math.PI * 2); ctx.fill();
    ctx.font = '600 30px "Barlow", system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = token('--card', '#fff'); ctx.strokeText(st.text, st.pts[0][0] + 18, st.pts[0][1]); ctx.fillText(st.text, st.pts[0][0] + 18, st.pts[0][1]);
    continue;
   }
   if (st.pts.length === 1) { ctx.beginPath(); ctx.arc(st.pts[0][0], st.pts[0][1], st.w / 2, 0, Math.PI * 2); ctx.fill(); continue; }
   ctx.beginPath(); ctx.moveTo(st.pts[0][0], st.pts[0][1]); for (const [x, y] of st.pts.slice(1)) ctx.lineTo(x, y); ctx.stroke();
  }
 };
 const pressSet = (sel, on) => $$(sel, s.el).forEach(b => { const yes = b === on; b.classList.toggle('active', yes); b.setAttribute('aria-pressed', yes); });
 const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
 cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (label != null) { strokes.push({ink, w: 1, text: labels[label], pts: [at(e)]}); label = null; pressSet('[data-label]', null); paint(); return; }
  cv.setPointerCapture(e.pointerId); cur = {ink, w: width * (e.pressure && e.pointerType === 'pen' ? .5 + e.pressure : 1), pts: [at(e)]}; strokes.push(cur); paint();
 });
 cv.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(at(e)); paint(); });
 const end = () => { cur = null; };
 cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
 s.el.addEventListener('click', e => {
  const i = e.target.closest('[data-ink]'), w = e.target.closest('[data-w]'), p = e.target.closest('[data-plate]'), l = e.target.closest('[data-label]'), a = e.target.closest('[data-sk]')?.dataset.sk;
  if (i) { ink = i.dataset.ink; pressSet('[data-ink]', i); }
  if (w) { width = Number(w.dataset.w); pressSet('[data-w]', w); }
  if (p) { plate = p.dataset.plate; pressSet('[data-plate]', p); paint(); }
  if (l) { const k = Number(l.dataset.label); label = label === k ? null : k; pressSet('[data-label]', label === null ? null : l); }
  if (a === 'undo') { strokes.pop(); paint(); }
  if (a === 'clear') { strokes.length = 0; paint(); }
  if (a === 'save') { if (!strokes.length) { s.close(); return; } cv.toBlob(blob => { s.close(); if (blob) onSave(blob); }, 'image/png'); }
 });
 paint();
 return s;
}
