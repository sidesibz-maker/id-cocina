// I+D · Sugerencias mientras escribes en la Biblioteca (y en el buscador de Hoy): las fichas que empiezan así o que se le
// parecen aunque haya faltas (bexamel → Bechamel). Flechas para moverte, Intro para abrir, Esc para cerrar.
import {t, en} from '../i18n.js';
import {esc} from '../ui.js';
import {suggest, CATS} from '../saber/index.js';

const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const shelf = e => { const c = CATS.find(x => x[0] === (e.cat || 'conceptos')); return c ? (en() ? c[2] : c[1]) : ''; };
// Pone en negrita la parte del nombre que coincide con lo escrito (si coincide tal cual).
function mark(name, q) {
 const i = norm(name).indexOf(norm(q).trim());
 if (i < 0 || !q.trim()) return esc(name);
 const n = q.trim().length;
 return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + n)) + '</b>' + esc(name.slice(i + n));
}

export function attachSuggest(input, {onPick}) {
 if (!input || input.dataset.suggest) return;
 input.dataset.suggest = '1';
 const id = input.id + '-sug';
 const list = document.createElement('ul');
 list.id = id; list.className = 'ksug'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t('Sugerencias', 'Suggestions')); list.hidden = true;
 (input.closest('.searchbox') || input).after(list);
 input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', id);
 let items = [], active = -1;
 const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
 const paintActive = () => {
  [...list.children].forEach((li, i) => { const on = i === active; li.classList.toggle('is-active', on); li.setAttribute('aria-selected', on); });
  if (active >= 0) { input.setAttribute('aria-activedescendant', id + '-' + active); list.children[active]?.scrollIntoView({block: 'nearest'}); } else input.removeAttribute('aria-activedescendant');
 };
 const open = () => {
  const q = input.value;
  items = q.trim().length >= 2 ? suggest(q, 7) : [];
  if (!items.length) { close(); return; }
  list.innerHTML = items.map((e, i) => '<li role="option" id="' + id + '-' + i + '" data-i="' + i + '" aria-selected="false"><span class="ksug-name">' + mark(e.name, q) + '</span><span class="ksug-meta">' + esc(shelf(e)) + '</span></li>').join('');
  active = -1; list.hidden = false; input.setAttribute('aria-expanded', 'true'); paintActive();
 };
 const pick = i => { const e = items[i]; if (!e) return; close(); onPick(e); };
 input.addEventListener('input', open);
 input.addEventListener('focus', () => { if (input.value.trim().length >= 2) open(); });
 input.addEventListener('blur', () => setTimeout(close, 150));
 input.addEventListener('keydown', e => {
  if (list.hidden || e.isComposing) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); active = e.key === 'ArrowDown' ? Math.min(items.length - 1, active + 1) : Math.max(-1, active - 1); paintActive(); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopPropagation(); pick(active); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  else if (e.key === 'Tab') close();
 });
 list.addEventListener('mousedown', e => { const li = e.target.closest('[data-i]'); if (!li) return; e.preventDefault(); pick(Number(li.dataset.i)); });
}
