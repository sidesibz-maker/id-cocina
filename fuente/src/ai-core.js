// I+D · IA: funciones puras (sin pantalla ni red) para poder probarlas con node (test-lab-ai.mjs). Preparan lo que se
// manda al servidor de IA y limpian lo que devuelve. Las mismas reglas están en backend/index.ts (cleanLabAdvice,
// cleanLabIdeas): el servidor limpia la respuesta y la pantalla la vuelve a limpiar. Lo que propone la IA es siempre un
// borrador: nada se guarda hasta que el cocinero lo decide, y los alérgenos son solo una pista, nunca la declaración oficial.
import {ROLES, TECH_IDS, COURSES, technique, role, matchName, dishProfile, dishAdvice, norm} from './flavor-core.js';

export const ROLE_IDS = ROLES.map(r => r[0]);
export const COURSE_IDS = COURSES.map(c => c[0]);
export const AI_TECHS = ['josper', 'ofyr', ...TECH_IDS];
// Los 14 alérgenos del Reglamento (UE) 1169/2011.
export const ALLERGENS = [
 ['gluten', 'Gluten', 'Gluten'], ['crustaceos', 'Crustáceos', 'Crustaceans'], ['huevo', 'Huevo', 'Egg'], ['pescado', 'Pescado', 'Fish'],
 ['cacahuetes', 'Cacahuetes', 'Peanuts'], ['soja', 'Soja', 'Soya'], ['lacteos', 'Lácteos', 'Milk'], ['frutos_cascara', 'Frutos de cáscara', 'Tree nuts'],
 ['apio', 'Apio', 'Celery'], ['mostaza', 'Mostaza', 'Mustard'], ['sesamo', 'Sésamo', 'Sesame'], ['sulfitos', 'Sulfitos', 'Sulphites'],
 ['altramuces', 'Altramuces', 'Lupin'], ['moluscos', 'Moluscos', 'Molluscs']
];
const ALLERGEN_IDS = ALLERGENS.map(a => a[0]);
export const IMAGE_STYLES = [
 ['mesa', 'En la mesa', 'On the table'], ['cenital', 'Desde arriba', 'From above'], ['cerca', 'De cerca', 'Close-up'], ['oscuro', 'Fondo oscuro', 'Dark backdrop']
];
export const IMAGE_STYLE_IDS = IMAGE_STYLES.map(s => s[0]);

const clip = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (v, max, each) => (Array.isArray(v) ? v : []).slice(0, max * 3).map(each).filter(Boolean).slice(0, max);
const texts = (v, max, len) => { const seen = new Set(); return list(v, max, x => { const s = clip(x, len), key = norm(s); if (!s || seen.has(key)) return null; seen.add(key); return s; }); };

// ---------- Lo que devuelve la IA ----------
export function cleanAdvice(value) {
 const p = value && typeof value === 'object' ? value : {};
 const changes = list(p.changes, 5, c => { const what = clip(c?.what, 160), how = clip(c?.how, 400); return what && how ? {what, why: clip(c?.why, 320), how} : null; });
 const variants = list(p.variants, 3, v => { const idea = clip(v?.idea, 420); return idea ? {label: clip(v?.label, 60), idea} : null; });
 const names = list(p.names, 4, n => { const es = clip(n?.es, 90); return es ? {es, en: clip(n?.en, 90)} : null; });
 const service = p.service && typeof p.service === 'object' ? p.service : {};
 const out = {
  verdict: clip(p.verdict, 420), works: texts(p.works, 4, 260), changes, signature: clip(p.signature, 520),
  service: {mise: texts(service.mise, 6, 220), pass: clip(service.pass, 320), risks: texts(service.risks, 4, 220)},
  plating: clip(p.plating, 520), variants, names,
  allergens: [...new Set((Array.isArray(p.allergens) ? p.allergens : []).filter(a => ALLERGEN_IDS.includes(a)))],
  issues: texts(p.issues, 6, 300)
 };
 // Sin veredicto ni cambios no hay consejo que enseñar.
 return out.verdict || out.changes.length ? out : null;
}

