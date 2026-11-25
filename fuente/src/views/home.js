// I+D, Hoy: la portada. El aviso del día, el resto del radar, la idea del día, los platos en marcha y lo que está de temporada.
import {inSeason} from '../flavor-core.js';
import {presetSaber} from './saber.js';
import {go} from '../nav.js';
import {t, en, longDate, greeting, dayKey, relDay, monthName} from '../i18n.js';
import {esc, icon, $, metaRow} from '../ui.js';
import {state, liveTrends, liveDishes, userName, liveDocs} from '../store.js';
import {timers} from '../timers.js';
import {dueToday} from './train.js';
import {trendCard, dishCard, hydrateImages, trText, trIdeas, kindLabel, heatMark, sourceLine, sectionHead, moreLink, emptyState, skeleton, adoptIdea} from './shared.js';

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
  (ideas.length ? '<span class="cover-idea"><em>' + esc(t('En tu cocina', 'In your kitchen')) + '</em>' + esc(ideas[0].name) + '</span>' : '') +
  '<span class="cover-foot"><span>' + (sourceLine(tr) || esc(t('Idea propia', 'Our own idea'))) + '</span><span class="cover-go">' + esc(t('Ver cómo llevarlo a tu cocina', 'See how to bring it to your kitchen')) + '</span></span></a>';
}
function seasonal() {
 const kb = state.kb;
 if (!kb) return '';
 const m = new Date().getMonth() + 1, pantry = state.kitchen?.pantry || new Set();
 const fresh = ['verdura', 'fruta', 'seta', 'pescado', 'marisco', 'hierba'];
 const rows = kb.list.filter(i => fresh.includes(i.family) && i.months.size > 0 && i.months.size <= 7 && inSeason(i, m))
  .map(i => ({i, have: pantry.has(i.id), fresh: !i.months.has(((m + 10) % 12) + 1), local: i.tags.includes('ibiza')}))
  .sort((a, b) => (b.local - a.local) || (b.fresh - a.fresh) || (b.have - a.have) || a.i.es.localeCompare(b.i.es)).slice(0, 14);
 if (!rows.length) return '';
 const entering = kb.list.filter(i => fresh.includes(i.family) && i.months.size > 0 && i.months.size < 12 && inSeason(i, m) && !i.months.has(((m + 10) % 12) + 1)).map(i => (en() ? i.en : i.es));
 return '<section class="sec">' + sectionHead(t('De temporada en ', 'In season in ') + monthName(m), moreLink('#/temporada', t('Ver la temporada', 'See the season')), entering.length ? t('Entra ahora: ', 'Coming in now: ') + entering.slice(0, 6).join(', ') + '.' : t('Toca un producto para ver con qué combina.', 'Tap a product to see what it pairs with.')) +
  '<div class="chips">' + rows.map(({i, have, local}) => '<a class="chip' + (have ? ' chip-have' : '') + '" href="#/sabores/' + esc(i.id) + '">' + esc(en() ? i.en : i.es) + (local ? '<small>' + esc(t('de aquí', 'local')) + '</small>' : have ? '<small>' + esc(t('de tus básicos', 'one of your staples')) + '</small>' : '') + '</a>').join('') + '</div></section>';
}

