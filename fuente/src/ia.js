// I+D · ChatGPT dentro de la app. Usa el servicio para desarrolladores de OpenAI con la clave del propio cocinero:
// la app habla directamente con OpenAI desde este aparato, sin servidores de por medio.
// La clave se guarda solo aquí (nunca entra en las copias de seguridad ni sale hacia otro sitio que no sea OpenAI).
import {t} from './i18n.js';

const KEY = 'id-cocina-ia', URL_API = 'https://api.openai.com/v1/responses';
// Los modelos se eligen de los que tiene la cuenta (se consultan al conectar); estos solo sirven si esa consulta falla.
const FALLBACK = {fast: 'gpt-5.4-mini', smart: 'gpt-5.5'};
const URL_MODELS = 'https://api.openai.com/v1/models';
export function iaConfig() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export const iaOn = () => /^sk-[\w-]{20,}$/.test(iaConfig().key || '');
export const iaModel = () => { const c = iaConfig(), m = {...FALLBACK, ...(c.models || {})}; return c.choice === 'smart' ? m.smart : m.fast; };
// Comprueba la clave y elige, de los modelos de la cuenta, el más nuevo de uso general y su versión «mini».
export async function checkKey(key) {
 let res;
 try { res = await fetch(URL_MODELS, {headers: {Authorization: 'Bearer ' + key}}); } catch { throw new IaError(navigator.onLine === false ? 'offline' : 'net'); }
 if (res.status === 401) throw new IaError('key');
 if (!res.ok) throw new IaError(res.status === 429 ? 'busy' : 'other', String(res.status));
 const ids = ((await res.json().catch(() => ({})))?.data || []).map(m => String(m?.id || ''));
 const pick = mini => ids.map(id => id.match(mini ? /^gpt-(\d+(?:\.\d+)?)-mini$/ : /^gpt-(\d+(?:\.\d+)?)$/)).filter(Boolean).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
 return {fast: pick(true) || FALLBACK.fast, smart: pick(false) || FALLBACK.smart};
}
export function saveIa(patch) { const next = {...iaConfig(), ...patch}; for (const k of Object.keys(next)) if (next[k] == null) delete next[k]; localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function forgetIa() { const {daily, lastRadar, choice} = iaConfig(); localStorage.setItem(KEY, JSON.stringify({daily, lastRadar, choice})); }

// Una imagen elegida (captura, foto) reducida y lista para enviar.
export async function imageData(file) {
 let bitmap;
 try { bitmap = await createImageBitmap(file); } catch { throw Error('image'); }
 const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
 canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
 canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
 return canvas.toDataURL('image/jpeg', .85);
}

export class IaError extends Error { constructor(kind, detail = '') { super(kind); this.kind = kind; this.detail = detail; } }
export function iaMessage(e) {
 const k = e?.kind || '';
 return k === 'key' ? t('La clave de ChatGPT no vale o se ha borrado. Revísala en el menú → ChatGPT en la app.', 'The ChatGPT key is not valid or was deleted. Check it in the menu → ChatGPT in the app.')
  : k === 'quota' ? t('Se ha acabado el saldo de ChatGPT o has llegado al límite que pusiste. Recárgalo en platform.openai.com.', 'The ChatGPT credit has run out or you reached your limit. Top it up at platform.openai.com.')
  : k === 'busy' ? t('ChatGPT está saturado ahora mismo. Prueba en un minuto.', 'ChatGPT is busy right now. Try again in a minute.')
  : k === 'offline' ? t('Sin conexión: no se puede hablar con ChatGPT ahora.', 'Offline: cannot reach ChatGPT right now.')
  : k === 'model' ? t('Tu cuenta no tiene acceso a ese modelo. Cambia de modelo en el menú → ChatGPT en la app.', 'Your account cannot use that model. Change the model in the menu → ChatGPT in the app.')
  : k === 'empty' ? t('ChatGPT no ha devuelto nada. Prueba otra vez.', 'ChatGPT returned nothing. Try again.')
  : t('No se pudo hablar con ChatGPT. Prueba otra vez.', 'Could not reach ChatGPT. Try again.') + (e?.detail ? ' (' + e.detail + ')' : '');
}

// Pregunta a ChatGPT. turns: [{role: 'user'|'assistant', text, images?: [dataUrl]}]. Devuelve el texto de la respuesta.
// smart: usa el modelo más listo aunque el elegido sea el rápido (para lo que se guarda para siempre, como las fichas).
export async function askIa({instructions = '', turns = [], text = '', images = [], json = false, web = false, signal, smart = false, effort = 'low'} = {}) {
 const cfg = iaConfig();
 if (!iaOn()) throw new IaError('key');
 const all = turns.length ? turns : [{role: 'user', text, images}];
 const input = all.map(m => m.role === 'assistant'
  ? {role: 'assistant', content: m.text}
  : {role: 'user', content: [{type: 'input_text', text: m.text || ' '}, ...(m.images || []).map(url => ({type: 'input_image', image_url: url, detail: 'high'}))]});
 const body = {model: smart ? {...FALLBACK, ...(cfg.models || {})}.smart : iaModel(), input, ...(instructions ? {instructions} : {}), reasoning: {effort}, store: false,
  ...(web ? {tools: [{type: 'web_search'}]} : {}), ...(json && !web ? {text: {format: {type: 'json_object'}}} : {})};
 let res;
 try { res = await fetch(URL_API, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key}, body: JSON.stringify(body), signal}); }
 catch (e) { if (e?.name === 'AbortError') throw e; throw new IaError(navigator.onLine === false ? 'offline' : 'net'); }
 let data = null;
 try { data = await res.json(); } catch {}
 if (!res.ok) {
  const code = data?.error?.code || '', msg = String(data?.error?.message || '');
  if (res.status === 401) throw new IaError('key');
  if (code === 'insufficient_quota' || /quota|billing/i.test(msg)) throw new IaError('quota');
  if (res.status === 429 || res.status >= 500) throw new IaError('busy');
  if (code === 'model_not_found' || /model/i.test(msg) && res.status === 404) throw new IaError('model');
  throw new IaError('other', String(res.status));
 }
 const out = typeof data?.output_text === 'string' && data.output_text ? data.output_text
  : (Array.isArray(data?.output) ? data.output : []).filter(o => o?.type === 'message').flatMap(o => o.content || []).filter(c => c?.type === 'output_text').map(c => c.text).join('\n');
 if (!out.trim()) throw new IaError('empty');
 return out;
}

