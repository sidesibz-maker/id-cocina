// I+D, Hoy: la portada. El aviso del día, el resto del radar, la idea del día, los platos en marcha y lo que está de temporada.
import {inSeason} from '../flavor-core.js';
import {presetSaber} from './saber.js';
import {go} from '../nav.js';
import {t, en, longDate, greeting, dayKey, relDay, monthName} from '../i18n.js';
import {esc, icon, $, metaRow, sheet} from '../ui.js';
import {state, liveTrends, liveDishes, userName, liveDocs, docById} from '../store.js';
import {timers} from '../timers.js';
import {dueToday, cards as trainCards} from './train.js';
import {challenge, completeChallenge, challengeText} from '../challenge.js';
import {entries} from '../saber/index.js';
import {currentPath} from './paths.js';
import {onThisDay} from './journal.js';
import {attachSuggest} from './ksuggest.js';
import {iaOn} from '../ia.js';
import {syncOn} from '../sync.js';
import {prefs, setPref} from '../i18n.js';
import {xsec, dishLayers, statusLabel, courseLabel, thermScale, tempMarks, trendCard, dishCard, hydrateImages, trText, trIdeas, kindLabel, heatMark, sourceLine, sectionHead, moreLink, emptyState, skeleton, adoptIdea} from './shared.js';

export const title = () => t('Hoy', 'Today');

// El día más reciente con avisos (hoy, o lo último que salió).
function latestDay(trends) {
 const today = dayKey();
 return trends.some(x => x.day === today) ? today : trends.reduce((m, x) => (x.day > m ? x.day : m), '');
}
function lead(tr, day) {
 const ideas = trIdeas(tr);
 return '<a class="cover" href="#/radar/' + esc(tr.id) + '">' +
  '<span class="cover-title">' + esc(trText(tr, 'title')) + '</span>' +
  metaRow([esc(t('Radar de ', 'Radar, ') + relDay(day).toLowerCase()), esc(kindLabel(tr.kind)), tr.kind === 'idea' ? '' : heatMark(tr.heat)], 'cover-meta') +
  '<span class="cover-sum">' + esc(trText(tr, 'summary')) + '</span>' +
  (ideas.length ? '<span class="cover-idea">' + esc(t('En tu cocina: ', 'In your kitchen: ') + ideas[0].name) + '</span>' : '') +
  '<span class="cover-foot"><span>' + (sourceLine(tr) || esc(t('Idea propia', 'Our own idea'))) + '</span><span class="cover-go">' + esc(t('Ver cómo llevarlo a tu cocina', 'See how to bring it to your kitchen')) + '</span></span></a>';
}
function seasonal() {
 const kb = state.kb;
 if (!kb) return '';
 const m = new Date().getMonth() + 1, pantry = state.kitchen?.pantry || new Set();
 const fresh = ['verdura', 'fruta', 'seta', 'pescado', 'marisco', 'hierba'];
 const rows = kb.list.filter(i => fresh.includes(i.family) && i.months.size > 0 && i.months.size <= 7 && inSeason(i, m))
  .map(i => ({i, have: pantry.has(i.id), fresh: !i.months.has(((m + 10) % 12) + 1), local: i.tags.includes('ibiza')}))
  .sort((a, b) => (b.local - a.local) || (b.fresh - a.fresh) || (b.have - a.have) || a.i.es.localeCompare(b.i.es)).slice(0, 10);
 if (!rows.length) return '';
 const entering = kb.list.filter(i => fresh.includes(i.family) && i.months.size > 0 && i.months.size < 12 && inSeason(i, m) && !i.months.has(((m + 10) % 12) + 1)).map(i => (en() ? i.en : i.es));
 return '<section class="sec">' + sectionHead(t('De temporada en ', 'In season in ') + monthName(m), moreLink('#/temporada', t('Ver la temporada', 'See the season')), entering.length ? t('Entra ahora: ', 'Coming in now: ') + entering.slice(0, 6).join(', ') + '.' : t('Toca un producto para ver con qué combina.', 'Tap a product to see what it pairs with.')) +
  '<div class="chips">' + rows.map(({i, have, local}) => '<a class="chip' + (have ? ' chip-have' : '') + '" href="#/sabores/' + esc(i.id) + '">' + esc(en() ? i.en : i.es) + (local ? '<small>' + esc(t('de aquí', 'local')) + '</small>' : have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : '') + '</a>').join('') + '</div></section>';
}

