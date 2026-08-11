# Cómo crear una Rutina con un LLM

Esta guía convierte un programa de entrenamiento que solo existe en tu cabeza (o en las
notas de un entrenador) en un archivo `rutina.json`. Rellena el prompt en la parte
superior de esta pantalla, cópialo en **cualquier** chat LLM (ChatGPT, Claude, Gemini,
lo que tengas a mano) e importa la respuesta en la aplicación **Rutina**.

No se requieren conocimientos de JSON. Sin cuenta, sin clave API — funciona en una
ventana de chat de navegador normal.

> **Idioma.** El campo 7 fija el idioma del texto de la rutina — escríbelo en
> el idioma que quieras (no solo inglés/español/bielorruso; cualquier idioma
> que el LLM pueda producir). Rutina muestra los nombres de ejercicios,
> etiquetas de días, indicaciones técnicas, reglas y notas **exactamente como
> las escribe el LLM**, en un único idioma, y nunca las traduce, las
> reetiqueta ni exige que coincidan con el idioma de la interfaz de la app
> (que se configura por separado, en **Ajustes**). Pide al LLM **una sola
> cadena de texto por campo** — nunca un objeto multilingüe como
> `{"en": "Monday", "es": "Lunes"}`.

Todos los datos de referencia están en el repositorio público
[github.com/bthos/gym-routine-basic-fit](https://github.com/bthos/gym-routine-basic-fit).
El prompt indica al LLM dónde leerlos — **no** necesitas copiar tú mismo el esquema ni
los archivos de equipamiento.

| Dato | URL |
|------|-----|
| Esquema (fuente de verdad) | [rutina.schema.json](https://cdn.jsdelivr.net/gh/bthos/gym-routine-basic-fit@main/data/schema/rutina.schema.json) |
| Catálogo de equipamiento | [equipment.json](https://cdn.jsdelivr.net/gh/bthos/gym-routine-basic-fit@main/data/equipment.json) |
| Lista de gimnasios (para el LLM) | [gyms.json](https://cdn.jsdelivr.net/gh/bthos/gym-routine-basic-fit@main/data/gyms.json) |
| Ejemplo de referencia | [phase1-monday.json](https://cdn.jsdelivr.net/gh/bthos/gym-routine-basic-fit@main/data/examples/phase1-monday.json) |

> **¿LLM sin acceso web?** Usa el botón **Descargar** de esta pantalla de guía para
> guardar un archivo zip con los cuatro archivos de datos directamente en tu dispositivo
> — un solo archivo, listo para adjuntar al chat, no solo una vista en el navegador.
> ¿Prefieres obtenerlos tú mismo? La tabla de arriba enlaza directamente a los archivos
> en bruto del repositorio.

## Paso 1 — Copia el prompt

Usa el botón **Copiar** encima de esta guía. El prompt empieza por **REQUEST** — rellena
cada línea numerada (texto simple, sin JSON) antes de enviar.

> **Campo 6 — gimnasio objetivo**
> Busca el nombre y el **id** numérico de tu gimnasio en el **[listado de gimnasios →](https://bthos.github.io/gym-routine-basic-fit/gyms.html)**
> (se abre en una pestaña nueva). También está en la pestaña **Catálogo** de la app Rutina.

| # | Campo | Ejemplo | Requerido |
|---|-------|---------|-----------|
| 1 | Para quién es / nombre del programa | "Elena — Fase 2" | sí |
| 2 | Objetivo principal en esta fase | "Hipertrofia, más volumen" | sí |
| 3 | Días por semana | 4 | sí |
| 4 | Presupuesto de duración de sesión | "45-60 min" | sí |
| 5 | Lesiones / movimientos a evitar | "Evitar press militar por hombro derecho" | no — escribe "ninguna" si no hay |
| 6 | Gimnasio objetivo | "Avda. Andalucía, Centro Comercial Alameda (id 3)" | sí |
| 7 | Idioma para el texto de salida | "Español" | sí |
| 8 | Exportación de progreso previo | Markdown de **Historial → Exportar** en Rutina | no — omite si es la primera fase |

Incluir "devuelve solo JSON, nada más" tanto al principio (`ROLE`) como al final
(`OUTPUT`) es deliberado — es la instrucción de mayor impacto para obtener una salida
parseable de un LLM ajustado para chat.

## Paso 2 — Importa en la app Rutina

1. Copia la respuesta JSON del LLM (sin vallas de markdown).
2. Abre la pantalla **Importar** en la app Rutina y pégala, o sube un archivo `.json`.
3. Pulsa **Importar**. La app valida contra el mismo esquema y catálogo de equipamiento.

Si la validación falla, copia la lista de errores de la app y pégala de vuelta en el
chat del LLM como siguiente mensaje. Pídele que corrija y vuelva a generar el JSON
completo. Repite hasta que la importación funcione.

**Opcional — validar en tu ordenador:**

```bash
npm run validate-rutina -- ruta/a/tu-rutina.json
```

| Resultado | Ejemplo de salida | Qué hacer |
|---|---|---|
| Éxito | `✓ Valid rutina: 4 days, 22 exercises` | Importar en la app |
| Error de esquema | `days[1].label: required` | Pegar todo el bloque de error de vuelta al LLM |
| Error de ID de equipamiento | `days[2].exercises[0].equipmentId "g3-xx" not found in data/equipment.json` | Igual — pegar literalmente |

---

## Ejemplo práctico (un turno completo)

**REQUEST rellenado (inicio del prompt copiado):**

```text
1. Para quién es / nombre del programa: Elena Rois — Fase 2
2. Objetivo principal en esta fase: Hipertrofia, más volumen muscular
3. Días por semana: 4
4. Presupuesto de duración de sesión: 45-60 min
5. Lesiones / movimientos a evitar: ninguna
6. Gimnasio objetivo: Avda. Andalucía, Centro Comercial Alameda (id 3)
7. Idioma para el texto de salida: Español
8. Exportación de progreso previo (opcional): (ninguna todavía, primera vez usando esto)
```

**El LLM lee esquema y equipamiento desde las URLs en DATA SOURCES y devuelve JSON.**

**Importar** en la app Rutina, o ejecutar `npm run validate-rutina -- data/rutina-nombre-fase2-draft.json`.

---

## Solución de problemas

- **El LLM no puede obtener URLs.** Usa el botón **Descargar** de esta pantalla de guía
  para guardar un archivo zip con los archivos de DATA SOURCES y adjúntalo manualmente
  al chat — los nombres dentro del zip coinciden con los del prompt. La tabla de URLs
  de arriba también funciona para LLMs/navegadores que sí pueden obtenerlos
  directamente, o puedes pegar el contenido en el chat.
- **El chat del LLM no puede abrir un adjunto `.zip`.** Extrae el archivo localmente y
  adjunta o pega los archivos individuales — `rutina.schema.json`, `equipment.json`,
  `gyms.json`, `phase1-monday.json`.
- **El LLM añadió una introducción o envolvió el JSON en una valla de markdown.**
  Reenvía con: "Output ONLY the JSON object, no markdown fence, no explanation."
- **La respuesta se cortó a la mitad del JSON (programas muy largos).** Pide al LLM
  que "continúe desde donde paró, siguiendo generando solo JSON".
- **ID de equipamiento no encontrado.** El LLM debe elegir ids de `equipment.json` cuyo
  array `gyms` incluya tu id de gimnasio. Pega el error del validador y pídele que relea el catálogo.
- **¿No sabes el id de tu gimnasio?** Abre la [lista de gimnasios](https://bthos.github.io/gym-routine-basic-fit/gyms.html) o la pestaña **Catálogo** en la app Rutina.

---

## Usa tu exportación de progreso (campo 8)

Tras completar una fase, **Historial → Exportar progreso** en la app Rutina genera un
texto Markdown que puedes pegar tal cual en el campo 8. Tiene este aspecto:

```
Prensa de Pecho (g3-s10)
  · 32kg / difícil
  · 32kg / normal
  · 35kg / fácil

Jalón al Pecho (g3-s30)
  · 45kg / normal
  · 48kg / fácil

Sesiones sin completar:
  · Lunes — 2026-07-01 (abandonada)
```

El LLM usa esto como evidencia de qué pesos fueron manejables, qué resultó demasiado
fácil o demasiado difícil, y qué sesiones se abandonaron — y ajusta la siguiente fase
en consecuencia.

**Referencia completa del formato:** [`docs/export-format.md`](export-format.md)

---

## Mantén los ejercicios rastreables entre fases

El progreso, el peso prellenado y los enlaces de tutorial se rastrean **por ejercicio**,
no por máquina — dos ejercicios distintos en el mismo aparato (por ejemplo, una prensa de
pecho y un press de hombro en la misma máquina multiestación) se registran, grafican y
exportan de forma independiente. Un ejercicio se identifica por su **nombre** junto con el
equipamiento que usa, así que al escribir el REQUEST de la siguiente fase:

- **Reutiliza el nombre exacto de la fase anterior** cuando esta fase repite un ejercicio.
  La exportación de progreso (campo 8) imprime el nombre de cada ejercicio tal como se
  registró — cópialo literalmente en vez de reformularlo ("Prensa de Pecho", no "Press de
  Pecho" ni "Chest Press"). Un nombre reescrito se trata como un ejercicio *distinto* con
  historial vacío — perderías la tendencia de peso y el prellenado ya acumulados.
- **`videoQuery` es una búsqueda para *este ejercicio en este equipamiento*, no para la
  máquina en general.** La app ya compone una buena búsqueda automáticamente a partir del
  nombre del ejercicio y del equipamiento — define `videoQuery` solo cuando quieras
  sobrescribirla (una variante específica, una demostración preferida, etc.).

---

## Actualizar tu programa

Una vez que hay un programa cargado, puedes reemplazarlo o eliminarlo desde la pestaña **Programa**:

1. Ve a la pestaña **Programa** y desplázate hasta el final de la vista general.
2. Pulsa **Reemplazar programa** para ir a la pantalla de importación y pegar un nuevo rutina.json.
3. O pulsa **Eliminar programa** para borrar el programa activo y volver al estado inicial.

El historial de sesiones se conserva al eliminar — los registros se mantienen pero ya no estarán vinculados a un programa.
