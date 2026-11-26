// I+D · Laboratorio creativo: método para inventar. Una chispa juntando un producto de temporada, una pareja (clásica o
// atrevida), un puente entre los dos y un mecanismo creativo; el cuaderno de chispas para apuntar cualquier idea al
// vuelo; y los mecanismos, explicados con un ejemplo. Todo funciona sin internet, con la tabla de sabores de la app.
// Las chispas son documentos «chispa:…» (copia y sincronización); nada se borra.
import {pairings, bridge, inSeason, norm} from '../flavor-core.js';
import {t, en, dayKey, relDay} from '../i18n.js';
import {esc, icon, $, $$, toast, ask, friendly} from '../ui.js';
import {state, liveDocs, saveDoc, trashDoc, createDish, docById, uploadImage, imageUrl} from '../store.js';
import {shrinkImage, ideasPrompt, ideasFromReply, copy} from '../ai.js';
import {iaOn, askIa, iaMessage} from '../ia.js';
import {adoptIdea} from './shared.js';
import {role, technique} from '../flavor-core.js';
import {sheet} from '../ui.js';
import {go} from '../nav.js';

export const title = () => t('Laboratorio creativo', 'Creative lab');
// Mecanismos de creación: maneras de mirar un producto o un plato para sacar algo nuevo.
export const MECHANISMS = [
 ['temperatura', 'Cambio de temperatura', 'Temperature shift', 'Sirve frío lo que se espera caliente, o junta frío y caliente en el mismo bocado.', 'Serve cold what is expected hot, or put cold and hot in the same bite.', 'Un gazpacho tibio de tomate asado con un granizado de su propia agua.', 'A warm roasted-tomato gazpacho with a granita of its own water.'],
 ['textura', 'Cambio de textura', 'Texture shift', 'Lo que siempre es cremoso, hazlo crujiente; lo crujiente, líquido; lo líquido, que se pueda morder.', 'Make the usually creamy crunchy, the crunchy liquid, the liquid something to bite.', 'Una croqueta cuyo interior es un caldo que se rompe en la boca.', 'A croquette whose filling is a broth that bursts in the mouth.'],
 ['forma', 'Cambio de forma', 'Shape shift', 'El mismo producto con otro aspecto: lámina, polvo, piel, hilo, pieza entera.', 'The same produce looking different: sheet, powder, skin, thread, whole piece.', 'Una berenjena entera a la brasa, abierta como un libro y rellena de su propia pulpa.', 'A whole grilled aubergine opened like a book and filled with its own flesh.'],
 ['deconstruccion', 'Deconstrucción', 'Deconstruction', 'Toma un plato que todos conocen, separa sus partes y móntalas de otra manera sin perder el sabor.', 'Take a dish everyone knows, separate its parts and rebuild them another way while keeping the taste.', 'Un pan con tomate en el que el tomate es una lámina y el pan, unas migas tostadas.', 'Pan con tomate where the tomato is a sheet and the bread toasted crumbs.'],
 ['un-producto', 'Un producto, varias técnicas', 'One produce, many techniques', 'El mismo producto crudo, asado, encurtido y en polvo en un solo plato.', 'The same produce raw, roasted, pickled and powdered in one dish.', 'Remolacha asada, cruda en láminas, encurtida y su piel deshidratada.', 'Beetroot roasted, raw in slices, pickled and its skin dried.'],
 ['dulce-salado', 'Dulce y salado', 'Sweet and savoury', 'Lleva un producto de postre a lo salado, o un salado al postre.', 'Take a dessert ingredient into savoury, or a savoury one into dessert.', 'Un helado de aceite de oliva con sal y tomate confitado.', 'Olive oil ice cream with salt and confit tomato.'],
 ['recuerdo', 'Recuerdo o paisaje', 'Memory or landscape', 'Un plato que cuente un lugar o un momento: el monte de la isla, el chiringuito, la cocina de casa.', 'A dish that tells a place or a moment: the island hills, the beach bar, home cooking.', 'Pescado a la brasa con hierbas del monte y una sal de algas.', 'Grilled fish with wild hill herbs and a seaweed salt.'],
 ['otra-cocina', 'Otra cocina', 'Another cuisine', 'Traduce un producto de aquí con la técnica o el condimento de otra cultura.', 'Translate local produce with the technique or seasoning of another culture.', 'Un escabeche de caballa con dashi y yuzu.', 'A mackerel escabeche with dashi and yuzu.'],
 ['aprovechamiento', 'Aprovechamiento', 'Using everything', 'Lo que se tira es el protagonista: pieles, espinas, recortes, tallos, cáscaras.', 'What gets thrown away becomes the star: skins, bones, trimmings, stalks, shells.', 'Un caldo de cáscaras de gamba tostadas servido como té.', 'A toasted prawn-shell broth served like tea.'],
 ['minimalismo', 'Minimalismo', 'Minimalism', 'Tres elementos y nada más. Cada uno tiene que justificar que está.', 'Three elements and nothing else. Each must earn its place.', 'Tomate, aceite y sal, cada uno en su mejor versión.', 'Tomato, oil and salt, each at its best.'],
 ['sala', 'Juego en la mesa', 'Play at the table', 'El cliente termina el plato: se rompe, se vierte, se comparte o se come con las manos.', 'The guest finishes the dish: it is broken, poured, shared or eaten by hand.', 'Una costra de sal que se rompe en la mesa y deja salir el aroma de las hierbas.', 'A salt crust broken at the table releasing the herbs’ aroma.'],
 ['fuego', 'Fuego y humo', 'Fire and smoke', 'El mismo producto con brasa, humo, ceniza o directamente sobre el carbón.', 'The same produce with embers, smoke, ash or straight on the coals.', 'Cebolla asada en las brasas hasta carbonizarse por fuera y dulce por dentro.', 'Onion roasted in the embers until charred outside and sweet inside.'],
 ['tiempo', 'Tiempo y fermentación', 'Time and fermentation', 'Deja que el tiempo transforme: madurar, fermentar, curar, secar.', 'Let time transform: age, ferment, cure, dry.', 'Un garum de recortes de pescado para sazonar las verduras.', 'A garum of fish trimmings to season vegetables.'],
 ['temporada', 'Primicia y final de temporada', 'First and last of the season', 'El mismo producto en dos momentos: recién llegado y en su último punto.', 'The same produce at two moments: just arrived and at its last point.', 'Guisantes lágrima crudos y guisantes maduros en crema.', 'Tiny raw peas and mature peas in a cream.']
];
const mechName = m => (en() ? m[2] : m[1]);
const avoidList = () => (state.settings?.avoid || []).map(norm).filter(Boolean);
const mechanisms = () => { const av = avoidList(); return MECHANISMS.filter(m => !av.some(a => norm(m[1] + ' ' + m[3]).includes(a))); };
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const name = id => { const i = state.kb?.byId[id]; return i ? (en() ? i.en : i.es) : id; };

