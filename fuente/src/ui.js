// I+D · piezas de pantalla comunes: texto seguro, iconos, avisos, hojas (ventanas) y el dibujo del perfil de sabor.
import {AXES, AXIS_IDS, fingerprint} from './flavor-core.js';
import {t, en, num} from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
// Todo lo que viene de la base de datos, de la IA o del teclado pasa por aquí antes de pintarse.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[m]));
// Solo enlaces http(s): lo demás (javascript:, data:) no se enlaza.
export const safeUrl = v => { try { const u = new URL(String(v || '')); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; } };
export const hostOf = v => { try { return new URL(v).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const clip = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const PATHS = {
 flame: '<path d="M12 3c.5 3-2 4.5-2 7a2.5 2.5 0 0 0 5 0c0-.8-.3-1.5-.6-2 2 1.200 3.600 3.500 3.600 6.200A6 6 0 0 1 6 14.200C6 10 10 8.500 12 3z"/>',
 radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.400-6.400"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/>',
 plus: '<path d="M12 5v14M5 12h14"/>',
 book: '<path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z"/><path d="M6 17a2 2 0 0 1 2-2h11M10 7h5M10 10.500h5"/>',
 wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.600 5.600l12.800 12.800M18.400 5.600L5.600 18.400"/>',
 pan: '<path d="M3 11h13a0 0 0 0 1 0 0v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-1z"/><path d="M16 12l5.500-2.500"/>',
 bell: '<path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 star: '<path d="M12 4l2.500 5.100 5.600.800-4.100 4 1 5.600L12 16.800 7 19.500l1-5.600-4.100-4 5.600-.800z"/>',
 x: '<path d="M6 6l12 12M18 6L6 18"/>',
 right: '<path d="M9 6l6 6-6 6"/>',
 left: '<path d="M15 6l-6 6 6 6"/>',
 arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
 search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
 image: '<rect x="3.500" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.600"/><path d="M4 17l5-4.500 3.500 3 3-2.500 4.500 4"/>',
 spark: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 15l.700 2 2 .700-2 .700-.700 2-.700-2-2-.700 2-.700z"/>',
 trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
 undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
 check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
 alert: '<path d="M12 4l9 15.500H3z"/><path d="M12 10v4.500M12 17.300v.200"/>',
 info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.200"/>',
 out: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>',
 moon: '<path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z"/>',
 sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300L7 7M17 17l1.700 1.700M18.700 5.300L17 7M7 17l-1.700 1.700"/>',
 globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.300 3 14.700 0 18M12 3c-3 3.300-3 14.700 0 18"/>',
 more: '<circle cx="5" cy="12" r="1.500" fill="currentColor"/><circle cx="12" cy="12" r="1.500" fill="currentColor"/><circle cx="19" cy="12" r="1.500" fill="currentColor"/>',
 copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
 leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19c3-5 6-8 11-10"/>',
 box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
 link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
 clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
 edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
 refresh: '<path d="M20 11a8 8 0 0 0-14.500-3.500L4 9"/><path d="M4 5v4h4M4 13a8 8 0 0 0 14.500 3.500L20 15"/><path d="M20 19v-4h-4"/>',
 down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
 user: '<circle cx="12" cy="8.500" r="3.500"/><path d="M5 20c.800-3.500 3.500-5.500 7-5.500s6.200 2 7 5.500"/>',
 menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
 drop: '<path d="M12 3.500c3.500 4.200 6 7 6 10.500a6 6 0 0 1-12 0c0-3.500 2.500-6.300 6-10.500z"/>',
 gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 brain: '<path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8a3 3 0 0 0 .3 5.5A3.2 3.2 0 0 0 8 18a2.8 2.8 0 0 0 4 1.5z"/><path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8a3 3 0 0 1-.3 5.5A3.2 3.2 0 0 1 16 18a2.8 2.8 0 0 1-4 1.5z"/><path d="M12 5v14.5"/>',
 library: '<path d="M4 4h4v16H4z"/><path d="M10 4h4v16h-4z"/><path d="m15.5 5.3 3.6-1 3.2 14.5-3.6 1z"/>',
 chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
 send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
 bolt: '<path d="M13 3L5 13.500h6L10 21l8-10.500h-6z"/>'
};
export const icon = (name, cls = '') => '<svg class="ic ' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (PATHS[name] || '') + '</svg>';

// ---------- Avisos breves ----------
// Un resumen recortado por palabras, con puntos suspensivos (en el texto, no con CSS: así nada queda tapado).
export const short = (text, max) => { const v = String(text || '').trim(); if (v.length <= max) return v; const cut = v.slice(0, max); return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,.;:]$/, '') + '…'; };
// Metadatos en fila: cada parte en su hueco, sin puntos entre medias.
export const metaRow = (parts, cls = '') => { const list = parts.filter(Boolean); return list.length ? '<span class="meta-row' + (cls ? ' ' + cls : '') + '">' + list.map(p => '<span>' + p + '</span>').join('') + '</span>' : ''; };
export function toast(message, kind = 'info', ms = 3600) {
 const host = $('#toasts');
 if (!host) return;
 const el = document.createElement('div');
 el.className = 'toast toast-' + kind;
 el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
 el.textContent = message;
 host.append(el);
 [...host.children].slice(0, -3).forEach(old => old.remove());
 requestAnimationFrame(() => el.classList.add('in'));
 setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); }, ms);
}
// Nunca texto técnico: los fallos se cuentan en claro.
export function friendly(error, fallback) {
 const text = String(error?.message || error || '');
 if (/failed to fetch|networkerror|load failed|network request failed/i.test(text) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return t('No hay conexión ahora mismo. Inténtalo de nuevo en un momento.', 'No connection right now. Please try again in a moment.');
 if (/permission denied|row-level security|42501|not allowed|forbidden/i.test(text)) return t('Tu cuenta no tiene permiso para hacer este cambio.', 'Your account is not allowed to make this change.');
 if (/quota/i.test(text)) return t('No queda sitio en este navegador para guardar más. Descarga una copia de seguridad y quita imágenes que no necesites.', 'This browser has no room left to save more. Download a backup and remove images you do not need.');
 return fallback || t('No se pudo completar. Inténtalo de nuevo.', 'It could not be completed. Please try again.');
}

// ---------- Hojas (ventanas): abajo en el móvil, centradas en el ordenador ----------
const openSheets = [];
function updateSheets() {
 const top = openSheets.at(-1);
 $('#app').inert = !!top;
 document.documentElement.classList.toggle('has-sheet', !!top);
 openSheets.forEach(s => { s.el.inert = s !== top; });
}
export function sheet({title = '', body = '', wide = false, onClose = null, label = ''} = {}) {
 const host = $('#sheets'), wrap = document.createElement('div');
 wrap.className = 'sheet-wrap';
 wrap.innerHTML = '<div class="sheet-back" data-close></div><section class="sheet' + (wide ? ' sheet-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label || title || t('Ventana', 'Dialog')) + '" tabindex="-1">' +
  '<header class="sheet-head"><h2 class="sheet-title">' + esc(title) + '</h2><button type="button" class="iconbtn" data-close aria-label="' + esc(t('Cerrar', 'Close')) + '">' + icon('x') + '</button></header>' +
  '<div class="sheet-body">' + body + '</div></section>';
 const previous = document.activeElement, dialog = $('.sheet', wrap);
 const close = ({restoreFocus = true} = {}) => {
  const index = openSheets.indexOf(api);
  if (index < 0) return;
  const wasTop = index === openSheets.length - 1;
  openSheets.splice(index, 1);
  wrap.inert = true;
  wrap.classList.remove('in');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) wrap.remove();
  else setTimeout(() => wrap.remove(), 220);
  updateSheets();
  const next = openSheets.at(-1);
  onClose?.();
  if (!restoreFocus || !wasTop || next !== openSheets.at(-1)) return;
  if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({preventScroll: true});
  if (document.activeElement === document.body) (next ? $('.sheet', next.el) : $('#view'))?.focus({preventScroll: true});
 };
 const api = {el: wrap, body: $('.sheet-body', wrap), close};
 wrap.addEventListener('click', e => { if (openSheets.at(-1) === api && e.target.closest('[data-close]')) close(); });
 wrap.addEventListener('keydown', e => {
  if (openSheets.at(-1) !== api || e.isComposing) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
  if (e.key !== 'Tab') return;
  const items = $$('button, a[href], input, select, textarea, summary, [contenteditable], [tabindex]', dialog)
   .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length && getComputedStyle(el).visibility === 'visible');
  const current = items.indexOf(document.activeElement);
  if (current < 0 || (e.shiftKey ? current === 0 : current === items.length - 1)) {
   e.preventDefault();
   (e.shiftKey ? items.at(-1) || dialog : items[0] || dialog).focus();
  }
 });
 host.append(wrap);
 openSheets.push(api);
 updateSheets();
 requestAnimationFrame(() => {
  if (!openSheets.includes(api)) return;
  wrap.classList.add('in');
  if (openSheets.at(-1) === api && !wrap.contains(document.activeElement)) dialog.focus({preventScroll: true});
 });
 return api;
}
export const closeSheets = () => [...openSheets].reverse().forEach(s => s.close({restoreFocus: false}));

