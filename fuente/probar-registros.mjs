// Prueba de los registros APPCC: temperaturas con aviso si se salen del límite, aceite, recepción, equipos propios,
// papelera sin borrar y hoja del mes para imprimir.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await wait(350); };
const docs = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('id-cocina-v1') || '{}').docs || {}));
await page.goto(url); await page.waitForSelector('.hello h1');
await go('#/herramientas/registros'); await page.waitForSelector('#rgForm');
// Temperaturas: dentro de límite
await page.fill('#rq-c1', '3'); await page.fill('#rq-c2', '-20'); await page.click('[data-act=rg-save]'); await wait(300);
ok(await page.locator('.rgtable tbody tr').count() === 1, 'no guarda las temperaturas');
// Fuera de límite: pide medida correctora
await page.fill('#rq-c1', '7,5'); await page.click('[data-act=rg-save]'); await wait(300);
ok((await page.textContent('#toasts')).includes('fuera de límite'), 'no avisa de la temperatura fuera de límite');
await page.fill('#rq-c1', '7,5'); await page.fill('#rgNote', 'Puerta abierta, reajustado'); await page.click('[data-act=rg-save]'); await wait(300);
ok(await page.locator('.rgtable tr.is-alert').count() === 1 && await page.locator('.rgbad').count() === 1, 'no marca la lectura fuera de límite');
// Equipos propios
await page.click('[data-act=rg-equip]'); await page.waitForSelector('#rgEq'); await page.fill('#rgEq', 'Cámara de pescado | 2\nNevera del pase | 5'); await page.click('.sheet [data-ok]'); await wait(400);
ok((await page.textContent('#rgForm')).includes('Cámara de pescado'), 'no cambia los equipos');
// Aceite
await page.click('[data-rk=aceite]'); await page.fill('#rgPolar', '22'); await page.click('[data-act=rg-save]'); await wait(300);
ok((await page.textContent('#rgList')).includes('22 %'), 'no guarda el aceite');
// Recepción rechazada
await page.click('[data-rk=recepcion]'); await page.fill('#rgProd', 'Gamba roja'); await page.fill('#rgTemp', '9'); await page.click('label:has-text("Rechazado")'); await page.click('[data-act=rg-save]'); await wait(300);
ok(await page.locator('.rglist li.is-alert').count() === 1, 'no marca la recepción rechazada');
// Quitar va a la papelera
await page.click('[data-rgdel]'); await wait(300);
ok((await docs()).some(d => d.type === 'registro' && d.kind === 'recepcion' && d.deleted_at), 'quitar un registro lo borra en vez de mandarlo a la papelera');
// Hoja del mes
await page.click('[data-rk=temp]'); await page.evaluate(() => { window.print = () => { window.__rg = document.getElementById('printFicha').innerText; }; });
await page.click('[data-act=rg-print]'); await wait(400);
const sheetText = await page.evaluate(() => window.__rg || '');
ok(sheetText.includes('Temperaturas') && sheetText.includes('Firma'), 'la hoja del mes no sale');
// Mise en place por partidas
await go('#/herramientas/mise'); await page.waitForSelector('.mepst');
ok(await page.locator('.mepst').count() === 3, 'no salen las partidas de ejemplo');
await page.check('[data-mk="Brasa|0"]'); await wait(300);
ok((await page.textContent('.mepcount')).includes('1 / 8'), 'no cuenta lo hecho: ' + await page.textContent('.mepcount'));
await page.fill('.mepadd[data-st="Frío"] input', 'Ostras abiertas'); await page.press('.mepadd[data-st="Frío"] input', 'Enter'); await wait(300);
ok((await page.textContent('.mepgrid')).includes('Ostras abiertas') && (await page.textContent('.mepcount')).includes('1 / 9'), 'no añade una tarea de hoy');
await page.click('[data-act=mep-edit]'); await page.waitForSelector('#mepTpl'); await page.fill('#mepTpl', ['# Pescados', 'Limpiar lubinas', 'Racionar atún', '', '# Arroces', 'Sofrito en porciones'].join('\n')); await page.click('.sheet [data-ok]'); await wait(400);
ok(await page.locator('.mepst').count() === 2 && (await page.textContent('.mepgrid')).includes('Racionar atún'), 'no cambia las partidas');
const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
await page.fill('#mepDay', tomorrow); await page.dispatchEvent('#mepDay', 'change'); await wait(300);
ok((await page.textContent('.mepcount')).includes('0 / 3'), 'el día siguiente no empieza limpio');
ok(errors.length === 0, 'errores en la página: ' + errors.join(' | '));
await browser.close();
if (fails.length) { console.error('FALLOS en registros APPCC:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('registros APPCC: todo correcto');