// Primeros pasos: lo que deja la app a punto. Cada paso se marca solo al hacerlo; se puede ocultar.
function firstSteps() {
 if (!state.loaded || prefs.stepsHidden) return '';
 const s = state.settings || {}, kitchen = (s.equipment || []).length || (s.interests || []).length || s.style;
 const steps = [
  [!!kitchen, '#/cocina', t('Cuenta cómo es tu cocina', 'Describe your kitchen'), t('Tu equipo, tu estilo y lo que no quieres: las ideas y consejos parten de aquí.', 'Your equipment, style and what you avoid: ideas and advice start from here.')],
  [!!docById('carrera:perfil')?.name, '#/trayectoria', t('Di quién eres en cocina', 'Say who you are in the kitchen'), t('Tu puesto, dónde estás y tu cocina en una frase.', 'Your role, where you are and your cooking in one sentence.')],
  [liveDishes().length > 0, '#/crear', t('Crea tu primer plato', 'Create your first dish'), t('Por componentes, para ver qué sabores dominan y qué le falta.', 'By components, to see which flavours lead and what is missing.')],
  [syncOn(), '#/hoy', t('Junta el PC y el móvil', 'Join PC and phone'), t('Ajustes → Sincronizar PC y móvil: lo que apuntas en uno aparece en el otro.', 'Settings → Sync PC and phone: what you note on one appears on the other.'), 'sync'],
  [iaOn(), '#/hoy', t('Conecta ChatGPT', 'Connect ChatGPT'), t('Para preguntar, ideas, radar diario y el repaso de tu semana.', 'For questions, ideas, a daily radar and your weekly review.'), 'ia'],
  [liveDocs('diario').length > 0, '#/diario/nuevo', t('Escribe tu primer diario', 'Write your first journal'), t('Al acabar el servicio: qué salió bien, qué falló y qué has aprendido.', 'After service: what went well, what went wrong and what you learned.')]
 ];
 const done = steps.filter(x => x[0]).length;
 if (done === steps.length) return '';
 return '<section class="sec steps"><details class="steps-wrap"' + (done < steps.length / 2 ? ' open' : '') + '><summary><span>' + esc(t('Primeros pasos', 'First steps')) + '</span><b class="craft-n">' + done + '/' + steps.length + '</b></summary>' +
  '<ol class="steps-grid">' + steps.map(([ok, href, title, sub, act]) => '<li class="' + (ok ? 'is-done' : '') + '"><a href="' + href + '"' + (act ? ' data-open="' + act + '"' : '') + '><span class="steps-mark" aria-hidden="true">' + (ok ? icon('check') : '') + '</span><span><strong>' + esc(title) + '</strong><small>' + esc(sub) + '</small></span>' + (ok ? '<span class="sr">' + esc(t('Hecho', 'Done')) + '</span>' : '') + '</a></li>').join('') + '</ol><p class="fine">' + esc(t('Se marcan solos. ', 'They tick themselves. ')) + '<button type="button" class="linkbtn" data-act="hide-steps">' + esc(t('Ocultar', 'Hide')) + '</button></p></details></section>';
}

