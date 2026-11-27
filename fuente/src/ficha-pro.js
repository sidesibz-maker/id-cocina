// I+D · Ficha técnica profesional: alérgenos deducidos de los ingredientes y cantidades escaladas a otras raciones.
// Todo sin conexión y sin ChatGPT. Los alérgenos son una pista para revisar: la declaración la confirma el cocinero.
import {state} from './store.js';

const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Palabras que delatan cada uno de los 14 alérgenos (nombres en español e inglés, y elaboraciones que los llevan).
const RULES = {
 gluten: ['harina', 'trigo', 'pan', 'panko', 'pasta', 'fideo', 'fideos', 'cuscus', 'semola', 'cebada', 'centeno', 'espelta', 'avena', 'bulgur', 'seitan', 'galleta', 'hojaldre', 'masa', 'brioche', 'bizcocho', 'croissant', 'tostada', 'migas', 'picatoste', 'rebozado', 'empanado', 'tempura', 'cerveza', 'roux', 'bechamel', 'croqueta', 'gnocchi', 'noquis', 'raviolis', 'lasana', 'canelones', 'pizza', 'focaccia', 'coca', 'tortilla de trigo', 'salsa de soja', 'shoyu', 'flour', 'wheat', 'bread', 'beer', 'crumb', 'biscuit'],
 crustaceos: ['gamba', 'gambas', 'langostino', 'cigala', 'bogavante', 'langosta', 'carabinero', 'quisquilla', 'cangrejo', 'centollo', 'necora', 'buey de mar', 'camaron', 'percebe', 'bisque', 'americana', 'prawn', 'shrimp', 'crab', 'lobster'],
 huevo: ['huevo', 'huevos', 'yema', 'yemas', 'clara', 'claras', 'mayonesa', 'alioli', 'holandesa', 'bearnesa', 'merengue', 'sabayon', 'crema pastelera', 'crema inglesa', 'flan', 'tortilla', 'pasta fresca', 'brioche', 'bizcocho', 'egg', 'yolk', 'mayonnaise'],
 pescado: ['anchoa', 'boqueron', 'bacalao', 'atun', 'bonito', 'salmon', 'sardina', 'caballa', 'merluza', 'lubina', 'dorada', 'rape', 'rodaballo', 'gallo', 'raya', 'mero', 'corvina', 'pez', 'pescado', 'fumet', 'garum', 'colatura', 'dashi', 'katsuobushi', 'salsa de pescado', 'nam pla', 'bottarga', 'hueva', 'huevas', 'mojama', 'surimi', 'worcestershire', 'perrins', 'fish', 'anchovy', 'tuna', 'cod'],
 cacahuetes: ['cacahuete', 'cacahuetes', 'mani', 'satay', 'peanut'],
 soja: ['soja', 'tofu', 'tempeh', 'miso', 'edamame', 'tamari', 'shoyu', 'soy', 'soya'],
 lacteos: ['leche', 'nata', 'mantequilla', 'queso', 'yogur', 'yogurt', 'kefir', 'requeson', 'ricotta', 'mascarpone', 'burrata', 'mozzarella', 'parmesano', 'manchego', 'labneh', 'bechamel', 'beurre', 'ghee', 'creme fraiche', 'suero', 'cuajada', 'helado', 'crema pastelera', 'crema inglesa', 'milk', 'cream', 'butter', 'cheese'],
 frutos_cascara: ['almendra', 'almendras', 'avellana', 'avellanas', 'nuez', 'nueces', 'pistacho', 'pistachos', 'anacardo', 'anacardos', 'pecana', 'macadamia', 'nuez de brasil', 'praline', 'mazapan', 'turron', 'frangipane', 'romesco', 'ajoblanco', 'picada', 'almond', 'hazelnut', 'walnut', 'pistachio', 'cashew'],
 apio: ['apio', 'apionabo', 'sal de apio', 'mirepoix', 'celery', 'celeriac'],
 mostaza: ['mostaza', 'dijon', 'mustard'],
 sesamo: ['sesamo', 'tahini', 'tahina', 'gomasio', 'hummus', 'sesame'],
 sulfitos: ['vino', 'vinagre', 'jerez', 'oporto', 'sidra', 'cava', 'champan', 'mosto', 'pasas', 'orejones', 'fruta seca', 'vermut', 'brandy', 'wine', 'vinegar', 'sherry'],
 altramuces: ['altramuz', 'altramuces', 'lupin'],
 moluscos: ['almeja', 'almejas', 'mejillon', 'mejillones', 'berberecho', 'navaja', 'ostra', 'ostras', 'vieira', 'zamburina', 'pulpo', 'calamar', 'calamares', 'sepia', 'chipiron', 'chipirones', 'choco', 'caracol', 'caracoles', 'bigaro', 'clam', 'mussel', 'oyster', 'squid', 'octopus', 'scallop']
};
// Excepciones: «harina de almendra» no es gluten, «leche de coco» o «de almendra» no son lácteos, «mantequilla de cacahuete» no es lácteo…
const NOT = {gluten: ['harina de almendra', 'harina de maiz', 'harina de arroz', 'harina de garbanzo', 'sin gluten', 'pan de especias sin'], lacteos: ['leche de coco', 'leche de almendra', 'leche de avena', 'leche de soja', 'leche de arroz', 'mantequilla de cacahuete', 'crema de coco', 'nata de coco', 'sin lactosa'], huevo: ['huevas']};
const FAMILY = {pescado: 'pescado', lacteo: 'lacteos', queso: 'lacteos', huevo: 'huevo'};
const has = (text, word) => (' ' + text + ' ').includes(' ' + word + ' ');

