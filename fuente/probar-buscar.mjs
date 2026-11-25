// Prueba del buscador general (Ctrl+K), de «Producción y pedido» y de las etiquetas de conservación.
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
 dishes: [
  {id: 'd1', name: 'Calamar a la brasa', course: 'principal', status: 'carta', components: [{id: 'c1', role: 'principal', name: 'Calamar', techniques: ['brasa'], items: [{n: 'Calamar', q: '150 g', k: null, w: 3}, {n: 'Romesco', q: '40 g', ref: 's1', src: 'recipe', w: 2}, {n: 'Sal en escamas', k: null, w: 1}]}], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'},
  {id: 'd2', name: 'Gamba roja cruda', course: 'picar', status: 'carta', components: [{id: 'c2', role: 'principal', name: '', techniques: [], items: [{n: 'Gamba roja', q: '2 ud', k: null, w: 3}, {n: 'Calamar', q: '0,05 kg', k: null, w: 1}]}], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}],
 subs: [{id: 's1', name: 'Romesco', items: [{n: 'Tomate', q: '500 g'}], yield: '1 kg', version: 1, updated_at: '2026-11-20T10:00:00Z'}],
 menus: [{id: 'm1', name: 'Menú brasa', kind: 'degustacion', items: [{dish_id: 'd1'}, {dish_id: 'd2'}], version: 1, updated_at: '2026-11-20T10:00:00Z'}],
 docs: {'rendimiento:1': {id: 'rendimiento:1', type: 'rendimiento', name: 'Calamar limpio', gross: 2, net: 1.5, pct: 75, updated_at: '2026-11-20T10:00:00Z'},
  'diario:1': {id: 'diario:1', type: 'diario', day: '2026-11-24', service: 'cena', learned: 'Atemperar el pulpo antes de la brasa', updated_at: '2026-11-24T23:00:00Z'}}})));
await page.reload(); await page.waitForSelector('.hello h1'); await wait(500);
// Buscador
await page.keyboard.press('Control+k'); await page.waitForSelector('#finderQ');
await page.fill('#finderQ', 'calamar'); await wait(150);
ok((await page.textContent('#finderRes')).includes('Calamar a la brasa'), 'el buscador no encuentra el plato');
await page.fill('#finderQ', 'romesco'); await wait(150);
ok((await page.textContent('#finderRes')).includes('Subrecetas'), 'el buscador no encuentra la subreceta');
await page.fill('#finderQ', 'bechamel'); await wait(150);
ok((await page.textContent('#finderRes')).includes('Biblioteca'), 'el buscador no busca en la Biblioteca');
await page.fill('#finderQ', 'pulpo'); await wait(150);
ok((await page.textContent('#finderRes')).includes('Diario'), 'el buscador no busca en el diario');
await page.fill('#finderQ', 'salmuera'); await wait(150);
ok((await page.textContent('#finderRes')).includes('Salmueras'), 'el buscador no encuentra herramientas');
await page.fill('#finderQ', 'calamar a la'); await page.keyboard.press('Enter'); await wait(400);
ok(await page.evaluate(() => location.hash) === '#/plato/d1', 'Intro no abre el primer resultado: ' + await page.evaluate(() => location.hash));
ok(!(await page.isVisible('#finderQ')), 'el buscador no se cierra al abrir');
await page.click('.rail [data-act=finder]'); await page.waitForSelector('#finderQ'); await page.keyboard.press('Escape'); await wait(300);
ok(!(await page.isVisible('#finderQ')), 'Esc no cierra el buscador');
// Producción
await go('#/herramientas'); ok(await page.locator('.ttiles .tile').count() === 11, 'no salen las 11 herramientas');
await go('#/herramientas/produccion'); await page.fill('#prCovers', '40'); await page.dispatchEvent('#prCovers', 'input'); await wait(200);
const pr = await page.textContent('#prOut');
// Calamar: 150 g × 40 + 50 g × 40 = 8 kg limpio; con rendimiento del 75 % → 10,7 kg en bruto
ok(pr.includes('10,7 kg'), 'el pedido no suma el calamar de los dos platos con tu rendimiento: ' + pr.slice(0, 300));
ok(pr.includes('80 ud'), 'no cuenta las unidades de gamba');
ok(pr.includes('1,6 kg') && pr.includes('1,6 tandas'), 'no calcula la subreceta y sus tandas');
ok(pr.includes('Sal en escamas') && pr.includes('c/s'), 'lo que no tiene cantidad no sale aparte');
// Etiquetas
await go('#/herramientas/etiquetas'); await page.fill('#lbName', 'Romesco'); await page.fill('#lbDay', '2026-11-25'); await page.click('[data-life="5"]'); await page.click('.lballerg label:has-text("Frutos de cáscara")'); await page.dispatchEvent('#lbName', 'input'); await wait(150);
const lb = await page.textContent('#lbOut');
ok(lb.includes('Romesco') && lb.includes('30/11/26') && lb.includes('Frutos de cáscara'), 'la etiqueta no sale bien: ' + lb);
await page.evaluate(() => { window.print = () => { window.__n = document.querySelectorAll('#printFicha .lbl').length; }; });
await page.fill('#lbCount', '9'); await page.click('[data-act=lb-print]'); await wait(300);
ok(await page.evaluate(() => window.__n) === 9, 'no imprime las etiquetas pedidas');
// Proveedores: alta, búsqueda y pedido agrupado por proveedor
await go('#/cocina'); ok(await page.locator('a[href="#/proveedores"]').count() >= 1, 'Mi cocina no lleva a los proveedores');
await go('#/proveedores'); await page.click('[data-act=new]'); await page.waitForSelector('#spform');
await page.fill('#sp-name', 'Pescados Juan'); await page.selectOption('#sp-kind', 'pescado'); await page.fill('#sp-products', 'calamar, gamba roja'); await page.fill('#sp-phone', '+34 600 111 222');
await page.click('.sprate label:nth-child(5)'); await page.click('#spform button[type=submit]'); await wait(500);
ok((await page.textContent('.spcards')).includes('Pescados Juan') && await page.locator('a[href^="tel:"]').count() === 1, 'no guarda el proveedor');
await page.fill('#spq', 'gamba'); await wait(100); ok(await page.locator('.spcard:not([hidden])').count() === 1, 'no busca por producto');
await go('#/herramientas/produccion'); await page.fill('#prCovers', '40'); await page.dispatchEvent('#prCovers', 'input'); await wait(200);
const grouped = await page.textContent('#prOut');
ok(grouped.includes('Pescados Juan') && grouped.includes('Mandar por WhatsApp'), 'el pedido no se agrupa por proveedor: ' + grouped.slice(0, 200));
await page.keyboard.press('Control+k'); await page.fill('#finderQ', 'pescados juan'); await wait(150); ok((await page.textContent('#finderRes')).includes('Proveedores'), 'el buscador no encuentra proveedores'); await page.keyboard.press('Escape');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en buscador, producción y etiquetas:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('buscador, producción y etiquetas: todo correcto');