// Tu oficio: el diario de hoy, el objetivo más cercano y lo que tienes en el fuego.
function craft() {
 const today = dayKey(), wrote = liveDocs('diario').some(e => e.day === today), hour = new Date().getHours();
 const goal = liveDocs('objetivo').filter(g => !g.done_at).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')))[0];
 const running = timers().filter(x => !x.done);
 const cards = [];
 cards.push('<a class="craft-card' + (!wrote && hour >= 15 ? ' is-due' : '') + '" href="#/diario' + (wrote ? '' : '/nuevo') + '">' + icon('edit') + '<strong>' + esc(wrote ? t('Diario de hoy escrito', 'Today\'s journal written') : t('¿Cómo ha ido hoy?', 'How did today go?')) + '</strong><span>' + esc(wrote ? t('Mira lo que llevas apuntado', 'See what you have written') : t('Dos minutos: qué salió bien, qué falló y qué has aprendido', 'Two minutes: what went well, what went wrong and what you learned')) + '</span></a>');
 if (goal) { const steps = goal.steps || [], done = steps.filter(x => x.done).length, next = steps.find(x => !x.done); cards.push('<a class="craft-card" href="#/trayectoria">' + icon('star') + '<strong>' + esc(goal.title) + '</strong><span>' + esc(next ? t('Siguiente paso: ', 'Next step: ') + next.text : steps.length ? t('Todos los pasos hechos: ¿lo das por conseguido?', 'All steps done: shall we call it achieved?') : t('Tu objetivo en marcha', 'Your goal in progress')) + (steps.length ? ' (' + done + '/' + steps.length + ')' : '') + '</span></a>'); }
 else cards.push('<a class="craft-card" href="#/trayectoria">' + icon('star') + '<strong>' + esc(t('Ponte un objetivo', 'Set yourself a goal')) + '</strong><span>' + esc(t('Una técnica, un stage, una partida: lo partes en pasos y lo sigues aquí', 'A technique, a stage, a section: break it into steps and follow it here')) + '</span></a>');
 const due = dueToday();
 cards.push('<a class="craft-card" href="#/entrenar">' + icon('brain') + '<strong>' + esc(due ? (due === 1 ? t('1 tarjeta para repasar', '1 card to review') : due + t(' tarjetas para repasar', ' cards to review')) : t('Entrenar cinco minutos', 'Train for five minutes')) + '</strong><span>' + esc(t('Proporciones, fallos y recetas base hasta que te los sepas de memoria', 'Ratios, faults and base recipes until you know them by heart')) + '</span></a>');
 cards.push('<a class="craft-card" href="#/herramientas' + (running.length ? '/temporizadores' : '') + '">' + icon(running.length ? 'clock' : 'bolt') + '<strong>' + esc(running.length ? (running.length === 1 ? t('1 temporizador en marcha', '1 timer running') : running.length + t(' temporizadores en marcha', ' timers running')) : t('Herramientas', 'Tools')) + '</strong><span>' + esc(t('Escalar recetas, mermas, salmueras, espesantes y temporizadores', 'Scale recipes, yields, brines, thickeners and timers')) + '</span></a>');
 return '<section class="sec">' + sectionHead(t('Tu oficio', 'Your craft')) + '<div class="craft">' + cards.join('') + '</div></section>';
}