// Pregunta de sí o no. Devuelve una promesa con true o false.
export function ask({title, text = '', yes, no = t('Cancelar', 'Cancel'), danger = false}) {
 return new Promise(resolve => {
  let answer = false;
  const s = sheet({title, body: (text ? '<p class="lead">' + esc(text) + '</p>' : '') + '<div class="row-actions"><button type="button" class="btn ghost" data-no>' + esc(no) + '</button><button type="button" class="btn ' + (danger ? 'danger' : 'primary') + '" data-yes>' + esc(yes) + '</button></div>', onClose: () => resolve(answer)});
  $('[data-yes]', s.el).onclick = () => { answer = true; s.close(); };
  $('[data-no]', s.el).onclick = () => s.close();
 });
}

// ---------- Perfil de sabor ----------
const axisName = id => { const a = AXES.find(x => x[0] === id); return a ? (en() ? a[2] : a[1]) : id; };
export {axisName};

// Barras alineadas, una por sabor, con su cifra: lo que domina va resaltado y dicho con palabras (no solo con color).
export function flavorMeters(profile, {lacking = []} = {}) {
 const a = profile?.axes || {}, dominant = new Set(profile?.dominant || []), missing = new Set(lacking.filter(x => AXIS_IDS.includes(x)));
 const rows = AXIS_IDS.map(id => {
  const v = Math.max(0, Math.min(10, Number(a[id]) || 0)), dom = dominant.has(id), lack = missing.has(id) && !dom;
  return '<li class="fm-row' + (dom ? ' is-dom' : '') + (lack ? ' is-lack' : '') + '"><span class="fm-name">' + esc(axisName(id)) + '</span>' +
   '<span class="fm-track" aria-hidden="true"><span class="fm-fill" style="width:' + (v * 10).toFixed(1) + '%"></span></span>' +
   '<span class="fm-val">' + num(v) + '</span>' +
   '<span class="fm-tag">' + (dom ? esc(t('domina', 'leads')) : lack ? icon('alert') + esc(t('falta', 'low')) : '') + '</span></li>';
 }).join('');
 return '<ul class="fm" aria-label="' + esc(t('Perfil de sabor, de 0 a 10', 'Flavour profile, 0 to 10')) + '">' + rows + '</ul>';
}

