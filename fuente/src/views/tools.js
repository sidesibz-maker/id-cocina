// I+D · Herramientas: las cuentas de oficio que se hacen cada día en cocina, sin sacar la calculadora.
// Escalar una receta, salmueras, espesar y gelificar, porcentaje de panadero, temperaturas y
// conversiones, y temporizadores. Todo se calcula en este aparato; nada lleva precios.
import {t, en, locale} from '../i18n.js';
import {esc, icon, $, $$, toast} from '../ui.js';
import {state, liveSubs, liveDishes, liveDocs, saveDoc, trashDoc} from '../store.js';
import {copy} from '../ai.js';
import {timers, onTimers, addTimer, pauseTimer, restartTimer, removeTimer, left, clock} from '../timers.js';

export const title = p => (TOOLS.find(x => x.id === p?.[0])?.name() || t('Herramientas', 'Tools'));

// ---------- números ----------
export const parseNum = v => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); const m = s.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/); const n = m ? Number(m[1]) / Number(m[2]) : Number(s); return Number.isFinite(n) ? n : NaN; };
// Redondeo de cocina: nadie pesa 1.234,56 g.
export function nice(n) {
 if (!Number.isFinite(n)) return '';
 const a = Math.abs(n), r = a >= 1000 ? Math.round(n / 10) * 10 : a >= 100 ? Math.round(n) : a >= 10 ? Math.round(n * 10) / 10 : a >= 1 ? Math.round(n * 100) / 100 : Math.round(n * 1000) / 1000;
 return r.toLocaleString(locale(), {maximumFractionDigits: 3, useGrouping: false});
}
const grams = n => (n >= 1000 ? nice(n / 1000) + ' kg' : nice(n) + ' g');
const SKIP = /^\s*(°|º|grados|min\b|minutos?\b|h\b|horas?\b|%|seg\b|s\b|cm\b|mm\b|w\b)/i;
// Multiplica las cantidades de una línea («500 g de harina», «1/2 l de nata», «2-3 dientes de ajo») y deja en paz
// temperaturas, tiempos y porcentajes. Si pasa de 1000 g o ml, lo pasa a kg o l (y al revés).
export function scaleLine(line, f) {
 return String(line).replace(/(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?(\s*)(kg|gr|g|ml|cl|l)?(?![a-záéíóúñ])/gi, (all, a, b, sp, unit, at, whole) => {
  const prev = at > 0 ? whole[at - 1] : '';
  if (/[a-záéíóúñ]/i.test(prev) || SKIP.test(whole.slice(at + all.length)) || (!unit && SKIP.test(sp + whole.slice(at + all.length)))) return all;
  let n = (b ? parseNum(a) / Number(b) : parseNum(a)) * f, u = unit || '';
  if (!Number.isFinite(n)) return all;
  const low = u.toLowerCase();
  if ((low === 'g' || low === 'gr') && n >= 1000) { n /= 1000; u = 'kg'; }
  else if (low === 'kg' && n < 1) { n *= 1000; u = 'g'; }
  else if (low === 'ml' && n >= 1000) { n /= 1000; u = 'l'; }
  else if (low === 'l' && n < 1) { n *= 1000; u = 'ml'; }
  else if (low === 'cl' && n >= 100) { n /= 100; u = 'l'; }
  return nice(n) + (u ? (sp || ' ') + u : sp);
 });
}

// ---------- piezas de pantalla ----------
const field = (id, label, {value = '', unit = '', ph = '', mode = 'decimal', hint = ''} = {}) => '<div class="tfield"><label for="' + id + '">' + esc(label) + '</label><div class="tinput"><input id="' + id + '" inputmode="' + mode + '" autocomplete="off" value="' + esc(value) + '" placeholder="' + esc(ph) + '">' + (unit ? '<span>' + esc(unit) + '</span>' : '') + '</div>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</div>';
const result = rows => '<dl class="tresult">' + rows.filter(Boolean).map(([k, v, strong]) => '<div' + (strong ? ' class="is-main"' : '') + '><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
const empty = text => '<p class="tresult-empty">' + esc(text) + '</p>';
const seg = (id, options, active) => '<div class="seg" role="group" id="' + id + '">' + options.map(([v, label]) => '<button type="button" class="seg-btn' + (v === active ? ' active' : '') + '" data-seg="' + v + '" aria-pressed="' + (v === active) + '">' + esc(label) + '</button>').join('') + '</div>';
const val = (root, id) => parseNum($('#' + id, root)?.value);
const caution = () => '<p class="fine">' + icon('info') + esc(t('Son puntos de partida de oficio. Valídalos en tu cocina; en seguridad alimentaria manda tu plan APPCC.', 'These are working starting points. Validate them in your kitchen; for food safety your HACCP plan rules.')) + '</p>';

// ---------- 1. Escalar una receta ----------
const escalar = {
 html() {
  const subs = liveSubs().filter(x => x.items.length), dishes = liveDishes().filter(d => d.components.some(c => c.items.some(i => i.q)));
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('La receta', 'The recipe')) + '</h2>' +
   (subs.length || dishes.length ? '<div class="tfield"><label for="scFrom">' + esc(t('Traer de tu libreta', 'Bring from your notebook')) + '</label><select id="scSource"><option value="">' + esc(t('Escribirla o pegarla aquí', 'Type or paste it here')) + '</option>' +
    (subs.length ? '<optgroup label="' + esc(t('Subrecetas', 'Sub-recipes')) + '">' + subs.map(x => '<option value="s:' + esc(x.id) + '">' + esc(x.name) + '</option>').join('') + '</optgroup>' : '') +
    (dishes.length ? '<optgroup label="' + esc(t('Platos (cantidades por ración)', 'Dishes (quantities per portion)')) + '">' + dishes.map(d => '<option value="d:' + esc(d.id) + '">' + esc(d.name) + '</option>').join('') + '</optgroup>' : '') + '</select></div>' : '') +
   '<div class="tfield"><label for="scText">' + esc(t('Ingredientes, uno por línea', 'Ingredients, one per line')) + '</label><textarea id="scText" rows="9" placeholder="' + esc(t('1 l de leche\n60 g de mantequilla\n60 g de harina\nSal, c/s', '1 l milk\n60 g butter\n60 g flour\nSalt, to taste')) + '"></textarea></div>' +
   '<div class="tpair">' + field('scA', t('La receta es para', 'The recipe makes'), {value: '4', unit: t('raciones', 'portions')}) + field('scB', t('La quiero para', 'I want it for'), {value: '40', unit: t('raciones', 'portions')}) + '</div>' +
   '<p class="fine">' + esc(t('También vale para litros o kilos: «es para 1» y «la quiero para 2,5».', 'It also works for litres or kilos: “makes 1” and “I want 2.5”.')) + '</p></section>' +
   '<section class="card" aria-live="polite"><h2>' + esc(t('Escalada', 'Scaled')) + '</h2><div id="scOut"></div></section></div>';
 },
 calc(root) {
  const a = val(root, 'scA'), b = val(root, 'scB'), lines = $('#scText', root).value.split('\n').map(x => x.trim()).filter(Boolean), out = $('#scOut', root);
  if (!lines.length || !(a > 0) || !(b > 0)) { out.innerHTML = empty(t('Pega la receta y di para cuántas raciones es y para cuántas la quieres.', 'Paste the recipe and say how many portions it makes and how many you want.')); return; }
  const f = b / a, scaled = lines.map(l => scaleLine(l, f));
  out.innerHTML = '<p class="tfactor">' + esc(t('Multiplicado por ', 'Multiplied by ') + nice(f)) + '</p><ul class="tlist">' + scaled.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
   '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="copy-scaled">' + icon('copy') + esc(t('Copiar', 'Copy')) + '</button></div>' +
   '<p class="fine">' + esc(t('Ojo al escalar mucho: la sal, las especias, los gelificantes y los tiempos no siempre suben en la misma proporción. Prueba y ajusta.', 'Careful when scaling a lot: salt, spices, gelling agents and times do not always grow in proportion. Taste and adjust.')) + '</p>';
  out.dataset.text = scaled.join('\n');
 },
 mount(root) {
  $('#scSource', root)?.addEventListener('change', e => {
   const [kind, id] = e.target.value.split(':');
   if (kind === 's') { const x = liveSubs().find(v => v.id === id); if (x) { $('#scText', root).value = x.items.map(i => (i.q ? i.q + ' ' : '') + i.n).join('\n'); $('#scA', root).value = '1'; } }
   if (kind === 'd') { const d = liveDishes().find(v => v.id === id); if (d) { $('#scText', root).value = d.components.flatMap(c => c.items.filter(i => i.q).map(i => i.q + ' ' + i.n)).join('\n'); $('#scA', root).value = '1'; } }
   escalar.calc(root);
  });
 }
};

// ---------- 2. Salmueras y salazones ----------
const BRINES = [
 {id: 'pescado', mode: 'baño', pct: 10, es: 'Lomos de pescado antes de cocinar', en: 'Fish fillets before cooking', noteEs: '10 % durante 10 a 20 minutos según el grosor: sazona por dentro y afirma la carne.', noteEn: '10% for 10 to 20 minutes depending on thickness: seasons through and firms the flesh.'},
 {id: 'ave', mode: 'baño', pct: 6, es: 'Aves y cerdo', en: 'Poultry and pork', noteEs: '5 a 6 %, de 2 a 12 horas según el tamaño de la pieza. Seca bien antes de marcar.', noteEn: '5 to 6%, from 2 to 12 hours depending on size. Dry well before searing.'},
 {id: 'equilibrio', mode: 'equilibrio', pct: 1.8, es: 'Salmuera de equilibrio para carnes', en: 'Equilibrium brine for meats', noteEs: '1,5 a 2 % sobre el peso de la carne más el agua. No se pasa de sal aunque se quede más tiempo.', noteEn: '1.5 to 2% of the weight of meat plus water. It cannot over-salt even if left longer.'},
 {id: 'fermento', mode: 'equilibrio', pct: 2.5, es: 'Fermentar verduras', en: 'Fermenting vegetables', noteEs: '2 a 3 % sobre el peso de la verdura más el agua. Todo sumergido y sin aire.', noteEn: '2 to 3% of the weight of vegetables plus water. Everything submerged, no air.'},
 {id: 'seco', mode: 'seco', pct: 1.8, es: 'Sazonado en seco de una pieza', en: 'Dry seasoning a joint', noteEs: '1,5 a 2 % de sal sobre el peso de la pieza, repartida por igual, y reposo en frío.', noteEn: '1.5 to 2% salt of the weight of the piece, spread evenly, then rest in the cold.'}
];
let brineMode = 'baño';
const salmuera = {
 html() {
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('Qué vas a hacer', 'What you are making')) + '</h2>' +
   seg('brMode', [['baño', t('Baño de salmuera', 'Brine bath')], ['equilibrio', t('De equilibrio', 'Equilibrium')], ['seco', t('En seco', 'Dry')]], brineMode) +
   '<div id="brFields">' + salmuera.fields() + '</div>' +
   '<h3>' + esc(t('Para empezar', 'Starting points')) + '</h3><div class="chips">' + BRINES.map(b => '<button type="button" class="chip" data-brine="' + b.id + '">' + esc(en() ? b.en : b.es) + '</button>').join('') + '</div><p class="tnote" id="brNote" hidden></p></section>' +
   '<section class="card" aria-live="polite"><h2>' + esc(t('Lo que hay que pesar', 'What to weigh')) + '</h2><div id="brOut"></div>' + caution() + '</section></div>';
 },
 fields(pct = brineMode === 'baño' ? 10 : 2) {
  if (brineMode === 'baño') return '<div class="tpair">' + field('brWater', t('Agua', 'Water'), {value: '5', unit: 'l'}) + field('brPct', t('Sal', 'Salt'), {value: String(pct).replace('.', ','), unit: t('% (g por 100 ml)', '% (g per 100 ml)')}) + '</div>' + field('brSugar', t('Azúcar (opcional)', 'Sugar (optional)'), {unit: '%'});
  if (brineMode === 'equilibrio') return '<div class="tpair">' + field('brProd', t('Producto', 'Product'), {value: '2', unit: 'kg'}) + field('brWater', t('Agua', 'Water'), {value: '2', unit: 'l'}) + '</div>' + field('brPct', t('Sal que quieres al final', 'Final salt you want'), {value: String(pct).replace('.', ','), unit: '%'});
  return '<div class="tpair">' + field('brProd', t('Peso de la pieza', 'Weight of the piece'), {value: '1,5', unit: 'kg'}) + field('brPct', t('Sal', 'Salt'), {value: String(pct).replace('.', ','), unit: '%'}) + '</div>' + field('brSugar', t('Azúcar (opcional)', 'Sugar (optional)'), {unit: '%'});
 },
 calc(root) {
  const out = $('#brOut', root), pct = val(root, 'brPct'), water = val(root, 'brWater'), prod = val(root, 'brProd'), sugar = val(root, 'brSugar');
  let rows = null;
  if (brineMode === 'baño' && water > 0 && pct > 0) rows = [[t('Sal', 'Salt'), grams(water * 1000 * pct / 100), true], sugar > 0 ? [t('Azúcar', 'Sugar'), grams(water * 1000 * sugar / 100)] : null, [t('Agua', 'Water'), nice(water) + ' l']];
  if (brineMode === 'equilibrio' && prod > 0 && water >= 0 && pct > 0) rows = [[t('Sal', 'Salt'), grams((prod + water) * 1000 * pct / 100), true], [t('Sobre', 'Of'), nice(prod + water) + ' kg ' + t('de producto y agua', 'of product and water')]];
  if (brineMode === 'seco' && prod > 0 && pct > 0) rows = [[t('Sal', 'Salt'), grams(prod * 1000 * pct / 100), true], sugar > 0 ? [t('Azúcar', 'Sugar'), grams(prod * 1000 * sugar / 100)] : null];
  out.innerHTML = rows ? result(rows) : empty(t('Rellena las cantidades.', 'Fill in the quantities.'));
 },
 mount(root) {
  root.addEventListener('click', e => {
   const s = e.target.closest('#brMode [data-seg]'), b = e.target.closest('[data-brine]');
   if (s) { brineMode = s.dataset.seg; $$('#brMode .seg-btn', root).forEach(x => { const on = x === s; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); }); $('#brFields', root).innerHTML = salmuera.fields(); $('#brNote', root).hidden = true; salmuera.calc(root); }
   if (b) { const p = BRINES.find(x => x.id === b.dataset.brine); brineMode = p.mode; $$('#brMode .seg-btn', root).forEach(x => { const on = x.dataset.seg === p.mode; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); }); $('#brFields', root).innerHTML = salmuera.fields(p.pct); const n = $('#brNote', root); n.hidden = false; n.textContent = en() ? p.noteEn : p.noteEs; salmuera.calc(root); }
  });
 }
};

