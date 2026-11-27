// Prueba de «ChatGPT en la app» con un OpenAI simulado: conectar la clave, preguntar, consejo, ideas, leer capturas y radar.
import {createRequire} from 'node:module';
import {writeFileSync, mkdirSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium, devices} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href, shots = (process.env.CAPTURAS || (await import('node:os')).tmpdir() + '/id-cocina-capturas') + '/';
mkdirSync(shots, {recursive: true});
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'sk-proj-prueba0123456789abcdefghijklmnop';
const sent = [];
const reply = text => ({status: 200, contentType: 'application/json', body: JSON.stringify({id: 'resp_1', output: [{type: 'reasoning', summary: []}, {type: 'message', role: 'assistant', content: [{type: 'output_text', text, annotations: []}]}]})});
const answers = {
 advice: '{"verdict":"Va bien; sube el ácido.","works":["La brasa"],"changes":[{"what":"Más ácido","why":"Grasa","how":"Encurtido"}],"signature":"Aceite ahumado","service":{"mise":["Cocer"],"pass":"3 min","risks":[]},"plating":"Plato hondo","variants":[{"label":"Más sencilla","idea":"Solo patata"}],"names":[{"es":"Pulpo brasa","en":"Grilled octopus"}],"allergens":["moluscos"],"issues":[]}',
 ideas: '{"ideas":[{"name":"Coliflor asada y miso","line":"Entera","course":"entrante","why":"Umami","twist":"Brasa","components":[{"role":"principal","name":"Coliflor","techniques":["brasa"],"items":["Coliflor"]}]}],"issues":[]}',
 recipe: '{"name":"Ceviche de corvina","portions":"4","components":[{"role":"principal","name":"Corvina","techniques":["crudo"],"items":[{"name":"Corvina","qty":"400 g"},{"name":"Lima","qty":"6"}],"method":["Cortar en dados","Marinar 3 min"]}],"plating":"Plato frío","issues":[]}',
 radar: '```json\n[{"day":"2026-11-19","kind":"tecnica","heat":"alza","title":"Aviso simulado de prueba","summary":"Resumen.","sources":[{"name":"Fuente","url":"https://example.org/a","date":"2026-11-18"}],"ideas":[],"fit":80}]\n```',
 crearViejo: '{"ideas":[{"texto":"Higo asado con miso","por":"dulce y umami","papel":"salsa"},{"texto":"Hoja de higuera","por":"aroma verde","papel":"toque"},{"texto":"Queso de cabra","por":"cremoso y ácido","papel":"cremoso"}]}',
 chat: 'Para la carrillera, **puré de apionabo** tostado:\n- Ásalo entero.\n- Tritúralo con mantequilla.'
};
const browser = await chromium.launch();
async function run(device) {
 const ctx = await browser.newContext({...(device ? devices[device] : {viewport: {width: 1280, height: 900}}), permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true});
 const page = await ctx.newPage(), errors = [];
 page.on('pageerror', e => errors.push(String(e)));
 await ctx.route('https://api.openai.com/v1/models', r => { sent.push({path: 'models', auth: r.request().headers().authorization}); r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [{id: 'gpt-5.4-mini'}, {id: 'gpt-5.5'}, {id: 'gpt-5.5-pro'}, {id: 'gpt-5.4'}, {id: 'gpt-5.5-mini-2026-05-01'}, {id: 'gpt-image-1'}]})}); });
 await ctx.route('https://api.openai.com/v1/responses', async r => {
  const body = JSON.parse(r.request().postData()), all = JSON.stringify(body);
  sent.push({path: 'responses', body, auth: r.request().headers().authorization});
  await wait(150);
  const kind = /"web_search"/.test(all) ? 'radar' : /Analiza este plato/.test(all) ? 'advice' : /Propón exactamente 3 platos/.test(all) ? 'ideas' : /pásala a una ficha de cocina/.test(all) ? 'recipe' : /lluvia de ideas creativas/.test(all) ? 'crear' : 'chat';
  r.fulfill(reply(answers[kind]));
 });
 await page.goto(url); await page.waitForSelector('.hello h1');
 return {ctx, page, errors};
}

