// Prueba del diario de cocina y de «Mi trayectoria»: escribir, buscar, repasar la semana (con ChatGPT simulado),
// objetivos con pasos y logros, técnicas, platos firma, dossier, papelera sin borrar, copia de seguridad y que lo nuevo
// se manda a sincronizar como tipo «doc».
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true});
let asked = '';
await ctx.route('https://api.openai.com/v1/responses', async r => { asked = r.request().postData() || ''; await r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: 'Se repiten los retrasos en el pase.\n\nOrganiza la mise en place de la brasa antes.\n\nLa semana que viene: tiempos del pase.'}]}]})}); });
const pushed = [];
await ctx.route('https://dyacksxibcwvrdsulsfc.supabase.co/rest/v1/rpc/*', async r => {
 const name = r.request().url().split('/').pop(), body = JSON.parse(r.request().postData() || '{}');
 if (name === 'id_push') { pushed.push(...body.items); return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({accepted: body.items.length, skipped: 0})}); }
 if (name === 'id_pull') return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({items: [], seq: 1})});
 if (name === 'id_pull_images') return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({images: [], seq: 0})});
 return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify([])});
});
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(350); };
await page.goto(url); await page.waitForSelector('.hello h1');
await page.evaluate(() => { localStorage.setItem('id-cocina-v1', JSON.stringify({dishes: [{id: 'd1', name: 'Calamar a la brasa', course: 'principal', status: 'carta', components: [{id: 'c', role: 'principal', name: '', techniques: ['brasa'], items: [{n: 'Calamar', k: null, w: 3}]}], tests: [], images: [], version: 1, created_at: new Date().toISOString(), updated_at: '2026-11-20T10:00:00Z'}]})); localStorage.setItem('id-cocina-ia', JSON.stringify({key: 'sk-prueba-1234567890abcdefghij'})); localStorage.setItem('id-cocina-sync', JSON.stringify({code: 'ABCDEFGHJKLMNPQRSTUVWXYZ'})); });
await page.reload(); await page.waitForSelector('.hello h1');
// Portada: «Tu oficio»
ok((await page.textContent('.craft')).includes('¿Cómo ha ido hoy?'), 'la portada no invita a escribir el diario');
ok((await page.textContent('.rail')).includes('Diario') && (await page.textContent('.rail')).includes('Trayectoria'), 'el menú no tiene Diario y Trayectoria');
// Diario
await go('#/diario'); ok(await page.isVisible('.empty'), 'el diario vacío no lo explica');
await go('#/diario/nuevo'); await page.fill('#jcovers', '74'); await page.click('.jmoods label:nth-child(4)');
await page.fill('#j-good', 'El calamar salió perfecto'); await page.fill('#j-bad', 'Retraso en el pase de la brasa'); await page.fill('#j-learned', 'Atemperar el calamar antes de la brasa');
await page.click('.jdishes label'); await page.click('#jform button[type=submit]'); await wait(400);
ok(await page.evaluate(() => location.hash) === '#/diario', 'guardar no vuelve al diario');
ok(await page.locator('.jcard').count() === 1, 'no sale la entrada guardada');
ok((await page.textContent('.jstats')).includes('74'), 'no cuenta los cubiertos de la semana');
await page.fill('#jq', 'atemperar'); await wait(100); ok(await page.locator('.jcard:not([hidden])').count() === 1, 'buscar no encuentra lo aprendido');
await page.fill('#jq', 'zzzz'); await wait(100); ok(await page.locator('.jcard:not([hidden])').count() === 0, 'buscar no filtra');
await page.fill('#jq', '');
const doc = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.type === 'diario'));
ok(doc && doc.covers === 74 && doc.mood === 4 && doc.dishes[0] === 'd1', 'la entrada no guarda bien sus datos: ' + JSON.stringify(doc));
await page.click('[data-review]'); await page.waitForSelector('.sheet [data-act=ia]'); await page.click('.sheet [data-act=ia]'); await page.waitForSelector('#jrev .callout');
ok(asked.includes('Retraso en el pase'), 'el repaso no manda el diario a ChatGPT');
ok((await page.textContent('#jrev')).includes('mise en place'), 'no enseña el resumen de la semana');
await page.click('.sheet-head [data-close]'); await wait(400);
await page.click('.jcard'); await page.waitForSelector('#jform'); await page.click('[data-act=trash]'); await page.click('.sheet [data-yes]'); await wait(400);
const trashed = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.type === 'diario'));
ok(trashed && trashed.deleted_at, 'la papelera del diario borra en vez de guardar');
// Trayectoria
await page.click('.rail a[href="#/trayectoria"]'); await page.waitForSelector('.cstats');
await page.click('[data-act=profile]'); await page.waitForSelector('#cform');
await page.fill('#f-name', 'Ana Cocina'); await page.fill('#f-role', 'Jefa de cocina'); await page.fill('#f-place', 'Casa Brasa'); await page.fill('#f-since', '2012'); await page.fill('#f-philosophy', 'Producto de la isla y brasa.');
await page.click('#cform button[type=submit]'); await wait(500);
ok((await page.textContent('.cprofile')).includes('Ana Cocina') && (await page.textContent('.cprofile')).includes('años'), 'el perfil no se guarda');
await page.click('[data-act=job]'); await page.waitForSelector('#cform'); await page.fill('#f-role', 'Jefe de partida'); await page.fill('#f-place', 'Restaurante Mar'); await page.fill('#f-from', '2018-03'); await page.fill('#f-to', '2021-09'); await page.click('#cform button[type=submit]'); await wait(500);
ok((await page.textContent('.ctime')).includes('Restaurante Mar'), 'no guarda la experiencia');
await page.click('[data-act=goal]'); await page.waitForSelector('#cform'); await page.fill('#f-title', 'Dominar la masa madre'); await page.fill('#f-steps', 'Hacer la madre\nUn pan a la semana'); await page.click('#cform button[type=submit]'); await wait(500);
ok(await page.locator('.cgoal').count() === 1, 'no sale el objetivo');
await page.check('.cgoal [data-step="0"]'); await wait(400);
const goal = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).find(d => d.type === 'objetivo'));
ok(goal.steps[0].done && !goal.steps[1].done, 'marcar un paso no se guarda');
await go('#/hoy'); ok((await page.textContent('.craft')).includes('Un pan a la semana'), 'la portada no enseña el siguiente paso del objetivo');
await go('#/trayectoria');
await page.click('[data-skill=brasa]'); await wait(300); await page.click('[data-skill=brasa]'); await wait(300); await page.click('[data-skill=brasa]'); await wait(300);
ok(await page.getAttribute('[data-skill=brasa]', 'data-level') === '3', 'las técnicas no suben de nivel');
ok((await page.textContent('[data-skill=brasa]')).includes('1 plato'), 'no cuenta en cuántos platos usas la técnica');
await page.click('[data-act=signature]'); await page.waitForSelector('.sheet .chip'); await page.click('.sheet .chip'); await page.click('.sheet [data-ok]'); await wait(400);
ok(await page.locator('.csig-card').count() === 1, 'no guarda los platos firma');
await page.click('[data-done]'); await wait(500);
ok((await page.textContent('.cwins')).includes('Dominar la masa madre'), 'el objetivo cumplido no pasa a logros');
// Dossier
await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('printFicha')?.textContent || ''; }; });
await page.click('[data-act=dossier]'); await wait(800);
const dossier = await page.evaluate(() => window.__printed || '');
ok(dossier.includes('Ana Cocina') && dossier.includes('Restaurante Mar') && dossier.includes('Calamar a la brasa') && dossier.includes('Brasa'), 'el dossier no lleva el perfil, la experiencia, los platos firma o las técnicas: ' + dossier.slice(0, 200));
// Copia de seguridad y sincronización
const dl = page.waitForEvent('download'); await page.click('.rail [data-act=menu]'); await page.click('[data-act=backup]');
const backup = JSON.parse((await import('node:fs')).readFileSync(await (await dl).path(), 'utf8'));
ok(Object.values(backup.docs || {}).filter(d => ['diario', 'puesto', 'objetivo', 'carrera'].includes(d.type)).length >= 4, 'la copia no lleva el diario y la trayectoria');
await page.keyboard.press('Escape');
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(3500);
ok(pushed.some(x => x.kind === 'doc' && x.id.startsWith('diario:')) && pushed.some(x => x.kind === 'doc' && x.id === 'carrera:perfil'), 'el diario y la trayectoria no se mandan a sincronizar');
// Móvil
await page.setViewportSize({width: 390, height: 800}); await go('#/hoy'); await page.click('.top [data-act=menu]'); await page.waitForSelector('.sheet');
ok(await page.locator('.sheet a[href="#/diario"]').count() === 1 && await page.locator('.sheet a[href="#/trayectoria"]').count() === 1, 'en el móvil no hay acceso al diario y a la trayectoria');
// Lo aprendido en el diario vuelve en Entrenar (la entrada está en la papelera, así que no debe salir) y el radar manda chispas
await page.goto(url + '#/diario/nuevo'); await page.waitForSelector('#jform'); await page.fill('#j-learned', 'La alcachofa confitada aguanta tres días en su aceite'); await page.click('#jform button[type=submit]'); await wait(400);
await page.evaluate(() => { location.hash = '#/entrenar'; }); await wait(400); await page.click('[data-cat=mias]'); await wait(200);
let foundLearn = false; for (let k = 0; k < 6 && !foundLearn; k++) { foundLearn = (await page.textContent('#trCard')).includes('Qué aprendiste'); if (!foundLearn && await page.locator('[data-tr=flip]').count()) { await page.click('[data-tr=flip]'); await page.click('[data-tr="2"]'); await wait(200); } }
ok(foundLearn, 'lo aprendido en el diario no sale en Entrenar');
// Lo aprendido, mes a mes, y las ideas del servicio pasan a chispas
await page.goto(url + '#/diario/nuevo'); await page.waitForSelector('#jform'); await page.fill('#j-ideas', 'Alcachofa confitada con yema curada'); await page.click('#jform button[type=submit]'); await wait(400);
await page.evaluate(() => { location.hash = '#/diario/aprendido'; }); await page.waitForSelector('#jlearned');
ok((await page.textContent('#jlearned')).includes('aguanta tres días'), 'lo aprendido no sale en su página');
await page.click('[data-spark]'); await wait(400);
ok(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1')).docs).some(d => d.type === 'chispa' && d.text === 'Alcachofa confitada con yema curada')), 'la idea del diario no pasa a chispas');
// Tal día como hoy (hace un año) y Mi año en cocina
const lastYear = await page.evaluate(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
await page.evaluate(day => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); v.docs['diario:antiguo'] = {id: 'diario:antiguo', type: 'diario', day, service: 'cena', learned: 'El primer pil-pil que ligué bien', created_at: day + 'T22:00:00Z', updated_at: day + 'T22:00:00Z', version: 1}; localStorage.setItem('id-cocina-v1', JSON.stringify(v)); }, lastYear);
await page.reload(); await wait(800); await go('#/diario'); await page.waitForSelector('.jonday').catch(() => {});
ok((await page.textContent('.jonday').catch(() => '')).includes('Hace 1 año'), 'el diario no enseña lo de tal día como hoy');
await go('#/trayectoria'); await page.click('[data-act=year]'); await page.waitForSelector('#yrBody .stats');
ok((await page.textContent('#yrBody')).includes('días en el diario'), 'Mi año en cocina no sale');
await page.keyboard.press('Escape'); await wait(200);
// Por descubrir
await go('#/trayectoria'); await page.waitForSelector('#discNew');
await page.selectOption('#discKind', 'libro'); await page.fill('#discTitle', 'Un libro sobre fermentación'); await page.click('#discNew button[type=submit]'); await wait(500);
ok((await page.textContent('.cdisc')).includes('Un libro sobre fermentación'), 'Por descubrir no guarda');
await page.click('[data-disc-done]'); await page.waitForSelector('#discTake'); await page.fill('#discTake', 'El koji en casa'); await page.click('.sheet [data-ok]'); await wait(500);
ok((await page.textContent('.cdisc')).includes('Me llevo: El koji en casa'), 'marcar como hecho no guarda lo que te llevas');
// Ánimo de los servicios del último mes
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('id-cocina-v1')); for (let k = 1; k <= 4; k++) { const d = new Date(); d.setDate(d.getDate() - k); const day = d.toISOString().slice(0, 10); v.docs['diario:m' + k] = {id: 'diario:m' + k, type: 'diario', day, service: 'cena', mood: k % 2 ? 5 : 3, good: 'Servicio ' + k, created_at: day + 'T23:00:00Z', updated_at: day + 'T23:00:00Z', version: 1}; } localStorage.setItem('id-cocina-v1', JSON.stringify(v)); });
await page.reload(); await wait(800); await go('#/diario'); await page.waitForSelector('.jmood').catch(() => {});
ok((await page.locator('.jmood rect.jm-good').count()) >= 2 && (await page.textContent('.jmood figcaption')).includes('Media'), 'el diario no enseña cómo han ido los servicios');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en diario y trayectoria:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('diario y trayectoria: todo correcto');