// Una chispa: producto (de temporada y, mejor, de aquí o de tus básicos), pareja, puente y mecanismo.
export function spark(fixed = '') {
 const kb = state.kb;
 if (!kb) return null;
 const m = new Date().getMonth() + 1, pantry = state.kitchen?.pantry || new Set();
 const fresh = kb.list.filter(i => i.months.size > 0 && inSeason(i, m) && kb.links[i.id]?.size);
 const base = fixed && kb.byId[fixed] ? kb.byId[fixed] : pickOne(fresh.filter(i => i.tags.includes('ibiza') || pantry.has(i.id)).concat(fresh)) || pickOne(kb.list);
 const p = pairings(kb, base.id, {pantry, month: m}), bold = Math.random() < .55 && p.bold.length;
 const partner = pickOne((bold ? p.bold : p.classic).slice(0, 12)) || pickOne(p.bold) || pickOne(p.classic);
 if (!partner) return null;
 const b = bridge(kb, base.id, partner.id, {pantry}), via = b.links[0] ? b.links[0].id : null, mech = pickOne(mechanisms()) || MECHANISMS[0];
 return {a: base.id, b: partner.id, via, bold: !!bold, mech: mech[0], aromas: b.aromas || []};
}
export function sparkText(s) {
 const m = MECHANISMS.find(x => x[0] === s.mech) || MECHANISMS[0];
 return name(s.a) + ' + ' + name(s.b) + (s.via ? t(', con ', ', with ') + name(s.via) + t(' de puente', ' as a bridge') : '') + '. ' + mechName(m) + ': ' + (en() ? m[4] : m[3]);
}