// 1. Escritorio: conectar y usarlo todo
let {ctx, page, errors} = await run(null);
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(300); };
// sin conectar, la pantalla de preguntar abre ChatGPT con la pregunta escrita
await go('#/preguntar'); await page.waitForSelector('#askForm');
ok(await page.locator('.notice [data-act=connect]').count() === 1, 'sin clave no ofrece conectar ChatGPT');
await ctx.route(/chatgpt\.com/, r => r.fulfill({body: 'chat'}));
await page.fill('#askText', '¿Qué guarnición para la carrillera?');
const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#askForm button[type=submit]')]);
ok(decodeURIComponent(pop.url()).includes('carrillera'), 'sin clave la pregunta no se abre en ChatGPT'); await pop.close();
// conectar
await page.click('.notice [data-act=connect]'); await page.waitForSelector('#iaKey');
await page.fill('#iaKey', 'esto-no-es-una-clave'); await page.click('[data-act=save-key]'); await wait(200);
ok(!(await page.evaluate(() => localStorage.getItem('id-cocina-ia') || '')).includes('esto-no'), 'guarda una clave que no vale');
await page.fill('#iaKey', KEY); await page.click('[data-act=save-key]'); await page.waitForSelector('#iaKey', {state: 'detached'});
const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-ia')));
ok(cfg.key === KEY && cfg.models.fast === 'gpt-5.4-mini' && cfg.models.smart === 'gpt-5.5', 'no elige bien los modelos de la cuenta: ' + JSON.stringify(cfg.models));
// preguntar con foto
await page.waitForSelector('#askForm'); ok(await page.locator('.notice [data-act=connect]').count() === 0, 'sigue diciendo que no está conectado');
writeFileSync(shots + 'foto.png', Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#c4401a'; x.fillRect(0, 0, 120, 80); x.fillStyle = '#fff'; x.fillText('Ceviche', 20, 40); return c.toDataURL('image/png'); })).split(',')[1], 'base64'));
await page.setInputFiles('#askPhoto', shots + 'foto.png'); await page.waitForSelector('.pending .chip');
await page.fill('#askText', '¿Qué guarnición para la carrillera?'); await page.click('#askForm button[type=submit]');
await page.waitForSelector('.msg-ai .msg-body strong');
const chatReq = sent.filter(x => x.path === 'responses').pop().body;
ok(chatReq.model === 'gpt-5.4-mini' && /basics/.test(chatReq.instructions) && chatReq.input[0].content.some(c => c.type === 'input_image' && c.image_url.startsWith('data:image/jpeg;base64,') && c.detail) && chatReq.store === false, 'la pregunta no va bien montada a OpenAI');
ok((await page.textContent('.msg-ai')).includes('puré de apionabo') && await page.locator('.msg-ai li').count() === 2, 'la respuesta no se ve bien');
ok(sent.every(x => x.auth === 'Bearer ' + KEY || x.path === 'models'), 'la clave no va en la cabecera');
// segunda pregunta lleva la conversación
await page.fill('#askText', '¿Y en verano?'); await page.click('#askForm button[type=submit]'); await page.waitForFunction(() => document.querySelectorAll('.msg-ai .msg-body').length === 2);
const second = sent.filter(x => x.path === 'responses').pop().body;
ok(second.input.length === 3 && second.input[1].role === 'assistant' && !second.input[0].content.some(c => c.type === 'input_image'), 'la segunda pregunta no lleva la conversación (o reenvía la foto)');
await page.reload(); await page.waitForSelector('.msg-ai'); ok(await page.locator('.msg').count() === 4, 'la conversación no se guarda: ' + await page.locator('.msg').count() + ' ' + await page.evaluate(() => localStorage.getItem('id-cocina-preguntas')));
await page.screenshot({path: shots + 'ia-preguntar.png', fullPage: true});
// consejo de un plato con un botón
await go('#/plato/nuevo'); await page.waitForSelector('#dishName'); await page.fill('#dishName', 'Pulpo de prueba');
await page.click('[data-add-comp=principal]'); await page.fill('#ingSearch', 'pulpo'); await page.locator('#ingResults .result').first().click(); await page.fill('#ingSearch', 'patata'); await page.locator('#ingResults .result').first().click(); await page.click('.sheet [data-close]');
await page.waitForSelector('.save-saved', {timeout: 8000});
await page.click('[data-act=advice-ia]'); await page.waitForSelector('.advice-lead');
ok((await page.textContent('.advice-lead')).includes('sube el ácido'), 'el consejo de ChatGPT no se guarda en el plato');
const adv = sent.filter(x => x.path === 'responses').pop().body; ok(adv.text?.format?.type === 'json_object', 'el consejo no pide JSON');
await page.waitForSelector('.save-saved', {timeout: 8000}); await page.reload(); await page.waitForSelector('.advice-lead');
ok(await page.locator('a[href^="#/preguntar/"]').count() >= 1, 'no hay enlace para preguntar sobre el plato');
// preguntar sobre el plato y guardar en notas
await page.locator('a[href^="#/preguntar/"]').first().click(); await page.waitForSelector('#askForm');
ok((await page.textContent('.page-head')).includes('Pulpo de prueba'), 'la pregunta sobre el plato no sabe de qué plato es');
await page.locator('#suggest .chip').first().click(); await page.waitForSelector('.msg-ai [data-note]');
const dishReq = sent.filter(x => x.path === 'responses').pop().body; ok(/Pulpo de prueba/.test(dishReq.instructions), 'la pregunta no lleva el plato');
await page.click('.msg-ai [data-note]'); await wait(300);
const notes = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.name === 'Pulpo de prueba').notes);
ok(notes.includes('puré de apionabo') && notes.includes('—'), 'no se guarda en las notas del plato');
// ideas
await go('#/crear/ideas'); await page.waitForSelector('#brief'); await page.fill('#brief', 'Entrante con coliflor'); await page.click('#ideasForm button[type=submit]'); await page.waitForSelector('.idea-result');
ok((await page.textContent('.idea-result')).includes('Coliflor asada y miso'), 'las ideas de ChatGPT no salen');
// crear: con ChatGPT conectado, la mesa de ideas sigue sin preguntarle (todo sale de la base de la app)
const beforeCrear = sent.length;
await go('#/crear'); await page.waitForSelector('#bPlate'); await page.fill('#bBrief', 'Cordero'); await page.click('#bStart button[type=submit]'); await page.waitForSelector('.bgroup-goes [data-add]');
await page.locator('.bgroup-goes [data-add]').first().click(); await wait(300);
ok(sent.length === beforeCrear, 'Crear pregunta a ChatGPT y no debe');
ok(await page.locator('[data-act=b-ai], #bAsk, .bgroup-ai').count() === 0, 'Crear sigue enseñando cosas de ChatGPT');
await page.click('[data-act=b-new]'); await wait(200);
// importar desde captura
await go('#/crear/importar'); await page.waitForSelector('#recipeShot', {state: 'attached'});
await page.setInputFiles('#recipeShot', shots + 'foto.png'); await page.waitForSelector('#recipePreview');
ok((await page.textContent('#recipePreview')).includes('400 g Corvina'), 'la captura no se lee');
const shotReq = sent.filter(x => x.path === 'responses').pop().body; ok(shotReq.input[0].content.filter(c => c.type === 'input_image').length === 1, 'la captura no se envía');
await page.click('[data-act=save-recipe]'); await page.waitForSelector('#dishName'); ok(await page.inputValue('#dishName') === 'Ceviche de corvina', 'la receta de la captura no llega a la libreta');
// importar texto con ChatGPT
await go('#/crear/importar'); await page.waitForSelector('#recipeReply'); await page.fill('#recipeReply', 'ceviche: corvina 400g, 6 limas, marinar 3 min'); await page.click('[data-act=read-recipe]'); await page.waitForSelector('#recipePreview');
ok((await page.textContent('#recipePreview')).includes('Ceviche de corvina'), 'el texto no lo lee ChatGPT');
// radar: búsqueda en internet con un botón
await go('#/radar'); await page.waitForSelector('[data-act=search]'); await page.click('[data-act=search]'); await page.waitForFunction(() => document.body.innerText.includes('Aviso simulado de prueba'), null, {timeout: 8000}).catch(() => fails.push('el radar no añade lo encontrado'));
const radarReq = sent.filter(x => x.path === 'responses').pop().body; ok(radarReq.tools?.[0]?.type === 'web_search' && !radarReq.text, 'el radar no busca en internet');
// la copia de seguridad nunca lleva la clave
await page.click('.rail [data-act=menu]'); await wait(1500); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.sheet [data-act=backup]')]);
const copyText = require('node:fs').readFileSync(await dl.path(), 'utf8'); ok(!copyText.includes(KEY) && !copyText.includes('sk-proj'), 'la copia de seguridad lleva la clave');
// errores claros: saldo agotado
await ctx.unroute('https://api.openai.com/v1/responses'); await ctx.route('https://api.openai.com/v1/responses', r => r.fulfill({status: 429, contentType: 'application/json', body: JSON.stringify({error: {code: 'insufficient_quota', message: 'You exceeded your current quota'}})}));
await go('#/preguntar'); await page.waitForSelector('#askForm'); await page.fill('#askText', 'hola'); await page.click('#askForm button[type=submit]'); await page.waitForSelector('.toast-error');
ok((await page.textContent('#toasts')).includes('saldo'), 'el error de saldo no se explica');
// desconectar
await page.click('.rail [data-act=menu]'); await page.click('.sheet [data-act=ia]'); await page.waitForSelector('[data-act=forget-key]'); await page.click('[data-act=forget-key]'); await wait(200);
ok(!(await page.evaluate(() => localStorage.getItem('id-cocina-ia'))).includes('sk-'), 'no borra la clave');
ok(!errors.length, 'errores en la página: ' + errors.join(' | '));
await ctx.close();

// 2. Móvil: la pantalla de preguntar no se sale y el radar diario se lanza solo una vez al día
({ctx, page, errors} = await run('iPhone 13'));
await page.evaluate(k => localStorage.setItem('id-cocina-ia', JSON.stringify({key: k, models: {fast: 'gpt-5.4-mini', smart: 'gpt-5.5'}})), KEY);
const before = sent.length; await page.reload(); await page.waitForSelector('.hello h1'); await wait(800);
ok(sent.slice(before).filter(x => x.body?.tools).length === 1, 'el radar diario no se lanza al abrir');
await page.reload(); await page.waitForSelector('.hello h1'); await wait(800);
ok(sent.slice(before).filter(x => x.body?.tools).length === 1, 'el radar diario se repite el mismo día');
await page.click('.top a[href="#/preguntar"]'); await page.waitForSelector('#askForm'); await page.fill('#askText', 'Una salsa'); await page.click('#askForm button[type=submit]'); await page.waitForSelector('.msg-ai');
ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'la pantalla de preguntar se sale en el móvil');
await page.screenshot({path: shots + 'ia-movil.png', fullPage: true});
ok(!errors.length, 'errores en el móvil: ' + errors.join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'ChatGPT en la app: todo correcto');
