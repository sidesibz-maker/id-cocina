// Prueba de lo nuevo: WhatsApp, género recién llegado, cartas y menús, revisión del emplatado y sincronización entre dos aparatos
// (con un servidor simulado que hace lo mismo que las funciones de la base de datos: gana lo más reciente y nada se borra).
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium, devices} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href, shots = (process.env.CAPTURAS || (await import('node:os')).tmpdir() + '/id-cocina-capturas') + '/';
mkdirSync(shots, {recursive: true});
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'sk-proj-prueba0123456789abcdefghijklmnop', now = () => new Date().toISOString();

// ---------- Servidor de sincronización simulado ----------
const db = {spaces: new Set(), items: new Map(), history: [], images: new Map(), seq: 0};
const ik = (s, k, id) => s + '|' + k + '|' + id;
const RPC = {
 id_open({secret, create_new}) { if (!db.spaces.has(secret)) { if (!create_new) return {ok: false}; db.spaces.add(secret); } return {ok: true}; },
 id_push({secret, items}) { if (!db.spaces.has(secret)) throw Error('libreta no encontrada'); let accepted = 0, skipped = 0; for (const it of items) { const key = ik(secret, it.kind, it.id), cur = db.items.get(key); if (cur && new Date(it.updated_at) <= new Date(cur.updated_at)) { skipped++; continue; } if (cur) db.history.push(cur); db.items.set(key, {space: secret, kind: it.kind, id: it.id, data: it.data, updated_at: it.updated_at, seq: ++db.seq}); accepted++; } return {accepted, skipped}; },
 id_pull({secret, since}) { const list = [...db.items.values()].filter(x => x.space === secret && x.seq > since).sort((a, b) => a.seq - b.seq).slice(0, 300); return {items: list, seq: list.length ? list[list.length - 1].seq : since}; },
 id_push_image({secret, path, data}) { const key = secret + '|' + path; if (!db.images.has(key)) db.images.set(key, {space: secret, path, data, seq: ++db.seq}); return true; },
 id_image_paths({secret}) { return [...db.images.values()].filter(x => x.space === secret).map(x => x.path); },
 id_pull_images({secret, since}) { const list = [...db.images.values()].filter(x => x.space === secret && x.seq > since).sort((a, b) => a.seq - b.seq).slice(0, 12); return {images: list, seq: list.length ? list[list.length - 1].seq : since}; }
};
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
async function serve(route) {
 const req = route.request();
 if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
 const name = req.url().split('/rpc/')[1];
 try { route.fulfill({status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(RPC[name](JSON.parse(req.postData() || '{}')))}); }
 catch (e) { route.fulfill({status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({message: e.message})}); }
}
// ---------- ChatGPT simulado ----------
const reply = text => ({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text}]}]})});
async function openai(route) {
 const body = route.request().postData() || '';
 if (/Ha llegado este género/.test(body)) return route.fulfill(reply('{"ideas":[{"name":"Rape a la brasa con ajada","line":"Entero","course":"principal","why":"x","twist":"y","components":[{"role":"principal","name":"Rape","techniques":["brasa"],"items":["Rape"]}]}],"issues":[]}'));
 if (/revisando el emplatado/.test(body)) return route.fulfill(reply('Bien el punto del pulpo.\n- Limpia el borde del plato.\n- Más salsa debajo.\nNota: 7/10'));
 if (/menú degustación/.test(body)) return route.fulfill(reply('El conjunto funciona.\n- Separa los dos platos grasos.'));
 return route.fulfill(reply('Respuesta.'));
}
const dish = (id, name, course, items, extra = {}) => ({id, name, concept: '', course, season: 'Invierno 2026', status: 'idea', tags: [], components: [{id: 'c' + id, role: 'principal', name: '', techniques: ['brasa'], items: items.map((k, i) => ({n: k, k, w: i ? 2 : 3, src: 'kb'}))}], tests: [], images: [], notes: '', version: 1, created_at: now(), updated_at: now(), deleted_at: null, ...extra});
const browser = await chromium.launch();
async function device(opts, seed) {
 const ctx = await browser.newContext({...opts, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true});
 await ctx.route(/dyacksxibcwvrdsulsfc\.supabase\.co\/rest\/v1\/rpc\//, serve);
 await ctx.route('https://api.openai.com/v1/responses', openai);
 await ctx.route(/wa\.me|chatgpt\.com/, r => r.fulfill({body: 'ok'}));
 const page = await ctx.newPage(), errors = [];
 page.on('pageerror', e => errors.push(String(e)));
 await page.goto(url); await page.waitForSelector('.hello h1');
 if (seed) { await page.evaluate(s => { localStorage.setItem('id-cocina-v1', JSON.stringify(s)); localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', models: {fast: 'gpt-5.4-mini', smart: 'gpt-5.5'}, daily: false})); }, seed); await page.reload(); await page.waitForSelector('.hello h1'); }
 const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(300); };
 return {ctx, page, errors, go};
}

// ===== PC =====
const seed = {dishes: [dish('d1', 'Pulpo, patata y romesco', 'entrante', ['pulpo', 'patata', 'romesco']), dish('d2', 'Cordero con patata', 'principal', ['cordero', 'patata', 'aove']), dish('d3', 'Calabaza y miso', 'entrante', ['calabaza', 'miso'])]};
const pc = await device({viewport: {width: 1280, height: 900}}, seed);
let {page, go} = pc;
// WhatsApp
await go('#/plato/d1'); await page.waitForSelector('#fichaSec');
await page.locator('[data-comp="0"] .ing').first().click(); await page.fill('#itemQty', '180 g'); await page.press('#itemQty', 'Enter'); await wait(300);
const [wa] = await Promise.all([pc.ctx.waitForEvent('page'), page.click('#fichaSec [data-act=share]')]);
const waText = decodeURIComponent(wa.url()); await wa.close();
ok(waText.startsWith('https://wa.me/?text=') && waText.includes('*Pulpo, patata y romesco*') && waText.includes('180 g'), 'la ficha no se manda bien por WhatsApp: ' + waText.slice(0, 120));
// Revisión del emplatado
const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#b55'; x.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1]; });
writeFileSync(shots + 'pase.png', Buffer.from(png, 'base64'));
await page.setInputFiles('#plateFile', shots + 'pase.png'); await page.waitForSelector('.plate-compare');
ok((await page.textContent('.sheet')).includes('Limpia el borde'), 'la revisión del emplatado no se ve');
await page.click('.sheet [data-r=photo]'); await wait(400); await page.click('.sheet [data-r=test]'); await wait(300); await page.click('.sheet [data-close]');
ok(await page.locator('.tests li').count() === 1 && (await page.textContent('.tests')).includes('Revisión del emplatado') && await page.locator('.tests .stars i.on').count() === 4, 'la revisión no se apunta como prueba (con 4 estrellas por un 7)');
await page.waitForSelector('.save-saved', {timeout: 8000}); ok(await page.locator('.shot img').count() === 1, 'la foto del pase no se guarda en el plato');
// Ha llegado género
await go('#/crear'); await page.click('a[href="#/crear/llegado"]'); await page.waitForSelector('#arrivedForm');
await page.setInputFiles('#arrivedPhoto', shots + 'pase.png'); await page.waitForSelector('#arrivedPics .chip');
await page.fill('#arrivedText', '6 kg de rape'); await page.click('#arrivedForm button[type=submit]'); await page.waitForSelector('.idea-result');
ok((await page.textContent('.idea-result')).includes('Rape a la brasa'), 'no propone platos con el género');
// Cartas y menús
await go('#/libreta'); await page.click('.book-tabs a[href="#/menus"]'); await page.waitForSelector('[data-act=new]');
await page.locator('[data-act=new]').first().click(); await page.waitForSelector('#menuName');
await page.fill('#menuName', 'Menú invierno'); await page.click('[data-act=add]'); await page.waitForSelector('.pick');
for (const n of ['Pulpo, patata y romesco', 'Calabaza y miso', 'Cordero con patata']) await page.locator('.pick', {hasText: n}).locator('input').check();
await page.click('.sheet [data-act=ok]'); await page.waitForSelector('.mrow');
ok(await page.locator('.mrow').count() === 3, 'no se añaden los platos al menú');
const notes = await page.textContent('.menu-bench .analysis');
ok(/Patata sale en 2 platos/i.test(notes) && /No hay postre/.test(notes), 'el análisis del menú no ve lo repetido o el postre: ' + notes.slice(0, 200));
await page.click('[data-up="2"]'); await wait(200); ok((await page.locator('.mrow strong').nth(1).textContent()) === 'Cordero con patata', 'no se puede cambiar el orden');
await page.click('#menuAdvice [data-act=advice]'); await page.waitForFunction(() => document.querySelector('#menuAdvice .msg-body')); ok((await page.textContent('#menuAdvice')).includes('Separa los dos platos grasos'), 'la opinión de ChatGPT sobre el menú no se guarda');
await page.screenshot({path: shots + 'menu.png', fullPage: true});
await page.click('[data-act=more]'); await page.click('.sheet .btn.danger'); await page.waitForSelector('.bin'); ok((await page.textContent('.bin')).includes('Menú invierno'), 'el menú no va a la papelera');
await page.click('[data-restore]'); await wait(200); ok(await page.locator('.menu-card').count() === 1, 'el menú no se recupera');
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('.rail [data-act=menu]'); await page.click('.sheet [data-act=backup]'); })()]);
ok(JSON.parse(require('node:fs').readFileSync(await dl.path(), 'utf8')).menus?.length === 1, 'la copia de seguridad no lleva los menús');
// Sincronizar: empezar en el PC
await page.click('.rail [data-act=menu]'); await page.click('.sheet [data-act=sync]'); await page.waitForSelector('[data-act=start]');
await page.click('[data-act=start]'); await page.waitForSelector('#syncCodeShow');
const code = (await page.textContent('#syncCodeShow')).trim();
ok(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(code), 'el código no tiene buena pinta: ' + code);
ok([...db.items.values()].filter(x => x.kind === 'dish').length === 3 && [...db.items.values()].some(x => x.kind === 'menu') && db.images.size === 1, 'el PC no sube todo (platos, menú, foto)');
await page.click('.sheet [data-close]');

