// I+D · navegación: las pantallas cambian con la parte de la dirección que va tras «#/» (así funciona el botón atrás).
export const go = path => { const target = '#/' + String(path).replace(/^#?\/?/, ''); if (location.hash === target) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = target; };
export const path = (...parts) => '#/' + parts.map(p => encodeURIComponent(p)).join('/');