// ---------- 3. Espesar y gelificar ----------
// Gramos por litro de líquido, de menos a más cuerpo.
const AGENTS = [
 {id: 'roux', es: 'Roux (mantequilla y harina a partes iguales)', en: 'Roux (equal butter and flour)', uses: [['Salsa ligera, velouté', 'Light sauce, velouté', 40, 50], ['Salsa que napa, bechamel', 'Coating sauce, béchamel', 60, 70], ['Masa de croquetas', 'Croquette base', 100, 120]], es2: 'Cuece el roux unos minutos y moja con el líquido poco a poco. Dale al menos 15 minutos de cocción suave para que pierda el sabor a harina.', en2: 'Cook the roux for a few minutes and add the liquid gradually. Give it at least 15 minutes of gentle cooking to lose the floury taste.'},
 {id: 'maicena', es: 'Almidón de maíz', en: 'Cornflour (corn starch)', uses: [['Salsa ligera, jugo ligado', 'Light sauce, thickened jus', 15, 20], ['Crema espesa', 'Thick cream', 30, 40], ['Crema pastelera', 'Pastry cream', 70, 90]], es2: 'Disuelve en frío con parte del líquido y añade al hervor. Hierve un minuto para que espese del todo. Se afloja si se congela.', en2: 'Dissolve cold in part of the liquid and add at the boil. Boil for a minute to thicken fully. It loosens if frozen.'},
 {id: 'xantana', es: 'Xantana', en: 'Xanthan gum', uses: [['Dar cuerpo y estabilizar una vinagreta', 'Give body, stabilise a vinaigrette', 1, 2], ['Salsa con cuerpo, sin calor', 'Sauce with body, no heat', 3, 5], ['Textura densa, casi gel', 'Dense, almost gel', 6, 8]], es2: 'Se añade en frío o en caliente, en lluvia y con túrmix. Pesa con báscula de precisión: medio gramo de más se nota.', en2: 'Add cold or hot, sprinkled in with a stick blender. Use a precision scale: half a gram too much shows.'},
 {id: 'gelatina', es: 'Gelatina en hojas (2 g la hoja)', en: 'Leaf gelatine (2 g per leaf)', uses: [['Gel muy tierno, para cuchara', 'Very soft gel, for a spoon', 10, 12], ['Gel que se desmolda', 'Gel that unmoulds', 16, 20], ['Gel firme, para cortar', 'Firm gel, for cutting', 24, 30]], es2: 'Hidrata en agua fría 5 minutos, escurre y funde en el líquido templado (60 a 70 °C), sin hervir. Necesita unas horas de frío. La piña, el kiwi y la papaya crudos no la dejan cuajar.', en2: 'Soak in cold water for 5 minutes, drain and melt into warm liquid (60 to 70 °C), never boiling. It needs a few hours of cold. Raw pineapple, kiwi and papaya stop it setting.', leaf: 2},
 {id: 'agar', es: 'Agar-agar en polvo', en: 'Agar powder', uses: [['Gel tierno o base para gel fluido', 'Soft gel or base for a fluid gel', 2, 3], ['Gel que aguanta el corte', 'Gel that holds a cut', 5, 7], ['Gel firme y quebradizo', 'Firm, brittle gel', 8, 10]], es2: 'Mezcla en frío y hierve uno o dos minutos. Cuaja al bajar de unos 40 °C y aguanta caliente hasta unos 80 °C. Triturado en frío da un gel fluido.', en2: 'Mix cold and boil for one or two minutes. It sets below about 40 °C and holds when warm up to about 80 °C. Blended cold it gives a fluid gel.'}
];
const ligar = {
 html() {
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('Qué vas a ligar', 'What you are thickening')) + '</h2>' +
   '<div class="tfield"><label for="agSel">' + esc(t('Con qué', 'With what')) + '</label><select id="agSel">' + AGENTS.map(a => '<option value="' + a.id + '">' + esc(en() ? a.en : a.es) + '</option>').join('') + '</select></div>' +
   field('agLiq', t('Líquido', 'Liquid'), {value: '1', unit: 'l'}) + '<p class="tnote" id="agNote"></p></section>' +
   '<section class="card" aria-live="polite"><h2>' + esc(t('Cuánto poner', 'How much to use')) + '</h2><div id="agOut"></div>' + caution() + '</section></div>';
 },
 calc(root) {
  const a = AGENTS.find(x => x.id === $('#agSel', root).value) || AGENTS[0], liq = val(root, 'agLiq'), out = $('#agOut', root);
  $('#agNote', root).textContent = en() ? a.en2 : a.es2;
  if (!(liq > 0)) { out.innerHTML = empty(t('Di cuánto líquido tienes.', 'Say how much liquid you have.')); return; }
  out.innerHTML = '<table class="ktable"><thead><tr><th>' + esc(t('Para', 'For')) + '</th><th class="q">' + esc(t('Cantidad', 'Amount')) + '</th></tr></thead><tbody>' + a.uses.map(([es, eng, lo, hi]) => '<tr><td>' + esc(en() ? eng : es) + '</td><td class="q">' + esc(nice(lo * liq) + ' – ' + grams(hi * liq)) + (a.leaf ? '<small>' + esc(Math.round(lo * liq / a.leaf) + ' – ' + Math.round(hi * liq / a.leaf) + t(' hojas', ' leaves')) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table>' +
   '<p class="fine">' + esc(t('Por litro: ', 'Per litre: ') + a.uses.map(u => u[2] + '–' + u[3] + ' g').join(', ') + '.') + '</p>';
 }
};

// ---------- 4. Porcentaje de panadero ----------
let bakerFrom = 'harina';
const panadero = {
 html() {
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('La fórmula', 'The formula')) + '</h2>' + seg('bkFrom', [['harina', t('Parto de la harina', 'From the flour')], ['masa', t('Quiero un peso de masa', 'I want a dough weight')]], bakerFrom) +
   '<div id="bkBase">' + panadero.base() + '</div>' +
   '<div class="tpair">' + field('bkWater', t('Agua (hidratación)', 'Water (hydration)'), {value: '70', unit: '%'}) + field('bkSalt', t('Sal', 'Salt'), {value: '2', unit: '%'}) + '</div>' +
   '<div class="tpair">' + field('bkYeast', t('Levadura fresca', 'Fresh yeast'), {value: '1', unit: '%'}) + field('bkStarter', t('Masa madre', 'Sourdough starter'), {unit: '%'}) + '</div>' +
   '<div class="tpair">' + field('bkFat', t('Aceite o grasa', 'Oil or fat'), {unit: '%'}) + field('bkOther', t('Otros (azúcar, semillas…)', 'Others (sugar, seeds…)'), {unit: '%'}) + '</div>' +
   '<p class="fine">' + esc(t('Todos los porcentajes van sobre el peso de la harina, que es el 100 %.', 'Every percentage is over the weight of the flour, which is 100%.')) + '</p></section>' +
   '<section class="card" aria-live="polite"><h2>' + esc(t('Lo que hay que pesar', 'What to weigh')) + '</h2><div id="bkOut"></div></section></div>';
 },
 base: () => (bakerFrom === 'harina' ? field('bkFlour', t('Harina', 'Flour'), {value: '1000', unit: 'g'}) : '<div class="tpair">' + field('bkPieces', t('Piezas', 'Pieces'), {value: '10', mode: 'numeric'}) + field('bkEach', t('Peso de cada una', 'Weight of each'), {value: '250', unit: 'g'}) + '</div>'),
 calc(root) {
  const p = id => { const n = val(root, id); return n > 0 ? n : 0; }, parts = {water: p('bkWater'), salt: p('bkSalt'), yeast: p('bkYeast'), starter: p('bkStarter'), fat: p('bkFat'), other: p('bkOther')};
  const sum = 100 + Object.values(parts).reduce((a, b) => a + b, 0), out = $('#bkOut', root);
  const flour = bakerFrom === 'harina' ? val(root, 'bkFlour') : val(root, 'bkPieces') * val(root, 'bkEach') * 100 / sum;
  if (!(flour > 0)) { out.innerHTML = empty(t('Di cuánta harina o cuánta masa quieres.', 'Say how much flour or dough you want.')); return; }
  const g = pct => grams(flour * pct / 100);
  out.innerHTML = result([[t('Harina', 'Flour'), grams(flour), true], [t('Agua', 'Water'), g(parts.water)], parts.salt ? [t('Sal', 'Salt'), g(parts.salt)] : null, parts.yeast ? [t('Levadura fresca', 'Fresh yeast'), g(parts.yeast)] : null, parts.starter ? [t('Masa madre', 'Sourdough starter'), g(parts.starter)] : null, parts.fat ? [t('Aceite o grasa', 'Oil or fat'), g(parts.fat)] : null, parts.other ? [t('Otros', 'Others'), g(parts.other)] : null, [t('Masa total', 'Total dough'), grams(flour * sum / 100)]]) +
   (parts.yeast ? '<p class="fine">' + esc(t('Levadura seca: un tercio de la fresca, ', 'Dried yeast: a third of the fresh, ') + g(parts.yeast / 3) + '.') + '</p>' : '');
 },
 mount(root) {
  root.addEventListener('click', e => { const s = e.target.closest('#bkFrom [data-seg]'); if (!s) return; bakerFrom = s.dataset.seg; $$('#bkFrom .seg-btn', root).forEach(x => { const on = x === s; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); }); $('#bkBase', root).innerHTML = panadero.base(); panadero.calc(root); });
 }
};