let current = null, fixedId = '';
// Retos con restricción: un límite obliga a buscar caminos que no tomarías. [es, en, por qué funciona (es), (en)]
export const RULES = [
 ['Solo tres ingredientes, sin contar sal ni aceite.', 'Only three ingredients, not counting salt or oil.', 'Sin nada donde esconderse, cada producto tiene que estar en su mejor punto.', 'With nowhere to hide, every product must be at its best.'],
 ['Un solo producto en cuatro texturas.', 'One product in four textures.', 'Obliga a conocer el producto a fondo: crudo, cocido, seco, líquido.', 'Forces you to know the product inside out: raw, cooked, dried, liquid.'],
 ['Sin fuego: ni brasa, ni horno, ni hervir.', 'No heat: no embers, oven or boiling.', 'Curar, marinar, fermentar, cortar y emulsionar también son cocinar.', 'Curing, marinating, fermenting, cutting and emulsifying are cooking too.'],
 ['Todo de la isla, a menos de 50 km.', 'Everything from the island, within 50 km.', 'El paisaje como despensa: lo que hay decide el plato.', 'The landscape as a pantry: what there is decides the dish.'],
 ['Un postre con una verdura como protagonista.', 'A dessert led by a vegetable.', 'El dulce de la zanahoria, la remolacha o el hinojo, mirado con otros ojos.', 'The sweetness of carrot, beetroot or fennel, seen differently.'],
 ['Un plato hecho solo con lo que sobra de otros.', 'A dish made only from what other dishes leave over.', 'Pieles, recortes, espinas y tallos: el sabor que se tira.', 'Skins, trimmings, bones and stalks: the flavour that gets thrown away.'],
 ['Que parezca una cosa y sepa a otra.', 'It should look like one thing and taste of another.', 'La sorpresa hace que el comensal preste atención.', 'Surprise makes the guest pay attention.'],
 ['Un solo color en el plato.', 'One single colour on the plate.', 'Sin el color para distinguir, mandan la textura y el sabor.', 'Without colour to tell things apart, texture and flavour lead.'],
 ['En un solo bocado.', 'In a single bite.', 'Todo el plato tiene que caber en un momento: equilibrio exacto.', 'The whole dish must fit in one moment: exact balance.'],
 ['El mismo producto en caliente y en frío, a la vez.', 'The same product hot and cold, at once.', 'El contraste de temperatura cambia cómo se percibe el sabor.', 'Temperature contrast changes how flavour is perceived.'],
 ['Sin sal añadida: la sal viene de otro producto.', 'No added salt: salt comes from another product.', 'Anchoa, alga, queso curado, salicornia, encurtido: la sal con sabor.', 'Anchovy, seaweed, aged cheese, samphire, pickle: salt with flavour.'],
 ['Un plato tradicional de la isla, contado al revés.', 'A traditional island dish, told backwards.', 'Lo que era guarnición pasa a protagonista, y al revés.', 'What was the garnish becomes the lead, and vice versa.'],
 ['Una sola técnica para todos los componentes.', 'One single technique for every component.', 'La técnica como hilo: todo a la brasa, todo curado, todo en crudo.', 'Technique as the thread: all grilled, all cured, all raw.'],
 ['Sin plato: el soporte también se come.', 'No plate: the support is edible too.', 'Una hoja, una teja, una piel crujiente: el recipiente es parte del sabor.', 'A leaf, a tuile, a crisp skin: the vessel is part of the flavour.'],
 ['Con un producto que no te gusta.', 'With a product you do not like.', 'Si consigues que te guste a ti, gustará a cualquiera.', 'If you can make yourself like it, anyone will.'],
 ['Que se termine en la mesa, delante del comensal.', 'Finished at the table, in front of the guest.', 'Un caldo vertido, un rallado, un humo: el último gesto cuenta.', 'A poured broth, a grating, a smoke: the last gesture counts.']
];
let rule = null;
const newRule = () => { let r; do { r = Math.floor(Math.random() * RULES.length); } while (RULES.length > 1 && r === rule); rule = r; };
function ruleHtml() {
 if (rule == null) newRule();
 const r = RULES[rule];
 return '<p class="labrule-text">' + esc(en() ? r[1] : r[0]) + '</p><p class="fine">' + esc(en() ? r[3] : r[2]) + '</p>';
}
export function render(params = []) {
 // #/laboratorio/<producto>: la chispa parte de ese producto (por ejemplo, desde «Tu estilo» o desde Sabores).
 if (params[0] && state.kb?.byId[params[0]] && fixedId !== params[0]) { fixedId = params[0]; current = spark(fixedId); }
 if (state.kb && !current) current = spark();
 const sparks = liveDocs('chispa').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
 return '<header class="page-head"><h1>' + esc(t('Laboratorio creativo', 'Creative lab')) + '</h1><p>' + esc(t('Crear es un método: mirar un producto de otra manera, juntar lo que nadie ha juntado y apuntar todas las ideas, también las malas. Aquí tienes con qué.', 'Creating is a method: look at produce differently, pair what nobody has paired and write down every idea, bad ones too. Here is how.')) + '</p></header>' +
  '<section class="card labspark" aria-live="polite"><div class="csec-head"><h2>' + esc(t('Una chispa', 'A spark')) + '</h2><span class="fine">' + esc(t('Producto de temporada, una pareja, un puente y un mecanismo', 'Seasonal produce, a partner, a bridge and a mechanism')) + '</span></div><div id="labCur">' + sparkHtml() + '</div>' +
  '<div class="labfix"><label for="labFix">' + esc(t('Partir de un producto concreto', 'Start from a given product')) + '</label><input id="labFix" list="labKb" autocomplete="off" placeholder="' + esc(t('Escribe un producto: gamba roja, higo, sobrasada…', 'Type a product: red prawn, fig, sobrasada…')) + '"><datalist id="labKb">' + (state.kb ? state.kb.list.map(i => '<option value="' + esc(en() ? i.en : i.es) + '">').join('') : '') + '</datalist></div>' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="lab-new">' + icon('spark') + esc(t('Otra chispa', 'Another spark')) + '</button><button type="button" class="btn ghost" data-act="lab-keep">' + icon('star') + esc(t('Guardar en el cuaderno', 'Save to the notebook')) + '</button><button type="button" class="btn ghost" data-act="lab-dish">' + icon('book') + esc(t('Llevar a la libreta', 'Take to the notebook')) + '</button><button type="button" class="btn ghost" data-act="lab-ideas">' + icon('chat') + esc(t('Tres platos con ChatGPT', 'Three dishes with ChatGPT')) + '</button></div></section>' +
  '<section class="card labrule"><div class="csec-head"><h2>' + esc(t('Un reto con restricción', 'A constrained challenge')) + '</h2><span class="fine">' + esc(t('Un límite te saca de tus caminos de siempre', 'A limit takes you off your usual paths')) + '</span></div><div id="labRule" aria-live="polite">' + ruleHtml() + '</div>' +
  '<div class="row-actions row-left"><button type="button" class="btn ghost" data-act="lab-rule">' + icon('refresh') + esc(t('Otro reto', 'Another challenge')) + '</button><button type="button" class="btn ghost" data-act="lab-rule-keep">' + icon('star') + esc(t('Apuntarlo con la chispa', 'Note it with the spark')) + '</button></div></section>' +
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Cuaderno de chispas', 'Spark notebook')) + '</h2><p>' + esc(t('Apunta cualquier idea en cuanto te venga, aunque sea a medias. Las mejores salen de releer las viejas.', 'Write down any idea as soon as it comes, even half-formed. The best ones come from rereading old ones.')) + '</p></div></header>' +
  '<form id="labNote" class="card labnote"><label class="sr" for="labText">' + esc(t('Nueva chispa', 'New spark')) + '</label><textarea id="labText" rows="3" maxlength="2000" data-voice placeholder="' + esc(t('Un sabor, un recuerdo, una técnica, algo que has visto o comido…', 'A flavour, a memory, a technique, something you saw or ate…')) + '"></textarea><div class="row-actions"><label class="btn ghost" for="labPhoto">' + icon('image') + esc(t('Con foto', 'With a photo')) + '</label><input id="labPhoto" class="sr" type="file" accept="image/*" capture="environment"><button type="submit" class="btn primary">' + icon('plus') + esc(t('Apuntar', 'Note it')) + '</button></div><p class="fine" id="labPhotoState" hidden></p></form>' +
  (sparks.length ? '<ul class="labsparks">' + sparks.map(s => '<li class="labsp' + (s.dish_id ? ' is-dish' : '') + '">' + (s.image ? '<img class="labsp-img" data-img="' + esc(s.image) + '" alt="' + esc(t('Foto de la chispa', 'Spark photo')) + '">' : '') + '<p>' + esc(s.text) + '</p><div class="labsp-foot"><small>' + esc(relDay(s.created_at || new Date())) + (s.dish_id ? t(', ya es un plato', ', now a dish') : '') + '</small>' + (s.dish_id ? '<a class="linkbtn" href="#/plato/' + esc(s.dish_id) + '">' + esc(t('Ver el plato', 'See the dish')) + '</a>' : '<button type="button" class="linkbtn" data-to-dish="' + esc(s.id) + '">' + esc(t('Convertir en plato', 'Turn into a dish')) + '</button><button type="button" class="linkbtn" data-sp-ideas="' + esc(s.id) + '">' + esc(t('Tres platos', 'Three dishes')) + '</button>') + '<button type="button" class="iconbtn" data-sp-del="' + esc(s.id) + '" aria-label="' + esc(t('A la papelera', 'To the bin')) + '">' + icon('trash') + '</button></div></li>').join('') + '</ul>' : '<p class="hint">' + esc(t('Aún no hay chispas. La primera puede ser la de arriba.', 'No sparks yet. The first one can be the one above.')) + '</p>') + '</section>' +
  '<section class="sec"><header class="sec-head"><div><h2>' + esc(t('Mecanismos de creación', 'Creative mechanisms')) + '</h2><p>' + esc(t('Maneras de mirar un producto o un plato para sacar algo nuevo. Elige uno y oblígate a usarlo.', 'Ways of looking at produce or a dish to get something new. Pick one and force yourself to use it.')) + '</p></div></header>' +
  '<div class="labmechs">' + mechanisms().map(m => '<article class="labmech"><h3>' + esc(mechName(m)) + '</h3><p>' + esc(en() ? m[4] : m[3]) + '</p><p class="labex"><em>' + esc(t('Por ejemplo: ', 'For example: ')) + '</em>' + esc(en() ? m[6] : m[5]) + '</p><button type="button" class="linkbtn" data-mech="' + m[0] + '">' + icon('spark') + esc(t('Chispa con este', 'Spark with this')) + '</button></article>').join('') + '</div></section>';
}
function sparkHtml() {
 if (!current) return '<p class="hint">' + esc(state.loaded ? t('No he encontrado una pareja para ese producto. Prueba con otro.', 'No partner found for that product. Try another.') : t('Cargando la tabla de sabores…', 'Loading the flavour table…')) + '</p>';
 const m = MECHANISMS.find(x => x[0] === current.mech) || MECHANISMS[0];
 return '<div class="labtrio"><a class="labing" href="#/sabores/' + esc(current.a) + '">' + esc(name(current.a)) + '</a><span class="labplus" aria-hidden="true">+</span><a class="labing" href="#/sabores/' + esc(current.b) + '">' + esc(name(current.b)) + '</a>' + (current.via ? '<span class="labvia">' + esc(t('puente: ', 'bridge: ')) + '<a href="#/sabores/' + esc(current.via) + '">' + esc(name(current.via)) + '</a></span>' : '') + '</div>' +
  '<p class="labmeta">' + esc(current.bold ? t('Pareja atrevida', 'Bold pairing') : t('Pareja clásica', 'Classic pairing')) + (current.aromas.length ? esc(t('. Comparten aromas: ', '. Shared aromas: ') + current.aromas.slice(0, 4).join(', ')) : '') + '</p>' +
  '<div class="labm"><strong>' + esc(mechName(m)) + '</strong><p>' + esc(en() ? m[4] : m[3]) + '</p></div>';
}
async function toDish(text, items, source) {
 try {
  const d = await createDish({name: t('Idea: ', 'Idea: ') + text.split(/[.\n]/)[0].slice(0, 80), concept: text.slice(0, 600), status: 'idea', components: items.length ? [{id: 'c' + Date.now().toString(36), role: 'principal', name: '', techniques: [], items}] : [], source});
  toast(t('En tu libreta: ', 'In your notebook: ') + d.name); return d;
 } catch (e) { toast(friendly(e), 'error'); return null; }
}
// Tres propuestas de plato a partir de una chispa. Con ChatGPT conectado, aquí mismo; si no, se copia la petición.
async function proposals(text, source, sparkId, btn) {
 const prompt = ideasPrompt({brief: t('Desarrolla esta chispa del cuaderno de I+D en tres platos distintos: ', 'Develop this spark from the R&D notebook into three different dishes: ') + text});
 if (!iaOn()) { const ok = await copy(prompt); toast(ok ? t('Petición copiada: pégala en ChatGPT y lleva la respuesta a Crear → Dame ideas. Para hacerlo aquí, conecta ChatGPT en Ajustes.', 'Request copied: paste it into ChatGPT and bring the answer to Create → Give me ideas. To do it here, connect ChatGPT in Settings.') : t('No se pudo copiar.', 'It could not be copied.'), ok ? 'info' : 'error', 8000); return; }
 btn.disabled = true; btn.classList.add('is-busy');
 try {
  const res = ideasFromReply(await askIa({text: prompt, json: true}));
  if (!res.ideas.length) throw Object.assign(Error('empty'), {kind: 'empty'});
  const s = sheet({title: t('Tres platos para esta chispa', 'Three dishes for this spark'), wide: true, body: '<p class="lead">' + esc(text) + '</p><div class="labideas">' + res.ideas.map((idea, k) => '<article class="idea-card"><h3>' + esc(idea.name) + '</h3>' + (idea.line ? '<p>' + esc(idea.line) + '</p>' : '') + (idea.twist ? '<p class="fine"><strong>' + esc(t('Lo propio: ', 'The twist: ')) + '</strong>' + esc(idea.twist) + '</p>' : '') +
   '<ul class="comp-list">' + (idea.components || []).map(c => { const r = role(c.role), techs = (c.techniques || []).map(technique).filter(Boolean).map(x => (en() ? x.en : x.es)); return '<li><span class="comp-role">' + esc(en() ? r.en : r.es) + '</span><span><strong>' + esc(c.name || '') + '</strong>' + (techs.length ? ', ' + esc(techs.join(', ')) : '') + ((c.items || []).length ? '<br><small>' + esc(c.items.map(x => (typeof x === 'string' ? x : x?.name || x?.n)).filter(Boolean).join(', ')) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' +
   '<button type="button" class="btn primary" data-take="' + k + '">' + icon('book') + esc(t('Llevar a la libreta', 'Add to notebook')) + '</button></article>').join('') + '</div>'});
  s.el.addEventListener('click', async e2 => {
   const b = e2.target.closest('[data-take]'); if (!b) return;
   b.disabled = true; s.close();
   const d = await adoptIdea(res.ideas[Number(b.dataset.take)], source);
   if (d && sparkId) await saveDoc('chispa', sparkId, {dish_id: d.id});
  });
 } catch (err) { toast(err?.kind ? iaMessage(err) : friendly(err), 'error', 7000); }
 btn.disabled = false; btn.classList.remove('is-busy');
}
export function mount(root) {
 const paintSpark = () => { const box = $('#labCur', root); if (box) box.innerHTML = sparkHtml(); };
 root.addEventListener('change', e => {
  if (e.target.id !== 'labFix' || !state.kb) return;
  const n = norm(e.target.value), hit = state.kb.list.find(i => norm(i.es) === n || norm(i.en) === n) || state.kb.list.find(i => norm(i.es).startsWith(n));
  if (!hit) { toast(t('No encuentro ese producto en la tabla de sabores.', 'That product is not in the flavour table.'), 'error'); return; }
  fixedId = hit.id; current = spark(fixedId); paintSpark();
 });
 let photo = null;
 root.addEventListener('change', async e => {
  if (e.target.id !== 'labPhoto' || !e.target.files[0]) return;
  const st = $('#labPhotoState', root);
  try { photo = await shrinkImage(e.target.files[0]); st.hidden = false; st.textContent = t('Foto lista: escribe qué te inspira y pulsa Apuntar.', 'Photo ready: write what inspires you and press Note it.'); }
  catch { photo = null; toast(t('No se pudo abrir esa foto.', 'That photo could not be opened.'), 'error'); }
 });
 root.addEventListener('submit', async e => {
  if (e.target.id !== 'labNote') return;
  e.preventDefault();
  const v = $('#labText', root).value.trim(); if (!v && !photo) return;
  try {
   const image = photo ? await uploadImage('chispas', photo) : null;
   photo = null;
   await saveDoc('chispa', null, {text: (v || t('Foto de inspiración', 'Inspiration photo')).slice(0, 2000), ...(image ? {image} : {})}); toast(t('Chispa apuntada.', 'Spark noted.'));
  } catch (err) { toast(friendly(err), 'error'); }
 });
 const hydrate = () => $$('img[data-img]', root).forEach(async img => { const u = await imageUrl(img.dataset.img); if (u && img.isConnected) { img.src = u; img.removeAttribute('data-img'); } });
 hydrate(); new MutationObserver(hydrate).observe(root, {childList: true});
 root.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]')?.dataset.act, mech = e.target.closest('[data-mech]'), td = e.target.closest('[data-to-dish]'), del = e.target.closest('[data-sp-del]');
  if (a === 'lab-ideas' && current) { proposals(sparkText(current), {kind: 'laboratorio'}, null, e.target.closest('button')); return; }
  const spi = e.target.closest('[data-sp-ideas]');
  if (spi) { const s = docById(spi.dataset.spIdeas); if (s) proposals(s.text, {kind: 'chispa', id: s.id}, s.id, spi); return; }
  if (a === 'lab-rule') { newRule(); $('#labRule', root).innerHTML = ruleHtml(); return; }
  if (a === 'lab-rule-keep') { const r = RULES[rule]; await saveDoc('chispa', null, {text: (t('Reto: ', 'Challenge: ') + (en() ? r[1] : r[0]) + (current ? ' ' + sparkText(current) : '')).slice(0, 2000)}); toast(t('Reto apuntado en tu cuaderno de chispas.', 'Challenge noted in your spark notebook.')); return; }
  if (a === 'lab-new') { current = spark(fixedId); paintSpark(); }
  if (mech) { current = spark(fixedId) || current; if (current) current.mech = mech.dataset.mech; paintSpark(); $('.labspark', root).scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }
  if (a === 'lab-keep' && current) { await saveDoc('chispa', null, {text: sparkText(current), spark: current}); toast(t('Guardada en el cuaderno.', 'Saved to the notebook.')); }
  if (a === 'lab-dish' && current) { const items = [current.a, current.b, current.via].filter(Boolean).map((id, k) => ({n: name(id), k: id, w: k === 0 ? 3 : k === 1 ? 2 : 1, src: 'kb'})); const d = await toDish(sparkText(current), items, {kind: 'laboratorio'}); if (d) go('plato/' + d.id); }
  if (td) { const s = docById(td.dataset.toDish); if (!s) return; const items = s.spark ? [s.spark.a, s.spark.b, s.spark.via].filter(Boolean).map((id, k) => ({n: name(id), k: id, w: k === 0 ? 3 : k === 1 ? 2 : 1, src: 'kb'})) : []; const d = await toDish(s.text, items, {kind: 'chispa', id: s.id}); if (d) { await saveDoc('chispa', s.id, {dish_id: d.id}); go('plato/' + d.id); } }
  if (del) { if (!await ask({title: t('¿Enviar a la papelera?', 'Move to the bin?'), text: t('No se borra: queda guardada.', 'It is not deleted: it stays saved.'), yes: t('A la papelera', 'To the bin'), danger: true})) return; await trashDoc(del.dataset.spDel); }
 });
 return null;
}
export function onData(what, root, params) { if (['docs', 'remote', 'load'].includes(what)) { if (what === 'load' && !current) current = spark(fixedId); const keep = document.activeElement?.id === 'labText' ? $('#labText', root).value : null; root.innerHTML = render(params); if (keep !== null) { const t2 = $('#labText', root); t2.value = keep; t2.focus(); } } }
export {dayKey};
