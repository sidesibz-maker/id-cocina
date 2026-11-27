// Prueba de: subrecetas, versiones, temporada, dictado, etiquetas, maridaje, radar a tu medida, carta para sala y ficha del equipo.
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium, devices} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href, fichaUrl = new URL('./salida/web/ficha.html', import.meta.url).href;
const shots = (process.env.CAPTURAS || (await import('node:os')).tmpdir() + '/id-cocina-capturas') + '/';
mkdirSync(shots, {recursive: true});
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();
const shares = new Map();
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'};
async function rpc(route) {
 const req = route.request();
 if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
 const name = req.url().split('/rpc/')[1], b = JSON.parse(req.postData() || '{}');
 let out;
 if (name === 'id_share_put') { const cur = shares.get(b.token); if (cur && cur.key !== b.edit_key) return route.fulfill({status: 400, headers: cors, body: '{"message":"sin permiso"}'}); shares.set(b.token, {key: b.edit_key, data: b.data, active: true, updated_at: now()}); out = true; }
 else if (name === 'id_share_off') { const cur = shares.get(b.token); out = !!cur && cur.key === b.edit_key; if (out) cur.active = false; }
 else if (name === 'id_share_get') { const cur = shares.get(b.token); out = cur && cur.active ? {ok: true, data: cur.data, updated_at: cur.updated_at} : {ok: false}; }
 else out = {ok: true};
 route.fulfill({status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(out)});
}
const reply = text => ({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text}]}]})});
async function openai(route) {
 const body = route.request().postData() || '';
 if (/sumiller/.test(body) && /PLATOS:/.test(body)) return route.fulfill(reply('- 1. Pulpo: Albariño de Rías Baixas\n- 2. Cordero: Mencía del Bierzo\nSin alcohol: kombucha de manzana.'));
 if (/sumiller/.test(body)) return route.fulfill(reply('- Albariño de Rías Baixas: acidez para el pulpo.\n- Sin alcohol: agua de pepino y lima.\nServir a 9 °C.'));
 return route.fulfill(reply('Respuesta.'));
}
const dish = (id, name, course, items, extra = {}) => ({id, name, concept: '', course, season: 'Invierno 2026', status: 'idea', tags: [], components: [{id: 'c' + id, role: 'principal', name: '', techniques: ['brasa'], items: items.map((k, i) => ({n: k, k, w: i ? 2 : 3, src: 'kb'}))}], tests: [], images: [], notes: '', version: 1, created_at: now(), updated_at: now(), deleted_at: null, ...extra});
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
await ctx.route(/dyacksxibcwvrdsulsfc\.supabase\.co\/rest\/v1\/rpc\//, rpc);
await ctx.route('https://api.openai.com/v1/responses', openai);
await ctx.route(/wa\.me|chatgpt\.com/, r => r.fulfill({body: 'ok'}));
// Dictado simulado: el «micrófono» dice una frase.
await ctx.addInitScript(() => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult?.({resultIndex: 0, results: [Object.assign([{transcript: 'menos sal en la salsa'}], {isFinal: true})]}); setTimeout(() => this.onend?.(), 50); }, 50); } stop() { this.onend?.(); } }; });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(300); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(s => { localStorage.setItem('id-cocina-v1', JSON.stringify(s)); localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-proj-prueba0123456789abcdefghijklmnop', daily: false})); }, {dishes: [dish('d1', 'Pulpo a la brasa', 'entrante', ['pulpo', 'patata']), dish('d2', 'Cordero y patata', 'principal', ['cordero', 'patata'])]});
await page.reload(); await page.waitForSelector('.hello h1');

// 1. Subrecetas
await go('#/cocina'); await page.waitForSelector('[data-act=new-sub]'); await page.click('[data-act=new-sub]'); await page.waitForSelector('#subName');
await page.fill('#subName', 'Romesco de la casa'); await page.fill('#subYield', '1 litro');
for (const q of ['tomate', 'almendra', 'ajo']) { await page.click('[data-act=add]'); await page.fill('#subSearch', q); await page.locator('#subResults [data-pick]').first().click(); await page.click('.sheet [data-close]'); await wait(250); }
await page.fill('#sq0', '500 g'); await page.fill('#subMethod', 'Asar el tomate.\nTriturar con la almendra.'); await wait(800);
ok(await page.locator('.sub-items li').count() === 3 && await page.locator('#subFlavour .fm-row').count() === 9, 'la subreceta no tiene ingredientes o sabor');
await go('#/cocina'); await page.waitForSelector('.sub-card'); ok((await page.textContent('.sub-card')).includes('Romesco de la casa'), 'la subreceta no sale en Mi cocina');
const sub = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).subs[0]);
ok(sub.items[0].q === '500 g' && sub.method.includes('Triturar') && sub.yield === '1 litro', 'la subreceta no guarda cantidad, elaboración o rendimiento');
await go('#/plato/d1'); await page.waitForSelector('#dishName');
await page.click('[data-add-comp=salsa]'); await page.fill('#ingSearch', 'romesco de'); const first = await page.locator('#ingResults .result').first().textContent();
ok(first.includes('Romesco de la casa') && first.includes('subreceta'), 'la subreceta no sale la primera al buscar: ' + first);
await page.locator('#ingResults .result').first().click(); await page.click('.sheet [data-close]'); await page.waitForSelector('.save-saved', {timeout: 8000});
const it = await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'd1').components[1].items[0]);
ok(it.src === 'recipe' && it.ref && it.mix?.length === 3, 'el plato no usa la subreceta con su sabor');
await page.evaluate(() => { window.print = () => { window.__p = document.getElementById('printFicha').innerText; }; });
await page.click('#fichaSec [data-act=print]'); await page.waitForFunction(() => window.__p);
ok((await page.evaluate(() => window.__p)).includes('Subreceta: Romesco de la casa'), 'la ficha impresa no lleva la subreceta');
await page.evaluate(() => dispatchEvent(new Event('afterprint')));
await page.locator('[data-comp="0"] [data-act=to-sub]').click(); await wait(300);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).subs.length) === 2, 'no se guarda un componente como subreceta');