// Los nombres de un plato: sus ingredientes y, si usa subrecetas propias, también los de esas subrecetas.
function namesOf(dish) {
 const out = [];
 for (const c of dish?.components || []) {
  if (c.name) out.push({n: c.name, where: c.name, k: null});
  for (const i of c.items || []) {
   out.push({n: i.n, where: i.n, k: i.k || null});
   if (i.src === 'recipe' && i.ref) { const sub = (state.subs || []).find(x => x.id === i.ref); for (const s of sub?.items || []) out.push({n: s.n, where: i.n + ' (' + s.n + ')', k: s.k || null}); }
  }
 }
 return out;
}
// Alérgenos que la app deduce del plato: [{id, from: [ingredientes que lo llevan]}], en el orden oficial.
export function autoAllergens(dish, order = Object.keys(RULES)) {
 const hits = new Map();
 for (const {n, where, k} of namesOf(dish)) {
  const text = norm(n);
  if (!text) continue;
  const fam = k && state.kb?.byId[k]?.family;
  for (const id of order) {
   const words = RULES[id] || [];
   const byWord = words.some(w => has(text, w)) && !(NOT[id] || []).some(x => text.includes(x));
   const byFamily = fam && FAMILY[fam] === id && !(NOT[id] || []).some(x => text.includes(x));
   if (byWord || byFamily) { if (!hits.has(id)) hits.set(id, []); if (!hits.get(id).includes(where)) hits.get(id).push(where); }
  }
 }
 return order.filter(id => hits.has(id)).map(id => ({id, from: hits.get(id).slice(0, 4)}));
}

// ---------- Escalar cantidades ----------
const FRACTIONS = {'½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3};
// El primer número de las raciones («4», «10 pases», «para 6») o null.
export const portionsOf = v => { const m = String(v ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/); const n = m ? Number(m[0]) : NaN; return n > 0 ? n : null; };
const rnd = v => String(v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100).replace('.', ',');
// Escala una cantidad escrita («120 g», «2-3 dientes», «1,5 l», «½ limón») por un factor. No toca temperaturas,
// porcentajes ni tiempos («180 °C», «2 %», «10 min»), ni lo que no lleva número («al gusto»).
export function scaleQty(q, f) {
 const s = String(q ?? '');
 if (!s.trim() || !(f > 0) || f === 1) return s;
 let out = s.replace(/(\d+)\s*\/\s*(\d+)/g, (m, a, b) => String(Number(a) / Number(b)).replace('.', ','));
 out = out.replace(/[½¼¾⅓⅔]/g, c => String(FRACTIONS[c]).replace('.', ','));
 return out.replace(/(\d+(?:[.,]\d+)?)(\s*([–-])\s*(\d+(?:[.,]\d+)?))?(\s*)([a-zA-Záéíóúñ°%]*)/g, (m, a, range, dash, b, sp, unit) => {
  if (/^(°|ºc|c$|%|min|minutos?|h$|horas?|seg|s$|segundos?)/i.test(unit) || unit === '°') return m;
  let x = Number(a.replace(',', '.')) * f, y = b ? Number(b.replace(',', '.')) * f : null, u = unit;
  // Gramos y mililitros que pasan de mil se dicen en kilos y litros (los dos extremos del rango igual).
  if (Math.max(x, y || 0) >= 1000 && /^(g|gr|grs|gramos?|ml|mililitros?)$/i.test(unit)) { x /= 1000; if (y != null) y /= 1000; u = /^m/i.test(unit) ? 'l' : 'kg'; sp = ' '; }
  return rnd(x) + (y != null ? dash + rnd(y) : '') + sp + u;
 });
}
