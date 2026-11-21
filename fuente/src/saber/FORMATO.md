# Formato de una entrada del «Saber» (cerebro de cocina)

Cada archivo es un array JSON (UTF-8) de entradas. Cada entrada:

{
  "id": "bechamel",                       // de la lista de ids, en minúsculas, con guiones
  "name": "Bechamel",
  "aka": ["besamel", "salsa blanca"],      // otros nombres con los que se busca
  "cat": "salsas" | "fondos" | "bases" | "conceptos",
  "group": "Salsas madre",                // subgrupo para el índice
  "summary": "Una frase que diga qué es y para qué se usa.",
  "what": "Qué es, en 2-4 frases. Puede llevar enlaces [[roux]] o [[mornay|salsa Mornay]].",
  "base": {
    "for": "1 litro",                     // para cuánto es la receta base
    "items": [["Leche entera", "1 l"], ["Mantequilla", "60 g"], ["Harina de trigo", "60 g"], ["Sal, pimienta blanca y nuez moscada", "al gusto"]],
    "steps": ["Paso 1…", "Paso 2…"]       // pasos concretos, con temperaturas y tiempos cuando importen
  },
  "ratios": [ {"use": "Croquetas", "ratio": "90-110 g de roux por litro", "note": "masa que se sostiene en frío"} ],   // cambios según para qué se usa (puede ser [])
  "variants": [ {"id": "mornay", "name": "Mornay", "note": "Bechamel con queso y yema; para gratinar."} ],             // derivadas y variantes; "id" solo si existe en la lista, si no, null
  "keys": ["Punto clave o truco profesional", "…"],      // 3-6
  "errors": [ {"p": "Grumos", "fix": "Cómo arreglarlo o evitarlo"} ],   // 2-5
  "history": "De dónde viene y cómo ha ido cambiando (2-4 frases). Solo hechos generales seguros; si no se sabe con certeza, dilo de forma general.",
  "uses": ["Croquetas", "Gratinados", "Canelones"],
  "keep": "Conservación y regeneración (frío, abatido, cuánto dura, cómo se recalienta).",
  "pro": "En producción y servicio: cantidades grandes, mise en place, cómo mantenerla en el pase.",
  "related": ["roux", "mornay", "ligazones"]   // ids de la lista
}

Reglas:
- Español de España, tono de jefe de cocina a otro cocinero: claro, práctico, sin adornos ni halagos.
- Medidas métricas (g, ml, l, °C, minutos). Proporciones realistas de cocina profesional.
- Texto ORIGINAL, escrito con tus palabras. No copies ni parafrasees de cerca ningún libro o web; nada de citas largas. Sin marcas comerciales.
- No inventes datos históricos, nombres ni fechas dudosas: si no es seguro, generaliza.
- Los enlaces en el texto van como [[id]] o [[id|texto visible]] y SOLO a ids de la lista completa.
- Entre 350 y 650 palabras por entrada en total.

Las elaboraciones de catálogo pueden incluir `name_en`, `role` (un id de `ROLES`) y `techniques` (ids de `TECHNIQUES` en `flavor-core.js`). Si incluyen ingredientes en `base.items`, se pueden llevar al editor como componente independiente. Sus cantidades son de la tanda y se copian al método. Los ingredientes se enlazan al perfil de sabor si el nombre coincide con el catálogo o con uno de sus alias.