// 2. Versiones
await page.fill('#dishName', 'Pulpo cambiado'); await page.waitForSelector('.save-saved', {timeout: 8000}); await wait(300);
await page.click('[data-act=more]'); await page.click('.sheet [data-act=versions]'); await page.waitForSelector('.versions li');
const vText = await page.textContent('.sheet:has(.versions)');
ok(/se llamaba «Pulpo a la brasa»/.test(vText), 'las versiones no dicen qué cambió: ' + vText.slice(0, 160));
await page.locator('.versions [data-cmp]').first().click(); await page.waitForSelector('.cmp');
const cmpText = await page.textContent('.sheet:has(.cmp)');
ok(cmpText.includes('Pulpo a la brasa') && cmpText.includes('Pulpo cambiado'), 'comparar no enseña el antes y el ahora: ' + cmpText.slice(0, 200));
await page.click('.sheet:has(.cmp) .sheet-head [data-close]'); await wait(300);
await page.locator('.versions [data-v]').first().click(); await page.click('.sheet .btn.primary:has-text("Recuperar")'); await wait(500);
ok(await page.inputValue('#dishName') === 'Pulpo a la brasa', 'no se recupera la versión');
// Deshacer: lo de antes de recuperar quedó como versión (con la salsa); se vuelve a ella.
await page.click('[data-act=more]'); await page.click('.sheet [data-act=versions]'); await page.waitForSelector('.versions li');
ok(await page.locator('.versions li').count() >= 2, 'recuperar no guarda lo de antes como versión');
await page.locator('.versions [data-v]').first().click(); await page.click('.sheet .btn.primary:has-text("Recuperar")'); await wait(500);
ok(await page.inputValue('#dishName') === 'Pulpo cambiado' && (await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).dishes.find(d => d.id === 'd1').components.length)) === 2, 'no se puede deshacer la recuperación');

// 3. Etiquetas y 4. dictado
await page.fill('#tagInput', 'Vegetal'); await page.press('#tagInput', 'Enter'); await wait(200);
ok((await page.textContent('#tagsRow')).includes('#vegetal'), 'la etiqueta no se añade');
await page.locator('#notesSec .voice-btn').click(); await wait(400);
ok((await page.inputValue('#dishNotes')).includes('Menos sal en la salsa'), 'el dictado no escribe en las notas');
await page.waitForSelector('.save-saved', {timeout: 8000});
await go('#/libreta'); await page.waitForSelector('[data-tagf]'); await page.click('[data-tagf=vegetal]'); await wait(200);
ok(await page.locator('#bookGrid .dish').count() === 1 && (await page.textContent('#bookGrid')).includes('#vegetal'), 'el filtro por etiqueta no funciona');

// 5. Maridaje
await go('#/plato/d1'); await page.waitForSelector('#pairSec'); await page.click('[data-act=pair-ia]'); await page.waitForFunction(() => document.querySelector('#pairSec .msg-body'));
ok((await page.textContent('#pairSec')).includes('Albariño'), 'el maridaje no se guarda en el plato');

// 6. Temporada
await go('#/temporada/11'); await page.waitForSelector('.season-sec');
const nov = await page.textContent('#view'); ok(nov.includes('Gerret') && nov.includes('De aquí') && nov.includes('Entra ahora'), 'la temporada de noviembre no sale bien');
await page.click('.month[href="#/temporada/7"]'); await wait(300); ok((await page.textContent('.season-month')).includes('julio'), 'no cambia de mes');

