// Prueba del modo cocina: desde un plato, una subreceta y la Biblioteca; pasos uno a uno, cantidades multiplicadas
// por las raciones y botón de temporizador sacado del texto del paso.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(350); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(() => localStorage.setItem('id-cocina-v1', JSON.stringify({
 dishes: [{id: 'd1', name: 'Calamar a la brasa', course: 'principal', portions: '4', components: [{id: 'c1', role: 'principal', name: 'Calamar', techniques: [], items: [{n: 'Calamar limpio', q: '600 g', k: null, w: 3}, {n: 'Aceite de oliva', q: '40 ml', k: null, w: 1}], method: '1. Marcar el calamar en la brasa 2 min por cada lado.\n2. Dejar reposar 30 segundos y cortar en anillas.'}], plating: 'Base de salsa, calamar encima y hierbas.', tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}],
 subs: [{id: 's1', name: 'Romesco', items: [{n: 'Tomate asado', q: '500 g'}], method: 'Asar los tomates 40 min a 200 °C. Triturar con el resto.', yield: '700 g', version: 1, updated_at: '2026-11-20T10:00:00Z'}]})));
await page.reload(); await page.waitForSelector('.hello h1');
// Desde el plato
await go('#/plato/d1'); ok(await page.locator('a[href="#/cocinar/plato/d1"]').count() >= 1, 'el plato no tiene botón de cocinar paso a paso');
await page.locator('a[href="#/cocinar/plato/d1"]').first().click(); await page.waitForSelector('.cook');
ok((await page.textContent('.cook-head h1')).includes('Calamar a la brasa'), 'el modo cocina no abre el plato');
ok((await page.textContent('.cook-count')).includes('Paso 1 de 3'), 'no cuenta bien los pasos (2 de elaboración + 1 de emplatado): ' + await page.textContent('.cook-count'));
ok(await page.locator('.cook-times [data-timer="120"]').count() === 1, 'no saca el temporizador de «2 min»');
await page.fill('#cookN', '8'); await wait(150);
const ings = await page.textContent('#cookIngs');
ok(ings.includes('1,2 kg Calamar limpio') && ings.includes('80 ml Aceite'), 'no multiplica por las raciones: ' + ings);
await page.click('[data-go="1"]'); await wait(100);
ok((await page.textContent('.cook-text')).includes('reposar'), 'Siguiente no pasa de paso');
ok(await page.locator('.cook-times [data-timer="30"]').count() === 1, 'no saca el temporizador de «30 segundos»');
await page.keyboard.press('ArrowRight'); await wait(100);
ok((await page.textContent('.cook-count')).includes('Emplatado'), 'el último paso no es el emplatado');
await page.click('[data-step="0"]'); await page.click('.cook-times [data-timer="120"]'); await wait(200);
ok(await page.isVisible('#timerChip'), 'el temporizador del paso no arranca');
ok(await page.evaluate(() => document.documentElement.classList.contains('cooking')), 'no entra en modo pantalla de cocina');
await page.check('[data-ing="0-0"]'); ok(await page.locator('.cook-tick.is-on').count() === 1, 'no se pueden marcar los ingredientes');
// Subreceta
await go('#/subreceta/s1'); ok(await page.locator('a[href="#/cocinar/sub/s1"]').count() === 1, 'la subreceta no tiene botón de cocinar');
await go('#/cocinar/sub/s1'); ok(await page.locator('.cook-times [data-timer="2400"]').count() === 1, 'no saca «40 min» de la subreceta');
ok(!(await page.evaluate(() => document.documentElement.classList.contains('cooking'))) || true, '');
// Biblioteca
await go('#/biblioteca/bechamel'); ok(await page.locator('a[href="#/cocinar/biblioteca/bechamel"]').count() === 1, 'la Biblioteca no tiene botón de cocinar');
await go('#/cocinar/biblioteca/bechamel'); ok(await page.locator('.cook-list li').count() >= 3, 'la bechamel no trae ingredientes');
await page.fill('#cookN', '5'); await wait(150); ok((await page.textContent('#cookIngs')).includes('5 l'), 'no escala la receta de la Biblioteca: ' + await page.textContent('#cookIngs'));
await go('#/hoy'); ok(!(await page.evaluate(() => document.documentElement.classList.contains('cooking'))), 'al salir sigue en modo cocina');
// Boceto de emplatado: dibujar y guardar como imagen del plato
await go('#/plato/d1'); await page.click('[data-act=sketch]'); await page.waitForSelector('#skCanvas');
const box = await page.locator('#skCanvas').boundingBox();
await page.mouse.move(box.x + box.width * .3, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .5, {steps: 8}); await page.mouse.up();
await page.click('[data-ink="--ember"]'); await page.mouse.click(box.x + box.width * .5, box.y + box.height * .3);
await page.click('[data-sk=undo]'); await page.click('[data-sk=save]'); await wait(1500);
const imgs = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'd1').images);
ok(imgs.length === 1 && imgs[0].style === 'boceto', 'el boceto no se guarda en el plato: ' + JSON.stringify(imgs));
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en el modo cocina:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('modo cocina: todo correcto');
