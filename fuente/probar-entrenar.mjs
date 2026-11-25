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
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en entrenar:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('entrenar: todo correcto');
