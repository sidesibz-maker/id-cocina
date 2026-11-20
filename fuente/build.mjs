// Empaqueta la app en un solo archivo HTML que se abre con doble clic (sin servidor ni instalación).
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD || 'esbuild');
const out = new URL('./salida/', import.meta.url).pathname, tmp = new URL('./tmp/', import.meta.url).pathname;
rmSync(tmp, {recursive: true, force: true}); mkdirSync(tmp, {recursive: true}); mkdirSync(out + 'ID Cocina', {recursive: true});
await esbuild.build({entryPoints: [new URL('./src/main.js', import.meta.url).pathname], bundle: true, minify: true, format: 'iife', target: ['chrome100', 'safari15', 'firefox100'], outfile: tmp + 'app.js', loader: {'.css': 'css'}, external: ['/fonts/*'], legalComments: 'none'});
let css = readFileSync(tmp + 'app.css', 'utf8');
// El sello de Hallmark (los primeros comentarios de lab.css) va delante: el empaquetador quita los comentarios.
const stamp = (readFileSync(new URL('./src/lab.css', import.meta.url), 'utf8').match(/^(?:\/\*[\s\S]*?\*\/\s*)+/) || [''])[0].split('/* I+D')[0].trim();
css = stamp + '\n' + css;
css = css.replace(/url\(["']?\/fonts\/([^"')]+)["']?\)/g, (_, f) => 'url(data:font/woff2;base64,' + readFileSync(new URL('./fonts/' + f, import.meta.url)).toString('base64') + ')');
const js = readFileSync(tmp + 'app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const icon = readFileSync(new URL('./origen/public/lab-192.png', import.meta.url)).toString('base64');
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>I+D, cuaderno de cocina</title>
<meta name="description" content="Cuaderno de I+D de cocina: crea platos, mira qué sabores dominan y sigue las tendencias.">
<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<div id="sheets"></div>
<div id="toasts" aria-live="polite"></div>
<script src="radar.js"></script>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(out + 'ID Cocina/ID Cocina.html', html);
// Versión para el móvil: la misma app servida en una dirección web, instalable («Añadir a pantalla de inicio») y que funciona sin conexión.
import {copyFileSync} from 'node:fs';
const web = out + 'web/'; rmSync(web, {recursive: true, force: true}); mkdirSync(web, {recursive: true});
const head = '<meta name="theme-color" content="#ECE7DE">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="I+D">\n<meta name="robots" content="noindex">\n';
const sw = "<script>if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js')</script>\n";
writeFileSync(web + 'index.html', html.replace('<link rel="icon"', head + '<link rel="icon"').replace('</body>', sw + '</body>'));
for (const [from, to] of [['lab-192.png', 'icon-192.png'], ['lab-512.png', 'icon-512.png'], ['lab-maskable-512.png', 'icon-maskable-512.png'], ['lab-touch-180.png', 'icon-180.png']]) copyFileSync(new URL('./origen/public/' + from, import.meta.url), web + to);
copyFileSync(out + 'ID Cocina/radar.js', web + 'radar.js');
copyFileSync(new URL('./ficha.html', import.meta.url), web + 'ficha.html');
writeFileSync(web + 'manifest.webmanifest', JSON.stringify({name: 'I+D · Cuaderno de cocina', short_name: 'I+D', start_url: './', scope: './', display: 'standalone', background_color: '#ECE7DE', theme_color: '#ECE7DE', lang: 'es', share_target: {action: './', method: 'GET', params: {title: 'title', text: 'text', url: 'url'}}, shortcuts: [{name: 'Importar receta', url: './#/crear/importar'}, {name: 'Crear un plato', url: './#/crear'}, {name: 'Radar', url: './#/radar'}], icons: [{src: 'icon-192.png', sizes: '192x192', type: 'image/png'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png'}, {src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}]}, null, 1));
// La app y el radar se piden primero a la red (para tener siempre lo último) y, sin conexión, salen de la copia guardada.
writeFileSync(web + 'sw.js', `const C = 'id-cocina-${Date.now().toString(36)}', FILES = ['./', 'index.html', 'radar.js', 'manifest.webmanifest', 'icon-192.png', 'icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
 const u = new URL(e.request.url);
 if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('ficha.html')) return;
 e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
});
`);
console.log('web/: ' + web);
console.log('ID Cocina.html: ' + Math.round(html.length / 1024) + ' KB');