const TECH_WORDS = {brasa: ['brasa', 'parrilla', 'grill', 'charcoal', 'a la brasa'], josper: ['josper'], ofyr: ['ofyr'], plancha: ['plancha', 'griddle'], fritura: ['frito', 'frita', 'fritura', 'fried'], horno: ['horno', 'asado', 'asada', 'roasted', 'oven'], crudo: ['crudo', 'cruda', 'raw', 'tartar', 'carpaccio']};
const techOf = v => { const n = norm(v); if (AI_TECHS.includes(n)) return n; for (const [id, words] of Object.entries(TECH_WORDS)) if (words.includes(n)) return id; return null; };
export function cleanIdeas(value) {
 const p = value && typeof value === 'object' ? value : {};
 const ideas = list(p.ideas, 4, i => {
  const name = clip(i?.name, 120);
  const components = list(i?.components, 7, c => {
   const items = texts(c?.items, 8, 70), cname = clip(c?.name, 90);
   if (!items.length && !cname) return null;
   return {role: ROLE_IDS.includes(c?.role) ? c.role : 'guarnicion', name: cname || items[0], techniques: [...new Set((Array.isArray(c?.techniques) ? c.techniques : []).filter(x => typeof x === 'string' && AI_TECHS.includes(x)))].slice(0, 4), items: items.length ? items : [cname]};
  });
  if (!name || !components.length) return null;
  if (!components.some(c => c.role === 'principal')) components[0].role = 'principal';
  return {name, line: clip(i?.line, 240), course: COURSE_IDS.includes(i?.course) ? i.course : 'otro', why: clip(i?.why, 360), twist: clip(i?.twist, 300), components};
 });
 return {ideas, issues: texts(p.issues, 6, 300)};
}

// ---------- Lo que se manda ----------
const techLabel = id => technique(id)?.es || id;
// El plato, resumido: componentes con su papel, técnicas e ingredientes, el perfil calculado y lo que dice el equilibrio.
export function dishRequest(kb, dish) {
 const profile = dishProfile(kb, dish), advice = dishAdvice(kb, dish, profile);
 return {
  name: clip(dish?.name, 140), concept: clip(dish?.concept, 600), course: COURSE_IDS.includes(dish?.course) ? dish.course : 'otro', season: clip(dish?.season, 40),
  components: list(dish?.components, 10, c => {
   const items = list(c?.items, 14, i => { const n = clip(i?.n, 80); return n ? {name: n, weight: i.w === 3 ? 'protagonista' : i.w === 1 ? 'un toque' : 'normal', own: i.src === 'recipe', ...(clip(i?.q, 30) ? {qty: clip(i.q, 30)} : {})} : null; });
   const name = clip(c?.name, 90);
   return items.length || name ? {role: role(c?.role).es, name, techniques: list(c?.techniques, 6, t => (technique(t) ? techLabel(t) : null)), items, ...(clip(c?.method, 900) ? {method: clip(c.method, 900)} : {})} : null;
  }),
  profile: profile.empty ? null : {axes: profile.axes, dominant: profile.dominant},
  balance: advice.notes.filter(n => n.level !== 'ok').map(n => n.title[0]).slice(0, 8),
  ...(clip(dish?.plating, 600) ? {plating: clip(dish.plating, 600)} : {}), ...(clip(dish?.portions, 30) ? {portions: clip(dish.portions, 30)} : {}),
  notes: clip(dish?.notes, 800),
  tests: list((Array.isArray(dish?.tests) ? dish.tests : []).slice(-3), 3, x => { const text = clip(x?.text, 400), next = clip(x?.next, 300); return text || next ? {rating: [1, 2, 3, 4, 5].includes(x?.rating) ? x.rating : null, text, next} : null; })
 };
}
export const EQUIPMENT = [
 ['josper', 'Josper (horno de brasa)', 'Josper (charcoal oven)'], ['ofyr', 'Ofyr (fuego abierto)', 'Ofyr (open fire)'], ['plancha', 'Plancha', 'Griddle'],
 ['freidora', 'Freidora', 'Fryer'], ['horno', 'Horno mixto', 'Combi oven'], ['salamandra', 'Salamandra', 'Salamander'], ['vacio', 'Envasadora al vacío', 'Vacuum packer'],
 ['roner', 'Roner (baja temperatura)', 'Water bath (sous-vide)'], ['abatidor', 'Abatidor', 'Blast chiller'], ['sifon', 'Sifón', 'Siphon'], ['ahumador', 'Ahumador', 'Smoker'],
 ['robot', 'Robot de cocina', 'Food processor'], ['heladera', 'Heladera o mantecadora', 'Ice-cream machine'], ['pizza', 'Horno de pizza', 'Pizza oven'], ['wok', 'Wok', 'Wok']
];
const EQUIPMENT_IDS = EQUIPMENT.map(e => e[0]);
// Perfil de «Mi cocina» tal como se guarda: solo campos conocidos, recortados.
export function cleanProfile(value) {
 const p = value && typeof value === 'object' ? value : {};
 return {
  name: clip(p.name, 40), equipment: [...new Set((Array.isArray(p.equipment) ? p.equipment : []).filter(e => EQUIPMENT_IDS.includes(e)))],
  other_equipment: clip(p.other_equipment, 200), style: clip(p.style, 400), signature: clip(p.signature, 500),
  avoid: texts(p.avoid, 16, 60), interests: texts(p.interests, 16, 60), service: clip(p.service, 300)
 };
}
// La cocina, resumida para la consulta: equipo, estilo, reglas y básicos. Nada más.
export function kitchenRequest(kb, kitchen, settings, restaurant, now = new Date()) {
 const p = cleanProfile(settings), m = now.getMonth() + 1;
 const equipment = [...p.equipment.map(id => EQUIPMENT.find(e => e[0] === id)[1]), ...(p.other_equipment ? [p.other_equipment] : [])];
 const pantry = [...(kitchen?.pantry || [])].map(id => kb.byId[id]?.es).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
 return {
  restaurant: clip(restaurant?.name, 80), equipment: equipment.slice(0, 20), style: p.style, signature: p.signature, avoid: p.avoid, service: p.service,
  basics: pantry.slice(0, 160),
  season: m >= 5 && m <= 10 ? 'verano' : 'invierno', month: m
 };
}

