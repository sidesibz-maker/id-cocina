// I+D · Herramientas (segunda parte): producción y pedido de un menú, y etiquetas de conservación para la mise en place.
import {t, en, locale, dayKey} from '../i18n.js';
import {esc, icon, $, $$, toast} from '../ui.js';
import {liveMenus, liveDishes, liveDocs, subById, dishById} from '../store.js';
import {ALLERGENS} from '../ai-core.js';
import {copy} from '../ai.js';

const parseNum = v => { const s = String(v ?? '').trim().replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };
const nice = n => { const a = Math.abs(n), r = a >= 1000 ? Math.round(n / 10) * 10 : a >= 100 ? Math.round(n) : a >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100; return r.toLocaleString(locale(), {maximumFractionDigits: 2, useGrouping: false}); };
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
// «120 g», «1,5 kg», «2 ud», «1/2 l» → {n, unit} en g, ml o ud. Lo que no se entiende (c/s, al gusto) devuelve null.
export function qtyOf(q) {
 const m = String(q || '').trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*(kg|gr|g|ml|cl|dl|l|ud|uds|u|unidad(?:es)?|piezas?|hojas?|dientes?)?\b/i);
 if (!m) return null;
 let n = parseNum(m[1]) / (m[2] ? Number(m[2]) : 1);
 const u = (m[3] || 'ud').toLowerCase();
 if (!Number.isFinite(n)) return null;
 if (u === 'kg') return {n: n * 1000, unit: 'g'};
 if (u === 'g' || u === 'gr') return {n, unit: 'g'};
 if (u === 'l') return {n: n * 1000, unit: 'ml'};
 if (u === 'dl') return {n: n * 100, unit: 'ml'};
 if (u === 'cl') return {n: n * 10, unit: 'ml'};
 if (u === 'ml') return {n, unit: 'ml'};
 return {n, unit: 'ud'};
}
const show = ({n, unit}) => (unit === 'g' ? (n >= 1000 ? nice(n / 1000) + ' kg' : nice(n) + ' g') : unit === 'ml' ? (n >= 1000 ? nice(n / 1000) + ' l' : nice(n) + ' ml') : nice(n) + ' ud');
const field = (id, label, value = '', unit = '', mode = 'decimal') => '<div class="tfield"><label for="' + id + '">' + esc(label) + '</label><div class="tinput"><input id="' + id + '" inputmode="' + mode + '" autocomplete="off" value="' + esc(value) + '">' + (unit ? '<span>' + esc(unit) + '</span>' : '') + '</div></div>';

