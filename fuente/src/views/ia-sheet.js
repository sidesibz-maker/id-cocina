// I+D · Conectar ChatGPT a la app con la clave del cocinero (servicio para desarrolladores de OpenAI).
import {t} from '../i18n.js';
import {esc, icon, $, sheet, toast} from '../ui.js';
import {iaConfig, iaOn, saveIa, forgetIa, checkKey, iaMessage} from '../ia.js';

export function iaSheet(onDone = null) {
 const cfg = iaConfig(), on = iaOn();
 const s = sheet({title: t('ChatGPT en la app', 'ChatGPT in the app'), wide: true, body:
  '<p class="lead">' + esc(t('Con ChatGPT conectado, la app pregunta ella sola: consejo, ideas, leer capturas de recetas, tus preguntas y las tendencias de cada día. Las imágenes se siguen haciendo en ChatGPT.', 'With ChatGPT connected, the app asks by itself: advice, ideas, reading recipe screenshots, your questions and each day\'s trends. Images are still made in ChatGPT.')) + '</p>' +
  (on ? '<div class="notice notice-ok" role="status">' + icon('check') + '<p><strong>' + esc(t('Conectado.', 'Connected.')) + '</strong> ' + esc(t('Clave terminada en ', 'Key ending in ') + '…' + String(cfg.key).slice(-4)) + '</p></div>' : '') +
  '<details class="fold"' + (on ? '' : ' open') + '><summary>' + esc(on ? t('Cambiar la clave', 'Change the key') : t('Cómo conectarlo (una sola vez)', 'How to connect it (once)')) + '</summary>' +
  '<ol class="steps-list"><li>' + esc(t('Entra en platform.openai.com con tu cuenta de ChatGPT.', 'Sign in at platform.openai.com with your ChatGPT account.')) + '</li><li>' + esc(t('En «Billing», carga saldo (por ejemplo 10 €) y pon un límite de gasto al mes. Va aparte de tu suscripción de ChatGPT.', 'In “Billing”, add credit (e.g. €10) and set a monthly spending limit. It is separate from your ChatGPT subscription.')) + '</li><li>' + esc(t('En «API keys», crea una clave nueva, cópiala y pégala aquí.', 'In “API keys”, create a new key, copy it and paste it here.')) + '</li></ol>' +
  '<div class="row-actions row-left"><a class="btn ghost" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">' + esc(t('Abrir mis claves de OpenAI', 'Open my OpenAI keys')) + icon('out') + '</a></div>' +
  '<label class="mini" for="iaKey">' + esc(t('Clave de OpenAI', 'OpenAI key')) + '</label><input id="iaKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…">' +
  '<div class="row-actions row-left"><button type="button" class="btn primary" data-act="save-key">' + icon('check') + esc(t('Comprobar y guardar', 'Check and save')) + '</button></div></details>' +
  '<fieldset class="choice"><legend>' + esc(t('Qué ChatGPT usar', 'Which ChatGPT to use')) + '</legend>' +
  [['fast', t('Rápido y barato (recomendado)', 'Fast and cheap (recommended)')], ['smart', t('El más listo (más caro y más lento)', 'The smartest (dearer and slower)')]].map(([id, label]) => '<button type="button" class="pill' + ((cfg.choice || 'fast') === id ? ' active' : '') + '" data-choice="' + id + '" aria-pressed="' + ((cfg.choice || 'fast') === id) + '">' + esc(label) + '</button>').join('') + '</fieldset>' +
  '<label class="check"><input type="checkbox" id="iaDaily"' + (cfg.daily === false ? '' : ' checked') + '><span>' + esc(t('Buscar tendencias nuevas una vez al día, al abrir la app (unos céntimos al día)', 'Look for new trends once a day when the app opens (a few cents a day)')) + '</span></label>' +
  '<p class="fine">' + esc(t('La clave se guarda solo en este aparato y solo se envía a OpenAI. No va en las copias de seguridad: en el móvil y en el PC hay que pegarla una vez en cada uno. Cada pregunta gasta del saldo (normalmente menos de un céntimo; leer una captura, uno o dos). Quien use este aparato podrá usar tu saldo: pon siempre un límite de gasto.', 'The key is stored only on this device and only sent to OpenAI. It is not in backups: paste it once on the phone and once on the PC. Each question uses credit (usually under a cent; reading a screenshot, one or two). Anyone using this device can use your credit: always set a spending limit.')) + '</p>' +
  (on ? '<div class="row-actions row-left"><button type="button" class="btn danger" data-act="forget-key">' + icon('x') + esc(t('Desconectar y borrar la clave de este aparato', 'Disconnect and remove the key from this device')) + '</button></div>' : '')});
 s.el.addEventListener('click', async e => {
  const choice = e.target.closest('[data-choice]');
  if (choice) { saveIa({choice: choice.dataset.choice}); s.el.querySelectorAll('[data-choice]').forEach(b => { const a = b === choice; b.classList.toggle('active', a); b.setAttribute('aria-pressed', a); }); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'save-key') {
   const key = $('#iaKey', s.el).value.trim().replace(/\s+/g, '');
   if (!/^sk-[\w-]{20,}$/.test(key)) { toast(t('Eso no parece una clave de OpenAI: empieza por «sk-».', 'That does not look like an OpenAI key: it starts with “sk-”.'), 'error'); return; }
   const b = e.target.closest('button'); b.disabled = true; b.classList.add('is-busy');
   try { const models = await checkKey(key); saveIa({key, models}); s.close(); toast(t('ChatGPT conectado. Ya puedes preguntar desde la app.', 'ChatGPT connected. You can now ask from the app.')); onDone?.(); }
   catch (err) { toast(iaMessage(err), 'error', 7000); }
   finally { b.disabled = false; b.classList.remove('is-busy'); }
  }
  if (act === 'forget-key') { forgetIa(); s.close(); toast(t('Clave borrada de este aparato.', 'Key removed from this device.')); onDone?.(); }
 });
 $('#iaDaily', s.el).onchange = e => saveIa({daily: e.target.checked});
 return s;
}
