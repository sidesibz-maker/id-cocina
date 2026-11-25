// I+D · idioma y apariencia, guardados en este ordenador. Sin tema guardado se sigue el del sistema.
const KEY = 'id-cocina-preferencias';

function read() {
 try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; }
}
const saved = read();
export const prefs = {
 lang: saved.lang === 'en' ? 'en' : 'es',
 theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : null,
 stepsHidden: !!saved.stepsHidden,
 size: ['grande', 'enorme'].includes(saved.size) ? saved.size : 'normal'
};

export const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
export const isDark = () => prefs.theme ? prefs.theme === 'dark' : systemDark();

export function applyPrefs() {
 const root = document.documentElement;
 root.lang = prefs.lang;
 if (prefs.theme) root.dataset.theme = prefs.theme; else delete root.dataset.theme;
 // Tamaño de letra: toda la app crece a la vez (texto, botones y huecos), para leer de lejos o con poca vista.
 if (prefs.size && prefs.size !== 'normal') root.dataset.size = prefs.size; else delete root.dataset.size;
 document.querySelectorAll('meta[name=theme-color]').forEach(meta => {
  if (prefs.theme) meta.content = prefs.theme === 'dark' ? '#141311' : '#ECE7DE';
 });
}
// Guarda solo lo que cambia.
export function setPref(key, value) {
 prefs[key] = value;
 try { localStorage.setItem(KEY, JSON.stringify({...read(), [key]: value})); } catch {}
 applyPrefs();
}

export const en = () => prefs.lang === 'en';
// t('Español', 'English')
export const t = (es, english) => (prefs.lang === 'en' ? english : es);
// Elige el texto de una pareja [es, en] (como las del motor de sabores).
export const pick = pair => (Array.isArray(pair) ? pair[prefs.lang === 'en' ? 1 : 0] : String(pair ?? ''));
export const locale = () => (prefs.lang === 'en' ? 'en-GB' : 'es-ES');

const asDate = v => (v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v + 'T12:00:00' : v));
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function longDate(v = new Date()) {
 const text = asDate(v).toLocaleDateString(locale(), {weekday: 'long', day: 'numeric', month: 'long'});
 return text.charAt(0).toUpperCase() + text.slice(1);
}
export const shortDate = v => asDate(v).toLocaleDateString(locale(), {day: 'numeric', month: 'short'});
// «Hoy», «Ayer» o la fecha.
export function relDay(v) {
 const d = asDate(v), today = new Date();
 const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
 if (days === 0) return t('Hoy', 'Today');
 if (days === 1) return t('Ayer', 'Yesterday');
 if (days > 1 && days < 7) return t('Hace ' + days + ' días', days + ' days ago');
 return shortDate(d);
}
export const num = (v, digits = 1) => Number(v || 0).toLocaleString(locale(), {minimumFractionDigits: 0, maximumFractionDigits: digits});
export const money = v => Number(v || 0).toLocaleString(locale(), {style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2});
export function greeting(now = new Date()) {
 const h = now.getHours();
 return h < 6 ? t('Buenas noches', 'Good evening') : h < 14 ? t('Buenos días', 'Good morning') : h < 21 ? t('Buenas tardes', 'Good afternoon') : t('Buenas noches', 'Good evening');
}
export const MONTHS = [['enero', 'January'], ['febrero', 'February'], ['marzo', 'March'], ['abril', 'April'], ['mayo', 'May'], ['junio', 'June'], ['julio', 'July'], ['agosto', 'August'], ['septiembre', 'September'], ['octubre', 'October'], ['noviembre', 'November'], ['diciembre', 'December']];
export const monthName = m => pick(MONTHS[(m - 1 + 12) % 12]);
// Temporadas: verano de mayo a octubre, con el año en curso («Invierno 2026»).
export function seasonOf(date = new Date()) {
 const m = date.getMonth() + 1, y = date.getFullYear(), summer = m >= 5 && m <= 10;
 return {key: (summer ? 'Verano ' : 'Invierno ') + y, summer, year: y};
}
export function seasonLabel(key) {
 const m = String(key || '').match(/^(Invierno|Verano)\s+(\d{4})$/);
 if (!m) return String(key || '');
 return prefs.lang === 'en' ? (m[1] === 'Verano' ? 'Summer ' : 'Winter ') + m[2] : key;
}