// La ficha del día: cada día una entrada distinta de la Biblioteca, para aprender algo cada vez que se abre la app.
function dailyEntry() {
 const all = entries().filter(e => !e.mine && e.summary);
 if (!all.length) return '';
 const d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) + d.getFullYear() * 7;
 const e = all[n % all.length], tip = (e.keys || [])[n % Math.max(1, (e.keys || []).length)];
 return '<section class="sec"><a class="daily" href="#/biblioteca/' + esc(e.id) + '"><strong>' + esc(t('Ficha del día: ', 'Entry of the day: ') + e.name) + '</strong><span class="daily-s">' + esc(e.summary) + '</span>' + thermScale(tempMarks(e), {label: e.name}) + (tip ? '<span class="daily-tip"><em>' + esc(t('Un truco: ', 'A tip: ')) + '</em>' + esc(tip.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')) + '</span>' : '') + '<span class="more">' + esc(t('Leer la ficha', 'Read the entry')) + icon('right') + '</span></a></section>';
}

// La pregunta del día: una tarjeta de Entrenar que cambia cada día; se le da la vuelta aquí mismo.
function questionOfDay() {
 const all = trainCards().filter(c => c.cat !== 'mias');
 if (!all.length) return '';
 const d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) * 7 + d.getFullYear();
 const c = all[n % all.length];
 return '<section class="sec"><div class="qday"><h2 class="qday-q">' + esc(c.q) + '</h2><p class="qday-meta">' + esc(t('Pregunta del día. Piénsala antes de girarla.', 'Question of the day. Think it through before turning it over.')) + '</p>' +
  '<details class="qday-a"><summary>' + esc(t('Ver la respuesta', 'Show the answer')) + '</summary>' + esc(c.a).split('\n').map(l => '<p>' + l + '</p>').join('') + (c.from ? '<a class="more" href="#/biblioteca/' + esc(c.from) + '">' + esc(t('Leer la ficha', 'Read the entry')) + icon('right') + '</a>' : '') + '</details>' +
  '<a class="linkbtn" href="#/entrenar">' + esc(t('Entrenar cinco minutos más', 'Train five more minutes')) + '</a></div></section>';
}
// Tu oficio: el diario de hoy, el objetivo más cercano y lo que tienes en el fuego.
// En marcha: el plato que tienes entre manos, dibujado en corte. Es lo primero que ve un cocinero al abrir.
function nowPanel(dishes) {
 const d = dishes.find(x => dishLayers(x).length > 1) || dishes[0];
 if (!d) return '<section class="sec now"><header class="sec-head"><div><h2>' + esc(t('En marcha', 'In progress')) + '</h2></div></header><a class="now-panel now-empty" href="#/crear"><strong>' + esc(t('Ningún plato en marcha', 'No dish in progress')) + '</strong><span>' + esc(t('Crea uno por componentes y aquí lo verás en corte, capa a capa.', 'Build one from components and you will see it here in section, layer by layer.')) + '</span></a></section>';
 const tests = (d.tests || []).filter(Boolean), rated = tests.filter(x => x.rating), avg = rated.length ? rated.reduce((a, x) => a + Number(x.rating), 0) / rated.length : 0;
 return '<section class="sec now"><header class="sec-head"><div><h2>' + esc(t('En marcha', 'In progress')) + '</h2></div>' + moreLink('#/libreta', t('Todos tus platos', 'All your dishes')) + '</header>' +
  '<a class="now-panel" href="#/plato/' + esc(d.id) + '"><span class="now-head"><strong class="now-name">' + esc(d.name) + '</strong><span class="dish-meta"><span class="status status-' + esc(d.status) + '">' + esc(statusLabel(d.status)) + '</span><span>' + esc(courseLabel(d.course)) + '</span></span></span>' +
  (dishLayers(d).length ? xsec(d) : '<span class="hint">' + esc(t('Añade componentes con sus gramos y aquí lo verás en corte.', 'Add components with their grams and you will see it here in section.')) + '</span>') +
  (tests.length ? '<span class="now-foot"><span>' + esc(tests.length === 1 ? t('1 prueba de cata', '1 tasting test') : tests.length + t(' pruebas de cata', ' tasting tests')) + '</span>' + (avg ? '<b class="craft-n">' + avg.toLocaleString(en() ? 'en' : 'es', {maximumFractionDigits: 1}) + '<small>/5</small></b>' : '') + '</span>' : '') + '</a></section>';
}
function craft() {
 const today = dayKey(), wrote = liveDocs('diario').some(e => e.day === today), hour = new Date().getHours();
 const goal = liveDocs('objetivo').filter(g => !g.done_at).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')))[0];
 const running = timers().filter(x => !x.done);
 const cards = [];
 cards.push('<a class="craft-card' + (!wrote && hour >= 15 ? ' is-due' : '') + '" href="#/diario' + (wrote ? '' : '/nuevo') + '">' + icon('edit') + '<strong>' + esc(wrote ? t('Diario de hoy escrito', 'Today\'s journal written') : t('¿Cómo ha ido hoy?', 'How did today go?')) + '</strong><span>' + esc(wrote ? t('Mira lo que llevas apuntado', 'See what you have written') : t('Dos minutos: qué salió bien, qué falló y qué has aprendido', 'Two minutes: what went well, what went wrong and what you learned')) + '</span></a>');
 if (goal) { const steps = goal.steps || [], done = steps.filter(x => x.done).length, next = steps.find(x => !x.done); cards.push('<a class="craft-card" href="#/trayectoria">' + icon('star') + '<strong>' + esc(goal.title) + '</strong><span>' + esc(next ? t('Siguiente paso: ', 'Next step: ') + next.text : steps.length ? t('Todos los pasos hechos: ¿lo das por conseguido?', 'All steps done: shall we call it achieved?') : t('Tu objetivo en marcha', 'Your goal in progress')) + '</span>' + (steps.length ? '<b class="craft-n">' + done + '/' + steps.length + '</b>' : '') + '</a>'); }
 else cards.push('<a class="craft-card" href="#/trayectoria">' + icon('star') + '<strong>' + esc(t('Ponte un objetivo', 'Set yourself a goal')) + '</strong><span>' + esc(t('Una técnica, un stage, una partida: lo partes en pasos y lo sigues aquí', 'A technique, a stage, a section: break it into steps and follow it here')) + '</span></a>');
 const ch = challenge();
 if (ch) cards.push('<div class="craft-card craft-challenge' + (ch.done ? ' is-done' : '') + '">' + icon('flame') + '<strong>' + esc(t('Reto de la semana: ', 'Challenge of the week: ') + ch.entry.name) + '</strong><span>' + esc(ch.done ? t('Hecho. Tu nivel en ', 'Done. Your level in ') + ch.techName.toLowerCase() + t(' ha subido.', ' went up.') : challengeText(ch)) + '</span>' + (ch.done ? '' : '<span class="craft-acts"><a class="linkbtn" href="#/biblioteca/' + esc(ch.entry.id) + '">' + esc(t('Leer la ficha', 'Read the entry')) + '</a><button type="button" class="linkbtn" data-act="challenge-done">' + icon('check') + esc(t('Hecho', 'Done')) + '</button></span>') + '</div>');
 const cp = currentPath();
 if (cp) { const nx = entries().find(e => e.id === cp.next); if (nx) cards.push('<a class="craft-card" href="#/biblioteca/' + esc(nx.id) + '">' + icon('library') + '<strong>' + esc(t('Tu ruta: ', 'Your path: ') + (en() ? cp.p[2] : cp.p[1])) + '</strong><span>' + esc(t('Siguiente ficha: ', 'Next entry: ') + nx.name) + '</span><b class="craft-n">' + cp.done + '/' + cp.ids.length + '</b></a>'); }
 const od = onThisDay();
 if (od) cards.push('<a class="craft-card" href="#/diario/' + encodeURIComponent(od.e.id) + '">' + icon('clock') + '<strong>' + esc(t('Tal día como hoy: ', 'On this day: ') + od.label.toLowerCase()) + '</strong><span>' + esc(String(od.e.learned || od.e.good || od.e.bad || od.e.ideas || '').slice(0, 140)) + '</span></a>');
 const due = dueToday();
 cards.push('<a class="craft-card" href="#/entrenar">' + icon('brain') + '<strong>' + esc(due ? (due === 1 ? t('1 tarjeta para repasar', '1 card to review') : due + t(' tarjetas para repasar', ' cards to review')) : t('Entrenar cinco minutos', 'Train for five minutes')) + '</strong><span>' + esc(t('Proporciones, fallos y recetas base hasta que te los sepas de memoria', 'Ratios, faults and base recipes until you know them by heart')) + '</span>' + (due ? '<b class="craft-n">' + due + '</b>' : '') + '</a>');
 if (running.length) cards.push('<a class="craft-card" href="#/herramientas' + (running.length ? '/temporizadores' : '') + '">' + icon(running.length ? 'clock' : 'bolt') + '<strong>' + esc(running.length ? (running.length === 1 ? t('1 temporizador en marcha', '1 timer running') : running.length + t(' temporizadores en marcha', ' timers running')) : t('Herramientas', 'Tools')) + '</strong><span>' + esc(t('Escalar recetas, salmueras, espesantes, panadero y temporizadores', 'Scale recipes, brines, thickeners, baking and timers')) + '</span><b class="craft-n">' + running.length + '</b></a>');
 return '<section class="sec today-list">' + sectionHead(t('Para hoy', 'For today')) + '<div class="craft">' + cards.join('') + '</div></section>';
}

