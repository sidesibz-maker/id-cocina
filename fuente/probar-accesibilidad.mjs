// Revisión de accesibilidad con axe en las pantallas principales, de día y de noche, en PC y en móvil.
// Falla si aparece algún problema grave o crítico. Con TODO=1 enseña también los moderados.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const url = new URL('./salida/ID Cocina/ID Cocina.html', import.meta.url).href;
const SCREENS = ['#/biblioteca/diccionario', '#/hoy', '#/radar', '#/crear', '#/libreta', '#/biblioteca', '#/biblioteca/bechamel', '#/laboratorio', '#/diario', '#/diario/nuevo', '#/trayectoria', '#/entrenar', '#/herramientas', '#/herramientas/escalar', '#/herramientas/temporizadores', '#/sabores', '#/temporada', '#/preguntar', '#/cocina', '#/plato/d1', '#/cocinar/plato/d1', '#/menus', '#/catalogo', '#/estilo'];
const seed = {dishes: [{id: 'd1', name: 'Calamar a la brasa', concept: 'Mar y huerto', course: 'principal', status: 'carta', portions: '4', components: [{id: 'c1', role: 'principal', name: 'Calamar', techniques: ['brasa'], items: [{n: 'Calamar', q: '150 g', k: null, w: 3}], method: '1. Marcar 2 min.\n2. Reposar.'}], tests: [{id: 't1', at: '2026-11-01', rating: 3, text: 'Bien', next: 'Más ácido'}, {id: 't2', at: '2026-11-10', rating: 4, text: 'Mejor', next: ''}], images: [], version: 1, updated_at: '2026-11-20T10:00:00Z'}]};
const browser = await chromium.launch(), serious = [], all = [];
for (const [w, h, dark, hc] of [[1280, 900, false], [390, 800, false], [1280, 900, true], [390, 800, true], [1280, 900, false, true], [1280, 900, true, true]]) {
 const page = await (await browser.newContext({viewport: {width: w, height: h}, colorScheme: dark ? 'dark' : 'light'})).newPage();
 await page.goto(url); await page.waitForSelector('.hello h1');
 await page.evaluate(s => localStorage.setItem('id-cocina-v1', JSON.stringify(s)), seed);
 await page.evaluate(([d, h]) => localStorage.setItem('id-cocina-preferencias', JSON.stringify({theme: d ? 'dark' : 'light', ...(h ? {contrast: 'alto'} : {})})), [dark, hc]);
 await page.reload(); await page.waitForSelector('.hello h1'); await page.waitForTimeout(500);
 await page.addScriptTag({content: AXE});
 for (const s of SCREENS) {
  await page.evaluate(x => { location.hash = x; }, s); await page.waitForTimeout(450);
  const res = await page.evaluate(async () => (await window.axe.run(document, {resultTypes: ['violations'], rules: {region: {enabled: false}}})).violations.map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(''))})));
  for (const v of res) { const line = (hc ? 'alto contraste ' : '') + (dark ? 'carbón ' : 'lámina blanca ') + w + 'px ' + s + ' [' + v.impact + '] ' + v.id + ': ' + v.help + '\n    ' + v.nodes.join('\n    '); all.push(line); if (['serious', 'critical'].includes(v.impact)) serious.push(line); }
 }
 await page.close();
}
await browser.close();
const uniq = a => [...new Set(a)];
if (process.env.TODO) console.log(uniq(all).join('\n'));
if (serious.length) { console.error('FALLOS de accesibilidad:\n - ' + uniq(serious).join('\n - ')); process.exit(1); }
console.log('accesibilidad: todo correcto');
