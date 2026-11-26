// Prueba de los primeros pasos de la portada, el recetario, las pruebas de cata y los alérgenos del plato.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(350); };
await page.goto(url); await page.waitForSelector('.hello h1'); await wait(400);
// Primeros pasos con la app vacía
ok(await page.locator('.steps-grid li').count() === 6, 'la portada vacía no enseña los primeros pasos');
ok(await page.locator('.steps-grid li.is-done').count() === 0, 'hay pasos marcados sin hacer nada');
await page.click('.steps-grid [data-open=sync]'); await page.waitForSelector('.sheet'); ok((await page.textContent('.sheet')).includes('Sincronizar'), 'el paso de sincronizar no abre su ventana');
await page.click('.sheet-head [data-close]'); await wait(300);
await page.evaluate(() => localStorage.setItem('id-cocina-v1', JSON.stringify({dishes: [{id: 'd1', name: 'Calamar a la brasa', concept: 'Mar y huerto', course: 'principal', status: 'carta', advice: {allergens: ['moluscos', 'frutos_cascara']}, components: [], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}], settings: {equipment: ['josper']}})));
await page.reload(); await page.waitForSelector('.steps-grid'); await wait(300);
ok(await page.locator('.steps-grid li.is-done').count() === 2, 'los pasos hechos no se marcan solos');
await page.click('[data-act=hide-steps]'); await wait(200); await page.reload(); await page.waitForSelector('.hello h1'); await wait(300);
ok(await page.locator('.steps-grid').count() === 0, 'ocultar los primeros pasos no se recuerda');
// Mi recetario: portada, índice y una ficha por plato
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.dishes.push({id: 'd2', name: 'Arroz de brasa', status: 'lista', course: 'principal', components: [{id: 'c', role: 'principal', name: 'Arroz', techniques: [], items: [{n: 'Arroz bomba', q: '80 g'}], method: 'Sofreír y mojar.'}], tests: [], images: [], version: 1, updated_at: '2026-11-21T10:00:00Z'}, {id: 'd3', name: 'Idea suelta', status: 'idea', components: [], tests: [], images: [], version: 1}); localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(500); await go('#/libreta'); await page.evaluate(() => { window.print = () => { window.__book = document.getElementById('printFicha').innerText; window.__pages = document.querySelectorAll('#printFicha .book-page').length; }; });
await page.click('[data-act=book]'); await page.waitForSelector('.sheet [data-ok]'); await page.click('.sheet [data-ok]'); await wait(1200);
const book = await page.evaluate(() => window.__book || '');
ok(await page.evaluate(() => window.__pages) === 2, 'el recetario no lleva solo los platos en carta y listos');
ok(book.includes('Índice') && book.includes('Arroz bomba') && book.includes('Sofreír y mojar') && !book.includes('Idea suelta'), 'el recetario no lleva índice o fichas completas');
// Pruebas de cata: evolución de la nota y lo pendiente para la próxima vez
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.dishes[0].tests = [{id: 't1', at: '2026-11-01', rating: 2, text: 'Seco', next: ''}, {id: 't2', at: '2026-11-10', rating: 3, text: 'Mejor', next: ''}, {id: 't3', at: '2026-11-20', rating: 4, text: 'Casi', next: 'Menos sal en el ajoblanco'}]; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(500); await go('#/plato/d1'); await wait(400);
ok(await page.locator('.test-trend circle').count() === 3 && (await page.textContent('.test-trend')).includes('va a mejor'), 'no enseña la evolución de las pruebas');
ok((await page.textContent('.test-pending')).includes('Menos sal en el ajoblanco'), 'no recuerda lo apuntado para la próxima vez');
// Biblioteca: estantes nuevos
await go('#/biblioteca'); ok(await page.locator('.kshelf[href="#/biblioteca/estante/dulce"]').count() === 1 && await page.locator('.kshelf[href="#/biblioteca/estante/tecnicas"]').count() === 1, 'faltan los estantes nuevos de la Biblioteca');
await go('#/biblioteca/crema-inglesa'); ok((await page.textContent('.kentry')).includes('82'), 'no abre la crema inglesa');
// Alérgenos confirmados en el plato y tabla de la carta
await go('#/plato/d1'); await wait(300);
ok((await page.textContent('.dalg')).includes('La IA cree que lleva'), 'el plato no propone los alérgenos de la IA');
await page.click('[data-act=alg-hint]'); await wait(300);
await page.click('.dalg label:has-text("Gluten")'); await wait(1500);
const alg = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'd1').allergens);
ok(JSON.stringify(alg && [...alg].sort()) === JSON.stringify(['frutos_cascara', 'gluten', 'moluscos']), 'no guarda los alérgenos confirmados: ' + JSON.stringify(alg));
await go('#/menus'); ok(await page.locator('[data-act=alg-table]').count() === 0, 'sigue la tabla de alérgenos de sala');
// Catálogo general: numerado por orden de creación, por temporadas, filtro e impresión
await go('#/libreta'); await page.click('a[href="#/catalogo"]'); await page.waitForSelector('.catgrid');
ok(await page.locator('.catcard').count() === 3, 'el catálogo no tiene todos los platos');
ok((await page.locator('.catnum').allTextContents()).sort().join(',') === '001,002,003', 'los números del catálogo no van seguidos');
await page.selectOption('#catFilter', 'carta'); await wait(200); ok(await page.locator('.catcard').count() === 1, 'el filtro por estado no funciona');
await page.click('[data-mode=lista]'); await wait(200); ok(await page.locator('.catseason').count() === 0, 'la lista completa sigue separada por temporadas');
await page.evaluate(() => { window.print = () => { window.__cat = document.getElementById('printFicha').innerText; }; }); await page.click('[data-act=cat-print]'); await wait(300);
ok((await page.evaluate(() => window.__cat || '')).includes('Catálogo general'), 'no imprime el catálogo');
await page.selectOption('#catFilter', 'todos');
// El ritmo del menú: un menú que sube sin descanso y termina fuerte lo dice
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); const dish = (id, name, items) => ({id, name, status: 'lista', course: 'principal', components: [{id: 'c', role: 'principal', name: '', techniques: [], items: items.map(([k, w]) => ({n: k, k, w, src: 'kb'}))}], tests: [], images: [], version: 1, updated_at: '2026-11-21T10:00:00Z'});
 v.dishes.push(dish('r1', 'Ostra y limón', [['ostra', 3], ['limon', 1]]), dish('r2', 'Tomate', [['tomate', 3]]), dish('r3', 'Cordero', [['cordero', 3], ['ajo', 2]]), dish('r4', 'Chocolate', [['chocolate-negro', 3]]));
 v.menus = [{id: 'm2', name: 'Menú de prueba', kind: 'degustacion', items: ['r1', 'r2', 'r3', 'r4'].map(dish_id => ({dish_id})), version: 1, updated_at: '2026-11-21T10:00:00Z'}]; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(600); await go('#/menus/m2'); await wait(400);
ok(await page.locator('.mrhythm .mr-dot').count() === 4, 'no dibuja el ritmo del menú');
ok((await page.textContent('.mrlist')).includes('Ostra y limón'), 'el ritmo no dice qué plato es cada pase');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en primeros pasos y fichas:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('primeros pasos y fichas: todo correcto');