// Una idea de la IA (o del radar) convertida en un plato para la mesa de trabajo: cada ingrediente se busca primero entre
// las subrecetas propias, luego en la tabla de sabores. Lo que no se reconoce se conserva con su nombre, sin perfil.
export function ideaToDish(kb, kitchen, idea, newId = () => Math.random().toString(36).slice(2, 10)) {
 const subs = kitchen?.subrecipes || [];
 const item = (name, lead, q = '') => {
  const n = clip(name, 80), qty = clip(q, 40);
  if (!n) return null;
  const own = subs.find(s => norm(s.name) === norm(n));
  if (own) return {n: own.name, k: own.kb, w: lead ? 3 : 2, src: 'recipe', ref: own.id, ...(own.mix.length ? {mix: own.mix} : {}), ...(qty ? {q: qty} : {})};
  const k = matchName(kb, n);
  return {n, k, w: lead ? 3 : 2, src: k ? 'kb' : 'free', ...(qty ? {q: qty} : {})};
 };
 const components = (Array.isArray(idea?.components) ? idea.components : []).slice(0, 8).map(c => {
  const r = ROLE_IDS.includes(c?.role) ? c.role : 'guarnicion';
  const list = (Array.isArray(c?.items) ? c.items : []).map(x => (typeof x === 'string' ? {n: x} : {n: x?.n || x?.name, q: x?.q || x?.qty || ''})).filter(x => x.n);
  const items = (list.length ? list : [{n: c?.name}]).slice(0, 10).map((x, k) => item(x.n, r === 'principal' && k === 0, x.q)).filter(Boolean);
  return {id: newId(), role: r, name: clip(c?.name, 90), techniques: [...new Set((Array.isArray(c?.techniques) ? c.techniques : []).map(techOf).filter(Boolean))].slice(0, 5), items};
 }).filter(c => c.items.length || c.name);
 return {name: clip(idea?.name, 140), concept: clip(idea?.line, 600), course: COURSE_IDS.includes(idea?.course) ? idea.course : 'otro', components};
}

// Petición de imagen: lo que se ve en el plato, con palabras.
export function imageRequest(kb, dish, style) {
 const d = dishRequest(kb, dish);
 return {
  name: d.name, concept: d.concept, course: d.course,
  components: d.components.map(c => ({role: c.role, name: c.name, techniques: c.techniques, items: c.items.map(i => i.name).slice(0, 8)})).slice(0, 8),
  plating: clip(dish?.plating, 520) || clip(dish?.advice?.plating, 520), style: IMAGE_STYLE_IDS.includes(style) ? style : 'mesa'
 };
}

