// Prueba de la Biblioteca (cerebro de cocina): inicio «¿Qué quieres saber?», estantes, buscador, entradas por pestañas, tus versiones,
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
// Inicio: una pregunta, accesos para empezar y estantes, sin listas largas
await page.click('.rail a[href="#/biblioteca"]'); await page.waitForSelector('#saberQ');
ok((await page.textContent('.kwelcome h1')).includes('¿Qué quieres saber?'), 'la Biblioteca no empieza con la pregunta');
ok(await page.locator('.kstart .kchip').count() >= 4, 'no hay accesos para empezar');
ok(await page.locator('.kshelf').count() >= 4, 'no hay estantes por temas');
ok(await page.locator('#view .krow').count() === 0, 'el inicio enseña listas de entradas de golpe');
ok((await page.textContent('.rail')).includes('Biblioteca'), 'el menú no dice «Biblioteca»');
// Un estante
await page.click('.kshelf[href="#/biblioteca/estante/salsas"]'); await page.waitForSelector('.kgroup-sec');
const n = await page.locator('#view .krow').count();
ok(n >= 15, 'el estante de salsas tiene pocas entradas: ' + n);
ok(await page.locator('.kgroup-sec').count() >= 2, 'el estante no está ordenado por grupos');
// Buscador desde la portada
await go('#/hoy'); await page.fill('#homeSaberQ', 'bechamel'); await page.press('#homeSaberQ', 'Enter'); await page.waitForSelector('#saberRes .krow');
ok((await page.locator('#saberRes .krow-name').first().textContent()).startsWith('Bechamel'), 'buscar bechamel no la pone la primera');
await page.fill('#saberQ', 'croquetas'); await wait(150); ok(await page.locator('#saberRes .krow').count() >= 1, 'buscar «croquetas» no encuentra nada (debería encontrar la bechamel por su uso)');
await page.fill('#saberQ', 'besamel'); await wait(150); ok((await page.locator('#saberRes .krow-name').first().textContent()).startsWith('Bechamel'), 'no encuentra por otro nombre');
// Una entrada
await page.fill('#saberQ', 'bechamel'); await page.press('#saberQ', 'Enter'); await page.waitForSelector('.kentry');
const body = await page.textContent('.kentry');
ok(['Qué es', 'Receta', 'Según el uso', 'Variantes', 'Trucos y errores', 'Historia', 'Tu versión'].every(x => body.includes(x)), 'a la entrada le faltan partes');
ok(await page.locator('.kpanel:not([hidden])').count() === 1, 'la entrada enseña todas las partes a la vez');
await page.click('[data-ktab=trucos]'); ok(await page.isVisible('.kerrors') && !(await page.isVisible('.ksteps')), 'las pestañas no cambian de parte');
ok(await page.evaluate(() => location.hash === '#/biblioteca/bechamel/trucos'), 'la pestaña no queda en la dirección');
ok(await page.locator('.kentry .kref').count() >= 3, 'la entrada no enlaza con otras');
ok((await page.textContent('.ksec-mine')).includes('Croquetas de jamón'), 'no dice en qué platos tuyos se usa');
await page.click('[data-ktab=que]'); const refHref = await page.locator('.kpanel:not([hidden]) .kref').first().getAttribute('href');
await page.locator('.kpanel:not([hidden]) .kref').first().click(); await page.waitForFunction(h => location.hash === h, refHref); await page.waitForSelector('.kentry');
ok(await page.locator('.kentry h1').count() === 1 && refHref.startsWith('#/biblioteca/'), 'los enlaces no llevan a la otra entrada');
// Tus versiones
await go('#/saber/bechamel'); await page.waitForSelector('.kentry'); await page.click('[data-ktab=tuya]'); await page.waitForSelector('#kText');
ok((await page.inputValue('#kText')).includes('Leche'), 'tu versión no empieza desde la receta base');
await page.fill('#kText', 'Mi bechamel: 1 l leche, 100 g mantequilla, 110 g harina.'); await page.fill('#kWhy', 'Más espesa para croquetas'); await page.click('[data-act=save-version]'); await wait(300);
await page.fill('#kText', 'Mi bechamel: 1 l leche, 90 g mantequilla, 100 g harina, caldo de jamón.'); await page.fill('#kWhy', 'Con caldo de jamón'); await page.click('[data-act=save-version]'); await wait(300);
ok((await page.textContent('.kversion')).includes('caldo de jamón') && await page.locator('.khistory li').count() === 1 && (await page.textContent('.khistory')).includes('Más espesa'), 'el historial de versiones no se ve bien');
ok(await page.isVisible('#kText'), 'después de guardar no sigues en tu versión');
await go('#/biblioteca'); await page.fill('#saberQ', ''); await page.waitForSelector('.kshelf'); ok((await page.textContent('#view')).includes('Con tu versión') && (await page.textContent('#view')).includes('Lo último que has consultado'), 'el inicio no marca tus versiones ni lo último consultado');
// Crear una entrada que falta
await page.fill('#saberQ', 'salsa de ostras'); await wait(150);
await page.evaluate(() => localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', daily: false})));
await page.reload(); await page.waitForSelector('#saberQ'); await page.fill('#saberQ', 'salsa de ostras'); await wait(200);
await page.click('[data-act=create-ia]'); await page.waitForSelector('.kentry h1');
ok((await page.textContent('.kentry h1')) === 'Salsa de ostras casera' && (await page.textContent('.kentry')).includes('reducción'), 'no se crea la entrada con ChatGPT');
await go('#/biblioteca'); await page.waitForSelector('.kshelf'); ok((await page.textContent('.kshelves')).includes('Tus entradas'), 'la entrada nueva no sale en «Tus entradas»');
// Desde un plato
await go('#/plato/d1'); await page.waitForSelector('[data-comp="0"] .ing'); await page.locator('[data-comp="0"] .ing').first().click(); await page.waitForSelector('.sheet a[href="#/biblioteca/bechamel"]').catch(() => fails.push('el ingrediente «Bechamel» no enlaza con la Biblioteca'));
// Copia de seguridad
await page.click('.sheet [data-close]'); await wait(400);
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('.rail [data-act=menu]'); await page.click('.sheet [data-act=backup]'); })()]);
const copia = JSON.parse(require('node:fs').readFileSync(await dl.path(), 'utf8'));
ok(copia.saber?.bechamel?.versions?.length === 2 && Object.values(copia.saber).some(x => x.custom?.name === 'Salsa de ostras casera'), 'la copia no lleva la Biblioteca');
// Móvil: Biblioteca en la barra de abajo y sin salirse
const m = await browser.newContext({...devices['iPhone 13']}), mp = await m.newPage();
await mp.goto(url); await mp.waitForSelector('.tabs a[href="#/biblioteca"]'); await mp.click('.tabs a[href="#/biblioteca"]'); await mp.waitForSelector('#saberQ');
ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'el inicio de la Biblioteca se sale en el móvil');
await mp.evaluate(() => { location.hash = '#/biblioteca/mayonesa'; }); await mp.waitForSelector('.kentry'); await wait(300);
ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'la entrada se sale en el móvil');
ok(await mp.locator('.ktabs button').count() >= 4, 'en el móvil no hay pestañas en la entrada');
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.settings = {interests: ['brasa', 'casquería', 'México'], _at: '2026-11-20T10:00:00Z'}; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(800); await go('#/biblioteca'); await wait(300);
const fy = await page.textContent('.kforyou').catch(() => '');
ok(fy.includes('Casquería') && fy.includes('Chiles'), 'la Biblioteca no propone fichas según tus intereses: ' + fy);
// Favoritas que viajan (documento), repasar una ficha y libro de cocina para imprimir
await go('#/biblioteca/flao'); await page.waitForSelector('.kentry');
await page.click('[data-act=favorite]'); await wait(200);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).docs?.['favoritas:lista']?.ids?.includes('flao')), 'la favorita no se guarda para sincronizar');
await page.click('a[href="#/entrenar/ficha/flao"]'); await page.waitForSelector('.tronly');
ok((await page.textContent('.trq')).includes('Flaó'), 'repasar esta ficha no enseña tarjetas de la ficha: ' + await page.textContent('.trq'));
await go('#/biblioteca'); await page.waitForSelector('[data-act=kbook]');
await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('printFicha').innerHTML; }; });
await page.click('[data-act=kbook]'); await page.waitForSelector('#kbkPath');
await page.selectOption('#kbkPath', 'isla'); await page.click('.sheet [data-ok]'); await wait(400);
const book = await page.evaluate(() => window.__printed || '');
ok(book.includes('Greixonera') && book.includes('Flaó') && book.includes('Índice'), 'el libro no lleva las fichas elegidas');
ok(book.includes('Bechamel') && book.includes('Mi versión'), 'el libro no lleva tus versiones');
await page.evaluate(() => document.documentElement.classList.remove('printing'));
// Comparar dos fichas
await go('#/biblioteca/bechamel'); await page.waitForSelector('[data-act=compare-entry]'); await page.click('[data-act=compare-entry]'); await page.waitForSelector('#kcmpRows tr');
await page.selectOption('#kcmpB', 'veloute'); await wait(150);
ok((await page.textContent('#kcmpName')) === 'Velouté' || (await page.textContent('#kcmpName')).toLowerCase().includes('velout'), 'comparar no cambia a la segunda ficha');
ok(await page.locator('#kcmpRows .kcmp-part').count() >= 5, 'la comparación tiene pocas partes');
await page.keyboard.press('Escape'); await wait(200);
// Diccionario, ficha al azar y «Nuevo en la Biblioteca»
await go('#/biblioteca/diccionario'); await page.waitForSelector('.kdict-row');
ok(await page.locator('.kdict-row').count() >= 50, 'el diccionario tiene pocos términos');
await page.fill('#dictQ', 'napar'); await wait(150);
ok(await page.locator('.kdict-row:not([hidden])').count() === 1, 'buscar en el diccionario no filtra');
await go('#/biblioteca'); await page.waitForSelector('[data-act=random-entry]');
ok((await page.textContent('.knew').catch(() => '')).includes('Hojaldre'), 'no avisa de las fichas nuevas');
await page.click('[data-act=seen-new]'); await wait(150); ok(await page.locator('.knew').count() === 0, 'marcar como vistas no quita el aviso');
await page.click('[data-act=random-entry]'); await wait(400);
ok(/^#\/biblioteca\/[a-z0-9-]+$/.test(await page.evaluate(() => location.hash)), 'la ficha al azar no abre una ficha');
ok(!errors.length, 'errores: ' + errors.join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'la Biblioteca: todo correcto');
