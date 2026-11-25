// Prueba de Herramientas: escalar (cantidades sí, temperaturas y tiempos no), salmuera, espesantes, panadero,
// rendimiento guardado (en la copia y en lo que se sincroniza, sin borrar), conversiones y temporizadores.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true})).newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(300); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(() => localStorage.setItem('id-cocina-v1', JSON.stringify({dishes: [], subs: [{id: 's1', name: 'Romesco', items: [{n: 'Tomate asado', q: '500 g'}, {n: 'Almendra tostada', q: '80 g'}], version: 1, updated_at: '2026-11-20T10:00:00Z'}]})));
await page.reload(); await page.waitForSelector('.hello h1');
// Menú y portada de herramientas
ok((await page.textContent('.rail')).includes('Herramientas'), 'el menú no tiene Herramientas');
await page.click('.rail a[href="#/herramientas"]'); await page.waitForSelector('.ttiles');
ok(await page.locator('.ttiles .tile').count() === 10, 'no salen las 10 herramientas');
// Escalar
await go('#/herramientas/escalar');
await page.fill('#scText', '1 l de leche\n60 g de mantequilla\n1/2 cucharadita de nuez moscada\nHornear a 180 °C 25 min\nSal, c/s');
await page.fill('#scA', '4'); await page.fill('#scB', '40'); await wait(150);
const sc = await page.textContent('#scOut');
ok(sc.includes('10 l de leche'), 'escalar no multiplica los litros: ' + sc);
ok(sc.includes('600 g de mantequilla'), 'escalar no multiplica los gramos');
ok(sc.includes('180 °C') && sc.includes('25 min'), 'escalar toca temperaturas o tiempos');
ok(sc.includes('Sal, c/s'), 'escalar estropea lo que no tiene cantidad');
await page.fill('#scB', '80'); await wait(100); ok((await page.textContent('#scOut')).includes('1,2 kg de mantequilla'), 'escalar no pasa a kg');
await page.selectOption('#scSource', 's:s1'); await wait(150); ok((await page.inputValue('#scText')).includes('500 g Tomate asado'), 'no trae la subreceta');
// Salmuera
await go('#/herramientas/salmuera'); await page.fill('#brWater', '5'); await page.fill('#brPct', '10'); await wait(100);
ok((await page.textContent('#brOut')).includes('500 g'), 'salmuera al 10 % de 5 l no da 500 g');
await page.click('[data-seg=equilibrio]'); await page.fill('#brProd', '2'); await page.fill('#brWater', '2'); await page.fill('#brPct', '2'); await wait(100);
ok((await page.textContent('#brOut')).includes('80 g'), 'salmuera de equilibrio mal calculada');
// Espesantes
await go('#/herramientas/ligar'); await page.selectOption('#agSel', 'gelatina'); await page.fill('#agLiq', '0,5'); await wait(100);
ok((await page.textContent('#agOut')).includes('hojas'), 'gelatina no dice hojas');
// Panadero
await go('#/herramientas/panadero'); await page.fill('#bkFlour', '1000'); await page.fill('#bkWater', '70'); await page.fill('#bkSalt', '2'); await wait(100);
const bk = await page.textContent('#bkOut'); ok(bk.includes('700 g') && bk.includes('20 g'), 'panadero mal calculado: ' + bk);
// Rendimiento
await go('#/herramientas/rendimiento'); await page.fill('#ydName', 'Lubina en lomos'); await page.fill('#ydGross', '2'); await page.fill('#ydNet', '0,9'); await wait(100);
ok((await page.textContent('#ydOut')).includes('45 %'), 'rendimiento mal calculado');
await page.click('[data-act=save-yield]'); await wait(200);
ok((await page.textContent('#ydList')).includes('Lubina en lomos'), 'no guarda el rendimiento');
await page.click('[data-use-yield]'); await page.fill('#odPortions', '60'); await page.fill('#odEach', '150'); await wait(100);
ok((await page.textContent('#odOut')).includes('20 kg'), 'cuánto pedir mal calculado: ' + await page.textContent('#odOut'));
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).docs);
ok(Object.values(saved || {}).some(d => d.type === 'rendimiento' && d.name === 'Lubina en lomos'), 'el rendimiento no se guarda en la libreta');
await page.click('[data-del-yield]'); await wait(200);
const after = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs));
ok(after.length === 1 && after[0].deleted_at, 'quitar un rendimiento lo borra en vez de mandarlo a la papelera');
// Copia de seguridad: los documentos van dentro y al recuperarla vuelven
const dl = page.waitForEvent('download'); await page.click('.rail [data-act=menu]'); await page.click('[data-act=backup]');
const file = await (await dl).path(); const backup = JSON.parse((await import('node:fs')).readFileSync(file, 'utf8'));
ok(backup.docs && Object.keys(backup.docs).length === 1, 'la copia no lleva los documentos');
// Conversiones
await go('#/herramientas/temperaturas'); await page.fill('#cv-c', '180'); await page.dispatchEvent('#cv-c', 'input'); await wait(100);
ok((await page.inputValue('#cv-f')) === '356', 'conversión de grados mal');
// Temporizadores
await go('#/herramientas/temporizadores'); await page.fill('#tmName', 'Fondo'); await page.fill('#tmMin', '0,02'); await page.click('#tmForm button[type=submit]'); await wait(300);
ok(await page.locator('.tm').count() === 1, 'no crea el temporizador');
ok(await page.isVisible('#timerChip'), 'no sale el aviso del temporizador');
await go('#/hoy'); ok(await page.isVisible('#timerChip'), 'el aviso del temporizador desaparece al cambiar de pantalla');
await wait(1800); ok((await page.textContent('#toasts')).includes('Fondo'), 'el temporizador no avisa al acabar');
await go('#/herramientas/temporizadores'); ok(await page.locator('.tm.is-done').count() === 1, 'el temporizador no queda terminado');
await page.reload(); await page.waitForSelector('.hello, .page-head'); ok(await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-temporizadores')).length) === 1, 'los temporizadores no sobreviven a recargar');
// Móvil: Herramientas en «Más»
await page.setViewportSize({width: 390, height: 800}); await go('#/hoy'); await page.click('.top [data-act=menu]'); await page.waitForSelector('.sheet');
ok(await page.locator('.sheet a[href="#/herramientas"]').count() === 1, 'en el móvil no hay acceso a Herramientas');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en herramientas:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('herramientas: todo correcto');