export function render() {
 const trends = liveTrends(), day = latestDay(trends), todays = trends.filter(x => x.day === day);
 const ideaOfDay = todays.find(x => x.kind === 'idea') || null;
 const news = todays.filter(x => x.kind !== 'idea').sort((a, b) => (Number(b.fit) || 0) - (Number(a.fit) || 0));
 const top = news[0] || ideaOfDay, rest = news.slice(1, 4);
 const dishes = liveDishes().filter(d => !['carta', 'descartada'].includes(d.status)).slice(0, 4);
 const name = userName(), k = state.kitchen?.stats;
 const counts = [];
 if (todays.length) counts.push(day === dayKey() ? (todays.length === 1 ? t('1 aviso nuevo en el radar', '1 new alert on the radar') : todays.length + t(' avisos nuevos en el radar', ' new alerts on the radar')) : t('el último radar es de ', 'the latest radar is from ') + relDay(day).toLowerCase());
 if (dishes.length) counts.push(dishes.length === 1 ? t('1 plato en marcha', '1 dish in progress') : dishes.length + t(' platos en marcha', ' dishes in progress'));

 let html = '<header class="hello hello-row"><div><h1>' + esc(greeting()) + (name ? ', ' + esc(name) : '') + '.</h1>' +
  '<p class="hello-sub">' + esc(longDate().replace(/^./, c => c.toUpperCase()) + '. ') + esc(counts.length ? (counts.join(t(' y ', ' and ')) + '.').replace(/^./, c => c.toUpperCase()) : t('Tu cuaderno de I+D: crea, prueba y afina platos propios.', 'Your R&D notebook: create, test and refine dishes of your own.')) + '</p></div>' + (state.canEdit ? '<a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a>' : '') + '</header>';

 if (show('now')) html += '<div class="today-grid">' + nowPanel(dishes) + craft() + '</div>';
 if (show('daily')) html += dailyEntry();
 if (show('search')) html += '<form class="ksearch" id="homeSaber" role="search"><label class="sr" for="homeSaberQ">' + esc(t('Buscar en la Biblioteca', 'Search the library')) + '</label><div class="searchbox">' + icon('search') + '<input id="homeSaberQ" type="search" placeholder="' + esc(t('¿Qué quieres saber? Bechamel, fumet, emulsión…', 'What do you want to know? Béchamel, stock, emulsion…')) + '" autocomplete="off" enterkeyhint="search"></div></form>';
 html += firstSteps();
 if (show('question')) html += questionOfDay();
 if (!show('radar')) {}
 else if (top) html += lead(top, day);
 else html += '<div class="cover cover-empty"><span class="cover-title">' + esc(state.loaded ? t('El radar está vacío', 'The radar is empty') : t('Abriendo el radar…', 'Opening the radar…')) + '</span>' +
  '<span class="cover-sum">' + esc(t('Aquí sale lo que se mueve en las mejores cocinas y revistas, llevado a tu cocina. Entra en el Radar y pulsa «Buscar tendencias de hoy».', 'What is moving in the best kitchens and magazines, brought to your kitchen, shows up here. Open the Radar and press “Find today\'s trends”.')) + '</span></div>';

 if (rest.length && show('radar')) html += '<section class="sec">' + sectionHead(day === dayKey() ? t('Hoy en el radar', 'On the radar today') : t('Lo último del radar', 'Latest on the radar'), moreLink('#/radar', t('Todo el radar', 'Full radar'))) + '<div class="strip">' + rest.map(x => trendCard(x)).join('') + '</div></section>';

 if (ideaOfDay && ideaOfDay !== top && show('radar')) {
  const idea = trIdeas(ideaOfDay)[0];
  html += '<section class="sec">' + sectionHead(t('Idea del día', 'Idea of the day')) + '<article class="idea"><div class="idea-text"><h3>' + esc(trText(ideaOfDay, 'title')) + '</h3><p>' + esc(trText(ideaOfDay, 'summary')) + '</p>' +
   (trText(ideaOfDay, 'adapt') ? '<p class="idea-adapt">' + esc(trText(ideaOfDay, 'adapt')) + '</p>' : '') + '</div>' +
   '<div class="idea-actions">' + (idea && state.canEdit ? '<button type="button" class="btn ghost" data-adopt="' + esc(ideaOfDay.id) + '">' + icon('book') + esc(t('Llevar a la libreta', 'Add to notebook')) + '</button>' : '') +
   '<a class="btn ghost" href="#/radar/' + esc(ideaOfDay.id) + '">' + esc(t('Ver la idea', 'See the idea')) + '</a></div></article></section>';
 }

 const others = dishes.filter(x => x !== (dishes.find(y => dishLayers(y).length > 1) || dishes[0]));
 if ((others.length || !dishes.length) && show('dishes')) {
 html += '<section class="sec">' + sectionHead(others.length ? t('Más platos en marcha', 'More dishes in progress') : t('En marcha', 'In progress'), others.length ? moreLink('#/libreta', t('Todos tus platos', 'All your dishes')) : '');
 if (others.length) html += '<div class="dish-grid">' + others.map(dishCard).join('') + '</div>';

 else if (!state.loaded && !state.loadError) html += skeleton(2);
 else html += emptyState('book', t('Tu libreta está vacía', 'Your notebook is empty'), t('Empieza por un producto que tengas en casa o pide ideas. Cada plato guarda sus pruebas y cómo va cambiando.', 'Start from a product you have in the kitchen or ask for ideas. Each dish keeps its tests and how it evolves.'), state.canEdit ? '<a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a>' : '');
 html += '</section>';
 }

 // Accesos para empezar: solo mientras la libreta tiene pocos platos; después ya están en el menú.
 if (liveDishes().length < 3) html += '<section class="sec start-list">' + sectionHead(t('Empieza por aquí', 'Start here')) + '<div class="tiles">' +
  '<a class="tile tile-big" href="#/crear">' + icon('plus') + '<strong>' + esc(t('Crear un plato', 'Create a dish')) + '</strong><span>' + esc(t('Monta componentes y mira qué sabores dominan', 'Build components and see which flavours lead')) + '</span></a>' +
  '<a class="tile tile-big" href="#/laboratorio">' + icon('spark') + '<strong>' + esc(t('Laboratorio creativo', 'Creative lab')) + '</strong><span>' + esc(t('Una chispa: producto, pareja, puente y mecanismo', 'A spark: produce, partner, bridge and mechanism')) + '</span></a>' +
  '<a class="tile tile-big" href="#/crear/ideas">' + icon('spark') + '<strong>' + esc(t('Dame ideas', 'Give me ideas')) + '</strong><span>' + esc(t('Tres propuestas a partir de lo que buscas', 'Three proposals from what you are after')) + '</span></a>' +
  '<a class="tile tile-big" href="#/sabores">' + icon('wheel') + '<strong>' + esc(t('¿Con qué combina?', 'What does it pair with?')) + '</strong><span>' + esc(t('Combinaciones clásicas, atrevidas y puentes entre dos productos', 'Classic and bold pairings, and bridges between two products')) + '</span></a>' +
  '<a class="tile tile-big" href="#/cocina">' + icon('pan') + '<strong>' + esc(t('Mi cocina', 'My kitchen')) + '</strong><span>' + esc(k ? k.catalogue + t(' productos en el catálogo, ', ' products in the catalogue, ') + k.known + t(' básicos tuyos', ' staples of yours') : t('Tu equipo, tu estilo y tus reglas', 'Your equipment, style and rules')) + '</span></a></div></section>';

 if (show('season')) html += seasonal();
 html += '<p class="fine home-custom"><button type="button" class="linkbtn" data-act="home-custom">' + icon('gear') + esc(t('Elegir qué ves en Hoy', 'Choose what you see on Today')) + '</button></p>';
 return html;
}
// Qué partes de Hoy se ven (se guarda en este aparato).
const HOME_PARTS = () => [['now', t('El plato en marcha y lo de hoy', 'The dish in progress and today')], ['daily', t('La ficha del día', 'Entry of the day')], ['search', t('Buscar en la Biblioteca', 'Search the library')], ['question', t('La pregunta del día', 'Question of the day')], ['radar', t('El radar', 'The radar')], ['dishes', t('Más platos en marcha', 'More dishes in progress')], ['season', t('De temporada', 'In season')]];
const show = id => !prefs.homeHide.includes(id);
function customSheet(root) {
 const s = sheet({title: t('Elegir qué ves en Hoy', 'Choose what you see on Today'), body: '<p class="lead">' + esc(t('Marca lo que quieres ver al abrir la app. Lo que quites sigue en su sitio del menú.', 'Tick what you want to see when you open the app. What you hide stays in the menu.')) + '</p><div class="home-parts">' + HOME_PARTS().map(([id, l]) => '<label class="check"><input type="checkbox" data-part="' + id + '"' + (show(id) ? ' checked' : '') + '> ' + esc(l) + '</label>').join('') + '</div>'});
 s.el.addEventListener('change', e => { const c = e.target.closest('[data-part]'); if (!c) return; const hide = new Set(prefs.homeHide); if (c.checked) hide.delete(c.dataset.part); else hide.add(c.dataset.part); setPref('homeHide', [...hide]); root.innerHTML = render(); hydrateImages(root); });
}