// Imagen guía: la crea el modelo de imágenes de OpenAI con la clave del propio cocinero. Devuelve un Blob PNG.
const URL_IMAGES = 'https://api.openai.com/v1/images/generations';
export async function makeImage(prompt, {size = '1536x1024', quality = 'medium', signal} = {}) {
 const cfg = iaConfig();
 if (!iaOn()) throw new IaError('key');
 let res;
 try { res = await fetch(URL_IMAGES, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key}, body: JSON.stringify({model: 'gpt-image-1', prompt, size, quality, n: 1}), signal}); }
 catch (e) { if (e?.name === 'AbortError') throw e; throw new IaError(navigator.onLine === false ? 'offline' : 'net'); }
 let data = null;
 try { data = await res.json(); } catch {}
 if (!res.ok) {
  const code = data?.error?.code || '', msg = String(data?.error?.message || '');
  if (res.status === 401) throw new IaError('key');
  if (code === 'insufficient_quota' || /quota|billing/i.test(msg)) throw new IaError('quota');
  if (res.status === 429 || res.status >= 500) throw new IaError('busy');
  if (/verif|organization must be verified/i.test(msg)) throw new IaError('other', 'verify');
  if (code === 'model_not_found' || res.status === 404) throw new IaError('model');
  throw new IaError('other', String(res.status));
 }
 const b64 = data?.data?.[0]?.b64_json;
 if (!b64) throw new IaError('empty');
 const bin = atob(b64), bytes = new Uint8Array(bin.length);
 for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
 return new Blob([bytes], {type: 'image/png'});
}
