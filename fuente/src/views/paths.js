// I+D · Rutas de aprendizaje: recorridos ordenados por la Biblioteca. Cada ficha que abres queda marcada como leída
// (documento «lectura:estado», en la copia y sincronizado), y cada ruta dice cuánto llevas y cuál es la siguiente.
import {t, en} from '../i18n.js';
import {esc, icon} from '../ui.js';
import {docById, saveDoc} from '../store.js';
import {entryById} from '../saber/index.js';

const ID = 'lectura:estado';
export const PATHS = [
 ['crear', 'Crear platos', 'Creating dishes', 'El método: de una idea a un plato y a un menú.', 'The method: from an idea to a dish and a menu.', ['construir-un-plato', 'contraste-y-equilibrio', 'acidez-en-cocina', 'umami-y-fondo', 'ritmo-de-un-menu', 'contar-un-plato', 'emplatado', 'de-la-tecnica-al-plato', 'catas-y-notas', 'menu-de-temporada', 'maridaje-de-sabores', 'del-plato-al-menu', 'escribir-una-carta', 'documentar-tu-obra', 'nombrar-un-plato', 'plato-firma']],
 ['fuego', 'Tu cocina de fuego', 'Your fire cooking', 'Brasa, punto, reposo, cortes, maduración, verduras y humo.', 'Embers, doneness, resting, cuts, ageing, vegetables and smoke.', ['fuego-y-brasa', 'punto-de-la-carne', 'sellado-y-reposo', 'cortes-de-vacuno', 'maduracion-de-carne', 'verduras-a-la-brasa', 'ahumado']],
 ['salsas', 'Las salsas madre', 'The mother sauces', 'Las bases de las que salen casi todas las demás.', 'The bases most others come from.', ['roux', 'bechamel', 'veloute', 'espanola', 'salsa-de-tomate', 'holandesa', 'mayonesa']],
 ['fondos', 'Fondos, jugos y caldos', 'Stocks, jus and broths', 'El sabor de fondo de una cocina seria.', 'The backbone flavour of a serious kitchen.', ['fondo-blanco', 'fondo-oscuro', 'fumet', 'fondo-de-marisco', 'jugo-de-carne', 'glace', 'consome', 'dashi', 'caldo-de-roca', 'caldo-de-verduras-tostadas', 'fondo-oscuro-de-ave', 'caldo-de-setas', 'jugos-de-verdura', 'fondo-de-cordero', 'fondo-de-caza', 'bisque', 'caldo-corto']],
 ['emulsiones', 'Emulsiones', 'Emulsions', 'Por qué ligan y cómo salvarlas cuando se cortan.', 'Why they bind and how to save them when they split.', ['emulsiones', 'mayonesa', 'alioli', 'vinagreta', 'holandesa', 'beurre-blanc', 'pil-pil', 'emulsiones-al-momento', 'sabayones-salados']],
 ['conservar', 'Conservar y transformar', 'Preserve and transform', 'Sal, ácido, tiempo y humo.', 'Salt, acid, time and smoke.', ['salmuera', 'curado-de-pescado', 'escabeche', 'fermentacion-lactica', 'ahumado', 'deshidratados-y-crujientes', 'conservas-en-aceite', 'vinagres-aromatizados', 'garum-y-salsas-de-pescado', 'confituras-y-mermeladas', 'marinados-en-seco', 'escabechado', 'ahumado-con-hierbas']],
 ['isla', 'La cocina de la isla', 'Island cooking', 'Producto, despensa y dulces de Ibiza y Formentera.', 'Produce, pantry and sweets of Ibiza and Formentera.', ['cocina-ibicenca', 'sal-y-flor-de-sal', 'pescado-de-roca', 'almendra', 'higos-y-algarroba', 'flao', 'greixonera', 'orelletes-y-bunyols', 'producto-de-la-isla', 'temporada-mes-a-mes', 'cocina-y-paisaje']],
 ['verdura', 'La verdura, protagonista', 'Vegetables at the centre', 'Escaldar, glasear, asar, brasa y encurtir.', 'Blanch, glaze, roast, grill and pickle.', ['escaldado-de-verduras', 'verduras-al-vapor', 'glaseado-de-verduras', 'asado-de-verduras', 'verduras-a-la-brasa', 'encurtidos-rapidos', 'alcachofas', 'setas']],
 ['asia', 'Asia en tu cocina', 'Asia in your kitchen', 'Dashi, umami, fermentos, salsas cítricas, tempura y crudos.', 'Dashi, umami, ferments, citrus sauces, tempura and raw fish.', ['dashi', 'umami-y-fondo', 'miso-y-koji', 'ponzu-y-salsas-citricas', 'tempura', 'ceviche-y-crudos']],
 ['carnes', 'Carnes y aves', 'Meat and poultry', 'Del punto al reposo, piezas nobles y de trabajo.', 'From doneness to resting, prime and working cuts.', ['punto-de-la-carne', 'sellado-y-reposo', 'cortes-de-vacuno', 'maduracion-de-carne', 'cordero', 'pato', 'confitado', 'baja-temperatura', 'jugo-de-carne', 'cerdo-iberico', 'conejo', 'cabrito', 'ternera-lechal', 'braseado', 'lacado-de-carnes', 'asado-al-horno', 'vaca-vieja-y-buey', 'cochinillo', 'caza-de-pluma', 'prensados-y-terrinas']],
 ['masas', 'Masas y pastelería de base', 'Doughs and pastry basics', 'Quebrada, hojaldre, bizcocho, masa madre, pasta fresca y chocolate.', 'Shortcrust, puff, sponge, sourdough, fresh pasta and chocolate.', ['masa-quebrada', 'hojaldre', 'bizcochos', 'masa-madre', 'pasta-fresca', 'chocolate-y-templado', 'sable-y-galletas', 'brioche', 'masas-laminadas-fermentadas', 'pasta-choux', 'bizcochos-humedos', 'pan-y-focaccia', 'coca-y-masas-saladas', 'baba-y-savarin', 'macarons', 'crepes-y-gofres']],
 ['despensa', 'La despensa mediterránea', 'The Mediterranean pantry', 'Aceite, sal, legumbres, arroz, almendra, especias y salazones.', 'Oil, salt, pulses, rice, almonds, spices and salted fish.', ['aceite-de-oliva', 'sal-y-flor-de-sal', 'legumbres', 'arroces', 'almendra', 'especias', 'salazones-y-huevas']],
 ['vanguardia', 'Técnicas de vanguardia', 'Modernist techniques', 'Texturas nuevas con método: geles, esferas, espumas, crujientes y baja temperatura.', 'New textures with method: gels, spheres, foams, crisps and low temperature.', ['gelificantes-y-espesantes', 'esferificacion', 'espumas-con-sifon', 'deshidratados-y-crujientes', 'baja-temperatura', 'miso-y-koji', 'vacio-de-verduras-y-frutas']],
 ['huerta', 'Huerta y fruta', 'Garden and fruit', 'El producto vegetal en su mejor momento: tomate, cítricos, alcachofas, setas e higos.', 'Plant produce at its best: tomatoes, citrus, artichokes, mushrooms and figs.', ['tomate', 'citricos', 'alcachofas', 'setas', 'higos-y-algarroba', 'papillote-y-vapor', 'asado-de-verduras', 'calabaza', 'berenjena', 'pimientos', 'caramelizacion-de-verduras', 'patata-y-boniato', 'cebolla-y-ajo', 'esparrago-y-guisante', 'hinojo-y-apio', 'punto-de-las-verduras']],
 ['postres', 'Postres de restaurante', 'Restaurant desserts', 'Del clásico de carta al postre de fruta: cuajados, mousses, crujientes y fruta.', 'From menu classics to fruit desserts: custards, mousses, crisps and fruit.', ['crema-catalana-y-flan', 'tarta-de-queso', 'mousses-y-cremosos', 'tejas-y-crujientes-dulces', 'fruta-asada', 'frutas-en-almibar', 'coulis-y-geles-de-fruta', 'panna-cotta-y-cuajadas', 'souffle', 'tartas-de-fruta', 'helados-sin-maquina', 'curds-y-cremas-de-citricos', 'menjar-blanc', 'petit-fours', 'postres-de-aceite-y-hierbas']],
 ['mar', 'Pescado y marisco', 'Fish and shellfish', 'Del pescado entero al crudo: puntos, piezas y mariscos de la isla.', 'From whole fish to raw: doneness, cuts and island shellfish.', ['pescado-entero', 'pescado-de-roca', 'dorada-y-lubina', 'gallo-y-rodaballo', 'coccion-a-la-sal', 'gamba-roja', 'cigala-y-langosta', 'erizo-de-mar', 'coccion-de-marisco', 'cefalopodos', 'ceviche-y-crudos', 'atun-rojo-y-bonito', 'pescado-azul', 'bacalao', 'mejillon-y-almeja', 'maduracion-de-pescado']],
 ['cocciones', 'Las cocciones de base', 'The basic cooking methods', 'Cada forma de dar calor y cuándo usarla.', 'Every way of applying heat and when to use it.', ['escalfado', 'salteado-y-wok', 'plancha-y-sarten', 'braseado', 'asado-al-horno', 'gratinado', 'coccion-en-hoja-y-ceniza', 'papillote-y-vapor', 'fritura', 'clarificacion', 'infusiones', 'rebozados-y-empanados', 'coccion-en-costra-de-masa', 'reposos-y-regeneracion', 'cortes-de-cuchillo']],
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
  PATHS.map(p => [p, pathProgress(p)]).sort((a, b) => ((!a[1].next) - (!b[1].next)) || ((b[1].done > 0) - (a[1].done > 0))).map(([p, g]) => { if (!g.ids.length) return ''; const nx = g.next ? entryById(g.next) : null, full = !g.next;
   return '<article class="kpath' + (full ? ' is-done' : '') + '"><h3>' + esc(name(p)) + '</h3><p>' + esc(en() ? p[4] : p[3]) + '</p><div class="cook-bar" aria-hidden="true"><i style="width:' + (g.done / g.ids.length * 100).toFixed(0) + '%"></i></div><p class="kpath-n">' + esc(g.done + t(' de ', ' of ') + g.ids.length + t(' leídas', ' read')) + '</p>' +
    '<details class="kpath-more"><summary>' + esc(t('Ver las ', 'See the ') + g.ids.length + t(' fichas', ' entries')) + '</summary><ol class="kpath-list">' + g.ids.map(id => '<li class="' + (read()[id] ? 'is-read' : '') + '"><a href="#/biblioteca/' + esc(id) + '">' + esc(entryById(id).name) + '</a></li>').join('') + '</ol></details>' +
    (nx ? '<a class="btn ' + (cur && cur.p === p && g.done ? 'primary' : 'ghost') + '" href="#/biblioteca/' + esc(nx.id) + '">' + esc(t('Seguir: ', 'Continue: ') + nx.name) + icon('right') + '</a>' : '<p class="fine">' + icon('check') + esc(t('Ruta terminada.', 'Path finished.')) + '</p>') + (g.done ? '<a class="linkbtn" href="#/entrenar/ruta/' + p[0] + '">' + icon('brain') + esc(full ? t('Examen de la ruta', 'Test on the path') : t('Repasar lo leído', 'Review what you read')) + '</a>' : '') + '</article>'; }).join('') + '</div></section>';
}