// 7. Radar a tu medida
await go('#/radar'); await page.waitForSelector('[data-act=interests]'); await page.click('[data-act=interests]'); await page.fill('#iNew', 'alcachofa'); await page.press('#iNew', 'Enter'); await page.click('[data-act=i-save]'); await wait(300);
ok(await page.locator('.group-follow').count() === 1 || await page.locator('.trend-strip .follow, .trows .follow').count() > 0, 'el radar no destaca lo que sigues');
ok((await page.evaluate(() => JSON.parse(localStorage.getItem('id-cocina-v1')).settings.interests)).includes('alcachofa'), 'no se guarda lo que te interesa');

// 8. Carta para sala y maridaje del menú
await go('#/menus'); await page.locator('[data-act=new]').first().click(); await page.waitForSelector('#menuName'); await page.fill('#menuName', 'Menú de prueba'); await wait(600);
await page.click('[data-act=add]'); await page.locator('.pick input').nth(0).check(); await page.locator('.pick input').nth(1).check(); await page.click('.sheet [data-act=ok]'); await page.waitForSelector('.mrow');
await page.click('#menuPair [data-act=pair]'); await page.waitForFunction(() => document.querySelector('#menuPair .msg-body')); ok((await page.textContent('#menuPair')).includes('Mencía'), 'el maridaje del menú no se guarda');
await page.evaluate(() => { window.__p = ''; window.print = () => { window.__p = document.getElementById('printFicha').innerText; }; });
await page.click('[data-act=sala]'); await page.waitForFunction(() => window.__p);
const sala = await page.evaluate(() => window.__p); ok(sala.includes('Menú de prueba') && sala.includes('Cordero y patata') && /alérgenos/i.test(sala), 'la carta para sala no sale bien');
await page.evaluate(() => dispatchEvent(new Event('afterprint')));

// 9. Ficha para el equipo
await go('#/plato/d1'); await page.waitForSelector('#fichaSec'); await page.click('#fichaSec [data-act=team]'); await page.click('.sheet [data-s=on]'); await page.waitForSelector('.share-url');
const link = (await page.textContent('.share-url')).trim(), token = link.split('#')[1];
ok(link.startsWith('https://sidesibz-maker.github.io/id-cocina/ficha.html#') && shares.has(token), 'no se crea el enlace del equipo');
ok(!JSON.stringify(shares.get(token).data).includes('Menos sal'), 'la ficha del equipo lleva las notas privadas');
await page.click('.sheet [data-close]');
const team = await ctx.newPage(); await team.goto(fichaUrl + '#' + token); await team.waitForSelector('h1');
ok((await team.textContent('h1')) === 'Pulpo cambiado' && (await team.textContent('main')).includes('Romesco de la casa') && (await team.textContent('main')).includes('500 g'), 'la ficha del equipo no se ve bien');
await page.fill('#dishConcept', 'Versión de invierno'); await page.waitForSelector('.save-saved', {timeout: 8000}); await wait(3600);
await team.reload(); await team.waitForSelector('h1'); ok((await team.textContent('main')).includes('Versión de invierno'), 'la ficha del equipo no se pone al día');
await page.click('#fichaSec [data-act=team]'); await page.click('.sheet [data-s=off]'); await wait(400);
await team.reload(); await team.waitForSelector('h1'); ok((await team.textContent('h1')).includes('ya no se comparte'), 'dejar de compartir no corta el enlace');
await team.screenshot({path: shots + 'ficha-equipo.png'});
// Hoy a tu gusto: quitar el radar y la pregunta del día, y que se recuerde
await page.evaluate(() => { location.hash = '#/hoy'; }); await page.waitForSelector('[data-act=home-custom]');
await page.click('[data-act=home-custom]'); await page.waitForSelector('[data-part=radar]');
await page.uncheck('[data-part=radar]'); await page.uncheck('[data-part=search]'); await wait(200);
ok(await page.locator('#homeSaber').count() === 0, 'quitar el buscador de Hoy no lo quita');
await page.keyboard.press('Escape'); await page.reload(); await page.waitForSelector('.hello h1');
ok(await page.locator('#homeSaber').count() === 0, 'Hoy no recuerda lo que quitaste');
await page.click('[data-act=home-custom]'); await page.waitForSelector('[data-part=search]'); await page.check('[data-part=search]'); await page.check('[data-part=radar]'); await wait(200); await page.keyboard.press('Escape');
ok(await page.locator('#homeSaber').count() === 1, 'volver a poner el buscador en Hoy no funciona');
ok(!errors.length, 'errores: ' + errors.join(' | '));
await browser.close();
console.log(fails.length ? 'FALLOS:\n - ' + fails.join('\n - ') : 'lo más nuevo: todo correcto');
