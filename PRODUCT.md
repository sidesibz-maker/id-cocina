# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un único usuario: el dueño, jefe de cocina de un restaurante mediterráneo de brasa en Ibiza. No programa. Usa la app tanto en el móvil, en la cocina entre servicios (de pie, con prisa, a veces con las manos ocupadas), como en el PC en casa, con calma, para estudiar, crear y escribir. Ninguno de los dos usos manda sobre el otro (confirmado el 26 nov 2026).

## Product Purpose

Cuaderno personal de I+D de cocina para toda su vida profesional: crear y afinar platos, cartas y subrecetas; aprender (Biblioteca, rutas, diccionario, entrenar); generar ideas (laboratorio, chispas, sabores, temporada, radar); y llevar su diario y su trayectoria. El éxito es que sea la app que siempre quiere abrir para nutrirse y crear, al nivel de un cocinero tipo Ferran Adrià.

## Positioning

Es el cuaderno de taller de un cocinero de autor, no una app de recetas ni de gestión: sus platos evolucionan por versiones y pruebas de cata, su saber está escrito con palabras propias y enlazado, y su método creativo (chispas, mecanismos, retos) vive junto a lo que aprende.

## Operating Context

- Móvil (PWA en GitHub Pages) y PC (programa de Windows con Electron que sirve un único archivo HTML en http://127.0.0.1:4781). Datos en el propio aparato y sincronizados entre los dos.
- Uso en cocina: luz fuerte, prisa, pantallas pequeñas, modo cocina a pantalla grande con temporizadores y lectura en voz alta.
- Uso en casa: lectura larga de la Biblioteca, escritura del diario, creación de platos por componentes, impresión de recetarios y dossier.
- ChatGPT opcional con la clave del propio dueño.

## Capabilities and Constraints

- Prioridades del menú, por orden del dueño: 1) Crear platos y libreta; 2) Biblioteca y aprender; 3) Laboratorio e ideas. Diario y trayectoria, Herramientas, Mi cocina y Ajustes siguen existiendo pero en segundo plano.
- No se añaden funciones nuevas: el rediseño cambia el aspecto, los menús y la organización, no lo que la app hace.
- Nada de gestión del restaurante (pedidos, stock, APPCC, equipo, sala, precios): eso va en otra app.
- Nunca se borran datos; todo lo que la app hace hoy debe seguir funcionando y pasar sus 13 baterías de pruebas.
- Interfaz en español de España, con inglés disponible.
- Un solo archivo compilado (esbuild), sin frameworks; CSS propio.

## Brand Commitments

Ninguno visual: el dueño pidió empezar el aspecto de cero (no conservar nombre, logo ni colores como obligación). El rediseño debe sentirse hecho por y para un chef.

## Evidence on Hand

Contenido real: 137 fichas de la Biblioteca escritas con palabras propias, 90 términos de diccionario, 14 mecanismos creativos, 16 retos, rutas de aprendizaje y los platos, diario y chispas del dueño. No hay fotos de marca ni del restaurante: no se inventan.

## Product Principles

1. El plato es el centro: crear, probar y afinar va primero.
2. Aprender cada día, en dosis cortas en el móvil y largas en el PC.
3. Las ideas se apuntan al vuelo y vuelven cuando hacen falta.
4. En la cocina, legible y rápido; en casa, para quedarse leyendo.
5. Nada se pierde.

## Accessibility & Inclusion

Mantener el nivel actual: revisión axe sin problemas graves en móvil, PC, noche y alto contraste; tamaño de letra grande y muy grande; foco visible; movimiento reducido; objetivos táctiles de 44 px.
