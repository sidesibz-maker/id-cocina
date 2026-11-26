---
name: I+D · Cuaderno de cocina
description: El I+D de un jefe de cocina visto como láminas de la cocina científica: platos en corte, temperaturas en escala, cifras como dato.
colors:
  carbon-ground: "#111214"
  carbon-card: "#191b1e"
  carbon-soft: "#22252a"
  carbon-field: "#16181a"
  carbon-deep: "#0b0c0d"
  chalk-ink: "#ecebe6"
  chalk-ink-2: "#c3c5c8"
  steel-muted: "#959aa1"
  carbon-rule: "#2c2f34"
  carbon-rule-strong: "#4a4f56"
  fire-red-carbon: "#ef5a3f"
  fire-red-ink-carbon: "#ff8f73"
  fire-red-soft-carbon: "#3a1d17"
  mark-teal-carbon: "#35c2ac"
  mark-teal-soft-carbon: "#16352f"
  sheet-ground: "#f4f4f1"
  sheet-card: "#ffffff"
  sheet-soft: "#ebebe6"
  sheet-field: "#fafaf8"
  sheet-slab: "#e6e6e1"
  graphite-ink: "#141516"
  graphite-ink-2: "#33363b"
  graphite-muted: "#5b6068"
  sheet-rule: "#d8d9d4"
  sheet-rule-strong: "#a9ada9"
  fire-red-sheet: "#c9361f"
  fire-red-ink-sheet: "#a42c18"
  fire-red-soft-sheet: "#fbe4dd"
  mark-teal-sheet: "#0f7f6e"
  mark-teal-soft-sheet: "#d6efe9"
  rail-coal: "#141516"
  rail-ink: "#ecebe6"
  rail-muted: "#a3a8ae"
  hc-sheet-ink: "#000000"
  hc-sheet-muted: "#33363b"
  hc-sheet-rule: "#6b6f74"
  hc-sheet-fire-ink: "#8a2212"
  hc-carbon-ground: "#000000"
  hc-carbon-ink: "#ffffff"
  hc-carbon-muted: "#c8ccd1"
  hc-carbon-rule: "#7b8189"
  hc-carbon-fire-ink: "#ffb3a1"
  therm-cold-carbon: "#4b8cf0"
  therm-cool-carbon: "#35c2ac"
  therm-warm-carbon: "#f2b32e"
  therm-hot-carbon: "#ef5a3f"
  therm-cold-sheet: "#2f6fdb"
  therm-cool-sheet: "#16a08c"
  therm-warm-sheet: "#e0a21c"
  therm-hot-sheet: "#d9452c"
  role-principal: "#c4683f"
  role-salsa: "#7a4a2e"
  role-guarnicion: "#9aa77a"
  role-cremoso: "#e3d6b8"
  role-fresco: "#7fb35a"
  role-crujiente: "#d6b25e"
  role-toque: "#a8436a"
typography:
  display:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "clamp(34px, 4vw, 48px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 30px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.05
  figure:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0em"
    fontFeature: "'tnum' 1"
  button:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
    letterSpacing: "0.005em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  section: "40px"
  rail: "240px"
components:
  button-primary:
    backgroundColor: "{colors.fire-red-carbon}"
    textColor: "{colors.carbon-ground}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "46px"
  button-primary-sheet:
    backgroundColor: "{colors.fire-red-sheet}"
    textColor: "{colors.sheet-card}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "46px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "46px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "44px"
  chip-have:
    backgroundColor: "{colors.mark-teal-soft-carbon}"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.none}"
  input:
    backgroundColor: "{colors.carbon-field}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "12px"
    height: "46px"
  card:
    backgroundColor: "{colors.carbon-card}"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
  rail-nav-main:
    backgroundColor: "{colors.rail-coal}"
    textColor: "{colors.rail-ink}"
    typography: "{typography.title}"
    height: "48px"
  tab-bar:
    backgroundColor: "{colors.carbon-field}"
    textColor: "{colors.steel-muted}"
    height: "64px"
---

# Design System: I+D · Cuaderno de cocina

## Overview

**Creative North Star: "Lámina de laboratorio"**

La cocina del dueño vista como las láminas de la cocina científica moderna. Cada plato se dibuja en corte, por capas y con sus gramos; cada temperatura cae en una escala térmica medida; cada cifra (gramos, grados, minutos, progreso) se lee como dato de laboratorio, en condensada y con cifras tabulares. El suelo es carbón, la tinta es tiza, las divisiones son reglas de un píxel y las esquinas son rectas. No hay sombras de adorno: la profundidad la dan el tono del panel y la regla.