// ===== Móvil con un plato propio =====
const mob = await device(devices['iPhone 13'], {dishes: [dish('m1', 'Torrija del móvil', 'postre', ['naranja'])]});
await mob.page.click('.top [data-act=menu]'); await mob.page.click('.sheet [data-act=sync]'); await mob.page.waitForSelector('#syncCode');
await mob.page.fill('#syncCode', code.toLowerCase().replace(/-/g, ' ')); await mob.page.click('[data-act=join]'); await mob.page.waitForSelector('#syncCodeShow', {timeout: 10000});
const mobState = await mob.page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')));
ok(mobState.dishes.length === 4 && mobState.menus?.length === 1 && mobState.dishes.some(d => d.name === 'Torrija del móvil'), 'el móvil no junta lo de los dos: ' + mobState.dishes.map(d => d.name).join(', '));
await mob.go('#/plato/d1'); await mob.page.waitForSelector('#dishName'); await mob.page.waitForSelector('.shot img[src^="blob:"]', {timeout: 8000}).catch(() => fails.push('la foto no llega al móvil'));
// Cambio en el móvil → llega al PC
await mob.page.fill('#dishConcept', 'Cambiado en el móvil'); await mob.page.waitForSelector('.save-saved', {timeout: 8000});
await mob.page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(2500);
const pcDish = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'd1'));
ok(pcDish.concept === 'Cambiado en el móvil' && pcDish.components[0].items[0].q === '180 g' && pcDish.tests.length === 1, 'el cambio del móvil no llega al PC o se pierde algo');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.some(d => d.name === 'Torrija del móvil')), 'el plato del móvil no llega al PC');
ok(db.history.length >= 1, 'el servidor no guarda la versión anterior');
// Un código que no existe
const third = await device({viewport: {width: 1000, height: 800}}, null);
await third.page.click('.rail [data-act=menu]'); await third.page.click('.sheet [data-act=sync]'); await third.page.fill('#syncCode', 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ'); await third.page.click('[data-act=join]'); await third.page.waitForSelector('.toast-error');
ok((await third.page.textContent('#toasts')).includes('no corresponde'), 'un código malo no se explica');
// Dejar de sincronizar no borra nada
await mob.page.click('.top [data-act=menu]'); await mob.page.click('.sheet [data-act=sync]'); await mob.page.click('[data-act=stop]'); await wait(200);
ok((await mob.page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.length)) === 4, 'dejar de sincronizar borra platos');
for (const d of [pc, mob, third]) ok(!d.errors.length, 'errores: ' + d.errors.join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'lo nuevo: todo correcto');
