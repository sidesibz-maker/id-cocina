// Prueba del Saber (cerebro de cocina): índice, buscador, una entrada completa con enlaces, tus versiones con historia,
// crear una entrada que falta con ChatGPT (simulado), enlaces desde platos y que todo entra en la copia y se conserva.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium, devices} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write']});
await ctx.route('https://api.openai.com/v1/responses', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify({name: 'Salsa de ostras casera', aka: ['oyster sauce'], cat: 'salsas', group: 'Salsas del mundo', summary: 'Salsa espesa y salada.', what: 'Se reduce el jugo de ostras; liga como una [[reducciones|reducción]].', base: {for: '250 ml', items: [['Ostras', '500 g']], steps: ['Abrir', 'Reducir']}, ratios: [], variants: [], keys: ['No salar al principio'], errors: [], history: 'Cocina cantonesa.', uses: ['Salteados'], keep: '1 semana en frío.', pro: '', related: ['reducciones']})}]}]})}));
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(300); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(() => localStorage.setItem('id-cocina-v1', JSON.stringify({dishes: [{id: 'd1', name: 'Croquetas de jamón', course: 'picar', components: [{id: 'c', role: 'principal', name: 'Bechamel', techniques: [], items: [{n: 'Bechamel', k: null, w: 3, src: 'free'}, {n: 'Jamón', k: 'jamon', w: 2, src: 'kb'}]}], tests: [], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}]})));
await page.reload(); await page.waitForSelector('.hello h1');
// Índice
await page.click('.rail a[href="#/saber"]'); await page.waitForSelector('#saberQ');
const n = await page.locator('.klinks li').count();
ok(n >= 45, 'el índice tiene pocas entradas: ' + n);
ok(await page.locator('.kcat').count() >= 3, 'el índice no está ordenado por temas');
// Buscador desde la portada
await go('#/hoy'); await page.fill('#homeSaberQ', 'bechamel'); await page.press('#homeSaberQ', 'Enter'); await page.waitForSelector('#saberRes .krow');
ok((await page.locator('#saberRes .krow-name').first().textContent()).startsWith('Bechamel'), 'buscar bechamel no la pone la primera');
await page.fill('#saberQ', 'croquetas'); await wait(150); ok(await page.locator('#saberRes .krow').count() >= 1, 'buscar «croquetas» no encuentra nada (debería encontrar la bechamel por su uso)');
await page.fill('#saberQ', 'besamel'); await wait(150); ok((await page.locator('#saberRes .krow-name').first().textContent()).startsWith('Bechamel'), 'no encuentra por otro nombre');
// Una entrada
await page.fill('#saberQ', 'bechamel'); await page.press('#saberQ', 'Enter'); await page.waitForSelector('.kentry');
const body = await page.textContent('.kentry');
ok(['Qué es', 'Receta base', 'Cómo cambia según para qué', 'Errores y cómo arreglarlos', 'Historia'].every(x => body.includes(x)), 'a la entrada le faltan partes');
ok(await page.locator('.kentry .kref').count() >= 3, 'la entrada no enlaza con otras');
ok((await page.textContent('.ksec-mine')).includes('Croquetas de jamón'), 'no dice en qué platos tuyos se usa');
const refHref = await page.locator('.kbody .kref').first().getAttribute('href');
await page.locator('.kbody .kref').first().click(); await page.waitForFunction(h => location.hash === h, refHref); await page.waitForSelector('.kentry');
ok(await page.locator('.kentry h1').count() === 1 && refHref.startsWith('#/saber/'), 'los enlaces no llevan a la otra entrada');
// Tus versiones
await go('#/saber/bechamel'); await page.waitForSelector('#kText');
ok((await page.inputValue('#kText')).includes('Leche'), 'tu versión no empieza desde la receta base');
await page.fill('#kText', 'Mi bechamel: 1 l leche, 100 g mantequilla, 110 g harina.'); await page.fill('#kWhy', 'Más espesa para croquetas'); await page.click('[data-act=save-version]'); await wait(300);
await page.fill('#kText', 'Mi bechamel: 1 l leche, 90 g mantequilla, 100 g harina, caldo de jamón.'); await page.fill('#kWhy', 'Con caldo de jamón'); await page.click('[data-act=save-version]'); await wait(300);
ok((await page.textContent('.kversion')).includes('caldo de jamón') && await page.locator('.khistory li').count() === 1 && (await page.textContent('.khistory')).includes('Más espesa'), 'el historial de versiones no se ve bien');
await go('#/saber'); await page.waitForSelector('.krows'); ok((await page.textContent('#view')).includes('tu versión'), 'el índice no marca dónde tienes versión');
// Crear una entrada que falta
await page.fill('#saberQ', 'salsa de ostras'); await wait(150);
await page.evaluate(() => localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', daily: false})));
await page.reload(); await page.waitForSelector('#saberQ'); await page.fill('#saberQ', 'salsa de ostras'); await wait(200);
await page.click('[data-act=create-ia]'); await page.waitForSelector('.kentry h1');
ok((await page.textContent('.kentry h1')) === 'Salsa de ostras casera' && (await page.textContent('.kentry')).includes('reducción'), 'no se crea la entrada con ChatGPT');
await go('#/saber'); await page.waitForSelector('.kcat'); ok((await page.textContent('.kcats')).includes('Tus entradas'), 'la entrada nueva no sale en «Tus entradas»');
// Desde un plato
await go('#/plato/d1'); await page.waitForSelector('[data-comp="0"] .ing'); await page.locator('[data-comp="0"] .ing').first().click(); await page.waitForSelector('.sheet a[href="#/saber/bechamel"]').catch(() => fails.push('el ingrediente «Bechamel» no enlaza con el Saber'));
// Copia de seguridad
await page.click('.sheet [data-close]'); await wait(400);
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('.rail [data-act=menu]'); await page.click('.sheet [data-act=backup]'); })()]);
const copia = JSON.parse(require('node:fs').readFileSync(await dl.path(), 'utf8'));
ok(copia.saber?.bechamel?.versions?.length === 2 && Object.values(copia.saber).some(x => x.custom?.name === 'Salsa de ostras casera'), 'la copia no lleva el Saber');
// Móvil: Saber en la barra de abajo y sin salirse
const m = await browser.newContext({...devices['iPhone 13']}), mp = await m.newPage();
await mp.goto(url); await mp.waitForSelector('.tabs a[href="#/saber"]'); await mp.click('.tabs a[href="#/saber"]'); await mp.waitForSelector('#saberQ');
await mp.evaluate(() => { location.hash = '#/saber/mayonesa'; }); await mp.waitForSelector('.kentry'); await wait(300);
ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'la entrada se sale en el móvil');
ok(await mp.locator('.kjump button').count() >= 3, 'en el móvil no hay saltos dentro de la entrada');
ok(!errors.length, 'errores: ' + errors.join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'el Saber: todo correcto');