// ---------- Importar una receta (captura de TikTok, Instagram, una web, un libro…) ----------
// Acepta la respuesta en JSON de Claude o ChatGPT, o el texto de la receta tal cual (se lee aquí mismo, sin conexión).
const clipText = (v, max) => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');
const UNIT = '(?:kg|g|gr|grs|gramos?|mg|l|litros?|ml|cl|dl|cdas?|cdtas?|cucharadas?|cucharaditas?|cuchara|tazas?|vasos?|ud|uds|unidad(?:es)?|dientes?|ramas?|ramitas?|hojas?|pizcas?|chorros?|chorrito|puñados?|latas?|botes?|sobres?|tbsp|tsp|cups?|oz|lb)\\.?';
const QTY_START = new RegExp('^((?:\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|½|¼|¾|medi[oa]|un[oa]?|dos|tres|cuatro|cinco)(?:\\s*(?:-|a)\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:' + UNIT + ')?)\\s+(?:de\\s+)?(.+)$', 'i');
const QTY_END = new RegExp('^(.+?)[\\s:,(–-]+(\\d+(?:[.,]\\d+)?\\s*' + UNIT + '|al gusto|c\\/s|c\\.s\\.|cantidad suficiente)\\)?$', 'i');
const BULLET = /^\s*(?:[-–•·*▪◦●○✓✔➤►>]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?)+\s*/u;
const STEP = /^\s*(?:\d{1,2}\s*[.)º:-]|paso\s*\d+\s*[.:-]?)\s*/i;
const SECTION = /^(?:para\s+(?:el|la|los|las)\s+)?([^:]{2,40}):\s*$/i;
const ING_HEAD = /^(?:ingredientes?|ingredients|lo que necesitas)(?:\s+para\s+.+)?$/i, STEP_HEAD = /^(?:elaboraci[oó]n|preparaci[oó]n|pasos|procedimiento|m[eé]todo|instrucciones|method|steps|c[oó]mo se hace)$/i, PLATE_HEAD = /^(?:emplatado|montaje|presentaci[oó]n|plating)$/i;
const roleFor = (name, first) => { const n = norm(name); return /salsa|alino|vinagreta|mayonesa|alioli|jugo|glaseado|aderezo|emulsion|mojo|pesto|chimichurri|romesco/.test(n) ? 'salsa' : /crujiente|crumble|tierra|crocante|tostad|praline/.test(n) ? 'crujiente' : /encurtid|pickle|ensalada|aliñ|ceviche/.test(n) ? 'fresco' : /pure|crema|parmentier|hummus|mousse|espuma/.test(n) ? 'cremoso' : first ? 'principal' : 'guarnicion'; };
function splitIngredient(line) {
 const s = line.replace(BULLET, '').replace(/\s+/g, ' ').trim();
 let m = s.match(QTY_START);
 if (m && m[2] && !/^\d/.test(m[2])) return {name: m[2].replace(/^de\s+/i, ''), qty: m[1]};
 m = s.match(QTY_END);
 if (m) return {name: m[1], qty: m[2]};
 m = s.match(/^(.+?)\s+(al gusto|c\/s)$/i);
 return m ? {name: m[1], qty: m[2]} : {name: s, qty: ''};
}
export function recipeFromText(text) {
 const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !/^(?:#\S+\s*)+$/.test(l) && !/^https?:\/\//i.test(l));
 if (!lines.length) return null;
 const url = (String(text).match(/https?:\/\/\S+/) || [''])[0];
 const out = {name: '', concept: '', portions: '', components: [], plating: '', notes: '', source: url ? {url} : null};
 let mode = 'start', comp = null, stepTo = null, plating = [], loose = [];
 const newComp = name => { comp = {role: roleFor(name, !out.components.length), name, techniques: [], items: [], method: ''}; out.components.push(comp); return comp; };
 for (const raw of lines) {
  const line = raw.replace(/\s+/g, ' ');
  const portions = line.match(/(?:para|raciones|porciones|personas|serves)\D{0,12}(\d{1,3})/i);
  if (portions && line.length < 40 && !out.portions) { out.portions = portions[1]; continue; }
  const head = line.replace(BULLET, '').match(SECTION);
  if (head) {
   const h = head[1].trim();
   if (ING_HEAD.test(h)) { mode = 'ing'; if (!comp) newComp(''); continue; }
   if (STEP_HEAD.test(h)) { mode = 'step'; stepTo = null; continue; }
   if (PLATE_HEAD.test(h)) { mode = 'plate'; continue; }
   const named = out.components.find(c => norm(c.name) === norm(h)); stepTo = named || null; comp = named || newComp(h.replace(/^(?:para\s+)?(?:el|la|los|las)\s+/i, '').replace(/^./, c => c.toUpperCase())); mode = named ? 'step' : 'ing'; continue;
  }
  if (!out.name && mode === 'start') { out.name = line.replace(BULLET, '').replace(/^receta(?:\s+de)?\s*[:-]?\s*/i, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').trim().slice(0, 140); continue; }
  const qtyLike = BULLET.test(raw) || QTY_START.test(line.replace(BULLET, '')) || QTY_END.test(line);
  const isStep = STEP.test(line) || mode === 'step' || mode === 'plate' || (!qtyLike && ((mode !== 'start' && line.split(' ').length >= 7) || (line.length > 70 && /[.!]$/.test(line))));
  const looksIng = !isStep && (qtyLike || (mode === 'ing' && line.length <= 60));
  if (looksIng) { if (!comp) newComp(''); if (mode === 'start') mode = 'ing'; const it = splitIngredient(line); if (it.name) comp.items.push(it); continue; }
  const textLine = line.replace(STEP, '');
  if (mode === 'plate') plating.push(textLine);
  else if (isStep) { const target = mode === 'step' ? stepTo || out.components.find(c => c.role === 'principal') || comp || newComp('') : comp || newComp(''); target.method += (target.method ? '\n' : '') + (STEP.test(line) ? line.trim() : textLine); }
  else if (mode === 'start' && !out.concept) out.concept = line.slice(0, 600);
  else loose.push(line);
 }
 // Los pasos que vinieron todos juntos van al protagonista; cada componente conserva los suyos.
 const withSteps = out.components.filter(c => c.method);
 if (withSteps.length === 1 && !withSteps[0].items.length && out.components.length > 1) { const lead = out.components.find(c => c.items.length); lead.method = [lead.method, withSteps[0].method].filter(Boolean).join('\n'); withSteps[0].method = ''; }
 out.components = out.components.filter(c => c.items.length || c.method);
 out.plating = plating.join('\n'); out.notes = loose.join('\n');
 if (!out.name) out.name = out.components[0]?.items[0]?.name || '';
 return out.name || out.components.length ? out : null;
}
// La respuesta de la IA (JSON) o, si no la hay, el texto tal cual.
export function cleanRecipe(v) {
 if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
 const src = v.recipe && typeof v.recipe === 'object' ? v.recipe : v;
 const comps = list(src.components, 10, c => {
  if (!c || typeof c !== 'object') return null;
  const items = list(c.items || c.ingredients, 30, i => { const name = clip(typeof i === 'string' ? splitIngredient(i).name : i?.name || i?.n, 80), qty = clip(typeof i === 'string' ? splitIngredient(i).qty : i?.qty || i?.quantity || i?.q || '', 30); return name ? {name, qty} : null; });
  const method = Array.isArray(c.method || c.steps) ? (c.method || c.steps).map((s, k) => (k + 1) + '. ' + clip(String(s), 400)).join('\n') : clipText(c.method || c.steps, 3000);
  return items.length || method ? {role: ROLE_IDS.includes(c.role) ? c.role : roleFor(clip(c.name, 90), false), name: clip(c.name, 90), techniques: list(c.techniques, 5, x => techOf(x)), items, method} : null;
 });
 if (!comps.length) return null;
 if (!comps.some(c => c.role === 'principal')) comps[0].role = 'principal';
 return {name: clip(src.name || src.title, 140), concept: clip(src.concept || src.description, 600), course: COURSE_IDS.includes(src.course) ? src.course : 'otro', portions: clip(String(src.portions ?? src.servings ?? ''), 30),
  components: comps, plating: clipText(Array.isArray(src.plating) ? src.plating.join('\n') : src.plating, 2000), notes: clipText(src.notes, 2000),
  source: src.source && typeof src.source === 'object' ? {author: clip(src.source.author, 120), url: /^https?:\/\//.test(String(src.source.url || '')) ? clip(src.source.url, 400) : ''} : null, issues: list(src.issues, 4, x => clip(x, 200))};
}
export function recipeToDish(kb, kitchen, r, newId = () => Math.random().toString(36).slice(2, 10)) {
 const subs = kitchen?.subrecipes || [];
 const components = r.components.map(c => ({id: newId(), role: c.role, name: c.name, techniques: c.techniques || [], method: c.method || '', items: c.items.slice(0, 30).map((i, k) => {
  const n = clip(i.name, 80), own = subs.find(s => norm(s.name) === norm(n)), key = own ? own.kb : matchName(kb, n);
  return {n, k: key || null, w: c.role === 'principal' && k === 0 ? 3 : /^(sal|pimienta|sal en escamas)$/i.test(n) ? 1 : 2, src: own ? 'recipe' : key ? 'kb' : 'free', ...(clip(i.qty, 30) ? {q: clip(i.qty, 30)} : {})};
 }).filter(i => i.n)}));
 const source = r.source && (r.source.url || r.source.author) ? r.source : null;
 return {name: r.name || 'Receta importada', concept: r.concept || '', course: r.course || 'otro', portions: r.portions || '', plating: r.plating || '', components,
  notes: [r.notes, source ? 'Fuente: ' + [source.author, source.url].filter(Boolean).join(' · ') : ''].filter(Boolean).join('\n'), source: {kind: 'import', title: source?.author || source?.url || 'Receta importada', ...(source?.url ? {url: source.url} : {})}};
}
