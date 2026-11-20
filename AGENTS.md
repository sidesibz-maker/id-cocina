# I+D · Cuaderno de cocina — reglas para agentes (Codex, Claude)

App personal de I+D de un jefe de cocina (restaurante mediterráneo de brasa en Ibiza). Interfaz en español de España
(con inglés vía `t('es', 'en')`). El dueño no programa: explícale todo en español llano.

## Dónde está cada cosa

- **Raíz del repositorio** = la app publicada en GitHub Pages (`https://sidesibz-maker.github.io/id-cocina/`). Son archivos
  generados: **no se editan a mano**. Se regeneran desde `fuente/`.
- **`fuente/`** = el código.
  - `src/main.js`: armazón, rutas por `#/…`, menú de ajustes. `src/store.js`: datos (localStorage `id-cocina-v1`,
    IndexedDB `id-cocina` con imágenes y versiones de platos), copia de seguridad. `src/sync.js`: sincronización PC–móvil.
    `src/ia.js`: ChatGPT con la clave del propio dueño (Responses API). `src/share.js` + `ficha.html`: fichas de solo
    lectura para el equipo. `src/views/*`: pantallas. `src/saber/`: la «Biblioteca» (cerebro de cocina; ruta `#/biblioteca`, pantalla `views/saber.js`): `index.js`, contenido
    en `a.json`, `b.json`, `c.json` con el formato de `saber/FORMATO.md`. `src/lab.css`: diseño (Hallmark, tema Solstice).
  - `radar.js`: avisos del radar que trae la app. `LEEME.txt`: instrucciones para el dueño.
- La versión del PC es un solo archivo, `ID Cocina.html`, que se abre con doble clic (desde `file://`), con `radar.js` y
  `LEEME.txt` al lado.

## Compilar, probar y publicar

```
cd fuente
npm install
npm run build        # genera salida/web (móvil, GitHub Pages) y salida/ID Cocina (PC)
npx playwright install chromium   # solo la primera vez, si no hay navegador
npm test             # 5 baterías en navegador: tienen que pasar TODAS
```

Publicar: con las pruebas en verde, copia `fuente/salida/web/*` a la raíz del repositorio, haz commit (`[codex] …`) y
`git push` a `main`; GitHub Pages lo publica en uno o dos minutos. Para el PC del dueño, copia
`fuente/salida/ID Cocina/ID Cocina.html` y `radar.js` encima de los de la carpeta donde tiene la app (sus datos están en el
navegador, no en esos archivos, así que no se pierden).

## Normas que no se saltan

1. **Nunca se borran datos del dueño.** Lo que se quita va a la papelera (`deleted_at`). Las versiones de la Biblioteca y de los
   platos solo se añaden. Al guardar o migrar, conserva todos los campos que no entiendas. Recuperar una copia solo suma.
2. **La sincronización** (Supabase, proyecto propio `id-cocina`, ref `dyacksxibcwvrdsulsfc`) gana por el cambio más reciente
   y guarda lo sustituido en `id_history`. **Nunca** SQL destructivo (DELETE, TRUNCATE, DROP) sobre sus datos. Si cambias el
   esquema, migración aditiva y probada antes en una transacción que se deshace.
3. **Nada que ver con Albarán Cocina ni Albarán Cloud** (ni su repositorio, ni su Supabase `switjscvhdigucxgnjvl`, ni
   AppDeploy). Sin precios ni costes.
4. **La clave de OpenAI** del dueño se guarda solo en su aparato (`id-cocina-ia`), nunca en copias, commits ni registros.
5. **La Biblioteca (antes «Saber») se escribe con palabras propias.** No se copian ni se parafrasean de cerca libros ni webs (derechos de autor).
   Proporciones métricas reales, sin inventar datos históricos. Enlaces internos `[[id]]` o `[[id|texto]]` solo a ids que
   existan.
6. **Diseño (Hallmark, Solstice):** todo color y letra por tokens de `:root`; nada de etiquetas en mayúsculas espaciadas,
   rótulos encima de los títulos ni datos unidos con «·»; un solo acento bermellón; espaciados de 4 en 4 px; foco visible
   y `prefers-reduced-motion`. Si tienes el skill (`npx skills add nutlope/hallmark -g`), pasa
   `node ~/.agents/skills/hallmark/scripts/sloplint.mjs salida/web/index.html --scope app --genre editorial` y deja 0 FAIL.
7. **No hacer crecer la app sin que el dueño lo pida.** Mejoras, arreglos y contenido de la Biblioteca sí.
8. **Trabajo compartido con Claude:** `git pull` antes de empezar, commits pequeños, no reescribir historia, no deshacer
   cambios ajenos. Si tocáis lo mismo, junta las dos intenciones y vuelve a pasar todas las pruebas.