// ---------- 5. Temperaturas y conversiones ----------
const TEMPS = [
 ['Vacuno y cordero, poco hecho', 'Beef and lamb, rare', '50–52'], ['Vacuno y cordero, al punto', 'Beef and lamb, medium', '54–57'], ['Vacuno y cordero, hecho', 'Beef and lamb, well done', '63–68'],
 ['Cerdo jugoso', 'Juicy pork', '62–65'], ['Aves, a corazón', 'Poultry, at the core', '72–74'], ['Pescado jugoso, nacarado', 'Juicy, pearly fish', '45–50'], ['Pescado cuajado', 'Fully set fish', '55–60'],
 ['Crema inglesa', 'Custard', '82–84'], ['Fritura', 'Deep frying', '170–180'], ['Caramelo rubio a oscuro', 'Light to dark caramel', '155–175']
];
const SAFE = [
 ['Mantener en frío', 'Keep cold', '4 °C o menos', '4 °C or below'], ['Mantener en caliente', 'Keep hot', '65 °C o más', '65 °C or above'], ['Regenerar, a corazón', 'Reheat, at the core', '70–75 °C', '70–75 °C'],
 ['Abatir', 'Blast chill', 'De 60 a 10 °C en menos de 2 horas', 'From 60 to 10 °C in under 2 hours'], ['Congelado', 'Frozen', '−18 °C o menos', '−18 °C or below']
];
const UNITS = [['c', '°C', 'f', '°F', v => v * 9 / 5 + 32, v => (v - 32) * 5 / 9], ['g', 'g', 'oz', 'oz', v => v / 28.3495, v => v * 28.3495], ['kg', 'kg', 'lb', 'lb', v => v * 2.20462, v => v / 2.20462], ['ml', 'ml', 'floz', 'fl oz', v => v / 29.5735, v => v * 29.5735], ['ml2', 'ml', 'cup', t('tazas (240 ml)', 'cups (240 ml)'), v => v / 240, v => v * 240], ['cm', 'cm', 'in', t('pulgadas', 'inches'), v => v / 2.54, v => v * 2.54]];
const temperaturas = {
 html() {
  return '<div class="tgrid"><section class="card"><h2>' + esc(t('Temperaturas a corazón', 'Core temperatures')) + '</h2><table class="ktable"><tbody>' + TEMPS.map(([es, eng, v]) => '<tr><td>' + esc(en() ? eng : es) + '</td><td class="q">' + esc(v) + ' °C</td></tr>').join('') + '</tbody></table>' +
   '<h3>' + esc(t('Seguridad', 'Safety')) + '</h3><table class="ktable"><tbody>' + SAFE.map(([es, eng, v, ven]) => '<tr><td>' + esc(en() ? eng : es) + '</td><td class="q tq-wrap">' + esc(en() ? ven : v) + '</td></tr>').join('') + '</tbody></table>' + caution() + '</section>' +
   '<section class="card"><h2>' + esc(t('Conversiones', 'Conversions')) + '</h2><p class="hint">' + esc(t('Escribe en cualquiera de los dos lados.', 'Type on either side.')) + '</p>' +
   UNITS.map(([a, la, b, lb]) => '<div class="tconv"><div class="tinput"><input id="cv-' + a + '" data-cv="' + a + '" inputmode="decimal" autocomplete="off" aria-label="' + esc(la) + '"><span>' + esc(la) + '</span></div><i aria-hidden="true">=</i><div class="tinput"><input id="cv-' + b + '" data-cv="' + b + '" inputmode="decimal" autocomplete="off" aria-label="' + esc(lb) + '"><span>' + esc(lb) + '</span></div></div>').join('') +
   '<p class="fine">' + esc(t('Cucharada: 15 ml. Cucharadita: 5 ml. Una libra: 454 g. Una onza: 28 g.', 'Tablespoon: 15 ml. Teaspoon: 5 ml. A pound: 454 g. An ounce: 28 g.')) + '</p></section></div>';
 },
 calc(root, e) {
  const el = e?.target?.closest?.('[data-cv]');
  if (!el) return;
  const row = UNITS.find(u => u[0] === el.dataset.cv || u[2] === el.dataset.cv), fromA = row[0] === el.dataset.cv, n = parseNum(el.value), other = $('#cv-' + (fromA ? row[2] : row[0]), root);
  other.value = Number.isFinite(n) && el.value.trim() ? nice((fromA ? row[4] : row[5])(n)) : '';
 }
};

