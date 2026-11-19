// I+D · consejo, ideas, imágenes y tendencias sin servidores. La app prepara la consulta completa (el plato, tu cocina y el
// formato de respuesta) y la copia: se pega en Claude o en ChatGPT, y lo que contesten se pega de vuelta aquí. La app limpia
// la respuesta y la guarda en el plato. Las imágenes se crean en ChatGPT con la descripción que da la app y se añaden al plato.
import {cleanAdvice, cleanIdeas, dishRequest, kitchenRequest, imageRequest, cleanRecipe, recipeFromText, ALLERGENS, ROLE_IDS, COURSE_IDS, AI_TECHS} from './ai-core.js';
import {state} from './store.js';
import {en} from './i18n.js';

const lang = () => (en() ? 'Write the texts in British English.' : 'Escribe los textos en español de España.');
// Los básicos van en una sola línea: la consulta cabe así en el enlace que abre el chat.
const kitchen = () => { const k = kitchenRequest(state.kb, state.kitchen, state.settings, null); return Object.fromEntries(Object.entries({...k, basics: k.basics.join(', ')}).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))); };
const RULES = 'Eres un jefe de cocina con mucho oficio que ayuda a otro cocinero con el I+D de su restaurante. No haces alta cocina de laboratorio: buscas platos novedosos, ricos, con personalidad propia y que se puedan servir bien con el servicio lleno. Habla claro y de tú, con frases cortas y concretas, sin halagos. Usa primero los básicos de su cocina; cualquier otro producto debe ser fácil de encontrar en España. No inventes cantidades exactas ni tiempos: orienta. Respeta lo que la cocina dice que no quiere.';
const ONLY_JSON = 'Responde SOLO con un bloque de código JSON válido (```json … ```), sin texto antes ni después.';

