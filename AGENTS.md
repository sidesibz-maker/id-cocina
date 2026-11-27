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
    en `a.json`, `b.json`, `c.json`, `preparaciones.json`, `tecnicas.json`, `dulce.json` y `producto.json` con el formato de
    `saber/FORMATO.md`. `src/lab.css`: diseño «Lámina de laboratorio» (ver `DESIGN.md` y `PRODUCT.md`).
  - **Esta app no gestiona el restaurante** (eso lo lleva el dueño en otra app): nada de pedidos, stock, APPCC, equipo ni
    sala. Es para crear, aprender y su carrera.
  - Oficio (nov 2026): `views/tools.js` (Herramientas de cocina: escalar, temporizadores, salmueras, espesantes, panadero,
    temperaturas), `views/lab.js` (Laboratorio creativo, `#/laboratorio`: chispas, retos con restricción, mecanismos, cuaderno de chispas), `views/create.js` (Crear: «mesa de ideas», el plato en el centro y alrededor estallan ideas por grupos que se arrastran o tocan, sacadas solo de la tabla de sabores, las técnicas y las recetas de la Biblioteca (sin ChatGPT, a petición del dueño), con lo que le falta al plato según su equilibrio; el borrador vive en localStorage `id-cocina-crear` hasta guardarlo como plato), `ficha-pro.js` (alérgenos deducidos de los ingredientes y escalar cantidades; lo usan la ficha técnica impresa, «Calcular raciones» y la mesa de ideas), `views/kbook.js` (libro de la Biblioteca para imprimir), `views/kcompare.js` (comparar dos fichas), `views/year.js` (Mi año en cocina), `views/discover.js` (Por descubrir, documentos «descubrir:…»), `saber/glosario.js` (diccionario de cocina; traducciones fr/it/en/ja y origen en `saber/glosario-idiomas.js`); tarjetas propias de Entrenar en documentos «tarjeta:…», `sketch.js`
    (boceto de emplatado), `timers.js`, `views/cook.js` (modo cocina,
    `#/cocinar/plato|sub|biblioteca/<id>`), `views/journal.js` (Diario, `#/diario`), `views/career.js` (Mi trayectoria y
    dossier, `#/trayectoria`), `views/train.js` (Entrenar: «Examen» con corrección que enseña, en `views/exam.js`, y «Repaso rápido» de tarjetas; repetición espaciada; exámenes guardados como documentos «examen:…»), `challenge.js` (reto de la
    semana), `finder.js` (buscador Ctrl+K).
  - Documentos: `state.docs` en `store.js` (`saveDoc`, `liveDocs`, `trashDoc`), con id `tipo:…` (diario, carrera:perfil,
    puesto, formacion, objetivo, logro, chispa, repaso:estado, lectura:estado, favoritas:lista; y otros de pantallas ya retiradas que se conservan). Van en la copia y se sincronizan como tipo
    `doc` (migración `fuente/migracion-doc.sql`, aplicada el 26 nov 2026 con permiso del dueño).
  - `radar.js`: avisos del radar que trae la app. `LEEME.txt`: instrucciones para el dueño.
- La versión del PC es un solo archivo, `ID Cocina.html`, que se abre con doble clic (desde `file://`), con `radar.js` y
  `LEEME.txt` al lado.

## Compilar, probar y publicar

```
cd fuente
npm install
npm run build        # genera salida/web (móvil, GitHub Pages) y salida/ID Cocina (PC)
npx playwright install chromium   # solo la primera vez, si no hay navegador
npm test             # 13 baterías en navegador: tienen que pasar TODAS
```

Publicar: con las pruebas en verde, copia `fuente/salida/web/*` a la raíz del repositorio, haz commit (`[codex] …`) y
`git push` a `main`; GitHub Pages lo publica en uno o dos minutos. Para el PC del dueño, copia
`fuente/salida/ID Cocina/ID Cocina.html` y `radar.js` encima de los de la carpeta donde tiene la app (sus datos están en el
navegador, no en esos archivos, así que no se pierden). En este PC el programa de Windows está en
`Documentos\ID Cocina\programa`: copia también esos dos archivos a `programa\ID Cocina-win32-x64\resources\app\app\` y a
`Documentos\ID Cocina\app\` (el programa sirve la app en http://127.0.0.1:4781; no cambiar el puerto). **Ojo:** el programa instalado lee su
   propia copia en `programa\ID Cocina-win32-x64\resources\app\app\`: si no la actualizas, el dueño no ve los cambios en el PC.

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
6. **Diseño «Lámina de laboratorio» (rediseño del 26 nov 2026, pedido por el dueño):** fondo carbón por defecto y versión
   clara «lámina blanca» en Ajustes; todo color y letra por tokens de `:root` (Barlow y Barlow Condensed, incrustadas desde
   `fuente/fonts/`); líneas de un píxel, esquinas rectas, sin sombras de adorno ni barras de color gruesas; cifras tabulares;
   el rojo fuego para la acción principal y lo que cambia; la escala térmica (frío, templado, caliente, fuego) para
   temperaturas y estados. Firmas: el plato en corte (`xsec` en `views/shared.js`) y la escala térmica (`thermScale`).
   Nada de rótulos encima de los títulos, etiquetas en mayúsculas espaciadas ni datos unidos con «·»; foco visible;
   `prefers-reduced-motion`; la revisión de accesibilidad (carbón, lámina blanca y alto contraste) sin fallos graves.
   Menú: Hoy, Platos, Biblioteca y Laboratorio primero (por este orden de prioridad del dueño).
7. **No hacer crecer la app sin que el dueño lo pida.** Mejoras, arreglos y contenido de la Biblioteca sí.
8. **Trabajo compartido con Claude:** `git pull` antes de empezar, commits pequeños, no reescribir historia, no deshacer
   cambios ajenos. Si tocáis lo mismo, junta las dos intenciones y vuelve a pasar todas las pruebas.