// ---------- 7. Temporizadores ----------
const temporizadores = {
 html() {
  return '<section class="card"><h2>' + esc(t('Nuevo temporizador', 'New timer')) + '</h2><form id="tmForm" class="tmform"><div class="tfield"><label for="tmName">' + esc(t('Para qué', 'What for')) + '</label><input id="tmName" maxlength="60" autocomplete="off" placeholder="' + esc(t('p. ej. Fondo oscuro, pan, reposo de la carne', 'e.g. Brown stock, bread, resting the meat')) + '"></div>' +
   field('tmMin', t('Minutos', 'Minutes'), {value: '10', unit: 'min'}) + '<button type="submit" class="btn primary">' + icon('clock') + esc(t('Empezar', 'Start')) + '</button></form>' +
   '<div class="chips">' + [1, 3, 5, 8, 12, 20, 30, 45, 60, 90].map(m => '<button type="button" class="chip" data-quick="' + m + '">' + m + ' min</button>').join('') + '</div></section>' +
   '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('En marcha', 'Running')) + '</h2><p>' + esc(t('Siguen contando aunque cambies de pantalla. Para que suenen, deja la app abierta.', 'They keep counting when you change screen. For the sound, keep the app open.')) + '</p></div></header><div id="tmList">' + temporizadores.list() + '</div></section>';
 },
 list() {
  const all = timers().sort((a, b) => (a.done - b.done) || left(a) - left(b));
  return all.length ? '<ul class="tmlist">' + all.map(x => { const s = left(x), pct = x.done ? 100 : Math.max(0, Math.min(100, 100 - s / x.total * 100)); return '<li class="tm' + (x.done ? ' is-done' : x.paused != null ? ' is-paused' : '') + '" data-tm="' + esc(x.id) + '"><div class="tm-main"><strong>' + esc(x.name) + '</strong><span class="tm-clock">' + (x.done ? esc(t('Terminado', 'Done')) : clock(s)) + '</span></div><div class="tm-bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></div><div class="tm-acts">' +
   (x.done ? '' : '<button type="button" class="btn ghost" data-tm-act="pause">' + esc(x.paused != null ? t('Seguir', 'Resume') : t('Pausa', 'Pause')) + '</button>') + '<button type="button" class="btn ghost" data-tm-act="restart">' + icon('refresh') + esc(t('Otra vez', 'Again')) + '</button><button type="button" class="iconbtn" data-tm-act="remove" aria-label="' + esc(t('Quitar ', 'Remove ') + x.name) + '">' + icon('x') + '</button></div></li>'; }).join('') + '</ul>' : '<p class="tresult-empty">' + esc(t('No hay ninguno en marcha.', 'None running.')) + '</p>';
 },
 calc() {},
 mount(root) {
  const paint = light => {
   const host = $('#tmList', root); if (!host) return;
   if (light === true) { for (const x of timers()) { const li = host.querySelector('[data-tm="' + CSS.escape(x.id) + '"]'); if (!li || x.done) continue; li.querySelector('.tm-clock').textContent = clock(left(x)); li.querySelector('.tm-bar i').style.width = Math.max(0, Math.min(100, 100 - left(x) / x.total * 100)).toFixed(1) + '%'; } return; }
   host.innerHTML = temporizadores.list();
  };
  const off = onTimers(paint);
  const start = () => { const m = val(root, 'tmMin'); if (!(m > 0)) { toast(t('Pon los minutos.', 'Enter the minutes.'), 'error'); return; } addTimer($('#tmName', root).value, m * 60); $('#tmName', root).value = ''; };
  root.addEventListener('submit', e => { if (e.target.id !== 'tmForm') return; e.preventDefault(); start(); });
  root.addEventListener('click', e => {
   const q = e.target.closest('[data-quick]'), act = e.target.closest('[data-tm-act]');
   if (q) { $('#tmMin', root).value = q.dataset.quick; start(); }
   if (act) { const id = act.closest('[data-tm]').dataset.tm; if (act.dataset.tmAct === 'pause') pauseTimer(id); if (act.dataset.tmAct === 'restart') restartTimer(id); if (act.dataset.tmAct === 'remove') removeTimer(id); }
  });
  return off;
 }
};