La densidad es de cuaderno de trabajo, no de revista: listas con reglas, cifras alineadas a la derecha, títulos cortos en Barlow Condensed seminegra. El color no decora, trabaja: el rojo fuego marca la acción principal y lo que ha cambiado; la escala térmica (frío, templado, caliente, fuego) solo habla de temperatura; los tintes de papel del corte solo hablan de qué papel tiene cada componente. Hay una variante clara, «lámina blanca», para cocinas con mucha luz, que conserva el mismo sistema y mantiene el menú lateral en carbón. El aspecto sigue el ajuste del aparato; ambos se publican, con un modo de alto contraste encima de cada uno.

Rechazos confirmados: el cuaderno de recetas de papel crema con serifa y la app de recetas a base de tarjetas con foto.

**Key Characteristics:**
- Carbón por defecto (#111214), lámina blanca (#f4f4f1) como alternativa, alto contraste sobre ambas.
- Líneas de un píxel, esquinas a 0, ninguna sombra.
- Barlow para leer, Barlow Condensed para títulos, cifras y rótulos de dato; cifras tabulares siempre.
- Un solo rojo fuego por pantalla: la acción principal o lo que cambia.
- Dos firmas: el plato en corte y la escala térmica.
- Todo lo que se toca mide 44 px o más; foco visible en rojo fuego.

## Colors

Una paleta de laboratorio: neutros de carbón y grafito con tinta tiza, un único acento rojo fuego, una escala térmica reservada a temperaturas y tintes de comida reservados al corte. Los valores viven en `:root` (lámina blanca), `:root[data-theme=dark]` (carbón) y `:root[data-contrast=alto]` de `fuente/src/lab.css`; todo color se aplica por token (`--bg`, `--card`, `--ink`, `--ember`…), nunca con hexadecimales sueltos.

### Primary
- **Rojo fuego** (`--ember`: fire-red-carbon en carbón, fire-red-sheet en lámina blanca): relleno de la acción principal de la pantalla («Crear un plato» en Hoy, «Crear» en Platos, «Cocinar paso a paso» en la ficha del plato), el botón Crear central de la barra de abajo, el contorno de foco, el cursor de texto, el subrayado de los enlaces de texto, la marca activa (cuadradito de 6 px en el menú lateral, raya de 3 px en la barra de abajo) y las insignias de novedad (Radar «9+»).
- **Tinta de fuego** (`--ember-ink`: fire-red-ink-*): texto en rojo sobre fondo neutro (enlaces de acción secundaria, iconos de «Para hoy»), con contraste AA.
- **Fuego suave** (`--ember-soft`: fire-red-soft-*): fondo de lo pendiente o recién cambiado («¿Cómo ha ido hoy?» cuando toca, ideas nuevas del radar).

### Secondary
- **Verde marca** (`--mark` / `--mark-soft`: mark-teal-*): estado de posesión y selección, no temperatura: los productos «de tus básicos» en Temporada y Sabores llevan borde verde y fondo verde suave. En carbón comparte valor con el tono templado de la escala, pero es un token distinto y no se usa para grados.

### Tertiary
- **Escala térmica** (`--t-cold`, `--t-cool`, `--t-warm`, `--t-hot`: therm-*): azul frío, verde agua templado, ámbar caliente, rojo fuego. Solo en la escala térmica y en su degradado.
- **Tintes de papel del corte** (`--role-principal` … `--role-toque`: role-*): colores de comida, deliberadamente separados de la escala térmica. Protagonista terracota (#c4683f), salsa o jugo marrón tostado, guarnición verde salvia, cremoso crema, fresco o ácido verde hoja, crujiente dorado, toque final magenta remolacha. Iguales en carbón y en lámina blanca.
- **Estados del plato** (`--warn`, `--tip`, `--ok` y sus `-ink`): fondos tonales de las etiquetas «En pruebas» (ámbar apagado), «Afinando» (azul tinta), «Lista» (verde).

### Neutral
- **Carbón** (carbon-ground, `--bg`): fondo de la app en el aspecto por defecto.
- **Panel grafito** (carbon-card, `--card`): paneles y tarjetas sobre carbón.
- **Grafito suave** (carbon-soft, `--soft`): hover de filas y tarjetas, zonas secundarias dentro de un panel.
- **Campo** (carbon-field, `--paper-2`): fondo de campos de texto y de la barra de abajo.
- **Carbón hondo** (carbon-deep, `--coal` / `--paper-3`): menú lateral y fondo del corte en miniatura.
- **Tinta tiza** (chalk-ink, `--ink`), **tiza segunda** (chalk-ink-2, `--ink2`) y **acero** (steel-muted, `--mut`): texto principal, secundario y apagado.
- **Regla** (carbon-rule, `--line`) y **regla fuerte** (carbon-rule-strong, `--line2`): todas las divisiones de un píxel; la fuerte para bordes de controles y la primera regla de una lista.
- **Lámina blanca**: sheet-ground (`--bg`), sheet-card, sheet-soft, sheet-field y sheet-slab con tinta grafito (graphite-ink, graphite-ink-2, graphite-muted) y reglas sheet-rule / sheet-rule-strong. El menú lateral sigue en carbón (rail-coal, rail-ink, rail-muted) en ambos aspectos.
- **Alto contraste**: en lámina blanca, tinta negra pura, fondo blanco puro, regla #6b6f74 y tinta de fuego más oscura (hc-sheet-*); en carbón, fondo negro puro, tinta blanca, regla #7b8189 y tinta de fuego más clara (hc-carbon-*). El foco pasa a 3 px.

### Named Rules
**The One Fire Rule.** El rojo fuego relleno aparece una vez por pantalla: la acción principal o lo que ha cambiado. Si hay una segunda acción importante, va en contorno de tinta. En la ficha del plato, los demás botones «primary» se vuelven contorno para que solo «Cocinar paso a paso» quede en rojo.

**The Thermal-Only Rule.** Los colores de la escala térmica solo dicen temperatura. Ni estados, ni progreso, ni papeles del plato, ni decoración.

**The Food-Tint Rule.** Los tintes de papel solo aparecen en las capas del corte y nunca toman un tono de la escala térmica.

## Typography

**Display Font:** Barlow Condensed (con system-ui, sans-serif)
**Body Font:** Barlow (con system-ui, sans-serif)
**Label/Mono Font:** Barlow Condensed para rótulos de dato; no hay monoespaciada (el token `--mono` apunta a Barlow).

**Character:** Una condensada de lámina técnica, seminegra y apretada, sobre una grotesca abierta y legible para leer de pie en cocina. Ambas incrustadas desde `fuente/fonts/` (OFL), sin síntesis de negritas.

### Hierarchy
- **Display** (600, clamp(34px, 4vw, 48px), 1): título de pantalla («Buenas tardes.», «Platos»). Uno por pantalla.
- **Headline** (600, clamp(24px, 2.4vw, 30px), 1.05): títulos de sección («En marcha», «Para hoy», «Lo último del radar»). El nombre del plato en marcha sube a clamp(24px, 2.6vw, 32px).
- **Title** (600, 22px): entradas principales del menú lateral (Platos, Biblioteca, Laboratorio) y cabeceras desplegables («Primeros pasos»).
- **Figure** (600, 24px, tabular): cifras a la derecha en listas («1/3», «0/6», «3/6»); la unidad o el total en 15px apagado.
- **Body** (400, 16px, 1.55): todo el texto de lectura; los campos van a 16px para que el móvil no haga zoom. Resúmenes a unos 70ch.
- **Label** (600, 13–15px, sin espaciado, sin mayúsculas forzadas): fecha de día, estados, gramos (`.qty`), metadatos, rótulos de la barra de abajo (12.5px).

### Named Rules
**The Tabular Figures Rule.** Toda cifra que se compara (gramos, grados, minutos, progreso, contadores) va con `font-variant-numeric: tabular-nums` y alineada a la derecha cuando forma columna.

**The Plain Label Rule.** Los rótulos van en minúscula natural y sin espaciado de letra: nada de mayúsculas espaciadas.

## Layout

PC (desde 960 px): menú lateral fijo de 240 px en carbón y el contenido en una columna de hasta 1120 px con márgenes de 40 px arriba y 44 px a los lados. Móvil: barra superior y barra inferior fijas, contenido con 16 px de margen y hueco inferior para la barra.

En Hoy, la cabecera es saludo y fecha sobre una regla de un píxel, con «Crear un plato» a la derecha (en el móvil ese botón se oculta porque Crear está en la barra de abajo). Debajo, en PC, dos columnas 1.15 : 1 con 32 px de separación: «En marcha» (el plato en corte) junto a «Para hoy»; en el móvil se apilan.

El ritmo es de 4 px: 4, 8, 12, 16, 20, 24, 32 y 40 px entre secciones. Las listas de cosas por hacer («Para hoy», «Empieza por aquí») son filas con regla, no tarjetas: icono de 20 px en una columna de 22 px, texto, y la cifra alineada a la derecha. En el móvil, las tiras largas de tarjetas (rutas, mecanismos) se deslizan en horizontal con ajuste magnético.

El menú lateral reduce alturas en pantallas bajas (900 px y 760 px de alto) sin perder niveles.

### Named Rules
**The Ruled List Rule.** Lo que hay que hacer se presenta como lista con reglas: regla fuerte arriba, regla fina bajo cada fila, sin fondo de tarjeta, la cifra a la derecha. Lo pendiente se tiñe de fuego suave, no se encierra en una caja.

## Elevation & Depth

Sistema plano. Ninguna superficie lleva sombra (`--shadow` y `--shadow-s` valen `none`; también las hojas y la barra de abajo). La profundidad se expresa con tono (carbón, panel grafito, grafito suave) y con la regla de un píxel; el panel de la acción o del plato en marcha usa la regla fuerte. Las hojas (ventanas) se separan con una regla de tinta y el velo `--scrim`.

### Named Rules
**The No-Shadow Rule.** Ninguna sombra, ni de adorno ni desplazada. Si algo tiene que destacar, cambia de tono o de regla.

## Shapes

Esquinas rectas en todo (radio 0: botones, campos, chips, tarjetas, hojas, insignias, foco). Bordes de un píxel. Lo vacío se dibuja con regla discontinua (estado vacío, corte vacío). Los desplegables llevan un cuadrado de 20 px con «+» / «−» en lugar del triángulo del navegador. Las marcas de estado activo son geométricas y pequeñas: un cuadrado de 6 px o una raya de 3 px, nunca barras gruesas.

### Named Rules
**The One-Pixel Rule.** Toda división es una regla de un píxel. No hay barras laterales gruesas de color ni bordes dobles.

## Components

### Buttons
Rectos, firmes, con texto Barlow 600.
- **Shape:** esquinas rectas (0), alto mínimo 46 px, 16 px de relleno lateral, icono de 20 px a 8 px del texto.
- **Primary:** relleno rojo fuego con texto carbón (en carbón) o blanco (en lámina blanca). Uno por pantalla.
- **Hover / Focus:** hover aclara un 8 % (`brightness(1.08)`), pulsado oscurece un 8 %; sin desplazamientos. Foco: contorno de 2 px en rojo fuego a 2 px de distancia (3 px en alto contraste).
- **Ghost:** fondo transparente, regla fuerte, texto tinta; en hover la regla pasa a tinta.
- **Enlace de acción:** texto tinta 600 subrayado en rojo fuego a 4 px; en hover el texto pasa a tinta de fuego. Mínimo 44 px de alto cuando es un objetivo aislado.
- **Crear en el menú lateral:** contorno con icono en rojo, no relleno, para que el rojo relleno de la pantalla siga siendo uno.

### Chips
- **Style:** fondo transparente, regla fuerte, esquinas rectas, mínimo 44 px de alto, texto 14.5px con nota pequeña apagada.
- **State:** hover con regla tinta y fondo grafito suave; «de tus básicos» con regla y fondo verde marca. Los filtros y pestañas activos se invierten (fondo tinta, texto fondo) y llevan el recuento en tabular.

### Cards / Containers
- **Corner Style:** recto (0).
- **Background:** panel grafito sobre carbón; blanco sobre lámina blanca.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** regla de un píxel; regla fuerte en paneles protagonistas (plato en marcha, ficha del día, portada del radar).
- **Internal Padding:** 12–16 px en tarjetas de rejilla, 20 × 24 px en paneles.
- **Hover:** regla fuerte o tinta y fondo grafito suave; nada se levanta.

### Inputs / Fields
- **Style:** fondo de campo, regla fuerte, esquinas rectas, 16px, alto mínimo 46 px, cursor rojo fuego.
- **Focus:** la regla pasa a rojo fuego con una segunda línea interior de un píxel (o contorno de 2 px hacia dentro con teclado).
- **Error / Disabled:** desactivado al 55 % sobre grafito suave; errores en `--bad-ink` sobre `--bad`.

### Navigation
- **PC, menú lateral en niveles:** 240 px en carbón también en lámina blanca. Arriba la marca «I+D» (Barlow Condensed 700, «+» en rojo fuego) y «Cuaderno de cocina», el buscador (Ctrl K) y «Crear un plato» en contorno. Luego Hoy; primer nivel Platos, Biblioteca, Laboratorio en Barlow Condensed 600 a 22 px y 48 px de alto; regla; segundo nivel Entrenar, Diario, Trayectoria a 15 px; regla; tercer nivel Sabores, Temporada, Radar, Herramientas, Preguntar, Mi cocina a 14 px; Ajustes al pie. Activo: fondo carbón más claro, texto tiza y cuadrado rojo de 6 px a la derecha.
- **Móvil, barra de abajo:** cinco destinos, Hoy, Platos, Crear (centro), Biblioteca y Laboratorio, con rótulo Barlow Condensed 12.5px. Crear es un cuadrado rojo de 52 px que sobresale de la barra. Activo: texto tinta y raya roja de 3 px encima del icono.
- **Móvil, barra de arriba:** marca, «Preguntar», buscar y el menú «Más y ajustes», donde está el resto de secciones; la insignia de novedades es un punto rojo de 8 px.

### Plato en corte (firma)
El plato se dibuja como sección: cada componente es una capa, ordenada de arriba abajo por papel (toque final, crujiente, fresco, protagonista, salsa, cremoso, guarnición). Cada fila lleva el nombre a la izquierda (13.5px, tiza segunda), la capa coloreada con el tinte de su papel y un grosor de 8 a 48 px según su peso, y los gramos a la derecha en tabular. Si no hay gramos, el grosor sale del peso típico del papel. La miniatura de la tarjeta de plato apila las capas sin texto sobre carbón hondo; sin componentes, tres capas discontinuas. Es una figura con descripción accesible completa («Corte del plato, de arriba abajo: …»).

**The Section Rule.** Un plato sin foto se representa por su corte, nunca por una ilustración o un icono. El corte usa solo tintes de papel y gramos reales.

### Escala térmica (firma)
Una barra de 8 px con el degradado frío → templado → caliente → fuego sobre un eje de −20 a 260 °C, graduada cada 20 °C con marcas mayores en 0, 100 y 200 °C rotuladas en tabular. Cada temperatura de la ficha cae en su sitio como una marca de un píxel con la cifra en 600 y el uso debajo; las marcas alternan arriba y abajo para no chocar y, pasado el 70 % del eje, se giran hacia la izquierda. Como máximo cuatro marcas. Figura con descripción accesible de todas las temperaturas.

**The Measured Scale Rule.** Una temperatura se muestra en su posición sobre la escala, no como insignia de color. La escala no se usa para nada que no sean grados.

### Ruled list (Para hoy)
Filas con regla fuerte arriba y fina debajo, icono de 20 px en tinta de fuego, título 16px, explicación apagada, acciones como enlaces y la cifra de progreso en Figure a la derecha. Lo que toca hoy se tiñe de fuego suave.

## Do's and Don'ts

### Do:
- **Do** aplicar todo color y tipografía por los tokens de `:root` en `lab.css`, y comprobar cada pantalla en carbón, lámina blanca y alto contraste.
- **Do** dejar un único relleno rojo fuego por pantalla, para la acción principal o lo que ha cambiado; las otras acciones en contorno o como enlace subrayado.
- **Do** usar la escala térmica solo para temperaturas y los tintes de papel solo en el corte.
- **Do** usar reglas de un píxel, esquinas rectas (0) y tono en lugar de sombra.
- **Do** escribir títulos en Barlow Condensed 600 y cifras con `tabular-nums`, alineadas a la derecha en columnas.
- **Do** presentar lo que hay que hacer como lista con reglas y la cifra a la derecha.
- **Do** dar 44 px o más a todo lo que se toca, foco visible en rojo fuego de 2 px (3 px en alto contraste) y respetar `prefers-reduced-motion`.
- **Do** mantener la revisión de accesibilidad (axe) sin fallos en carbón, lámina blanca y alto contraste.
- **Do** mantener el orden de menú Hoy, Platos, Biblioteca, Laboratorio, y en el móvil la barra Hoy, Platos, Crear, Biblioteca, Laboratorio con el resto en «Más».

### Don't:
- **Don't** poner rótulos o antetítulos encima de los títulos; la categoría o la fecha van debajo del título.
- **Don't** usar mayúsculas espaciadas ni unir datos con «·»; los datos se separan con comas o en columnas.
- **Don't** usar sombras de ningún tipo, ni barras laterales gruesas de color, ni esquinas redondeadas.
- **Don't** usar colores de la escala térmica para estados, progreso, selección o decoración.
- **Don't** poner un segundo relleno rojo fuego en la misma pantalla.
- **Don't** volver al papel crema con serifa ni a las tarjetas de receta con foto.
- **Don't** usar fuentes del sistema para títulos ni sintetizar negritas.
