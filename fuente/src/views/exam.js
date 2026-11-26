// I+D · Examen de Entrenar: preguntas de verdad (escribes o dictas tu respuesta, o eliges entre cuatro) y una corrección
// que enseña: lo que has acertado, lo que te ha faltado, la respuesta buena y por qué es así. Con ChatGPT conectado corrige
// un «jefe examinador» que entiende lo que dices con tus palabras; sin él, la app compara cifras y palabras clave.
import {t, en} from '../i18n.js';
import {esc, icon} from '../ui.js';
import {entryById} from '../saber/index.js';
import {iaOn, askIa} from '../ia.js';

const plain = v => String(v || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, (m, id) => entryById(id)?.name || id);
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Por qué de cada temperatura de oficio (no tienen ficha propia de la que sacarlo).
export const TEMP_WHY = {
 'Vacuno y cordero, poco hecho': 'A 50–52 °C la proteína del músculo apenas ha empezado a contraerse: el centro sigue rojo, blando y suelta poco jugo. Tras el reposo sube 2–3 °C.',
 'Vacuno y cordero, al punto': 'Entre 54 y 57 °C la miosina ya ha cuajado y la carne se nota firme y rosada, pero la actina (que exprime el jugo) aún no: por eso sigue jugosa.',
 'Cerdo jugoso': 'El cerdo de hoy es seguro a 62–65 °C en el centro; más allá de 68 °C las fibras se contraen del todo y la pieza se seca.',
 'Aves, a corazón': 'Las aves pueden llevar salmonela en el interior: a 72–74 °C en el centro se elimina en segundos. Más bajo solo es seguro con tiempo largo controlado (baja temperatura).',
 'Pescado jugoso, nacarado': 'El colágeno del pescado es frágil y su proteína cuaja antes que la de la carne: a 45–50 °C las lascas se separan y siguen húmedas. Si se va a comer así, el pescado se congela antes por el anisakis.',
 'Crema inglesa': 'A 82–84 °C las yemas espesan la crema (napa la cuchara) sin llegar a cuajar en grumos, que empieza hacia los 85 °C.',
 'Fritura': 'Entre 170 y 180 °C el agua de la superficie se evapora de golpe y forma costra; con el aceite más frío el alimento lo absorbe, y por encima se quema el aceite y se forma más acrilamida.',
 'Mantener en caliente': 'Por encima de 65 °C las bacterias no se multiplican. Entre 5 y 65 °C está la zona de riesgo, donde hay que estar el menor tiempo posible.',
 'Mantener en frío': 'A 4 °C o menos la mayoría de las bacterias crecen muy despacio. El frío frena, pero no mata.',
 'Abatir': 'Pasar de 60 a 10 °C en menos de 2 horas acorta el paso por la zona de riesgo y evita que despierten las esporas de guisos y arroces.',
 'Regenerar, a corazón': 'Lo que se recalienta debe llegar a 70–75 °C en el centro para eliminar lo que haya crecido en la cámara.',
 'Agar: cuaja al bajar de': 'El agar se disuelve hirviendo y cuaja al enfriarse hacia 35–40 °C, pero no vuelve a fundirse hasta unos 80 °C: por eso sirve para gelatinas calientes.',
 'Gelatina: fundir sin hervir, a': 'La gelatina se funde a 60–70 °C; si hierve, pierde fuerza. Funde en el cuerpo (unos 35 °C): por eso se deshace en la boca.'
};

// ---------- Preguntas ----------
// Las proporciones y las temperaturas pueden salir de elegir entre cuatro; lo demás, siempre a desarrollar.
export function makeQuestions(list, pool) {
 return list.map(card => {
  const canTest = card.short && ['proporciones', 'temperaturas'].includes(card.cat);
  if (!canTest || Math.random() < .45) return {card, type: 'abierta'};
  const others = shuffle(pool.filter(x => x.cat === card.cat && x.short && x.id !== card.id && norm(x.short) !== norm(card.short)));
  const seen = new Set([norm(card.short)]), wrong = [];
  for (const x of others) { if (seen.has(norm(x.short))) continue; seen.add(norm(x.short)); wrong.push({text: x.short, from: x}); if (wrong.length === 3) break; }
  if (wrong.length < 3) return {card, type: 'abierta'};
  return {card, type: 'test', options: shuffle([{text: card.short, correct: true}, ...wrong])};
 });
}