// La «huella» del plato: la misma información como una forma, para reconocer un plato de un vistazo en las tarjetas.
// Un solo color; los nombres de los ejes solo en el tamaño grande. La lectura exacta está en las barras.
export function flavorPrint(axes, {size = 56, labels = false, title = ''} = {}) {
 const values = fingerprint(axes), n = values.length, pad = labels ? 66 : 3, box = size + pad * 2, c = box / 2, R = size / 2;
 const point = (k, r) => { const ang = -Math.PI / 2 + k * 2 * Math.PI / n; return [c + Math.cos(ang) * r, c + Math.sin(ang) * r]; };
 const empty = values.every(v => v === 0);
 const pts = values.map((v, k) => point(k, R * (.16 + .84 * v)));
 // Curva cerrada y suave por los nueve puntos.
 let d = '';
 for (let k = 0; k < n; k++) {
  const p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n], s = .18;
  const c1 = [p1[0] + (p2[0] - p0[0]) * s, p1[1] + (p2[1] - p0[1]) * s], c2 = [p2[0] - (p3[0] - p1[0]) * s, p2[1] - (p3[1] - p1[1]) * s];
  if (k === 0) d += 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
  d += 'C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
 }
 const rings = (labels ? [.25, .5, .75, 1] : [1]).map(f => '<circle class="fp-ring" cx="' + c + '" cy="' + c + '" r="' + (R * f).toFixed(1) + '"/>').join('');
 const spokes = labels ? values.map((_, k) => { const [x, y] = point(k, R); return '<path class="fp-ring" d="M' + c + ' ' + c + 'L' + x.toFixed(1) + ' ' + y.toFixed(1) + '"/>'; }).join('') : '';
 const names = labels ? AXIS_IDS.map((id, k) => {
  const [x, y] = point(k, R + 14), anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
  return '<text class="fp-label' + (values[k] >= .5 ? ' is-strong' : '') + '" x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(axisName(id)) + '</text>';
 }).join('') : '';
 return '<svg class="fp' + (labels ? ' fp-big' : '') + (empty ? ' is-empty' : '') + '" viewBox="0 0 ' + box + ' ' + box + '" width="' + box + '" height="' + box + '" role="img" aria-label="' + esc(title || t('Huella de sabor', 'Flavour print')) + '">' +
  rings + spokes + (empty ? '' : '<path class="fp-shape" d="' + d + 'Z"/>') + names + '</svg>';
}