export function advicePrompt(dish) {
 return RULES + '\n\nAnaliza este plato en desarrollo y da consejo práctico para afinarlo. ' + ONLY_JSON + ' Claves:\n' +
  '- "verdict": una o dos frases con lo esencial y qué tocarías primero.\n- "works": de 2 a 4 cosas concretas que ya funcionan.\n' +
  '- "changes": de 2 a 4 cambios por orden de impacto, cada uno {"what": el cambio, "why": qué problema resuelve, "how": cómo hacerlo con su equipo y sus básicos}.\n' +
  '- "signature": cómo darle el sello de la casa, en dos o tres frases.\n- "service": {"mise": de 3 a 5 cosas que se dejan hechas, "pass": cómo se termina y cuánto tarda en salir, "risks": de 1 a 3 cosas que pueden fallar en pleno servicio}.\n' +
  '- "plating": emplatado sencillo, sin pinzas ni flores: qué va debajo, qué encima y qué color manda.\n- "variants": exactamente 3, cada una {"label": «Más sencilla», «Más atrevida» o «De temporada», "idea": qué cambia}.\n' +
  '- "names": 3 nombres de carta, cada uno {"es", "en"}.\n- "allergens": los que probablemente lleva, solo de esta lista: ' + ALLERGENS.map(a => a[0]).join(', ') + '.\n- "issues": dudas; lista vacía si no hay.\n' +
  'Ten en cuenta el perfil de sabor calculado (de 0 a 10) y los avisos de equilibrio, pero usa tu criterio. ' + lang() + '\n\nDATOS:\n' + JSON.stringify({plato: dishRequest(state.kb, dish), cocina: kitchen()});
}
export function ideasPrompt({brief = '', course = '', lead = '', wants = [], trend = null} = {}) {
 return RULES + '\n\nPropón exactamente 3 platos distintos entre sí a partir de esta petición. ' + ONLY_JSON + ' Formato: {"ideas": [ … ], "issues": [ … ]}. Cada idea:\n' +
  '- "name": nombre de carta corto. "line": la idea en una frase. "course": uno de ' + COURSE_IDS.join(', ') + '.\n- "why": por qué funciona (equilibrio de sabores y texturas). "twist": qué lo hace propio y no una copia.\n' +
  '- "components": de 3 a 6, cada uno {"role": uno de ' + ROLE_IDS.join(', ') + '; "name": cómo se llama en el plato; "techniques": de esta lista: ' + AI_TECHS.join(', ') + '; "items": ingredientes con nombres simples}.\n' +
  'Cada plato lleva un protagonista claro, algo ácido o fresco que equilibre y un contraste de textura. Nada de espumas, esferificaciones ni geles. Una de las tres puede ser más atrevida. ' + lang() + '\n\nDATOS:\n' +
  JSON.stringify({peticion: {texto: brief.slice(0, 600), tipo: course, producto_principal: lead.slice(0, 80), que_sea: wants, tendencia: trend ? {titulo: trend.title, resumen: trend.summary} : null}, cocina: kitchen()});
}
const STYLE = {mesa: 'ángulo de 45 grados, luz natural lateral de ventana, mesa de madera clara, poca profundidad de campo', cenital: 'vista cenital, luz de día suave, superficie de piedra o lino, el plato entero a la vista', cerca: 'primer plano a baja altura, muy poca profundidad de campo, se ven las texturas y el brillo de la salsa', oscuro: 'fondo oscuro, una sola luz cálida lateral, superficie de pizarra o madera quemada, brasas desenfocadas al fondo'};
export function imagePrompt(dish, style) {
 const d = imageRequest(state.kb, dish, style);
 return 'Crea una fotografía gastronómica profesional y realista de un plato de restaurante: «' + d.name + '».' + (d.concept ? ' Idea: ' + d.concept + '.' : '') + '\nEn el plato:\n' +
  d.components.map(c => '- ' + [c.role, c.name].filter(Boolean).join(': ') + (c.techniques.length ? ' (' + c.techniques.join(', ') + ')' : '') + (c.items.length ? ' — ' + c.items.join(', ') : '')).join('\n') +
  '\nEmplatado: ' + (d.plating || 'sencillo, generoso y natural, sin puntos de salsa, sin pinzas y sin flores') + '.\nToma: ' + STYLE[d.style] + '.\nAmbiente: restaurante mediterráneo de brasa, plato de cerámica artesanal mate, materiales naturales.\n' +
  'La comida debe parecer cocinada de verdad y apetecible, con marcas de brasa donde toque, colores naturales y una ración realista. Solo lo que está en la lista. Sin texto, sin letras, sin logotipos, sin manos y sin personas.';
}
export function importPrompt() {
 return 'Te paso una receta: una captura de pantalla (TikTok, Instagram, YouTube, una web, un libro…), una foto o el texto. Léela entera y pásala a una ficha de cocina. ' + ONLY_JSON + ' Formato:\n' +
  '{"name": "nombre del plato", "concept": "qué es, en una frase", "course": uno de ' + COURSE_IDS.join(', ') + ', "portions": "raciones si lo dice", "source": {"author": "la cuenta, chef o web si sale", "url": "el enlace si sale"}, ' +
  '"components": [{"role": uno de ' + ROLE_IDS.join(', ') + ', "name": "nombre del componente (p. ej. Alioli)", "techniques": ids de esta lista si encajan: ' + AI_TECHS.join(', ') + ', "items": [{"name": "ingrediente", "qty": "cantidad tal cual (120 g, 2 cdas, al gusto)"}], "method": ["paso 1", "paso 2"]}], ' +
  '"plating": "cómo se emplata si lo dice", "notes": "trucos o avisos que dé", "issues": ["lo que no se lee bien o falta"]}\n' +
  'Si todavía no te he pasado la receta, pídemela en una frase corta y espera. Separa la receta en componentes (lo principal, la salsa, la guarnición, lo crujiente…), cada uno con sus ingredientes y sus pasos. Copia las cantidades, tiempos y temperaturas tal cual aparecen; no inventes nada que no salga: si falta algo, déjalo vacío y dilo en "issues". Si la receta tiene subtítulos o se dice hablando, usa lo que se entienda. ' + lang();
}
// La respuesta de la IA (JSON) o el texto de la receta pegado tal cual.
export function recipeFromReply(text) {
 const v = parseReply(text);
 return cleanRecipe(v) || (/[{[]/.test(String(text).trim()[0] || '') ? null : recipeFromText(text));
}
export function radarPrompt() {
 const k = kitchen(), recent = state.trends.slice(0, 40).map(t => t.title);
 return 'Busca en internet las tendencias gastronómicas de estas semanas y dame el radar de hoy para un cocinero profesional en España que quiere ideas novedosas, ricas y propias (no alta cocina de laboratorio).\n' +
  'Fuentes: The World\'s 50 Best y sus artículos, Guía Michelin, Guía Repsol, Eater, Bon Appétit, Food & Wine, Fine Dining Lovers, Gastroactitud, 7 Caníbales, El Comidista, Tapas Magazine, Hule y Mantel, y cocinas de brasa y producto de referencia. Da prioridad a lo publicado en los últimos dos meses. No inventes nada: cada aviso lleva al menos una fuente real con su enlace exacto.\n' +
  ONLY_JSON + ' Es una lista de 4 a 6 avisos y 1 idea del día. Cada aviso:\n' +
  '{"kind": tecnica, producto, plato, escena, dulce o bebida; "heat": emergente, alza o consolidada; "title": hasta 90 caracteres; "summary": una o dos frases; "why": por qué ahora y quién lo hace; "adapt": cómo llevarlo a esta cocina con su equipo y sus básicos; "places": hasta 5 restaurantes o ciudades; "sources": [{"name", "url", "date": "AAAA-MM-DD"}]; ' +
  '"ideas": 1 o 2 platos {"name", "line", "components": [{"role": ' + ROLE_IDS.join('/') + ', "name", "techniques": de ' + AI_TECHS.join(', ') + ', "items": [ingredientes]}]}; "tags": de 2 a 4 palabras; "fit": de 0 a 100, cuánto encaja con esta cocina}.\n' +
  'La idea del día lleva "kind": "idea", sin sources ni places: "title" es el nombre del plato, "summary" la idea y "ideas" ese plato.\n' + lang() + '\n\nLA COCINA:\n' + JSON.stringify(k) + (recent.length ? '\n\nNo repitas estos avisos anteriores:\n- ' + recent.join('\n- ') : '');
}
// Saca el JSON de una respuesta pegada (con o sin bloque de código alrededor). null si no hay JSON.
export function parseReply(text) {
 const s = String(text || ''), fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
 for (const candidate of [fenced && fenced[1], s]) {
  if (!candidate) continue;
  const start = candidate.search(/[[{]/);
  if (start < 0) continue;
  const open = candidate[start], close = open === '{' ? '}' : ']';
  for (let end = candidate.lastIndexOf(close); end > start; end = candidate.lastIndexOf(close, end - 1)) { try { return JSON.parse(candidate.slice(start, end + 1)); } catch {} }
 }
 return null;
}
// Lo pegado como consejo: si trae el formato pedido se ordena; si no, se guarda tal cual como texto.
export function adviceFromReply(text) {
 const clean = cleanAdvice(parseReply(text)), raw = String(text || '').trim();
 if (clean) return {...clean, at: new Date().toISOString()};
 return raw.length >= 20 ? {raw: raw.slice(0, 12000), at: new Date().toISOString()} : null;
}
export const ideasFromReply = text => { const v = parseReply(text); return cleanIdeas(Array.isArray(v) ? {ideas: v} : v); };
export function trendsFromReply(text) {
 const v = parseReply(text), list = Array.isArray(v) ? v : Array.isArray(v?.avisos) ? v.avisos : Array.isArray(v?.trends) ? v.trends : [];
 return list.filter(t => t && typeof t === 'object' && typeof t.title === 'string' && t.title.trim()).slice(0, 12);
}
// Lo último copiado: los botones «Preguntar a ChatGPT / Claude» lo llevan ya escrito al chat.
export let lastCopied = null;
export async function copy(text) {
 lastCopied = {text: String(text || ''), at: Date.now()};
 try { await navigator.clipboard.writeText(text); return true; } catch {}
 try { const a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.append(a); a.select(); const done = document.execCommand('copy'); a.remove(); return done; } catch { return false; }
}
// Reduce una imagen elegida del ordenador (unos 150-250 KB) antes de guardarla.
export async function shrinkImage(file) {
 let bitmap;
 try { bitmap = await createImageBitmap(file); } catch { return file; }
 const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
 canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
 canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
 const make = (type, q) => new Promise(resolve => canvas.toBlob(resolve, type, q));
 let out = await make('image/webp', .84);
 if (!out || out.type !== 'image/webp') out = await make('image/jpeg', .86);
 return out && out.size < file.size ? out : file;
}