// ---------- Corrección sin ChatGPT: cifras y palabras clave ----------
const STOP = new Set('para como cuando donde porque pero sino desde hasta sobre entre tras antes despues mientras tambien siempre nunca solo muy poco mucho mas menos bien cada todo toda todos todas otra otro otros otras este esta estos estas ese esa esos esas aquel cual cuales hace hacer haces tiene tienen puede pueden debe deben queda quedan sale salen pasa pasar dejar deja lleva llevar usar usa usan poner pone pon echar echa unos unas algo nada parte partes forma modo vez veces hora horas minuto minutos grado grados litro litros gramo gramos'.split(' '));
const stem = w => w.slice(0, Math.max(4, Math.min(6, w.length - 1)));
function numbers(text) {
 const out = [];
 for (const m of String(text).replace(/(\d),(\d)/g, '$1.$2').matchAll(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*(%|°\s*C|º\s*C|kg|g|ml|cl|l|h|horas?|min|minutos?|d[ií]as?|s\b)?/gi)) {
  const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : lo;
  if (!isFinite(lo)) continue;
  out.push({lo: Math.min(lo, hi), hi: Math.max(lo, hi), label: m[0].trim()});
 }
 return out;
}
function keywords(text) {
 const seen = new Set(), out = [];
 for (const w of norm(plain(text)).replace(/[^a-zñ ]+/g, ' ').split(' ')) {
  if (w.length < 4 || STOP.has(w)) continue;
  const k = stem(w);
  if (seen.has(k)) continue;
  seen.add(k); out.push({k, word: w});
 }
 return out.slice(0, 10);
}
export function localGrade(card, answer) {
 const user = String(answer || '').trim();
 const nums = numbers(card.a), words = keywords(card.a);
 if (!user) return {nota: 0, verdict: 'mal', hits: [], missing: [...nums.map(n => n.label), ...words.map(w => w.word)].slice(0, 8), local: true};
 const unums = numbers(user), ustems = new Set(keywords(user).map(w => w.k)), uwords = norm(user);
 const hits = [], missing = [];
 let got = 0, total = 0;
 for (const n of nums) {
  total += 2;
  const ok = unums.some(u => u.hi >= n.lo * .95 && u.lo <= n.hi * 1.05);
  if (ok) { got += 2; hits.push(n.label); } else missing.push(n.label);
 }
 for (const w of words) {
  total += 1;
  if (ustems.has(w.k) || uwords.includes(w.k)) { got += 1; hits.push(w.word); } else missing.push(w.word);
 }
 const nota = total ? Math.round(got / total * 10) : 5;
 return {nota, verdict: nota >= 8 ? 'bien' : nota >= 5 ? 'casi' : 'mal', hits: hits.slice(0, 8), missing: missing.slice(0, 8), local: true};
}

// El porqué, sacado de la ficha: la clave que más tiene que ver con la pregunta, o lo que es la elaboración.
export function whyFor(card) {
 if (card.cat === 'temperaturas') return TEMP_WHY[card.key] || '';
 const e = card.from ? entryById(card.from) : null;
 if (!e) return '';
 const ws = new Set(keywords(card.q + ' ' + card.a).map(w => w.k));
 const scored = (e.keys || []).map(k => [k, keywords(k).filter(w => ws.has(w.k)).length]).sort((a, b) => b[1] - a[1]);
 const key = scored[0]?.[1] ? scored[0][0] : '';
 const first = String(plain(e.what || e.summary || '')).split(/(?<=\.)\s/)[0];
 return plain([key, first].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' '));
}

