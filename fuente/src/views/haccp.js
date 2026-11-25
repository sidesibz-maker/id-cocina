// I+D · Registros APPCC: lo que hay que apuntar cada día para el plan de autocontrol. Temperaturas de cámaras y
// neveras (avisa si se salen del límite), cambios del aceite de freír y recepción de mercancía. Hoja mensual para
// imprimir y archivar. Cada apunte es un documento «registro:…» (copia y sincronización); nada se borra.
import {t, en, dayKey, locale} from '../i18n.js';
import {esc, icon, $, $$, toast} from '../ui.js';
import {liveDocs, docById, saveDoc, trashDoc} from '../store.js';
import {suppliers} from './suppliers.js';

const SETUP = 'registro-equipos:cocina';
const KINDS = [['temp', 'Temperaturas', 'Temperatures'], ['aceite', 'Aceite de freír', 'Frying oil'], ['recepcion', 'Recepción de mercancía', 'Goods in']];
const equipment = () => (docById(SETUP)?.list || [{id: 'c1', name: t('Cámara de frío', 'Walk-in fridge'), max: 4, min: 0}, {id: 'c2', name: t('Congelador', 'Freezer'), max: -18, min: -30}]);
const regs = (kind, month) => liveDocs('registro').filter(r => r.kind === kind && String(r.day).startsWith(month)).sort((a, b) => String(b.day + b.at).localeCompare(String(a.day + a.at)));
const now = () => new Date().toTimeString().slice(0, 5);
const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString(locale(), {weekday: 'short', day: 'numeric', month: 'short'});
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
let kind = 'temp', month = dayKey().slice(0, 7);

