// Prueba del Laboratorio creativo: chispa con producto, pareja, puente y mecanismo; partir de un producto; mecanismos
// (respetando lo que el cocinero no quiere); cuaderno de chispas; convertir una chispa en plato sin perderla.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 900}});
await ctx.route('https://api.openai.com/v1/responses', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify({ideas: [1, 2, 3].map(k => ({name: 'Higo a la brasa ' + k, line: 'Higo, ceniza y queso', course: 'postre', why: 'Dulce y ahumado', twist: 'Ceniza de sarmiento', components: [{role: 'principal', name: 'Higo', techniques: ['brasa'], items: ['higo']}, {role: 'cremoso', name: 'Crema de queso', techniques: [], items: ['queso fresco']}]})), issues: []})}]}]})}));
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(400); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(() => localStorage.setItem('id-cocina-v1', JSON.stringify({dishes: [], settings: {avoid: ['minimalismo'], _at: '2026-11-20T10:00:00Z'}})));
await page.reload(); await page.waitForSelector('.hello h1'); await wait(500);
ok((await page.textContent('.rail')).includes('Laboratorio'), 'el menú no tiene el Laboratorio');
await page.click('.rail a[href="#/laboratorio"]'); await page.waitForSelector('.labtrio');
ok(await page.locator('.labtrio .labing').count() === 2, 'la chispa no trae producto y pareja');
ok((await page.textContent('.labm')).length > 20, 'la chispa no trae mecanismo');
ok(!(await page.textContent('.labmechs')).includes('Minimalismo'), 'no respeta lo que el cocinero no quiere');
ok(await page.locator('.labmech').count() >= 12, 'faltan mecanismos');
const first = await page.textContent('.labtrio');
let changed = false; for (let k = 0; k < 5 && !changed; k++) { await page.click('[data-act=lab-new]'); await wait(100); changed = (await page.textContent('.labtrio')) !== first; }
ok(changed, 'otra chispa no cambia nada');
await page.fill('#labFix', 'Higo'); await page.dispatchEvent('#labFix', 'change'); await wait(200);
ok((await page.textContent('.labtrio .labing')).toLowerCase().includes('higo'), 'no parte del producto elegido: ' + await page.textContent('.labtrio'));
await page.click('[data-mech=fuego]'); await wait(200);
ok((await page.textContent('.labm')).includes('Fuego'), 'elegir un mecanismo no lo aplica');
// Guardar y cuaderno
await page.click('[data-act=lab-keep]'); await wait(400);
await page.fill('#labText', 'Gamba roja con agua de tomate y hojas de higuera'); await page.click('#labNote button[type=submit]'); await wait(400);
ok(await page.locator('.labsp').count() === 2, 'el cuaderno no guarda las chispas');
// Convertir en plato
await page.locator('.labsp', {hasText: 'hojas de higuera'}).locator('[data-to-dish]').click(); await wait(600);
ok((await page.evaluate(() => location.hash)).startsWith('#/plato/'), 'convertir no abre el plato');
const st = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); return {dishes: v.dishes.length, sp: Object.values(v.docs).filter(d => d.type === 'chispa')}; });
ok(st.dishes === 1 && st.sp.length === 2 && st.sp.some(s => s.dish_id), 'la chispa no queda enlazada al plato o se ha perdido');
ok((await page.textContent('#view')).includes('Nació de una chispa'), 'el plato no recuerda que nació de una chispa');
await go('#/laboratorio'); ok((await page.textContent('.labsparks')).includes('ya es un plato'), 'la chispa no dice que ya es un plato');
// Llevar la chispa directamente a la libreta
await page.click('[data-act=lab-dish]'); await wait(600);
const d2 = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.source?.kind === 'laboratorio'));
ok(d2 && d2.components[0]?.items.length >= 2 && d2.status === 'idea', 'llevar a la libreta no crea el plato con sus productos');
// La ficha del día en la portada, el estante de creatividad y el tamaño de letra
await go('#/hoy'); ok(await page.locator('.daily[href^="#/biblioteca/"]').count() === 1, 'la portada no trae la ficha del día');
await go('#/biblioteca'); ok(await page.locator('.kshelf[href="#/biblioteca/estante/creatividad"]').count() === 1, 'falta el estante de creatividad');
await go('#/biblioteca/construir-un-plato'); ok((await page.textContent('.kentry')).includes('idea en una frase'), 'no abre «Construir un plato»');
await page.click('.rail [data-act=menu]'); await page.click('[data-size=grande]'); await wait(200);
ok(await page.evaluate(() => document.documentElement.dataset.size) === 'grande', 'el tamaño de letra no cambia');
await page.reload(); await wait(500); ok(await page.evaluate(() => document.documentElement.dataset.size) === 'grande', 'el tamaño de letra no se recuerda');
await page.click('.rail [data-act=menu]'); await page.click('[data-size=normal]'); await wait(200);
ok(!(await page.evaluate(() => document.documentElement.dataset.size)), 'no vuelve al tamaño normal');
// Rutas de aprendizaje: abrir una ficha la marca como leída y la ruta avanza
await go('#/biblioteca/construir-un-plato'); await wait(1900);
const rd = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).docs['lectura:estado']);
ok(rd && rd.read['construir-un-plato'], 'abrir una ficha no la marca como leída');
await go('#/biblioteca'); ok(await page.locator('.kpath').count() >= 7, 'faltan rutas de aprendizaje');
const crear = page.locator('.kpath', {hasText: 'Crear platos'});
ok((await crear.textContent()).includes('1 de 10') && (await crear.locator('.btn').textContent()).includes('Contraste y equilibrio'), 'la ruta no avanza: ' + await crear.textContent());
await go('#/hoy'); ok((await page.textContent('.craft')).includes('Tu ruta: Crear platos'), 'la portada no dice la siguiente ficha de la ruta');
// Chispa con foto: se guarda la imagen y va en la copia de seguridad
await go('#/laboratorio');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');
await page.setInputFiles('#labPhoto', {name: 'mercado.png', mimeType: 'image/png', buffer: png}); await wait(600);
await page.fill('#labText', 'Puesto de setas del mercado'); await page.click('#labNote button[type=submit]'); await wait(800);
const withImg = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.type === 'chispa' && d.image));
ok(withImg && withImg.image.startsWith('img/chispas/'), 'la chispa no guarda la foto');
ok(await page.locator('.labsp-img').count() === 1, 'la chispa no enseña la foto');
// Tres platos con ChatGPT a partir de la chispa
await page.evaluate(() => localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-prueba-1234567890abcdefghij'})));
await go('#/laboratorio'); await page.click('[data-act=lab-ideas]'); await page.waitForSelector('.labideas .idea-card');
ok(await page.locator('.labideas .idea-card').count() === 3, 'no salen las tres propuestas');
await page.click('[data-take="1"]'); await wait(800);
ok((await page.evaluate(() => location.hash)).startsWith('#/plato/') && (await page.inputValue('#dishName')).includes('Higo a la brasa 2'), 'llevar la propuesta no crea el plato');
await go('#/laboratorio/higo'); ok((await page.textContent('.labtrio .labing')).toLowerCase().includes('higo'), 'el Laboratorio no parte del producto de la dirección');
// Reto con restricción: cambia y se apunta en el cuaderno
await go('#/laboratorio'); await page.waitForSelector('.labrule-text');
const r1 = await page.textContent('.labrule-text'); await page.click('[data-act=lab-rule]'); await wait(100);
ok((await page.textContent('.labrule-text')) !== r1, 'otro reto no cambia el reto');
const nsp = await page.locator('.labsp').count(); await page.click('[data-act=lab-rule-keep]'); await wait(500);
ok(await page.locator('.labsp').count() === nsp + 1 && (await page.textContent('.labsparks')).includes('Reto: '), 'el reto no se apunta en el cuaderno');
// Cruzar dos chispas y la pregunta del día en la portada
await go('#/laboratorio'); await page.waitForSelector('[data-act=lab-cross]');
const nx = await page.locator('.labsp').count(); await page.click('[data-act=lab-cross]'); await page.waitForSelector('#crossA');
await page.click('.sheet [data-x=save]'); await wait(500);
ok(await page.locator('.labsp').count() === nx + 1 && (await page.textContent('.labsparks')).includes('Cruce: '), 'cruzar dos chispas no apunta el cruce');
await go('#/hoy'); ok(await page.locator('.qday .qday-q').count() === 1, 'la portada no trae la pregunta del día');
await page.click('.qday summary'); ok(await page.locator('.qday-a[open]').count() === 1, 'la pregunta del día no se gira');
// Buscar y filtrar el cuaderno de chispas
await go('#/laboratorio'); await page.waitForSelector('#spQ');
await page.fill('#spQ', 'reto'); await wait(150);
const vis = await page.locator('.labsp:not([hidden])').count();
ok(vis >= 1 && vis < await page.locator('.labsp').count(), 'buscar en las chispas no filtra');
await page.fill('#spQ', ''); await page.click('[data-spf=dish]'); await wait(150);
ok(await page.locator('.labsp:not([hidden]):not(.is-dish)').count() === 0, 'el filtro «ya son plato» enseña otras');
// Tablero de inspiración y compartir una chispa
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.docs['chispa:foto'] = {id: 'chispa:foto', type: 'chispa', text: 'Hoja de higuera al sol', image: 'img/chispas/prueba.jpg', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', version: 1}; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(800); await go('#/laboratorio'); await page.waitForSelector('.labboard-wrap');
ok(await page.locator('.labboard figure').count() >= 1, 'el tablero de inspiración no enseña las chispas con foto');
await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; });
await page.click('[data-sp-share="chispa:foto"]'); await wait(200);
ok((await page.evaluate(() => window.__shared?.text || '')) === 'Hoja de higuera al sol', 'compartir una chispa no manda su texto');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en el laboratorio:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('laboratorio: todo correcto');