const TOOLS = [
 {id: 'escalar', ic: 'refresh', name: () => t('Escalar una receta', 'Scale a recipe'), sub: () => t('De 4 raciones a 60 sin hacer cuentas', 'From 4 portions to 60 without the maths'), tool: escalar},
 {id: 'temporizadores', ic: 'clock', name: () => t('Temporizadores', 'Timers'), sub: () => t('Varios a la vez, con nombre', 'Several at once, with a name'), tool: temporizadores},
 {id: 'salmuera', ic: 'drop', name: () => t('Salmueras y salazones', 'Brines and dry salting'), sub: () => t('La sal justa para baño, equilibrio o en seco', 'The right salt for a bath, equilibrium or dry'), tool: salmuera},
 {id: 'ligar', ic: 'spark', name: () => t('Espesar y gelificar', 'Thicken and set'), sub: () => t('Roux, almidón, xantana, gelatina y agar', 'Roux, starch, xanthan, gelatine and agar'), tool: ligar},
 {id: 'panadero', ic: 'wheel', name: () => t('Porcentaje de panadero', 'Baker\'s percentage'), sub: () => t('Masas por hidratación y peso de pieza', 'Doughs by hydration and piece weight'), tool: panadero},
 {id: 'temperaturas', ic: 'flame', name: () => t('Temperaturas y conversiones', 'Temperatures and conversions'), sub: () => t('Puntos a corazón, seguridad y unidades', 'Core temperatures, safety and units'), tool: temperaturas}
];
export const toolList = () => TOOLS.map(x => ({id: x.id, ic: x.ic, name: x.name(), sub: x.sub()}));