export const haccp = {
 html() {
  return '<div class="seg rgkinds" role="group" aria-label="' + esc(t('Qué registrar', 'What to record')) + '">' + KINDS.map(([k, es, eng]) => '<button type="button" class="seg-btn' + (k === kind ? ' active' : '') + '" data-rk="' + k + '" aria-pressed="' + (k === kind) + '">' + esc(en() ? eng : es) + '</button>').join('') + '</div>' +
   '<div class="tgrid"><section class="card" id="rgForm">' + haccp.form() + '</section><section class="card"><div class="csec-head"><h2>' + esc(t('Este mes', 'This month')) + '</h2><input id="rgMonth" type="month" value="' + month + '" aria-label="' + esc(t('Mes', 'Month')) + '" class="rgmonth"></div><div id="rgList">' + haccp.list() + '</div>' +
   '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="rg-print">' + icon('down') + esc(t('Imprimir la hoja del mes', 'Print the month sheet')) + '</button></div></section></div>' +
   '<p class="fine">' + icon('info') + esc(t('Estos registros te ayudan a llevar el plan APPCC, pero los límites y la frecuencia los marca tu plan.', 'These records help you keep your HACCP plan, but limits and frequency are set by your plan.')) + '</p>';
 },
 form() {
  if (kind === 'temp') return '<h2>' + esc(t('Apuntar temperaturas', 'Log temperatures')) + '</h2><p class="hint">' + esc(t('Una lectura por equipo. Si se sale del límite, se marca y te pide qué has hecho.', 'One reading per unit. If it is out of range it is flagged and asks what you did.')) + '</p>' +
   equipment().map(q => '<div class="tfield rgeq"><label for="rq-' + q.id + '">' + esc(q.name) + ' <small>(' + esc(t('máx. ', 'max ') + q.max + ' °C') + ')</small></label><div class="tinput"><input id="rq-' + q.id + '" data-eq="' + esc(q.id) + '" inputmode="decimal" autocomplete="off"><span>°C</span></div></div>').join('') +
   '<div class="tfield"><label for="rgNote">' + esc(t('Medida correctora o nota', 'Corrective action or note')) + '</label><input id="rgNote" maxlength="300" autocomplete="off" placeholder="' + esc(t('Puerta mal cerrada; reajustado y comprobado a la hora', 'Door left open; reset and checked an hour later')) + '"></div>' +
   '<div class="row-actions"><button type="button" class="linkbtn" data-act="rg-equip">' + icon('edit') + esc(t('Cambiar los equipos', 'Change the units')) + '</button><button type="button" class="btn primary" data-act="rg-save">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>';
  if (kind === 'aceite') return '<h2>' + esc(t('Aceite de freír', 'Frying oil')) + '</h2><div class="tpair"><div class="tfield"><label for="rgFry">' + esc(t('Freidora', 'Fryer')) + '</label><input id="rgFry" maxlength="60" value="' + esc(t('Freidora 1', 'Fryer 1')) + '"></div><div class="tfield"><label for="rgPolar">' + esc(t('Compuestos polares (si lo mides)', 'Polar compounds (if measured)')) + '</label><div class="tinput"><input id="rgPolar" inputmode="decimal"><span>%</span></div></div></div>' +
   '<div class="tfield"><label for="rgAct">' + esc(t('Qué has hecho', 'What you did')) + '</label><select id="rgAct"><option value="cambio">' + esc(t('Cambio de aceite', 'Oil change')) + '</option><option value="filtrado">' + esc(t('Filtrado', 'Filtered')) + '</option><option value="control">' + esc(t('Solo control', 'Check only')) + '</option></select></div>' +
   '<div class="tfield"><label for="rgNote">' + esc(t('Nota', 'Note')) + '</label><input id="rgNote" maxlength="300" autocomplete="off"></div><div class="row-actions"><button type="button" class="btn primary" data-act="rg-save">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>';
  return '<h2>' + esc(t('Recepción de mercancía', 'Goods in')) + '</h2><div class="tpair"><div class="tfield"><label for="rgSup">' + esc(t('Proveedor', 'Supplier')) + '</label><input id="rgSup" list="rgSups" maxlength="80" autocomplete="off"><datalist id="rgSups">' + suppliers().map(s => '<option value="' + esc(s.name) + '">').join('') + '</datalist></div><div class="tfield"><label for="rgProd">' + esc(t('Producto', 'Product')) + '</label><input id="rgProd" maxlength="120" autocomplete="off"></div></div>' +
   '<div class="tpair"><div class="tfield"><label for="rgTemp">' + esc(t('Temperatura al llegar', 'Temperature on arrival')) + '</label><div class="tinput"><input id="rgTemp" inputmode="decimal"><span>°C</span></div></div><div class="tfield"><label for="rgLot">' + esc(t('Lote o caducidad', 'Batch or use-by')) + '</label><input id="rgLot" maxlength="60" autocomplete="off"></div></div>' +
   '<fieldset class="tfield"><legend class="jlegend">' + esc(t('¿Se acepta?', 'Accepted?')) + '</legend><div class="seg"><label class="seg-btn active"><input type="radio" class="sr" name="rgOk" value="1" checked>' + esc(t('Aceptado', 'Accepted')) + '</label><label class="seg-btn"><input type="radio" class="sr" name="rgOk" value="0">' + esc(t('Rechazado', 'Rejected')) + '</label></div></fieldset>' +
   '<div class="tfield"><label for="rgNote">' + esc(t('Nota (estado, envase, etiquetado…)', 'Note (condition, packaging, labelling…)')) + '</label><input id="rgNote" maxlength="300" autocomplete="off"></div><div class="row-actions"><button type="button" class="btn primary" data-act="rg-save">' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>';
 },
 list() {
  const rows = regs(kind, month);
  if (!rows.length) return '<p class="tresult-empty">' + esc(t('Nada apuntado este mes.', 'Nothing logged this month.')) + '</p>';
  if (kind === 'temp') {
   const eq = equipment();
   return '<table class="ktable rgtable"><thead><tr><th>' + esc(t('Día', 'Day')) + '</th>' + eq.map(q => '<th class="q">' + esc(q.name) + '</th>').join('') + '<th></th></tr></thead><tbody>' + rows.map(r => '<tr' + (r.alert ? ' class="is-alert"' : '') + '><td>' + esc(fmt(r.day)) + ' <small>' + esc(r.at) + '</small>' + (r.note ? '<small class="rgnote">' + esc(r.note) + '</small>' : '') + '</td>' + eq.map(q => { const v = r.values?.[q.id]; const bad = Number.isFinite(v) && v > q.max; return '<td class="q' + (bad ? ' rgbad' : '') + '">' + (Number.isFinite(v) ? esc(String(v).replace('.', ',')) + ' °C' : '') + '</td>'; }).join('') + '<td class="q"><button type="button" class="iconbtn" data-rgdel="' + esc(r.id) + '" aria-label="' + esc(t('Quitar', 'Remove')) + '">' + icon('x') + '</button></td></tr>').join('') + '</tbody></table>';
  }
  if (kind === 'aceite') return '<ul class="rglist">' + rows.map(r => '<li><strong>' + esc(fmt(r.day)) + ', ' + esc(r.fryer) + '</strong><span>' + esc({cambio: t('Cambio de aceite', 'Oil change'), filtrado: t('Filtrado', 'Filtered'), control: t('Control', 'Check')}[r.action] || '') + (Number.isFinite(r.polar) ? ', ' + String(r.polar).replace('.', ',') + ' %' : '') + (r.note ? '. ' + esc(r.note) : '') + '</span><button type="button" class="iconbtn" data-rgdel="' + esc(r.id) + '" aria-label="' + esc(t('Quitar', 'Remove')) + '">' + icon('x') + '</button></li>').join('') + '</ul>';
  return '<ul class="rglist">' + rows.map(r => '<li' + (r.ok ? '' : ' class="is-alert"') + '><strong>' + esc(fmt(r.day)) + ', ' + esc(r.product || '') + '</strong><span>' + esc([r.supplier, Number.isFinite(r.temp) ? String(r.temp).replace('.', ',') + ' °C' : '', r.lot, r.ok ? t('aceptado', 'accepted') : t('rechazado', 'rejected'), r.note].filter(Boolean).join(', ')) + '</span><button type="button" class="iconbtn" data-rgdel="' + esc(r.id) + '" aria-label="' + esc(t('Quitar', 'Remove')) + '">' + icon('x') + '</button></li>').join('') + '</ul>';
 },
 calc() {},
 mount(root) {
  const repaint = () => { $('#rgForm', root).innerHTML = haccp.form(); $('#rgList', root).innerHTML = haccp.list(); };
  root.addEventListener('change', e => {
   if (e.target.id === 'rgMonth') { month = e.target.value || dayKey().slice(0, 7); $('#rgList', root).innerHTML = haccp.list(); }
   const r = e.target.closest('input[name=rgOk]'); if (r) $$('#rgForm .seg-btn', root).forEach(l => l.classList.toggle('active', l.contains(r)));
  });
  root.addEventListener('click', async e => {
   const k = e.target.closest('[data-rk]'), a = e.target.closest('[data-act]')?.dataset.act, del = e.target.closest('[data-rgdel]');
   if (k) { kind = k.dataset.rk; $$('[data-rk]', root).forEach(b => { const on = b === k; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); repaint(); }
   if (del) { await trashDoc(del.dataset.rgdel); $('#rgList', root).innerHTML = haccp.list(); toast(t('Quitado (queda en la papelera).', 'Removed (kept in the bin).')); }
   if (a === 'rg-equip') {
    const cur = equipment().map(q => q.name + ' | ' + q.max).join('\n');
    const {sheet} = await import('../ui.js');
    const s = sheet({title: t('Tus equipos de frío', 'Your cold units'), body: '<p class="lead">' + esc(t('Uno por línea: nombre | temperatura máxima.', 'One per line: name | maximum temperature.')) + '</p><textarea id="rgEq" rows="6">' + esc(cur) + '</textarea><div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>'});
    $('[data-ok]', s.el).onclick = async () => {
     const list = $('#rgEq', s.el).value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(([n]) => n).slice(0, 12).map(([name, max], i) => ({id: 'c' + (i + 1), name: name.slice(0, 40), max: Number.isFinite(num(max)) ? num(max) : 4}));
     if (!list.length) return;
     await saveDoc('registro-equipos', SETUP, {list}); s.close(); repaint();
    };
   }
   if (a === 'rg-save') {
    const v = id => ($('#' + id, root)?.value || '').trim(), base = {day: dayKey(), at: now(), kind, note: v('rgNote')};
    let patch = null;
    if (kind === 'temp') {
     const values = {}; for (const inp of $$('[data-eq]', root)) { const n = num(inp.value); if (inp.value.trim() && Number.isFinite(n)) values[inp.dataset.eq] = n; }
     if (!Object.keys(values).length) { toast(t('Apunta al menos una temperatura.', 'Log at least one temperature.'), 'error'); return; }
     const alert = equipment().some(q => Number.isFinite(values[q.id]) && values[q.id] > q.max);
     if (alert && !base.note) { toast(t('Hay una temperatura fuera de límite: apunta qué has hecho.', 'A temperature is out of range: note what you did.'), 'error', 6000); $('#rgNote', root).focus(); return; }
     patch = {...base, values, alert};
    } else if (kind === 'aceite') patch = {...base, fryer: v('rgFry') || t('Freidora', 'Fryer'), action: v('rgAct'), polar: v('rgPolar') ? num(v('rgPolar')) : null};
    else { if (!v('rgProd')) { toast(t('Pon el producto.', 'Enter the product.'), 'error'); return; } patch = {...base, supplier: v('rgSup'), product: v('rgProd'), temp: v('rgTemp') ? num(v('rgTemp')) : null, lot: v('rgLot'), ok: root.querySelector('input[name=rgOk]:checked')?.value !== '0'}; }
    await saveDoc('registro', null, patch); month = dayKey().slice(0, 7); repaint(); toast(t('Registrado.', 'Logged.'));
   }
   if (a === 'rg-print') {
    const {printText} = await import('./tools-more.js');
    printText('<article class="ficha"><header class="ficha-head"><div><p class="ficha-kicker">' + esc(t('Registro de autocontrol', 'Self-check record')) + '</p><h1>' + esc((KINDS.find(x => x[0] === kind) || KINDS[0])[en() ? 2 : 1]) + '</h1><p class="ficha-meta">' + esc(new Date(month + '-15T12:00:00').toLocaleDateString(locale(), {month: 'long', year: 'numeric'})) + '</p></div></header>' + haccp.list().replace(/<button[^>]*data-rgdel[^>]*>[\s\S]*?<\/button>/g, '') + '<p class="ficha-line">' + esc(t('Firma del responsable:', 'Signed by:')) + ' ______________________</p></article>');
   }
  });
 }
};