// Texto de una frase: «Domina graso y umami. Le falta ácido y crujiente.»
const LACK_NAMES = {acido: ['ácido', 'acidity'], fresco: ['frescor', 'freshness'], umami: ['fondo (umami)', 'depth (umami)'], graso: ['algo que redondee', 'something to round it off'], crujiente: ['crujiente', 'crunch'], color: ['color', 'colour'], dulce: ['dulce', 'sweetness'], amargo: ['amargo', 'bitterness'], picante: ['picante', 'heat']};
export const lackName = id => (LACK_NAMES[id] ? LACK_NAMES[id][en() ? 1 : 0] : id);
const joinList = items => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + (en() ? ' and ' : ' y ') + items[items.length - 1];
export function verdictText(verdict, profile) {
 if (!verdict || profile?.empty) return t('Añade ingredientes y verás qué sabores dominan.', 'Add ingredients to see which flavours lead.');
 const dom = verdict.dominant.map(id => axisName(id).toLowerCase()), lack = verdict.lacking.map(lackName);
 const first = dom.length ? t('Domina ', 'Led by ') + joinList(dom) + '.' : t('Perfil suave: ningún sabor manda.', 'A gentle profile: no flavour leads.');
 const second = lack.length ? ' ' + t('Le falta ', 'It lacks ') + joinList(lack) + '.' : ' ' + t('Está equilibrado.', 'It is balanced.');
 return first + second;
}
export {joinList};