export function render(params) {
 const cur = TOOLS.find(x => x.id === params[0]);
 if (!cur) {
  const running = timers().filter(x => !x.done).length;
  return '<header class="page-head"><h1>' + esc(t('Herramientas', 'Tools')) + '</h1><p>' + esc(t('Las cuentas de cocina, hechas: escribe lo que tienes y te digo lo que hay que pesar.', 'Kitchen sums, done: type what you have and I tell you what to weigh.')) + '</p></header>' +
   '<div class="tiles ttiles">' + TOOLS.map(x => '<a class="tile tile-big" href="#/herramientas/' + x.id + '">' + icon(x.ic) + '<strong>' + esc(x.name()) + '</strong><span>' + esc(x.id === 'temporizadores' && running ? (running === 1 ? t('1 en marcha', '1 running') : running + t(' en marcha', ' running')) : x.sub()) + '</span></a>').join('') + '</div>';
 }
 return '<a class="back" href="#/herramientas">' + icon('left') + esc(t('Herramientas', 'Tools')) + '</a><header class="page-head"><h1>' + esc(cur.name()) + '</h1><p>' + esc(cur.sub()) + '.</p></header><div class="tool tool-' + cur.id + '">' + cur.tool.html() + '</div>';
}
export function mount(root, params) {
 const cur = TOOLS.find(x => x.id === params[0]);
 if (!cur) return null;
 const run = e => cur.tool.calc(root, e);
 root.addEventListener('input', run);
 root.addEventListener('change', run);
 root.addEventListener('click', async e => {
  if (!e.target.closest('[data-act=copy-scaled]')) return;
  const done = await copy($('#scOut', root).dataset.text || '');
  toast(done ? t('Copiada.', 'Copied.') : t('No se pudo copiar.', 'It could not be copied.'), done ? 'info' : 'error');
 });
 const off = cur.tool.mount?.(root) || null;
 cur.tool.calc(root);
 return off;
}
// Los datos que llegan (sincronización) no deben borrar lo que se está escribiendo en una calculadora.
export function onData() {}
export {state};