export function render() {
 const trends = liveTrends(), day = latestDay(trends), todays = trends.filter(x => x.day === day);
 const ideaOfDay = todays.find(x => x.kind === 'idea') || null;
 const news = todays.filter(x => x.kind !== 'idea').sort((a, b) => (Number(b.fit) || 0) - (Number(a.fit) || 0));
 const top = news[0] || ideaOfDay, rest = news.slice(1, 7);
 const dishes = liveDishes().filter(d => !['carta', 'descartada'].includes(d.status)).slice(0, 4);
 const name = userName(), k = state.kitchen?.stats;
 const counts = [];
 if (todays.length) counts.push(day === dayKey() ? (todays.length === 1 ? t('1 aviso nuevo en el radar', '1 new alert on the radar') : todays.length + t(' avisos nuevos en el radar', ' new alerts on the radar')) : t('el último radar es de ', 'the latest radar is from ') + relDay(day).toLowerCase());
 if (dishes.length) counts.push(dishes.length === 1 ? t('1 plato en marcha', '1 dish in progress') : dishes.length + t(' platos en marcha', ' dishes in progress'));

 let html = '<header class="hello"><h1>' + esc(greeting()) + (name ? ', ' + esc(name) : '') + '.</h1>' +
  '<p class="hello-sub">' + esc(longDate().replace(/^./, c => c.toUpperCase()) + '. ') + esc(counts.length ? (counts.join(t(' y ', ' and ')) + '.').replace(/^./, c => c.toUpperCase()) : t('Tu cuaderno de I+D: crea, prueba y afina platos propios.', 'Your R&D notebook: create, test and refine dishes of your own.')) + '</p></header>';
 html += '<form class="ksearch" id="homeSaber" role="search"><label class="sr" for="homeSaberQ">' + esc(t('Buscar en la Biblioteca', 'Search the library')) + '</label><div class="searchbox">' + icon('search') + '<input id="homeSaberQ" type="search" placeholder="' + esc(t('¿Qué quieres saber? Bechamel, fumet, emulsión…', 'What do you want to know? Béchamel, stock, emulsion…')) + '" autocomplete="off" enterkeyhint="search"></div></form>';

 if (top) html += lead(top, day);
 else html += '<div class="cover cover-empty"><span class="kicker">' + esc(t('Radar', 'Radar')) + '</span><span class="cover-title">' + esc(state.loaded ? t('El radar está vacío', 'The radar is empty') : t('Abriendo el radar…', 'Opening the radar…')) + '</span>' +
  '<span class="cover-sum">' + esc(t('Aquí sale lo que se mueve en las mejores cocinas y revistas, llevado a tu cocina. Entra en el Radar y pulsa «Buscar tendencias de hoy».', 'What is moving in the best kitchens and magazines, brought to your kitchen, shows up here. Open the Radar and press “Find today\'s trends”.')) + '</span></div>';

 if (rest.length) html += '<section class="sec">' + sectionHead(day === dayKey() ? t('Hoy en el radar', 'On the radar today') : t('Lo último del radar', 'Latest on the radar'), moreLink('#/radar', t('Todo el radar', 'Full radar'))) + '<div class="strip">' + rest.map(x => trendCard(x)).join('') + '</div></section>';

 if (ideaOfDay && ideaOfDay !== top) {
  const idea = trIdeas(ideaOfDay)[0];
  html += '<section class="sec">' + sectionHead(t('Idea del día', 'Idea of the day')) + '<article class="idea"><div class="idea-text"><h3>' + esc(trText(ideaOfDay, 'title')) + '</h3><p>' + esc(trText(ideaOfDay, 'summary')) + '</p>' +
   (trText(ideaOfDay, 'adapt') ? '<p class="idea-adapt">' + esc(trText(ideaOfDay, 'adapt')) + '</p>' : '') + '</div>' +
   '<div class="idea-actions">' + (idea && state.canEdit ? '<button type="button" class="btn primary" data-adopt="' + esc(ideaOfDay.id) + '">' + icon('book') + esc(t('Llevar a la libreta', 'Add to notebook')) + '</button>' : '') +
   '<a class="btn ghost" href="#/radar/' + esc(ideaOfDay.id) + '">' + esc(t('Ver la idea', 'See the idea')) + '</a></div></article></section>';
 }

 html += '<section class="sec">' + sectionHead(t('En marcha', 'In progress'), dishes.length ? moreLink('#/libreta', t('Toda la libreta', 'Full notebook')) : '');
 if (dishes.length) html += '<div class="dish-grid">' + dishes.map(dishCard).join('') + '</div>';
 else if (!state.loaded && !state.loadError) html += skeleton(2);
 else html += emptyState('book', t('Tu libreta está vacía', 'Your notebook is empty'), t('Empieza por un producto que tengas en casa o pide ideas. Cada plato guarda sus pruebas y cómo va cambiando.', 'Start from a product you have in the kitchen or ask for ideas. Each dish keeps its tests and how it evolves.'), state.canEdit ? '<a class="btn primary" href="#/crear">' + icon('plus') + esc(t('Crear un plato', 'Create a dish')) + '</a>' : '');
 html += '</section>';

 html += craft();
 html += '<section class="sec">' + sectionHead(t('Empieza por aquí', 'Start here')) + '<div class="tiles">' +
  '<a class="tile tile-big" href="#/crear">' + icon('plus') + '<strong>' + esc(t('Crear un plato', 'Create a dish')) + '</strong><span>' + esc(t('Monta componentes y mira qué sabores dominan', 'Build components and see which flavours lead')) + '</span></a>' +
  '<a class="tile tile-big" href="#/crear/ideas">' + icon('spark') + '<strong>' + esc(t('Dame ideas', 'Give me ideas')) + '</strong><span>' + esc(t('Tres propuestas a partir de lo que buscas', 'Three proposals from what you are after')) + '</span></a>' +
  '<a class="tile tile-big" href="#/sabores">' + icon('wheel') + '<strong>' + esc(t('¿Con qué combina?', 'What does it pair with?')) + '</strong><span>' + esc(t('Combinaciones clásicas, atrevidas y puentes entre dos productos', 'Classic and bold pairings, and bridges between two products')) + '</span></a>' +
  '<a class="tile tile-big" href="#/cocina">' + icon('pan') + '<strong>' + esc(t('Mi cocina', 'My kitchen')) + '</strong><span>' + esc(k ? k.catalogue + t(' productos en el catálogo, ', ' products in the catalogue, ') + k.known + t(' básicos tuyos', ' staples of yours') : t('Tu equipo, tu estilo y tus reglas', 'Your equipment, style and rules')) + '</span></a></div></section>';

 html += seasonal();
 return html;
}

export function mount(root) {
 hydrateImages(root);
 root.addEventListener('submit', e => { if (e.target.id !== 'homeSaber') return; e.preventDefault(); presetSaber(e.target.querySelector('input').value); go('biblioteca'); });
 root.addEventListener('click', e => {
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