// ---------- Producción y pedido ----------
let prodMenu = '';
export const produccion = {
 html() {
  const menus = liveMenus().filter(m => m.items.some(x => dishById(x.dish_id)));
  if (!prodMenu && menus[0]) prodMenu = menus[0].id;
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('Para qué servicio', 'For which service')) + '</h2>' +
   (menus.length ? '<div class="tfield"><label for="prMenu">' + esc(t('Carta o menú', 'Menu')) + '</label><select id="prMenu">' + menus.map(m => '<option value="' + esc(m.id) + '"' + (m.id === prodMenu ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '<option value="*"' + (prodMenu === '*' ? ' selected' : '') + '>' + esc(t('Elegir platos sueltos', 'Pick single dishes')) + '</option></select></div>'
    : '<p class="hint">' + esc(t('Elige platos de tu libreta. Si haces una carta en «Cartas y menús», podrás elegirla aquí de una vez.', 'Pick dishes from your notebook. If you build a menu in “Menus”, you can pick it here in one go.')) + '</p>') +
   field('prCovers', t('Cubiertos', 'Covers'), '60', '', 'numeric') + '<div id="prDishes"></div>' +
   '<p class="fine">' + esc(t('Las cantidades salen de la ficha técnica de cada plato (cantidad por ración). Lo que no tenga cantidad sale aparte para que no se olvide.', 'Quantities come from each dish sheet (quantity per portion). Anything without a quantity is listed apart so it is not forgotten.')) + '</p></section>' +
   '<section class="card" aria-live="polite"><h2>' + esc(t('Lo que hay que preparar y pedir', 'What to prep and order')) + '</h2><div id="prOut"></div></section></div>';
 },
 dishes(root) {
  const sel = $('#prMenu', root)?.value || '*', m = liveMenus().find(x => x.id === sel), carta = m?.kind === 'carta';
  const list = m ? m.items.map(x => dishById(x.dish_id)).filter(d => d && !d.deleted_at) : liveDishes();
  return '<fieldset class="tfield prdishes"><legend class="jlegend">' + esc(carta ? t('Qué parte de los cubiertos pide cada plato', 'Share of covers ordering each dish') : m ? t('Platos del menú (todos los cubiertos)', 'Menu dishes (every cover)') : t('Platos', 'Dishes')) + '</legend>' +
   list.map(d => '<label class="prdish"><input type="checkbox" data-d="' + esc(d.id) + '"' + (m ? ' checked' : '') + '><span>' + esc(d.name) + '</span>' + (carta ? '<span class="tinput prpct"><input data-pct="' + esc(d.id) + '" inputmode="decimal" value="30" aria-label="' + esc(t('Porcentaje de ', 'Share for ') + d.name) + '"><span>%</span></span>' : '') + '</label>').join('') + '</fieldset>';
 },
 calc(root) {
  const covers = parseNum($('#prCovers', root)?.value), out = $('#prOut', root);
  const picked = $$('[data-d]', root).filter(c => c.checked).map(c => ({d: dishById(c.dataset.d), pct: parseNum($('[data-pct="' + CSS.escape(c.dataset.d) + '"]', root)?.value ?? 100)})).filter(x => x.d);
  if (!(covers > 0) || !picked.length) { out.innerHTML = '<p class="tresult-empty">' + esc(t('Elige los platos y los cubiertos.', 'Choose the dishes and covers.')) + '</p>'; out.dataset.text = ''; return; }
  const order = new Map(), loose = new Map(), subs = new Map(), prep = [], yields = liveDocs('rendimiento');
  for (const {d, pct} of picked) {
   const portions = Math.ceil(covers * (Number.isFinite(pct) ? pct : 100) / 100);
   const rows = [];
   for (const c of d.components) for (const i of c.items) {
    const q = qtyOf(i.q);
    if (!q) { const k = norm(i.n); loose.set(k, {n: i.n, dishes: new Set([...(loose.get(k)?.dishes || []), d.name])}); rows.push({n: i.n, q: i.q || t('c/s', 'to taste')}); continue; }
    const tot = {n: q.n * portions, unit: q.unit};
    rows.push({n: i.n, q: show(tot), comp: c.name});
    const sub = i.ref ? subById(i.ref) : null, map = sub ? subs : order, k = sub ? sub.id : norm(i.n) + '|' + q.unit;
    const cur = map.get(k) || {n: sub ? sub.name : i.n, unit: q.unit, total: 0, sub};
    cur.total += tot.n; map.set(k, cur);
   }
   prep.push({d, portions, rows});
  }
  // Subrecetas: cuántas tandas hacen falta si su rendimiento está apuntado en g, ml o ud.
  for (const s of subs.values()) { const y = qtyOf(s.sub?.yield); s.batches = y && y.unit === s.unit && y.n > 0 ? Math.ceil(s.total / y.n * 10) / 10 : null; }
  // Pedido en bruto con tus rendimientos guardados (si el nombre coincide).
  const withYield = o => { const k = norm(o.n), y = yields.find(r => norm(r.name).includes(k) || k.includes(norm(r.name).split(' ')[0])); return y && o.unit !== 'ud' && y.pct > 0 ? {...o, gross: o.total / (y.pct / 100), yield: y} : o; };
  const ord = [...order.values()].map(withYield).sort((a, b) => a.n.localeCompare(b.n, 'es'));
  const text = [t('PRODUCCIÓN para ', 'PRODUCTION for ') + covers + t(' cubiertos', ' covers'), ...prep.flatMap(p => ['', p.d.name + ' (' + p.portions + t(' raciones)', ' portions)'), ...p.rows.map(r => '  ' + r.q + '  ' + r.n)]),
   ...(subs.size ? ['', t('SUBRECETAS', 'SUB-RECIPES'), ...[...subs.values()].map(s => '  ' + show({n: s.total, unit: s.unit}) + '  ' + s.n + (s.batches ? ' (' + nice(s.batches) + t(' tandas)', ' batches)') : ''))] : []),
   '', t('PEDIDO', 'ORDER'), ...ord.map(o => '  ' + show({n: o.gross || o.total, unit: o.unit}) + '  ' + o.n + (o.gross ? t(' (en bruto)', ' (gross)') : '')), ...[...loose.values()].map(l => '  c/s  ' + l.n)].join('\n');
  out.dataset.text = text;
  out.innerHTML = '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="pr-copy">' + icon('copy') + esc(t('Copiar todo', 'Copy all')) + '</button><button type="button" class="btn ghost" data-act="pr-print">' + icon('down') + esc(t('Imprimir', 'Print')) + '</button></div>' +
   '<h3>' + esc(t('Pedido', 'Order')) + '</h3><table class="ktable"><tbody>' + ord.map(o => '<tr><td>' + esc(o.n) + (o.yield ? '<small class="prsmall">' + esc(t('Con tu rendimiento del ', 'With your yield of ') + nice(o.yield.pct) + ' %: ' + show({n: o.total, unit: o.unit}) + t(' limpio', ' trimmed')) + '</small>' : '') + '</td><td class="q">' + esc(show({n: o.gross || o.total, unit: o.unit})) + '</td></tr>').join('') +
   [...loose.values()].map(l => '<tr><td>' + esc(l.n) + '<small class="prsmall">' + esc(t('Sin cantidad en la ficha de ', 'No quantity in the sheet of ') + [...l.dishes].join(', ')) + '</small></td><td class="q">c/s</td></tr>').join('') + '</tbody></table>' +
   (subs.size ? '<h3>' + esc(t('Subrecetas a preparar', 'Sub-recipes to prepare')) + '</h3><table class="ktable"><tbody>' + [...subs.values()].map(s => '<tr><td><a href="#/subreceta/' + esc(s.sub.id) + '">' + esc(s.n) + '</a>' + (s.batches ? '<small class="prsmall">' + esc(nice(s.batches) + t(' tandas de ', ' batches of ') + s.sub.yield) + '</small>' : '') + '</td><td class="q">' + esc(show({n: s.total, unit: s.unit})) + '</td></tr>').join('') + '</tbody></table>' : '') +
   '<h3>' + esc(t('Producción por plato', 'Production per dish')) + '</h3>' + prep.map(p => '<details class="fold"><summary>' + esc(p.d.name) + ' <span class="count">' + p.portions + t(' raciones', ' portions') + '</span></summary><table class="ktable"><tbody>' + p.rows.map(r => '<tr><td>' + esc(r.n) + '</td><td class="q">' + esc(r.q) + '</td></tr>').join('') + '</tbody></table></details>').join('');
 },
 mount(root) {
  const redo = () => { $('#prDishes', root).innerHTML = produccion.dishes(root); produccion.calc(root); };
  root.addEventListener('change', e => { if (e.target.id === 'prMenu') { prodMenu = e.target.value; redo(); } });
  root.addEventListener('click', async e => {
   if (e.target.closest('[data-act=pr-copy]')) { const ok = await copy($('#prOut', root).dataset.text || ''); toast(ok ? t('Copiado.', 'Copied.') : t('No se pudo copiar.', 'It could not be copied.'), ok ? 'info' : 'error'); }
   if (e.target.closest('[data-act=pr-print]')) printText('<pre class="prprint">' + esc($('#prOut', root).dataset.text || '') + '</pre>');
  });
  $('#prDishes', root).innerHTML = produccion.dishes(root);
 }
};

// ---------- Etiquetas de conservación ----------
const KEEP = [['frio', 'Refrigerado (0 a 4 °C)', 'Chilled (0 to 4 °C)'], ['congelado', 'Congelado (−18 °C)', 'Frozen (−18 °C)'], ['ambiente', 'Ambiente, lugar fresco y seco', 'Room temperature, cool and dry']];
export const etiquetas = {
 html() {
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('La etiqueta', 'The label')) + '</h2>' +
   '<div class="tfield"><label for="lbName">' + esc(t('Producto o elaboración', 'Product or preparation')) + '</label><input id="lbName" list="lbSubs" maxlength="60" autocomplete="off" placeholder="' + esc(t('p. ej. Romesco, fondo oscuro, gamba pelada', 'e.g. Romesco, brown stock, peeled prawn')) + '"><datalist id="lbSubs"></datalist></div>' +
   '<div class="tpair"><div class="tfield"><label for="lbDay">' + esc(t('Elaborado o abierto', 'Made or opened')) + '</label><input id="lbDay" type="date" value="' + dayKey() + '"></div>' + field('lbLife', t('Días de vida', 'Shelf life'), '3', t('días', 'days'), 'numeric') + '</div>' +
   '<div class="chips lbquick">' + [1, 2, 3, 5, 7, 15, 30, 90].map(n => '<button type="button" class="chip" data-life="' + n + '">' + n + (n === 1 ? t(' día', ' day') : t(' días', ' days')) + '</button>').join('') + '</div>' +
   '<div class="tfield"><label for="lbKeep">' + esc(t('Conservación', 'Storage')) + '</label><select id="lbKeep">' + KEEP.map(k => '<option value="' + k[0] + '">' + esc(en() ? k[2] : k[1]) + '</option>').join('') + '</select></div>' +
   '<div class="tpair">' + field('lbWho', t('Quién (iniciales)', 'Who (initials)'), '', '', 'text') + field('lbBatch', t('Lote (opcional)', 'Batch (optional)'), '', '', 'text') + '</div>' +
   '<fieldset class="tfield"><legend class="jlegend">' + esc(t('Alérgenos', 'Allergens')) + '</legend><div class="chips lballerg">' + ALLERGENS.map(a => '<label class="chip"><input type="checkbox" class="sr" value="' + a[0] + '">' + esc(en() ? a[2] : a[1]) + '</label>').join('') + '</div></fieldset>' +
   field('lbCount', t('Cuántas etiquetas', 'How many labels'), '6', '', 'numeric') + '</section>' +
   '<section class="card"><h2>' + esc(t('Así queda', 'Preview')) + '</h2><div id="lbOut"></div><div class="row-actions row-left"><button type="button" class="btn primary" data-act="lb-print">' + icon('down') + esc(t('Imprimir etiquetas', 'Print labels')) + '</button></div>' +
   '<p class="fine">' + esc(t('Salen en una hoja A4, 3 por fila, para recortar o en hojas de etiquetas adhesivas. Los días de vida los decide tu plan APPCC.', 'They print on an A4 sheet, 3 per row, to cut or on sticky label sheets. Shelf life is set by your HACCP plan.')) + '</p></section></div>';
 },
 label(root) {
  const name = $('#lbName', root).value.trim() || t('Producto', 'Product'), day = $('#lbDay', root).value || dayKey(), life = Math.max(0, parseInt($('#lbLife', root).value, 10) || 0);
  const end = new Date(day + 'T12:00:00'); end.setDate(end.getDate() + life);
  const fmt = d => new Date(d).toLocaleDateString(locale(), {weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit'});
  const keep = KEEP.find(k => k[0] === $('#lbKeep', root).value) || KEEP[0], who = $('#lbWho', root).value.trim(), batch = $('#lbBatch', root).value.trim();
  const al = $$('.lballerg input:checked', root).map(x => ALLERGENS.find(a => a[0] === x.value)).filter(Boolean).map(a => (en() ? a[2] : a[1]));
  return '<div class="lbl"><strong class="lbl-name">' + esc(name) + '</strong><div class="lbl-dates"><span><small>' + esc(t('Elaborado', 'Made')) + '</small>' + esc(fmt(day + 'T12:00:00')) + '</span><span class="lbl-end"><small>' + esc(t('Consumir antes de', 'Use by')) + '</small>' + esc(fmt(end)) + '</span></div>' +
   '<p class="lbl-keep">' + esc(en() ? keep[2] : keep[1]) + '</p>' + (al.length ? '<p class="lbl-al"><b>' + esc(t('Alérgenos: ', 'Allergens: ')) + '</b>' + esc(al.join(', ')) + '</p>' : '') + (who || batch ? '<p class="lbl-who">' + esc([who, batch ? t('Lote ', 'Batch ') + batch : ''].filter(Boolean).join('  ')) + '</p>' : '') + '</div>';
 },
 calc(root) { $('#lbOut', root).innerHTML = etiquetas.label(root); },
 mount(root) {
  import('../store.js').then(({liveSubs}) => { const dl = $('#lbSubs', root); if (dl) dl.innerHTML = liveSubs().map(x => '<option value="' + esc(x.name) + '">').join(''); });
  root.addEventListener('click', e => {
   const l = e.target.closest('[data-life]');
   if (l) { $('#lbLife', root).value = l.dataset.life; etiquetas.calc(root); }
   if (e.target.closest('[data-act=lb-print]')) { const n = Math.max(1, Math.min(48, parseInt($('#lbCount', root).value, 10) || 1)); printText('<div class="lbl-sheet">' + etiquetas.label(root).repeat(n) + '</div>'); }
  });
  root.addEventListener('change', e => { const c = e.target.closest('.lballerg input'); if (c) c.closest('.chip').classList.toggle('chip-have', c.checked); });
 }
};

// Imprime un trozo de HTML suelto con el mismo sistema que las fichas.
export function printText(html) {
 let host = document.getElementById('printFicha');
 if (!host) { host = document.createElement('div'); host.id = 'printFicha'; document.body.append(host); }
 host.innerHTML = html;
 document.documentElement.classList.add('printing');
 const done = () => { document.documentElement.classList.remove('printing'); host.innerHTML = ''; removeEventListener('afterprint', done); };
 addEventListener('afterprint', done);
 setTimeout(() => print(), 50);
}
