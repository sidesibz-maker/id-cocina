// I+D · Mise en place por partidas: la lista de cada día de cada partida (brasa, frío, postres…). La plantilla se escribe
// una vez; cada día empieza limpia, se marca lo hecho y se ve quién va retrasado. Lo de cada día queda guardado.
// Documentos «mep:plantilla» y «mep:AAAA-MM-DD» (copia y sincronización).
import {t, dayKey, longDate} from '../i18n.js';
import {esc, icon, $, $$, toast, sheet} from '../ui.js';
import {docById, saveDoc} from '../store.js';

const TPL = 'mep:plantilla';
const DEFAULT = () => [
 {name: t('Brasa', 'Grill'), items: [t('Encender y preparar la brasa', 'Light and prepare the grill'), t('Racionar y atemperar las carnes', 'Portion and temper the meats'), t('Sal en escamas y aceite en el pase', 'Flaky salt and oil at the pass')]},
 {name: t('Frío', 'Cold'), items: [t('Aliños y vinagretas', 'Dressings and vinaigrettes'), t('Hierbas limpias y secas', 'Herbs washed and dried'), t('Encurtidos y fermentos a punto', 'Pickles and ferments ready')]},
 {name: t('Postres', 'Pastry'), items: [t('Cremas en manga', 'Creams in piping bags'), t('Crujientes y tejas', 'Crisps and tuiles')]}
];
const template = () => docById(TPL)?.stations || DEFAULT();
const keyOf = (s, i) => s + '|' + i;
let day = dayKey();
const today = () => docById('mep:' + day) || {done: {}, extra: {}};

export const mep = {
 html() {
  const st = template(), d = today(), extra = d.extra || {};
  const total = st.reduce((n, s) => n + s.items.length + (extra[s.name] || []).length, 0), done = Object.values(d.done || {}).filter(Boolean).length;
  return '<div class="mephead"><div class="tfield"><label for="mepDay">' + esc(t('Día', 'Day')) + '</label><input id="mepDay" type="date" value="' + day + '"></div><p class="mepcount"><strong>' + done + ' / ' + total + '</strong> ' + esc(t('tareas hechas', 'tasks done')) + '</p>' +
   '<div class="row-actions"><button type="button" class="btn ghost" data-act="mep-edit">' + icon('edit') + esc(t('Editar las partidas', 'Edit the sections')) + '</button><button type="button" class="btn ghost" data-act="mep-print">' + icon('down') + esc(t('Imprimir', 'Print')) + '</button></div></div>' +
   '<div class="cook-bar" aria-hidden="true"><i style="width:' + (total ? done / total * 100 : 0).toFixed(1) + '%"></i></div>' +
   '<div class="mepgrid">' + st.map(s => {
    const items = [...s.items.map((x, i) => ({x, k: keyOf(s.name, i)})), ...(extra[s.name] || []).map((x, i) => ({x, k: keyOf(s.name, 'e' + i)}))];
    const n = items.filter(i => d.done?.[i.k]).length;
    return '<section class="mepst' + (n === items.length && items.length ? ' is-done' : '') + '"><header><h2>' + esc(s.name) + '</h2><span class="count">' + n + '/' + items.length + '</span></header><ul>' +
     items.map(i => '<li><label class="cook-tick' + (d.done?.[i.k] ? ' is-on' : '') + '"><input type="checkbox" data-mk="' + esc(i.k) + '"' + (d.done?.[i.k] ? ' checked' : '') + '><span>' + esc(i.x) + '</span></label></li>').join('') + '</ul>' +
     '<form class="mepadd" data-st="' + esc(s.name) + '"><label class="sr" for="mepAdd-' + esc(s.name) + '">' + esc(t('Añadir solo para hoy', 'Add for today only')) + '</label><input id="mepAdd-' + esc(s.name) + '" maxlength="120" autocomplete="off" placeholder="' + esc(t('Añadir solo para hoy…', 'Add for today only…')) + '"><button type="submit" class="iconbtn" aria-label="' + esc(t('Añadir', 'Add')) + '">' + icon('plus') + '</button></form></section>';
   }).join('') + '</div>';
 },
 calc() {},
 mount(root) {
  const repaint = () => { const box = root.querySelector('.tool-mise'); if (box) box.innerHTML = mep.html(); };
  root.addEventListener('change', async e => {
   if (e.target.id === 'mepDay') { day = e.target.value || dayKey(); repaint(); return; }
   const c = e.target.closest('[data-mk]'); if (!c) return;
   const d = today();
   await saveDoc('mep', 'mep:' + day, {day, done: {...(d.done || {}), [c.dataset.mk]: c.checked}, extra: d.extra || {}});
   repaint();
  });
  root.addEventListener('submit', async e => {
   const f = e.target.closest('.mepadd'); if (!f) return;
   e.preventDefault();
   const v = f.querySelector('input').value.trim(); if (!v) return;
   const d = today(), extra = {...(d.extra || {})}; extra[f.dataset.st] = [...(extra[f.dataset.st] || []), v.slice(0, 120)];
   await saveDoc('mep', 'mep:' + day, {day, done: d.done || {}, extra}); repaint();
  });
  root.addEventListener('click', async e => {
   const a = e.target.closest('[data-act]')?.dataset.act;
   if (a === 'mep-edit') {
    const text = template().map(s => '# ' + s.name + '\n' + s.items.join('\n')).join('\n\n');
    const s = sheet({title: t('Partidas y tareas', 'Sections and tasks'), wide: true, body: '<p class="lead">' + esc(t('Cada partida empieza con «#» y su nombre; debajo, una tarea por línea. Es la lista que sale cada día.', 'Each section starts with “#” and its name; below it, one task per line. This is the list you get every day.')) + '</p><textarea id="mepTpl" rows="14">' + esc(text) + '</textarea><div class="row-actions"><button type="button" class="btn primary" data-ok>' + icon('check') + esc(t('Guardar', 'Save')) + '</button></div>'});
    $('[data-ok]', s.el).onclick = async () => {
     const stations = []; let cur = null;
     for (const raw of $('#mepTpl', s.el).value.split('\n')) { const l = raw.trim(); if (!l) continue; if (l.startsWith('#')) { cur = {name: l.replace(/^#+\s*/, '').slice(0, 40) || t('Partida', 'Section'), items: []}; stations.push(cur); } else { if (!cur) { cur = {name: t('General', 'General'), items: []}; stations.push(cur); } cur.items.push(l.slice(0, 120)); } }
     if (!stations.length) { toast(t('Escribe al menos una partida.', 'Write at least one section.'), 'error'); return; }
     await saveDoc('mep-plantilla', TPL, {stations: stations.slice(0, 12)}); s.close(); repaint(); toast(t('Partidas guardadas.', 'Sections saved.'));
    };
   }
   if (a === 'mep-print') {
    const {printText} = await import('./tools-more.js'), d = today(), extra = d.extra || {};
    printText('<article class="ficha"><header class="ficha-head"><div><p class="ficha-kicker">' + esc(t('Mise en place', 'Mise en place')) + '</p><h1>' + esc(longDate(day)) + '</h1></div></header>' + template().map(s => '<section class="ficha-comp"><h2>' + esc(s.name) + '</h2><ul class="mepprint">' + [...s.items, ...(extra[s.name] || [])].map(x => '<li>☐ ' + esc(x) + '</li>').join('') + '</ul></section>').join('') + '</article>');
   }
  });
 }
};
