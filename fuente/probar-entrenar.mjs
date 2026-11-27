// Prueba de Entrenar: tarjetas sacadas de la Biblioteca, dar la vuelta, responder, que lo fallado vuelva mañana y
// lo sabido más tarde, temas, racha y aviso en la portada.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(350); };
const day = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
await page.goto(url); await page.waitForSelector('.hello h1');
ok((await page.textContent('.rail')).includes('Entrenar'), 'el menú no tiene Entrenar');
await page.click('.rail a[href="#/entrenar"]'); await page.waitForSelector('.trcard');
ok(await page.locator('[data-mode=examen].active').count() === 1 && await page.locator('.trexam').count() === 1, 'Entrenar no empieza en modo examen');
await page.click('[data-mode=rapido]'); await page.waitForSelector('[data-tr=flip]');
ok(Number((await page.textContent('.stats .stat:nth-child(2) strong')).split('/')[1]) > 300, 'hay pocas tarjetas');
ok(!(await page.isVisible('.tra')), 'la respuesta sale antes de darle la vuelta');
await page.click('[data-tr=flip]'); ok(await page.isVisible('.tra'), 'no da la vuelta a la tarjeta');
const q1 = await page.textContent('.trq');
await page.click('[data-tr="2"]'); await wait(250);
ok((await page.textContent('.trq')) !== q1, 'no pasa a la siguiente tarjeta');
await page.keyboard.press(' '); await wait(100); ok(await page.isVisible('.tra'), 'el espacio no da la vuelta');
await page.keyboard.press('1'); await wait(250);
const st = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.id === 'repaso:estado'));
const vals = Object.values(st.cards);
ok(vals.length === 2, 'no guarda las respuestas: ' + vals.length);
ok(vals.some(v => v.box === 1 && v.due === day(1)) && vals.some(v => v.box === 0 && v.due === day(1)), 'las fechas de repaso no son las esperadas: ' + JSON.stringify(vals));
ok(st.streak === 1 && st.last === day(), 'no lleva la racha');
// Temas
await page.click('[data-cat=temperaturas]'); await wait(200);
ok((await page.textContent('.trmeta')).includes('Temperaturas'), 'el tema no filtra las tarjetas');
// Lo que toca hoy sale en la portada
await page.evaluate(d => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); const s = v.docs['repaso:estado']; for (const k of Object.keys(s.cards)) s.cards[k].due = d; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); }, day());
await page.reload(); await wait(500); await go('#/hoy'); await page.waitForSelector('.craft');
ok((await page.textContent('.craft')).includes('2 tarjetas para repasar'), 'la portada no avisa de lo que hay que repasar: ' + await page.textContent('.craft'));
// Reto de la semana: sale en la portada y, al cumplirlo, sube el nivel de la técnica
const ch = await page.textContent('.craft-challenge');
ok(ch.includes('Reto de la semana'), 'la portada no propone el reto de la semana');
await page.click('[data-act=challenge-done]'); await wait(600);
const perfil = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).docs['carrera:perfil']);
ok(perfil && Object.values(perfil.skills || {}).some(v => v === 1) && Object.keys(perfil.challenges || {}).length === 1, 'cumplir el reto no sube el nivel: ' + JSON.stringify(perfil));
ok((await page.textContent('.craft-challenge')).includes('Hecho'), 'el reto no queda como hecho');
// Tus recetas: tarjetas de tus subrecetas y tus platos listos
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.subs = [{id: 's1', name: 'Romesco', items: [{n: 'Ñora', q: '6'}, {n: 'Almendra', q: '80 g'}], yield: '700 g', method: 'Asar y majar.', version: 1, updated_at: '2026-11-20T10:00:00Z'}]; v.dishes = [{id: 'd9', name: 'Calamar', status: 'carta', course: 'principal', plating: 'Romesco debajo, calamar encima.', components: [{id: 'c', role: 'principal', name: 'Calamar', techniques: [], items: [{n: 'Calamar', q: '150 g'}]}], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}]; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(500); await go('#/entrenar'); await page.click('[data-mode=rapido]'); await wait(150); await page.click('[data-cat=mias]'); await wait(200);
ok((await page.textContent('.trmeta')).includes('Tus recetas') && (await page.textContent('.trmeta')).includes('de 3'), 'no hay tarjetas de tus recetas: ' + await page.textContent('.trcard'));
// Examen de una ruta
await go('#/entrenar/ruta/salsas'); await page.waitForSelector('.tronly');
ok((await page.textContent('.tronly')).includes('Examen de la ruta'), 'el examen de la ruta no sale');
ok(await page.locator('.trq').count() === 1, 'el examen de la ruta no trae tarjetas');
// Tarjetas propias
await go('#/entrenar'); await page.waitForSelector('#trNew');
await page.fill('#trQ', '¿Temperatura del aceite para mi tempura?'); await page.fill('#trA', '175 °C'); await page.click('#trNew button[type=submit]'); await wait(400);
ok((await page.textContent('.trmine')).includes('mi tempura'), 'la tarjeta propia no se guarda');
await page.click('[data-cat=mias]'); await wait(200);
let mine = false; for (let k = 0; k < 20 && !mine; k++) { mine = (await page.textContent('#trCard')).includes('mi tempura'); if (!mine && await page.locator('[data-tr=flip]').count()) { await page.click('[data-tr=flip]'); await page.click('[data-tr="2"]'); await wait(100); } else if (!mine) break; }
ok(mine, 'la tarjeta propia no sale en el repaso');
// Dominio por tema
await go('#/entrenar'); ok(await page.locator('.tmastery li').count() >= 4, 'no sale cuánto dominas de cada tema');
// ---------- Examen ----------
const TEMPS = {'Vacuno y cordero, poco hecho': '51 °C', 'Vacuno y cordero, al punto': '55 °C', 'Cerdo jugoso': '63 °C', 'Aves, a corazón': '73 °C', 'Pescado jugoso, nacarado': '48 °C', 'Crema inglesa': '83 °C', 'Fritura': '175 °C', 'Mantener en caliente': '65 °C o más', 'Mantener en frío': '4 °C o menos', 'Abatir': 'de 60 a 10 °C en menos de 2 horas', 'Regenerar, a corazón': '72 °C', 'Agar: cuaja al bajar de': '40 °C y aguanta hasta 80 °C', 'Gelatina: fundir sin hervir, a': '65 °C'};
await page.reload(); await wait(500); await go('#/entrenar'); await page.waitForSelector('.trexam');
await page.click('[data-cat=temperaturas]'); await page.waitForSelector('.trexam .trq');
let opened = 0, tested = 0, rightOpen = 0;
for (let k = 0; k < 10; k++) {
 const q = await page.textContent('.trexam .trq');
 if (await page.locator('#exA').count()) {
  const key = Object.keys(TEMPS).find(x => q.startsWith(x));
  await page.fill('#exA', key ? TEMPS[key] : '60 °C'); await page.click('#exForm button[type=submit]'); await page.waitForSelector('.exfb');
  opened++;
  if ((await page.textContent('.exverdict')).includes('Bien')) rightOpen++;
  ok((await page.textContent('.exfb')).includes('La respuesta') && (await page.textContent('.exfb')).includes('Por qué'), 'la corrección no enseña la respuesta y el porqué');
 } else {
  await page.click('button.exopt[data-opt="0"]'); await page.waitForSelector('.exfb');
  tested++;
  ok(await page.locator('.exopt.is-right').count() === 1, 'la pregunta de elegir no marca la correcta');
 }
 await page.click('[data-ex=next]'); await wait(120);
}
ok(opened > 0 && tested >= 0, 'el examen no trae preguntas a desarrollar');
ok(rightOpen === opened, 'una respuesta correcta no sale como «Bien»: ' + rightOpen + ' de ' + opened);
await page.waitForSelector('.exres');
ok(/\d/.test(await page.textContent('.exres .exbig')), 'el examen no da nota final');
const exams = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).filter(d => d.type === 'examen'));
ok(exams.length === 1 && exams[0].n === 10, 'el examen no se guarda: ' + JSON.stringify(exams));
await page.click('[data-ex=new]'); await page.waitForSelector('.trexam .trq');
ok((await page.textContent('.exlast')).includes('Tus últimos exámenes'), 'no enseña los últimos exámenes');
// Una respuesta en blanco («No lo sé») se corrige como mal y enseña la respuesta
for (let k = 0; k < 10 && !(await page.locator('#exA').count()); k++) { await page.click('button.exopt[data-opt="0"]'); await page.click('[data-ex=next]'); await wait(80); }
if (await page.locator('#exA').count()) { await page.click('[data-ex=skip]'); await page.waitForSelector('.exfb'); ok((await page.textContent('.exverdict')).includes('Mal'), '«No lo sé» no sale como mal'); }
// Con ChatGPT: corrige el «jefe examinador»
const ctx2 = await browser.newContext({viewport: {width: 390, height: 844}}); const p2 = await ctx2.newPage();
let asked = null;
await ctx2.route('https://api.openai.com/v1/responses', r => (asked = r.request().postDataJSON(), r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify({nota: 7, veredicto: 'casi', aciertos: ['La temperatura'], falta: ['El reposo'], explicacion: 'Explicación del jefe examinador.', truco: 'Truco para recordarlo.'})}]}]})})));
await p2.goto(url); await p2.waitForSelector('.hello h1');
await p2.evaluate(() => localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', daily: false})));
await p2.reload(); await p2.waitForSelector('.hello h1'); await p2.evaluate(() => { location.hash = '#/entrenar'; }); await p2.waitForSelector('.trexam');
await p2.click('[data-cat=fallos]'); await p2.waitForSelector('#exA');
await p2.fill('#exA', 'Bajo el fuego y lo dejo reposar.'); await p2.click('#exForm button[type=submit]'); await p2.waitForSelector('.exfb');
const fb = await p2.textContent('.exfb');
ok(fb.includes('Casi') && fb.includes('7') && fb.includes('Explicación del jefe examinador') && fb.includes('Truco para recordarlo') && fb.includes('El reposo'), 'la corrección con ChatGPT no sale: ' + fb.slice(0, 200));
ok(/Respuesta del cocinero: Bajo el fuego/.test(JSON.stringify(asked || {})), 'no manda tu respuesta a ChatGPT');
ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'el examen se sale en el móvil');
await ctx2.close();
// ---------- Examen de una ruta: logro y certificado ----------
const ctx3 = await browser.newContext({viewport: {width: 1280, height: 900}}); const p3 = await ctx3.newPage();
await ctx3.route('https://api.openai.com/v1/responses', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify({nota: 10, veredicto: 'bien', aciertos: ['Todo'], falta: [], explicacion: 'Bien.', truco: 'Sigue así.'})}]}]})}));
await p3.goto(url); await p3.waitForSelector('.hello h1');
await p3.evaluate(() => localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', daily: false})));
await p3.reload(); await p3.waitForSelector('.hello h1');
let gotCert = false, sawHint = false;
for (let round = 0; round < 4 && !gotCert; round++) {
 await p3.evaluate(() => { location.hash = '#/hoy'; }); await wait(150); await p3.evaluate(() => { location.hash = '#/entrenar/ruta/salsas'; }); await p3.waitForSelector('.trexam .trq');
 for (let k = 0; k < 10; k++) {
  if (await p3.locator('#exA').count()) { await p3.fill('#exA', 'Respuesta completa.'); await p3.click('#exForm button[type=submit]'); }
  else { const n = await p3.locator('button.exopt').count(); await p3.locator('button.exopt').nth(k % Math.max(1, n)).click(); }
  await p3.waitForSelector('.exfb'); await p3.click('[data-ex=next]'); await wait(80);
  if (await p3.locator('.exres').count()) break;
 }
 await p3.waitForSelector('.exres');
 gotCert = await p3.locator('.excert').count() > 0; sawHint = sawHint || (await p3.textContent('.exres')).includes('Con un 7 o más');
}
console.log('examen de ruta: ' + (gotCert ? 'certificado' : 'sin certificado (nota baja)'));
ok(gotCert || sawHint, 'el examen de la ruta no habla del certificado');
if (gotCert) {
 const wins = await p3.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).filter(d => d.type === 'logro'));
 ok(wins.length === 1 && wins[0].route === 'salsas' && wins[0].title.includes('Ruta'), 'la ruta superada no queda en los logros: ' + JSON.stringify(wins));
 await p3.evaluate(() => { window.print = () => { window.__cert = document.getElementById('printFicha').innerText; }; });
 await p3.click('[data-ex=cert]'); await p3.waitForFunction(() => window.__cert);
 ok((await p3.evaluate(() => window.__cert)).includes('Certificado de aprendizaje'), 'el certificado no se imprime');
 await p3.evaluate(() => { location.hash = '#/trayectoria'; }); await p3.waitForSelector('[data-act=dossier]');
 await p3.evaluate(() => { window.print = () => { window.__dossier = document.getElementById('printFicha').innerText; }; });
 await p3.click('[data-act=dossier]'); await p3.waitForFunction(() => window.__dossier, null, {timeout: 8000}).catch(() => {});
 const dos = await p3.evaluate(() => window.__dossier || '');
 ok(dos.includes('Formación continua') && dos.includes('Rutas superadas'), 'el dossier no lleva tu formación en la app: ' + dos.slice(0, 200));
}
await ctx3.close();
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en entrenar:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('entrenar: todo correcto');
