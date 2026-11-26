// Prueba del buscador general (Ctrl+K) y de que no quedan herramientas de gestión.
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
// Herramientas: solo las de cocinar, nada de gestión (eso va en la otra app del dueño)
await go('#/herramientas'); ok(await page.locator('.ttiles .tile').count() === 6, 'no salen las 6 herramientas');
for (const gone of ['produccion', 'etiquetas', 'briefing', 'registros', 'mise', 'rendimiento']) ok(await page.locator('a[href="#/herramientas/' + gone + '"]').count() === 0, 'sigue la herramienta de gestión ' + gone);
// Atajos: «?» abre la ayuda y «g» + letra cambia de sección
await page.keyboard.press('Escape'); await page.evaluate(() => { location.hash = '#/hoy'; document.activeElement?.blur(); }); await wait(400);
await page.keyboard.press('Shift+Slash'); await wait(300);
ok((await page.textContent('.sheet').catch(() => '')).includes('Atajos de teclado'), 'la tecla ? no abre la ayuda de atajos');
await page.keyboard.press('Escape'); await wait(200); await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('g'); await page.keyboard.press('b'); await wait(400);
ok((await page.evaluate(() => location.hash)) === '#/biblioteca', 'g y b no llevan a la Biblioteca: ' + await page.evaluate(() => location.hash));
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en el buscador:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('buscador: todo correcto');
