// I+D · Estado de tus datos, siempre a la vista: cuándo fue la última copia de seguridad y si el móvil y el PC están
// al día. Lo usan el menú lateral y la portada. Solo lee: no cambia nada.
import {t} from './i18n.js';
import {state} from './store.js';
import {syncStatus} from './sync.js';

export function dataStatus() {
 const s = syncStatus(), days = state.lastBackup ? Math.floor((Date.now() - new Date(state.lastBackup).getTime()) / 86400000) : null;
 const copy = days === null ? t('Sin copia de seguridad', 'No backup yet') : days === 0 ? t('Copia de seguridad de hoy', 'Backup from today') : days === 1 ? t('Copia de seguridad de ayer', 'Backup from yesterday') : t('Copia de seguridad de hace ', 'Backup from ') + days + t(' días', ' days ago');
 const sync = !s.on ? t('Solo en este aparato', 'Only on this device') : s.state === 'error' ? t('La sincronización ha fallado', 'Sync failed') : t('Móvil y PC sincronizados', 'Phone and PC in sync');
 const level = s.on && s.state !== 'error' ? 'ok' : days !== null && days <= 14 ? 'ok' : 'warn';
 return {copy, sync, level, days, on: s.on};
}
