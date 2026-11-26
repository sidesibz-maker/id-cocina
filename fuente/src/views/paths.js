// I+D · Rutas de aprendizaje: recorridos ordenados por la Biblioteca. Cada ficha que abres queda marcada como leída
// (documento «lectura:estado», en la copia y sincronizado), y cada ruta dice cuánto llevas y cuál es la siguiente.
import {t, en} from '../i18n.js';
import {esc, icon} from '../ui.js';
import {docById, saveDoc} from '../store.js';
import {entryById} from '../saber/index.js';

const ID = 'lectura:estado';
export const PATHS = [
 ['crear', 'Crear platos', 'Creating dishes', 'El método: de una idea a un plato y a un menú.', 'The method: from an idea to a dish and a menu.', ['construir-un-plato', 'contraste-y-equilibrio', 'acidez-en-cocina', 'umami-y-fondo', 'ritmo-de-un-menu', 'contar-un-plato']],
 ['fuego', 'Tu cocina de fuego', 'Your fire cooking', 'Brasa, punto, reposo, cortes, maduración, verduras y humo.', 'Embers, doneness, resting, cuts, ageing, vegetables and smoke.', ['fuego-y-brasa', 'punto-de-la-carne', 'sellado-y-reposo', 'cortes-de-vacuno', 'maduracion-de-carne', 'verduras-a-la-brasa', 'ahumado']],
 ['salsas', 'Las salsas madre', 'The mother sauces', 'Las bases de las que salen casi todas las demás.', 'The bases most others come from.', ['roux', 'bechamel', 'veloute', 'espanola', 'salsa-de-tomate', 'holandesa', 'mayonesa']],
 ['fondos', 'Fondos, jugos y caldos', 'Stocks, jus and broths', 'El sabor de fondo de una cocina seria.', 'The backbone flavour of a serious kitchen.', ['fondo-blanco', 'fondo-oscuro', 'fumet', 'fondo-de-marisco', 'jugo-de-carne', 'glace', 'consome', 'dashi']],
 ['emulsiones', 'Emulsiones', 'Emulsions', 'Por qué ligan y cómo salvarlas cuando se cortan.', 'Why they bind and how to save them when they split.', ['emulsiones', 'mayonesa', 'alioli', 'vinagreta', 'holandesa', 'beurre-blanc', 'pil-pil']],
 ['conservar', 'Conservar y transformar', 'Preserve and transform', 'Sal, ácido, tiempo y humo.', 'Salt, acid, time and smoke.', ['salmuera', 'curado-de-pescado', 'escabeche', 'fermentacion-lactica', 'ahumado', 'deshidratados-y-crujientes']],
 ['isla', 'La cocina de la isla', 'Island cooking', 'Producto, despensa y dulces de Ibiza y Formentera.', 'Produce, pantry and sweets of Ibiza and Formentera.', ['cocina-ibicenca', 'sal-y-flor-de-sal', 'pescado-de-roca', 'almendra', 'higos-y-algarroba', 'flao', 'greixonera', 'orelletes-y-bunyols']],
 ['verdura', 'La verdura, protagonista', 'Vegetables at the centre', 'Escaldar, glasear, asar, brasa y encurtir.', 'Blanch, glaze, roast, grill and pickle.', ['escaldado-de-verduras', 'verduras-al-vapor', 'glaseado-de-verduras', 'asado-de-verduras', 'verduras-a-la-brasa', 'encurtidos-rapidos', 'alcachofas', 'setas']],
 ['asia', 'Asia en tu cocina', 'Asia in your kitchen', 'Dashi, umami, fermentos, salsas cítricas, tempura y crudos.', 'Dashi, umami, ferments, citrus sauces, tempura and raw fish.', ['dashi', 'umami-y-fondo', 'miso-y-koji', 'ponzu-y-salsas-citricas', 'tempura', 'ceviche-y-crudos']],
 ['carnes', 'Carnes y aves', 'Meat and poultry', 'Del punto al reposo, piezas nobles y de trabajo.', 'From doneness to resting, prime and working cuts.', ['punto-de-la-carne', 'sellado-y-reposo', 'cortes-de-vacuno', 'maduracion-de-carne', 'cordero', 'pato', 'confitado', 'baja-temperatura', 'jugo-de-carne']],
 ['masas', 'Masas y pastelería de base', 'Doughs and pastry basics', 'Quebrada, hojaldre, bizcocho, masa madre, pasta fresca y chocolate.', 'Shortcrust, puff, sponge, sourdough, fresh pasta and chocolate.', ['masa-quebrada', 'hojaldre', 'bizcochos', 'masa-madre', 'pasta-fresca', 'chocolate-y-templado']],
 ['despensa', 'La despensa mediterránea', 'The Mediterranean pantry', 'Aceite, sal, legumbres, arroz, almendra, especias y salazones.', 'Oil, salt, pulses, rice, almonds, spices and salted fish.', ['aceite-de-oliva', 'sal-y-flor-de-sal', 'legumbres', 'arroces', 'almendra', 'especias', 'salazones-y-huevas']],
 ['dulce', 'Bases de pastelería', 'Pastry foundations', 'Cremas, azúcar, chocolate, masas y frío.', 'Creams, sugar, chocolate, doughs and cold.', ['crema-inglesa', 'crema-pastelera', 'merengues', 'caramelo', 'ganache', 'masa-quebrada', 'helados-y-sorbetes']]
];
const read = () => docById(ID)?.read || {};
const live = p => p[5].filter(id => entryById(id));
export function pathProgress(p) { const r = read(), ids = live(p); return {ids, done: ids.filter(id => r[id]).length, next: ids.find(id => !r[id]) || null}; }
// La ruta que llevas a medias (la que más avanzada está sin terminar), para la portada.
export function currentPath() {
 const list = PATHS.map(p => ({p, ...pathProgress(p)})).filter(x => x.ids.length && x.next);
 return list.sort((a, b) => b.done - a.done)[0] || null;
}
let last = '';
export async function markRead(id) {
 if (!id || id === last || !entryById(id)) return;
 last = id;
 const r = read();
 if (r[id]) return;
 await saveDoc('lectura', ID, {read: {...r, [id]: new Date().toISOString().slice(0, 10)}});
}
const name = p => (en() ? p[2] : p[1]);
export function pathsHtml() {
 const cur = currentPath();
 return '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Rutas de aprendizaje', 'Learning paths')) + '</h2><p>' + esc(t('Recorridos en orden. Lo que abres queda marcado como leído.', 'Paths in order. What you open is marked as read.')) + '</p></div></header><div class="kpaths">' +
  PATHS.map(p => { const g = pathProgress(p); if (!g.ids.length) return ''; const nx = g.next ? entryById(g.next) : null, full = !g.next;
   return '<article class="kpath' + (full ? ' is-done' : '') + '"><h3>' + esc(name(p)) + '</h3><p>' + esc(en() ? p[4] : p[3]) + '</p><div class="cook-bar" aria-hidden="true"><i style="width:' + (g.done / g.ids.length * 100).toFixed(0) + '%"></i></div><p class="kpath-n">' + esc(g.done + t(' de ', ' of ') + g.ids.length + t(' leídas', ' read')) + '</p>' +
    '<ol class="kpath-list">' + g.ids.map(id => '<li class="' + (read()[id] ? 'is-read' : '') + '"><a href="#/biblioteca/' + esc(id) + '">' + esc(entryById(id).name) + '</a></li>').join('') + '</ol>' +
    (nx ? '<a class="btn ' + (cur && cur.p === p && g.done ? 'primary' : 'ghost') + '" href="#/biblioteca/' + esc(nx.id) + '">' + esc(t('Seguir: ', 'Continue: ') + nx.name) + icon('right') + '</a>' : '<p class="fine">' + icon('check') + esc(t('Ruta terminada.', 'Path finished.')) + '</p>') + (g.done ? '<a class="linkbtn" href="#/entrenar/ruta/' + p[0] + '">' + icon('brain') + esc(full ? t('Examen de la ruta', 'Test on the path') : t('Repasar lo leído', 'Review what you read')) + '</a>' : '') + '</article>'; }).join('') + '</div></section>';
}