// ---------- Corrección con ChatGPT ----------
export async function iaGrade(card, answer) {
 const e = card.from ? entryById(card.from) : null;
 const ctx = e ? [plain(e.summary), ...(e.keys || []).slice(0, 4).map(plain)].filter(Boolean).join(' ') : (TEMP_WHY[card.key] || '');
 const reply = await askIa({json: true,
  instructions: 'Eres un jefe de cocina con experiencia que examina a un cocinero profesional para que aprenda de verdad. Corrige con justicia: cuenta el contenido (cifras, pasos, razones), no las palabras exactas; si dice lo mismo con otras palabras, está bien. Si da una cifra fuera de lo correcto, es un fallo y lo dices. Español de España, directo, sin halagos ni relleno. Responde SOLO con JSON: {"nota": entero de 0 a 10, "veredicto": "bien" | "casi" | "mal", "aciertos": [lo que ha dicho bien, frases muy cortas], "falta": [lo que falta o está mal, frases muy cortas], "explicacion": "2 a 4 frases con la razón técnica de la respuesta correcta, para entenderla y no solo memorizarla", "truco": "una frase para recordarlo en servicio"}.',
  text: 'Pregunta: ' + card.q + '\nRespuesta correcta según la ficha: ' + card.a + (ctx ? '\nContexto de la ficha: ' + ctx : '') + '\nRespuesta del cocinero: ' + (String(answer || '').trim() || '(no sabe)')});
 let v = null;
 try { v = JSON.parse(String(reply).replace(/^```(?:json)?|```$/g, '').trim()); } catch { const m = String(reply).match(/\{[\s\S]*\}/); if (m) try { v = JSON.parse(m[0]); } catch {} }
 if (!v || typeof v !== 'object') throw new Error('respuesta');
 const nota = Math.max(0, Math.min(10, Math.round(Number(v.nota) || 0)));
 const list = x => (Array.isArray(x) ? x : []).map(String).filter(Boolean).slice(0, 6);
 return {nota, verdict: ['bien', 'casi', 'mal'].includes(v.veredicto) ? v.veredicto : nota >= 8 ? 'bien' : nota >= 5 ? 'casi' : 'mal', hits: list(v.aciertos), missing: list(v.falta), why: String(v.explicacion || ''), trick: String(v.truco || ''), local: false};
}
export const canAskIa = () => iaOn();

// ---------- Pantallas ----------
const VERDICT = {bien: [t('Bien', 'Right'), 'check'], casi: [t('Casi', 'Nearly'), 'alert'], mal: [t('Mal', 'Wrong'), 'x']};
const lines = text => esc(text).split('\n').filter(Boolean).map(l => '<p>' + l + '</p>').join('');