export function mount(root) {
 hydrateImages(root);
 root.addEventListener('focusin', e => { if (e.target.id === 'homeSaberQ') attachSuggest(e.target, {onPick: x => go('biblioteca/' + x.id)}); });
 root.addEventListener('submit', e => { if (e.target.id !== 'homeSaber') return; e.preventDefault(); presetSaber(e.target.querySelector('input').value); go('biblioteca'); });
 root.addEventListener('click', e => {
  if (e.target.closest('[data-act=challenge-done]')) { completeChallenge().then(lv => { if (lv != null) import('../ui.js').then(({toast}) => toast(t('¡Reto cumplido! Tu nivel ha subido en Mi trayectoria.', 'Challenge done! Your level went up in My career.'), 'info', 5000)); }); return; }
  if (e.target.closest('[data-act=home-custom]')) { customSheet(root); return; }
  if (e.target.closest('[data-act=hide-steps]')) { setPref('stepsHidden', true); e.target.closest('.steps').remove(); return; }
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); document.dispatchEvent(new CustomEvent('id-open', {detail: o.dataset.open})); return; }
  const b = e.target.closest('[data-adopt]');
  if (!b) return;
  const tr = state.trends.find(x => x.id === b.dataset.adopt), idea = tr && trIdeas(tr)[0];
  if (!idea) return;
  b.disabled = true;
  adoptIdea(idea, {kind: 'radar', trend_id: tr.id, title: tr.title}).finally(() => { if (b.isConnected) b.disabled = false; });
 });
 return null;
}
export {$};
