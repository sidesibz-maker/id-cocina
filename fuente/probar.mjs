import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href, shots = (process.env.CAPTURAS || (await import('node:os')).tmpdir() + '/id-cocina-capturas') + '/';
mkdirSync(shots, {recursive: true});
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true});
const page = await ctx.newPage(), errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(250); };
const over = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('#app *')].filter(el => !el.closest('.strip,.filters,.thumbs,.results,.sr')).map(el => el.getBoundingClientRect().right)) - innerWidth);
await page.goto(url); await page.waitForSelector('.hello h1'); await page.waitForSelector('.chips .chip');
ok(!(await page.evaluate(() => document.body.innerText)).match(/Al Pase|Albar|undefined|NaN|\[object/), 'texto raro en la portada');
await page.screenshot({path: shots + 'hoy.png', fullPage: true});
// Plato nuevo con un producto y un ingrediente escrito a mano
await go('#/plato/nuevo'); await page.waitForSelector('#dishName');
await page.fill('#dishName', 'Pulpo, romesco y encurtido');
await page.click('[data-add-comp=principal]'); await page.fill('#ingSearch', 'pulpo'); await page.locator('#ingResults .result').first().click(); await page.click('.sheet [data-close]');
await page.locator('[data-comp="0"] [data-act=techs]').click(); await page.click('[data-tech=brasa]'); await page.click('.sheet .btn.primary');
await page.click('[data-add-comp=salsa]'); await page.fill('#ingSearch', 'romesco'); await page.locator('#ingResults .result').first().click(); await page.fill('#ingSearch', 'Salsa de la abuela'); await page.click('[data-free]'); await page.click('.sheet [data-close]');
ok(await page.locator('#analysis .fm-row').count() === 9, 'faltan las barras de sabor');
ok((await page.textContent('#analysis .verdict')).includes('Domina'), 'no dice qué domina');
const fix = page.locator('#analysis .fix .chip-add').first(); ok(await fix.count() > 0, 'no sugiere cómo equilibrar'); await fix.click();
await page.waitForSelector('.save-saved', {timeout: 8000});
// Consejo: copiar consulta y pegar respuesta
await page.click('[data-act=advice]'); await wait(200);
const prompt = await page.evaluate(() => navigator.clipboard.readText());
ok(prompt.includes('Pulpo, romesco y encurtido') && prompt.includes('"basics"') && !/precio|price|supplier|Albar/i.test(prompt), 'la consulta no lleva el plato o lleva algo de más');
console.log('consulta de consejo:', prompt.length, 'caracteres,', encodeURIComponent(prompt).length, 'en enlace');
// «Preguntar a ChatGPT» abre el chat con la consulta escrita; «Pegar y leer» trae la respuesta de un toque
await ctx.route(/chatgpt\.com|claude\.ai/, r => r.fulfill({body: 'chat'}));
const [chat] = await Promise.all([ctx.waitForEvent('page'), page.click('#adviceSec a[data-chat][href^="https://chatgpt.com"]')]);
const chatUrl = chat.url(); await chat.close();
ok(chatUrl.startsWith('https://chatgpt.com/') && (chatUrl.includes('?q=') ? decodeURIComponent(chatUrl).includes('Pulpo, romesco y encurtido') : true), 'Preguntar a ChatGPT no abre el chat con la consulta: ' + chatUrl.slice(0, 80));
console.log('enlace al chat con la consulta escrita:', chatUrl.includes('?q='));
await page.fill('#adviceReply', 'Claro:\n```json\n{"verdict":"Tiene sentido, baja el romesco.","works":["La brasa"],"changes":[{"what":"Más ácido","why":"Hay grasa","how":"Cebolla encurtida"}],"signature":"Aceite ahumado","service":{"mise":["Pulpo cocido"],"pass":"Tres minutos","risks":[]},"plating":"Sencillo","variants":[{"label":"Más sencilla","idea":"Solo patata"}],"names":[{"es":"Pulpo brasa","en":"Charcoal octopus"}],"allergens":["moluscos"],"issues":[]}\n```');
await page.evaluate(t => navigator.clipboard.writeText(t), await page.inputValue('#adviceReply')); await page.fill('#adviceReply', ''); await page.click('#adviceSec [data-paste]'); await page.waitForSelector('.advice-lead');
// Imagen: copiar descripción y añadir un archivo
await page.click('[data-act=image]'); await wait(200);
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('fotografía gastronómica'), 'la descripción de la imagen no se copia');
writeFileSync(shots + 'foto.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAYAAAD+Bd/7AAAAFUlEQVR4nGP8z8DwnwEPYMInOXwUAAASWwIKHrzNmwAAAABJRU5ErkJggg==', 'base64'));
await page.setInputFiles('#imageFile', shots + 'foto.png'); await page.waitForSelector('.shot img[src^="blob:"]');
// Prueba de cata
await page.locator('#testForm .rating label').nth(3).click(); await page.fill('#testText', 'Buen punto'); await page.click('#testForm button[type=submit]');
// Ficha técnica: cantidad, elaboración, raciones y emplatado
await page.locator('[data-comp="0"] .ing').first().click(); await page.fill('#itemQty', '180 g'); await page.press('#itemQty', 'Enter'); await wait(300);
ok((await page.locator('[data-comp="0"] .ing').first().textContent()).includes('180 g'), 'la cantidad no se ve en el ingrediente');
await page.locator('[data-comp="0"] .comp-method summary').click({timeout: 4000}).catch(async e => { await page.screenshot({path: shots + 'fallo.png'}); console.log(await page.evaluate(() => [document.querySelectorAll('.sheet').length, document.querySelector('[data-comp="0"]')?.outerHTML.slice(0, 600)])); throw e; }); await page.fill('#cmethod0', 'Cocer 40 min.\nMarcar en brasa al pase.');
await page.fill('#dishPortions', '4'); await page.fill('#dishPlating', 'Plato hondo, romesco debajo.');
ok(await page.locator('[data-act=plating-from-advice]:visible').count() === 0, 'ofrece el emplatado del consejo aunque ya hay uno');
await page.waitForSelector('.save-saved', {timeout: 8000}); await wait(300);
await page.click('#adviceSec .fold summary'); await page.click('#adviceSec .fold [data-act=advice]'); await wait(200);
const p2txt = await page.evaluate(() => navigator.clipboard.readText());
ok(p2txt.includes('180 g') && p2txt.includes('Marcar en brasa') && p2txt.includes('Plato hondo'), 'la consulta no lleva cantidades, elaboración o emplatado');
await page.evaluate(() => { window.print = () => { window.__ficha = document.getElementById('printFicha').innerText; window.__printing = document.documentElement.classList.contains('printing'); }; });
await page.click('#fichaSec [data-act=print]'); await page.waitForFunction(() => window.__ficha);
const ficha = await page.evaluate(() => window.__ficha);
ok(await page.evaluate(() => window.__printing) && ficha.includes('Pulpo, romesco y encurtido') && ficha.includes('180 g') && ficha.includes('Marcar en brasa') && ficha.includes('Raciones: 4') && ficha.includes('Plato hondo') && ficha.includes('Moluscos'), 'la ficha impresa está incompleta');
await page.emulateMedia({media: 'print'}); await page.screenshot({path: shots + 'ficha.png', fullPage: true}); await page.pdf({path: shots + 'ficha.pdf', format: 'A4'}); await page.emulateMedia({media: 'screen'});
await page.evaluate(() => dispatchEvent(new Event('afterprint')));
await page.screenshot({path: shots + 'mesa.png', fullPage: true});
// Recargar: todo sigue ahí (guardado en este ordenador)
await page.reload(); await page.waitForSelector('#dishName');
ok(await page.inputValue('#dishName') === 'Pulpo, romesco y encurtido', 'el nombre no se guardó');
ok(await page.locator('.tests li').count() === 1 && await page.locator('.advice-lead').count() === 1, 'no se guardaron la prueba o el consejo');
await page.waitForSelector('.shot img[src^="blob:"]', {timeout: 5000}).catch(() => fails.push('la imagen no se guardó'));
ok((await page.locator('[data-comp="1"] .ing').allTextContents()).some(x => x.includes('Salsa de la abuela')), 'el ingrediente escrito a mano se perdió');
ok((await page.locator('[data-comp="0"] .ing').first().textContent()).includes('180 g') && (await page.inputValue('#cmethod0')).includes('Marcar en brasa') && await page.inputValue('#dishPortions') === '4' && (await page.inputValue('#dishPlating')).includes('Plato hondo'), 'la ficha técnica no se guardó');
// Un plato guardado con la forma antigua (sin ficha, componentes con campos desconocidos) se abre y no pierde nada al tocarlo
const oldId = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('id-cocina-v1')); const d = {...s.dishes[0], id: 'viejo1', name: 'Plato antiguo', updated_at: '2026-11-01T00:00:00Z', components: [{role: 'principal', name: 'Cordero', extra: 'guardar', techniques: ['brasa'], items: [{n: 'Cordero', k: null, w: 3, src: 'free', raro: 1}]}]}; delete d.plating; delete d.portions; s.dishes.push(d); localStorage.setItem('id-cocina-v1', JSON.stringify(s)); return d.id; });
await page.reload(); await go('#/plato/' + oldId); await page.waitForSelector('#dishName'); await page.fill('#dishConcept', 'Tocado'); await page.waitForSelector('.save-saved', {timeout: 8000}); await wait(200);
const old = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'viejo1'));
ok(old.concept === 'Tocado' && old.components[0].extra === 'guardar' && old.components[0].items[0].raro === 1 && old.components[0].name === 'Cordero', 'un plato antiguo pierde datos al guardarlo');
await go('#/plato/' + (await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.name === 'Pulpo, romesco y encurtido').id))); await page.waitForSelector('#dishName');
// Ideas pegadas
await go('#/crear/ideas'); await page.waitForSelector('#ideasForm'); await page.fill('#brief', 'Entrante con coliflor'); await page.click('#ideasForm [data-act=copy-ideas]'); await wait(200);
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('Entrante con coliflor'), 'la petición de ideas no se copia');
await page.fill('#ideasReply', '{"ideas":[{"name":"Coliflor asada y miso","line":"Entera a la brasa","course":"entrante","why":"Dulce y umami","twist":"Tu toque","components":[{"role":"principal","name":"Coliflor","techniques":["brasa"],"items":["Coliflor"]},{"role":"salsa","name":"Miso","techniques":[],"items":["Miso"]}]}],"issues":[]}');
await page.click('[data-act=read-ideas]'); await page.waitForSelector('.idea-result'); await page.locator('.idea-result [data-open]').first().click(); await page.waitForSelector('#dishName');
ok(await page.inputValue('#dishName') === 'Coliflor asada y miso', 'la idea no abre la mesa de trabajo');
// Crear: la mesa de ideas sin ChatGPT. Se empieza por un producto, estallan ideas por grupos, se añaden tocando o arrastrando, se quitan y se guarda
await go('#/crear'); await page.waitForSelector('#bPlate');
ok(await page.locator('.bgroup-start [data-add]').count() >= 4, 'Crear no propone por dónde empezar');
await page.fill('#bBrief', 'Pulpo'); await page.click('#bStart button[type=submit]'); await page.waitForSelector('.bgroup-fresh [data-add]');
ok((await page.inputValue('#bName')).startsWith('Pulpo'), 'el plato no empieza por el pulpo');
ok(await page.locator('.bread .bnotes li').count() > 0 && (await page.textContent('.bread')).includes('Manda'), 'el plato no dice cómo va ni qué le falta');
ok(await page.locator('.bgroup-need [data-add]').count() > 0, 'no salen ideas para lo que le falta al plato');
ok(await page.locator('.bgroup-crunch [data-add], [data-group=need-crujiente] [data-add]').count() > 0, 'no salen ideas crujientes');
for (const g of ['fresh', 'creamy', 'goes', 'tech', 'recipes']) ok(await page.locator('.bgroup-' + g + ' [data-add]').count() > 0, 'no salen ideas del grupo ' + g);
const fr = (await page.locator('.bgroup-fresh [data-add] strong').first().textContent()).trim();
await page.locator('.bgroup-fresh [data-add]').first().click(); await page.waitForFunction(n => document.querySelector('#bDish')?.innerText.includes(n), fr);
const rec = (await page.locator('.bgroup-recipes [data-add] strong').first().textContent()).trim();
await page.locator('.bgroup-recipes [data-add]').first().dragTo(page.locator('#bPlate')); await page.waitForFunction(n => document.querySelector('#bDish')?.innerText.includes(n), rec);
await page.locator('.bgroup-tech [data-add]').first().click(); await wait(200);
ok(await page.locator('.bitem').count() === 4, 'no entran en el plato lo tocado y lo arrastrado: ' + await page.locator('.bitem').count());
await page.locator('.bitem [data-drop]').nth(1).click(); await wait(200);
ok(!(await page.textContent('#bDish')).includes(fr), 'quitar del plato no quita');
await page.fill('#bName', 'Pulpo de la mesa de ideas');
await page.reload(); await page.waitForSelector('.hello h1, #bPlate'); await go('#/crear'); await page.waitForSelector('#bName');
ok(await page.inputValue('#bName') === 'Pulpo de la mesa de ideas' && await page.locator('.bitem').count() === 3, 'la mesa de ideas se pierde al recargar');
await page.click('[data-act=b-save]'); await page.waitForSelector('#dishName');
ok(await page.inputValue('#dishName') === 'Pulpo de la mesa de ideas', 'el plato de la mesa de ideas no se guarda');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.name === 'Pulpo de la mesa de ideas'));
ok(saved && saved.components.length === 2 && JSON.stringify(saved.components).includes(rec.split(' ')[0]), 'el plato guardado no lleva lo de la mesa');
await go('#/crear'); await page.waitForSelector('.bgroup-start [data-add]');
// Importar receta: texto pegado tal cual y respuesta de la IA
await go('#/crear'); await page.click('a[href="#/crear/importar"]'); await page.waitForSelector('#recipeReply');
await page.click('[data-act=copy-import]'); await wait(200); ok((await page.evaluate(() => navigator.clipboard.readText())).includes('captura'), 'la instrucción para leer capturas no se copia');
await page.fill('#recipeReply', 'Pulpo a la gallega 🐙\nPara 4 personas\nIngredientes:\n- 1 pulpo de 2 kg\n- 500 g de patata\n- 2 cdas de pimentón\nPara el alioli:\n1 diente de ajo\n200 ml aceite de girasol\nElaboración:\n1. Cuece el pulpo 40 minutos.\n2. Marca en la brasa.\n#pulpo #receta');
await page.click('[data-act=read-recipe]'); await page.waitForSelector('#recipePreview');
ok((await page.textContent('#recipePreview')).includes('500 g patata') && (await page.textContent('#recipePreview')).includes('Alioli'), 'la receta pegada no se lee bien');
await page.click('[data-act=save-recipe]'); await page.waitForSelector('#dishName');
ok(await page.inputValue('#dishName') === 'Pulpo a la gallega' && await page.inputValue('#dishPortions') === '4' && (await page.inputValue('#cmethod0')).includes('Cuece el pulpo') && (await page.locator('[data-comp="0"] .ing').allTextContents()).some(x => x.includes('500 g')), 'la receta importada no llega completa a la mesa');
await go('#/crear/importar'); await page.waitForSelector('#recipeReply');
await page.fill('#recipeReply', 'Aquí la tienes:\n```json\n{"name":"Mojo verde","portions":"6","source":{"author":"@cocinero","url":"https://www.tiktok.com/@cocinero/video/1"},"components":[{"role":"salsa","name":"Mojo","techniques":["emulsion"],"items":[{"name":"Cilantro","qty":"1 manojo"},{"name":"Ajo","qty":"2 dientes"}],"method":["Majar","Emulsionar con aceite"]}],"plating":"En cuenco","issues":[]}\n```');
await page.click('[data-act=read-recipe]'); await page.waitForSelector('#recipePreview'); await page.click('[data-act=save-recipe]'); await page.waitForSelector('#dishName');
ok(await page.inputValue('#dishName') === 'Mojo verde' && (await page.inputValue('#cmethod0')).includes('2. Emulsionar') && (await page.inputValue('#dishNotes')).includes('tiktok.com') && (await page.inputValue('#dishPlating')) === 'En cuenco', 'la respuesta de la IA no se importa bien');
const importedIds = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.filter(d => d.source?.kind === 'import').map(d => d.id));
ok(importedIds.length === 2, 'no se guardaron las dos recetas importadas');
// Radar pegado
await go('#/radar'); await page.waitForSelector('.trow'); await page.click('[data-filter=fecha]'); const radarCount = await page.locator('.trow').count(); await page.click('[data-act=search]'); await page.click('.sheet [data-act=copy]'); await wait(200);
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('Busca en internet'), 'la búsqueda de tendencias no se copia');
await page.fill('#radarReply', '```json\n[{"kind":"tecnica","heat":"alza","title":"Verduras enteras a la brasa","summary":"La verdura como principal.","why":"Parrillas de referencia.","adapt":"En tu brasa.","places":["Ejemplo"],"sources":[{"name":"Revista","url":"https://example.org/x","date":"2026-11-10"}],"ideas":[{"name":"Puerro a la brasa","line":"Entero","components":[{"role":"principal","name":"Puerro","techniques":["brasa"],"items":["Puerro"]}]}],"tags":["brasa"],"fit":90},{"kind":"idea","title":"Calabaza, miso y pipas","summary":"Dulce y umami.","ideas":[{"name":"Calabaza, miso y pipas","line":"x","components":[{"role":"principal","name":"Calabaza","techniques":["brasa"],"items":["Calabaza"]}]}]}]\n```');
await page.click('.sheet [data-act=add]'); await page.waitForSelector('.group'); await page.click('[data-filter=fecha]'); ok(await page.locator('.trow').count() === radarCount + 2, 'los avisos pegados no entran');
// Radar por temas: grupos, búsqueda y tema abierto
await page.click('[data-filter=tema]'); ok(await page.locator('.group').count() >= 3 && await page.locator('.trend-strip .trend').count() === 3, 'el radar no se agrupa por temas');
await page.fill('#radarQ', 'calabaza'); await wait(150); ok((await page.textContent('#radarBody')).includes('Calabaza, miso y pipas') && await page.locator('#radarBody .trow').count() === 1, 'la búsqueda del radar no encuentra');
await page.fill('#radarQ', ''); await wait(150); await page.locator('.group-more').first().click(); await wait(150); ok(await page.locator('.group-title').count() === 1 && await page.locator('.trend-grid .trend').count() >= 3, 'no se abre un tema entero');
await page.locator('.trend-grid .trend').first().click(); await page.waitForSelector('.story'); ok(await page.locator('.story-next').count() === 1, 'el aviso no ofrece el siguiente del tema');
await go('#/hoy'); await page.waitForSelector('.cover-title'); ok((await page.textContent('.cover-title')).trim().length > 5, 'la portada no enseña ningún aviso');
await page.screenshot({path: shots + 'hoy-con-radar.png', fullPage: true});
// Libreta, papelera, sabores, cocina
await go('#/libreta'); await page.waitForSelector('#bookGrid .dish'); ok(await page.locator('#bookGrid .dish').count() === 6, 'la libreta no tiene los dos platos');
await go('#/sabores/alcachofa'); await page.waitForSelector('.ing-page'); await page.screenshot({path: shots + 'sabores.png', fullPage: true});
await go('#/sabores/pulpo/calabaza'); await page.waitForSelector('.page-head h1');
await go('#/cocina'); await page.waitForSelector('#kitchenForm'); await page.click('[data-equip=josper]'); await page.fill('#kName', 'Manu'); await page.click('#kSave'); await wait(300);
await page.screenshot({path: shots + 'cocina.png', fullPage: true});
// Copia de seguridad: se descarga y se puede recuperar en un navegador vacío
await page.click('.rail [data-act=menu]');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('.sheet [data-act=backup]')]);
const file = shots + 'copia.json'; await download.saveAs(file);
const copia = JSON.parse(readFileSync(file, 'utf8'));
ok(copia.app === 'id-cocina' && copia.dishes.length === 6 && Object.keys(copia.images).length === 1 && copia.settings.name === 'Manu', 'la copia no lleva todo');
const ctx2 = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}), p2 = await ctx2.newPage(), e2 = [];
p2.on('pageerror', e => e2.push(String(e)));
await p2.goto(url); await p2.waitForSelector('.hello h1'); await p2.waitForSelector('.chips .chip');
await p2.click('.top [data-act=menu]'); await p2.setInputFiles('#restoreFile', file); await p2.waitForFunction(() => JSON.parse(localStorage.getItem('id-cocina-v1') || '{}').dishes?.length === 6);
await p2.evaluate(() => { location.hash = '#/libreta'; }); await p2.waitForSelector('#bookGrid .dish');
ok(await p2.locator('#bookGrid .dish').count() === 6, 'recuperar la copia no trae los platos');
for (const h of ['#/hoy', '#/radar', '#/crear', '#/sabores', '#/cocina', '#/libreta']) { await p2.evaluate(x => { location.hash = x; }, h); await wait(300); const o = await p2.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('#app *')].filter(el => !el.closest('.strip,.filters,.thumbs,.results,.sr,.bcards')).map(el => el.getBoundingClientRect().right)) - innerWidth); ok(o <= 1, 'móvil: se sale de la pantalla en ' + h); }
await p2.evaluate(() => { location.hash = '#/hoy'; }); await wait(300); await p2.screenshot({path: shots + 'movil-hoy.png', fullPage: true});
ok((await over()) <= 1, 'ordenador: se sale de la pantalla');
const real = errors.filter(e => !/radar\.js|ERR_FILE_NOT_FOUND/.test(e));
ok(real.length === 0 && e2.length === 0, 'errores: ' + [...real, ...e2].slice(0, 3).join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'app local: todo correcto');
