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
// Reto de la semana: sale en la portada y, al cumplirlo, sube el nivel de la técnica
const ch = await page.textContent('.craft-challenge');
ok(ch.includes('Reto de la semana'), 'la portada no propone el reto de la semana');
await page.click('[data-act=challenge-done]'); await wait(600);
const perfil = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).docs['carrera:perfil']);
ok(perfil && Object.values(perfil.skills || {}).some(v => v === 1) && Object.keys(perfil.challenges || {}).length === 1, 'cumplir el reto no sube el nivel: ' + JSON.stringify(perfil));
ok((await page.textContent('.craft-challenge')).includes('Hecho'), 'el reto no queda como hecho');
// Tus recetas: tarjetas de tus subrecetas y tus platos listos
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.subs = [{id: 's1', name: 'Romesco', items: [{n: 'Ñora', q: '6'}, {n: 'Almendra', q: '80 g'}], yield: '700 g', method: 'Asar y majar.', version: 1, updated_at: '2026-11-20T10:00:00Z'}]; v.dishes = [{id: 'd9', name: 'Calamar', status: 'carta', course: 'principal', plating: 'Romesco debajo, calamar encima.', components: [{id: 'c', role: 'principal', name: 'Calamar', techniques: [], items: [{n: 'Calamar', q: '150 g'}]}], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}]; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(500); await go('#/entrenar'); await page.click('[data-cat=mias]'); await wait(200);
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
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en entrenar:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('entrenar: todo correcto');
