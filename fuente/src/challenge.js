// I+D · Reto de la semana: una técnica que todavía no dominas, con su ficha de la Biblioteca. Cocinarla y apuntarla en el
// diario es el reto; al darlo por hecho, tu nivel en esa técnica sube uno en «Mi trayectoria».
import {TECHNIQUES} from './flavor-core.js';
import {t, en, dayKey} from './i18n.js';
import {docById, saveDoc} from './store.js';
import {entries} from './saber/index.js';

const PERFIL = 'carrera:perfil';
// Lunes de esta semana, como clave.
export const weekKey = (d = new Date()) => { const x = new Date(d), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return dayKey(x); };
export function challenge() {
 const p = docById(PERFIL) || {}, skills = p.skills || {}, week = weekKey();
 const pool = entries().filter(e => e.technique && TECHNIQUES.some(x => x[0] === e.technique) && (Number(skills[e.technique]) || 0) < 3);
 if (!pool.length) return null;
 // Primero lo que estás aprendiendo, luego lo que no has marcado; dentro de eso, una distinta cada semana.
 const ranked = [...pool].sort((a, b) => ((Number(skills[a.technique]) || 0) === 1 ? 0 : 1) - ((Number(skills[b.technique]) || 0) === 1 ? 0 : 1) || a.id.localeCompare(b.id));
 const learning = ranked.filter(e => Number(skills[e.technique]) === 1), list = learning.length ? learning : ranked;
 const n = Math.floor(new Date(week + 'T12:00:00').getTime() / (7 * 86400000));
 const e = list[n % list.length], tech = TECHNIQUES.find(x => x[0] === e.technique);
 return {week, entry: e, tech: e.technique, techName: en() ? tech[2] : tech[1], level: Number(skills[e.technique]) || 0, done: (p.challenges || {})[week] === e.id};
}
export async function completeChallenge() {
 const c = challenge();
 if (!c || c.done) return null;
 const p = docById(PERFIL) || {}, skills = {...(p.skills || {})};
 skills[c.tech] = Math.min(3, (Number(skills[c.tech]) || 0) + 1);
 await saveDoc('carrera', PERFIL, {...p, skills, challenges: {...(p.challenges || {}), [c.week]: c.entry.id}});
 return skills[c.tech];
}
export const challengeText = c => t('Lee la ficha de ', 'Read the entry on ') + c.entry.name.toLowerCase() + t(', cocínalo al menos una vez esta semana y apunta en el diario qué has aprendido.', ', cook it at least once this week and write in your journal what you learned.');