export function questionHtml(ex, catLabel) {
 const it = ex.list[ex.at], c = it.card;
 const head = '<p class="trmeta"><span>' + esc(t('Pregunta ', 'Question ') + (ex.at + 1) + t(' de ', ' of ') + ex.list.length) + '</span><span>' + esc(catLabel(c.cat)) + '</span></p><div class="cook-bar" aria-hidden="true"><i style="width:' + (ex.at / ex.list.length * 100).toFixed(1) + '%"></i></div><h2 class="trq">' + esc(c.q) + '</h2>';
 if (it.type === 'test') return '<article class="trcard trexam">' + head + '<p class="fine">' + esc(t('Elige la respuesta correcta.', 'Choose the correct answer.')) + '</p><div class="exopts" role="group" aria-label="' + esc(t('Respuestas posibles', 'Possible answers')) + '">' + it.options.map((o, i) => '<button type="button" class="exopt" data-opt="' + i + '"><b>' + 'ABCD'[i] + '</b><span>' + esc(o.text) + '</span></button>').join('') + '</div></article>';
 return '<article class="trcard trexam">' + head + '<form id="exForm"><label class="mini" for="exA">' + esc(t('Tu respuesta', 'Your answer')) + '</label><textarea id="exA" rows="4" maxlength="2000" data-voice placeholder="' + esc(t('Escríbela o díctala como se la explicarías a alguien de tu equipo: cifras, pasos y por qué.', 'Write or dictate it as you would explain it to someone on your team: figures, steps and why.')) + '"></textarea>' +
  '<div class="row-actions row-left"><button type="submit" class="btn primary">' + icon('check') + esc(t('Corregir', 'Mark it')) + '</button><button type="button" class="btn ghost" data-ex="skip">' + esc(t('No lo sé', 'I do not know')) + '</button></div>' +
  '<p class="fine">' + esc(canAskIa() ? t('Te corrige ChatGPT como un jefe examinador: entiende lo que dices con tus palabras.', 'ChatGPT marks it like an examining chef: it understands your own words.') : t('Sin ChatGPT, la app comprueba las cifras y palabras clave de la respuesta. Conéctalo en Ajustes para una corrección completa.', 'Without ChatGPT, the app checks the key figures and words. Connect it in Settings for a full correction.')) + '</p></form></article>';
}

export function feedbackHtml(ex, catLabel) {
 const it = ex.list[ex.at], c = it.card, r = ex.current, [vLabel, vIcon] = VERDICT[r.verdict];
 const why = r.why || whyFor(c);
 const e = c.from ? entryById(c.from) : null;
 const chips = (title, list, cls) => (list.length ? '<div class="exchips ' + cls + '"><h3>' + esc(title) + '</h3><ul>' + list.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '');
 let body = '';
 if (it.type === 'test') {
  const picked = it.options[r.picked];
  body = '<div class="exopts is-done">' + it.options.map((o, i) => '<div class="exopt' + (o.correct ? ' is-right' : i === r.picked ? ' is-wrong' : '') + '"><b>' + 'ABCD'[i] + '</b><span>' + esc(o.text) + (o.correct ? ' <em>' + esc(t('correcta', 'correct')) + '</em>' : i === r.picked ? ' <em>' + esc(t('la tuya', 'yours')) + '</em>' : '') + '</span></div>').join('') + '</div>' +
   (picked && !picked.correct && picked.from ? '<p class="exwhy-wrong">' + esc(t('La que has elegido es la de otra pregunta: «', 'The one you chose belongs to another question: “') + picked.from.q + t('».', '”.')) + '</p>' : '');
 } else {
  body = '<div class="excols"><section><h3>' + esc(t('Tu respuesta', 'Your answer')) + '</h3>' + (r.user ? lines(r.user) : '<p class="fine">' + esc(t('(sin responder)', '(no answer)')) + '</p>') + '</section><section><h3>' + esc(t('La respuesta', 'The answer')) + '</h3>' + lines(c.a) + '</section></div>' +
   chips(t('Lo que has acertado', 'What you got right'), r.hits, 'is-hit') + chips(t('Lo que te ha faltado o no es así', 'What was missing or wrong'), r.missing, 'is-miss');
 }
 return '<article class="trcard trexam exfb exfb-' + r.verdict + '"><p class="trmeta"><span>' + esc(t('Pregunta ', 'Question ') + (ex.at + 1) + t(' de ', ' of ') + ex.list.length) + '</span><span>' + esc(catLabel(c.cat)) + '</span></p>' +
  '<h2 class="trq">' + esc(c.q) + '</h2><div class="exverdict" role="status">' + icon(vIcon) + '<strong>' + esc(vLabel) + '</strong><span class="exnota">' + r.nota + '<small>/10</small></span></div>' + body +
  (why ? '<section class="exwhy"><h3>' + esc(t('Por qué', 'Why')) + '</h3><p>' + esc(why) + '</p>' + (r.trick ? '<p class="extrick"><strong>' + esc(t('Para recordarlo: ', 'To remember it: ')) + '</strong>' + esc(r.trick) + '</p>' : '') + '</section>' : '') +
  (e ? '<p><a class="more" href="#/biblioteca/' + esc(e.id) + '">' + esc(t('Leer la ficha: ', 'Read the entry: ') + e.name) + icon('right') + '</a></p>' : '') +
  (r.local && it.type !== 'test' ? '<p class="fine exfix">' + esc(t('¿La nota no es justa? Corrígela: ', 'Is the mark unfair? Fix it: ')) + '<button type="button" class="linkbtn" data-ex-grade="2">' + esc(t('La sabía', 'I knew it')) + '</button><button type="button" class="linkbtn" data-ex-grade="1">' + esc(t('Más o menos', 'Roughly')) + '</button><button type="button" class="linkbtn" data-ex-grade="0">' + esc(t('No la sabía', 'I did not know it')) + '</button></p>' : '') +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-ex="next">' + esc(ex.at + 1 < ex.list.length ? t('Siguiente pregunta', 'Next question') : t('Ver mi nota', 'See my mark')) + icon('right') + '</button></div></article>';
}

