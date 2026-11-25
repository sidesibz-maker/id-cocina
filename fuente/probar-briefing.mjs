// Prueba del briefing del servicio y de los primeros pasos de la portada.
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
// Briefing
await go('#/herramientas/briefing'); await page.waitForSelector('#bfOutBox');
await page.fill('#bfCovers', '80'); await page.click('.bfdishes label'); await page.fill('#bfOut', 'Gamba roja'); await page.fill('#bfAllergy', 'Mesa 12: celíaco'); await page.dispatchEvent('#bfAllergy', 'input'); await wait(150);
const txt = await page.textContent('#bfOutBox');
ok(txt.includes('80 cubiertos') && txt.includes('Calamar a la brasa: Mar y huerto') && txt.includes('Frutos de cáscara') && txt.includes('NO SALE HOY') && txt.includes('Mesa 12'), 'el briefing no sale completo: ' + txt);
await page.click('[data-act=bf-save]'); await wait(300);
const saved = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.type === 'briefing'));
ok(saved && saved.covers === '80' && saved.dishes[0] === 'd1', 'el briefing no se guarda');
await go('#/hoy'); await go('#/herramientas/briefing'); await page.fill('#bfOut', ''); await page.click('[data-load]'); await wait(200);
ok((await page.inputValue('#bfOut')) === 'Gamba roja', 'no se puede recuperar un briefing anterior');
// Mi recetario: portada, índice y una ficha por plato
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.dishes.push({id: 'd2', name: 'Arroz de brasa', status: 'lista', course: 'principal', components: [{id: 'c', role: 'principal', name: 'Arroz', techniques: [], items: [{n: 'Arroz bomba', q: '80 g'}], method: 'Sofreír y mojar.'}], tests: [], images: [], version: 1, updated_at: '2026-11-21T10:00:00Z'}, {id: 'd3', name: 'Idea suelta', status: 'idea', components: [], tests: [], images: [], version: 1}); localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(500); await go('#/libreta'); await page.evaluate(() => { window.print = () => { window.__book = document.getElementById('printFicha').innerText; window.__pages = document.querySelectorAll('#printFicha .book-page').length; }; });
await page.click('[data-act=book]'); await page.waitForSelector('.sheet [data-ok]'); await page.click('.sheet [data-ok]'); await wait(1200);
const book = await page.evaluate(() => window.__book || '');
ok(await page.evaluate(() => window.__pages) === 2, 'el recetario no lleva solo los platos en carta y listos');
ok(book.includes('Índice') && book.includes('Arroz bomba') && book.includes('Sofreír y mojar') && !book.includes('Idea suelta'), 'el recetario no lleva índice o fichas completas');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en briefing y primeros pasos:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('briefing y primeros pasos: todo correcto');