export function resultHtml(ex) {
 const n = ex.results.length, avg = n ? ex.results.reduce((a, r) => a + r.nota, 0) / n : 0;
 const fails = ex.results.filter(r => r.verdict !== 'bien');
 const count = v => ex.results.filter(r => r.verdict === v).length;
 const word = avg >= 9 ? t('Sobresaliente', 'Outstanding') : avg >= 7 ? t('Notable', 'Very good') : avg >= 5 ? t('Aprobado', 'Pass') : t('Suspenso: a repasar', 'Fail: review it');
 return '<article class="trcard exres"><h2>' + esc(t('Tu nota', 'Your mark')) + '</h2><p class="exbig">' + avg.toLocaleString(en() ? 'en' : 'es', {maximumFractionDigits: 1}) + '<small>/10</small></p><p class="lead">' + esc(word) + '</p>' +
  '<ul class="exsum"><li><strong>' + count('bien') + '</strong> ' + esc(t('bien', 'right')) + '</li><li><strong>' + count('casi') + '</strong> ' + esc(t('casi', 'nearly')) + '</li><li><strong>' + count('mal') + '</strong> ' + esc(t('mal', 'wrong')) + '</li></ul>' +
  (fails.length ? '<h3>' + esc(t('Para repasar', 'To review')) + '</h3><ol class="exfails">' + fails.map(r => { const c = ex.list.find(x => x.card.id === r.id)?.card; if (!c) return ''; const e = c.from ? entryById(c.from) : null; return '<li><strong>' + esc(c.q) + '</strong><span>' + esc(c.a.split('\n')[0]) + (c.a.includes('\n') ? '…' : '') + '</span>' + (e ? '<a class="linkbtn" href="#/biblioteca/' + esc(e.id) + '">' + esc(t('Leer la ficha', 'Read the entry')) + '</a>' : '') + '</li>'; }).join('') + '</ol><p class="fine">' + esc(t('Lo que has fallado vuelve mañana al repaso; lo que sabías, más adelante.', 'What you missed comes back tomorrow; what you knew, later on.')) + '</p>' : '<p>' + esc(t('Todo bien. Estas preguntas no vuelven hasta dentro de unos días.', 'All right. These questions will not come back for a few days.')) + '</p>') +
  '<div class="row-actions row-left">' + (fails.length ? '<button type="button" class="btn primary" data-ex="retry">' + icon('refresh') + esc(t('Repetir las falladas', 'Retry the missed ones')) + '</button>' : '') + '<button type="button" class="btn ' + (fails.length ? 'ghost' : 'primary') + '" data-ex="new">' + esc(t('Otro examen', 'Another exam')) + '</button><a class="btn ghost" href="#/hoy">' + esc(t('Hecho por hoy', 'Done for today')) + '</a></div></article>';
}
