# Cómo crear una Rutina con un LLM

Esta guía convierte un programa de entrenamiento que solo existe en tu cabeza (o en las
notas de un entrenador) en un archivo `rutina.json`. La app ya rellena la mayor parte del
prompt por ti; revísalo y ajústalo en la parte superior de esta pantalla, cópialo en
**cualquier** chat LLM (ChatGPT, Claude, Gemini, lo que tengas a mano) e importa la
respuesta en la aplicación **Rutina**.

No se requieren conocimientos de JSON. Sin cuenta, sin clave API — funciona en una
ventana de chat de navegador normal.

## Qué rellena la app por ti

La primera vez que abres Rutina, el asistente de bienvenida te pregunta por tu gimnasio,
el nombre/objetivo de tu programa, tu horario y tus lesiones o movimientos a evitar —
un paso guiado por campo, cada uno con su propósito, cómo lo usa el prompt y un ejemplo
concreto. **Todos los pasos son opcionales**: puedes saltarte cualquiera y el prompt deja
la línea numerada correspondiente en blanco, lista para que la rellenes tú a mano en el
textarea si cambias de idea.

Tus respuestas se guardan en este dispositivo y tienen **un único sitio para editarlas
después**: el formulario de esta misma pantalla de guía, justo encima del prompt. No hay
una pantalla de Ajustes aparte para esto — ábrela cuando quieras, cambia lo que haga
falta, y el prompt se recalcula al instante con cada cambio (el texto que hayas escrito a
mano directamente en el textarea se descarta en cuanto tocas el formulario; el aviso junto
al textarea te avisa de esto).

> **Idioma.** El campo 7 fija el idioma del texto de la rutina. Ya no se pregunta como
> paso de onboarding: la app lo rellena automáticamente con el idioma activo de la
> interfaz (por ejemplo, "Español"). Rutina muestra los nombres de ejercicios, etiquetas
> de días, indicaciones técnicas, reglas y notas **exactamente como las escribe el
> LLM**, en un único idioma, y nunca las traduce, las reetiqueta ni exige que coincidan
> con el idioma de la interfaz de la app (que se configura por separado, en
> **Ajustes**). Si quieres una salida en un idioma distinto de los tres que soporta la
> interfaz (es/en/be), cambia el campo 7 directamente en el textarea antes de copiar —
> el LLM puede producir cualquier idioma, no solo esos tres. Pide al LLM **una sola
> cadena de texto por campo** — nunca un objeto multilingüe como
> `{"en": "Monday", "es": "Lunes"}`.

El esquema de la rutina y el listado de equipamiento de tu club van **incluidos en el
propio prompt** (secciones `SCHEMA` y `EQUIPMENT`) — no hay nada que buscar ni adjuntar
para un primer intento. El repositorio público
[github.com/gym-rutina/basic-fit](https://github.com/gym-rutina/basic-fit) sigue siendo
la fuente de verdad de esos datos; el prompt solo cae de vuelta a una URL si tu chat
truncó el pegado (ver "Solución de problemas" más abajo).

> **¿El prompt se cortó al pegarlo?** Usa el botón **Descargar** de esta pantalla de
> guía para guardar `rutina.schema.json` — el esquema completo, con sus descripciones —
> directamente en tu dispositivo, y adjúntalo al chat manualmente.

## Paso 1 — Revisa y copia el prompt

Revisa el formulario de arriba de esta pantalla (nombre, objetivo, días por semana,
duración de sesión, lesiones) — la app ya lo ha rellenado con lo que sabe de ti. Edita
cualquier campo si hace falta y usa el botón **Copiar**. El tamaño del prompt compuesto
se muestra junto al botón, por si tu chat tiende a truncar pegados largos.

> **Campo 6 — gimnasio objetivo**
> Usa el **Selector de club** de la app Rutina — pulsa la fila de club en el paso de
> onboarding "Tu gimnasio", en **Ajustes → Mi club**, o la fila de club encima del
> prompt en esta pantalla de guía. Una vez seleccionado el club, la app rellena el
> campo 6 (nombre, ciudad, dirección) y añade automáticamente el listado de
> equipamiento del club. Si tu club no está en el directorio, escribe directamente el
> nombre y la dirección del gimnasio en el campo 6 del textarea.
>
> **¿A tu club le falta una máquina?** Márcala como ausente y el listado de equipamiento
> del prompt se reduce en consecuencia, de modo que al LLM solo se le ofrece lo que tu
> club tiene. Pulsa el chip bajo la tarjeta de ese equipo en la pestaña **Catálogo**
> (**En mi club** ↔ **Fuera de mi club**), o desmárcala en **Ajustes → Mi club → Equipo
> del club**. Ambos editan la misma lista guardada. Con el filtro **Solo mi club**
> activado, la tarjeta que excluyes desaparece del catálogo; desactiva el filtro para
> volver a verla y añadirla de nuevo.

| # | Campo | Rellenado por | Ejemplo |
|---|-------|----------------|---------|
| 1 | Para quién es / nombre del programa | Onboarding (paso "Personaliza tu programa") · editable en esta guía | "Elena — Fase 2 de 3 (volumen). Llevo 8 meses entrenando." |
| 2 | Objetivo principal en esta fase | Onboarding (mismo paso) · editable en esta guía | "Quiero más músculo en tren superior, sobre todo pecho y hombros..." |
| 3 | Días por semana | Onboarding (paso "Tu horario") · editable en esta guía (selector 1–7) | 4 |
| 4 | Presupuesto de duración de sesión | Onboarding (mismo paso) · editable en esta guía | "45-60 min entre semana, hasta 80 min los sábados" |
| 5 | Lesiones / movimientos a evitar | Onboarding (paso "Antes de terminar") · editable en esta guía | "Tendinitis rotuliana en rodilla derecha..." — escribe "ninguna" si no hay |
| 6 | Gimnasio objetivo | Selector de club (onboarding, Ajustes → Mi club o esta guía) | Nombre, ciudad y dirección del club elegido, más el listado de equipamiento |
| 7 | Idioma para el texto de salida | Idioma activo de la interfaz (Ajustes) — nunca se pregunta | "Español" (autónimo del idioma activo) |
| 8 | Exportación de progreso previo | Historial de sesiones de la app, si tienes alguna registrada | Markdown de tus sesiones, con casilla "Incluir mi progreso" activada por defecto |

Todos los campos de texto tienen un límite de longitud (campos 1 y 4: 200 caracteres;
campo 2: 800; campo 5: 500) — el texto se recorta al guardar, nunca se rechaza mientras
escribes.

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

## Ejemplo de prompt compuesto

No necesitas escribir esto a mano — así es como queda el bloque `REQUEST` una vez
completas el asistente de bienvenida (o editas los campos en esta guía). Las **etiquetas
de los 8 campos se mantienen en inglés** en las tres guías — son la redacción original
del prompt y no cambian con el idioma de la interfaz; solo tus respuestas y el resto de
esta guía están en español.

```text
### REQUEST

1. Who is this for / program name: Elena — Fase 2 de 3 (volumen). Llevo 8 meses entrenando.
2. Primary goal this phase: Quiero más músculo en tren superior, sobre todo pecho y hombros. Me encantan las máquinas de cable y el press en Smith.
3. Days per week: 4
4. Session length budget: 45-60 min entre semana, hasta 80 min los sábados
5. Injuries / movements to avoid (write "none"/"ninguna" if none): Tendinitis rotuliana en rodilla derecha (desde 2024): sin sentadilla libre ni zancadas, pero prensa con rango parcial va bien.
6. Target gym (pre-filled by the app's club picker — name, city, address and available equipment ids are listed in the EQUIPMENT section appended below): BasicFit Málaga Alameda, Málaga, Avda. Andalucía s/n (CC Alameda, La Luz)
7. Language for the output text: Español
8. Prior progress export (optional — paste Markdown from Rutina app Export, or leave blank): Prensa de Pecho (g3-s10)
   · 32kg / difícil
   · 32kg / normal
   · 35kg / fácil
```

El esquema (`SCHEMA`) y el listado de equipamiento de tu club (`EQUIPMENT`) van
inmediatamente después de esto en el prompt copiado — el LLM no necesita ir a buscar
nada por su cuenta.

**Importar** en la app Rutina, o ejecutar `npm run validate-rutina -- data/rutina-nombre-fase2-draft.json`.

---

## Solución de problemas

- **El chat truncó el prompt al pegarlo (programas o descripciones muy largas).** Es el
  fallo más habitual con un prompt de este tamaño. Usa el botón **Descargar** de esta
  pantalla de guía para guardar `rutina.schema.json` (el esquema completo, con sus
  descripciones) y adjúntalo manualmente al chat, indicando que la sección `SCHEMA` del
  prompt pegado se cortó y que use el archivo adjunto en su lugar.
- **El LLM añadió una introducción o envolvió el JSON en una valla de markdown.**
  Reenvía con: "Output ONLY the JSON object, no markdown fence, no explanation."
- **La respuesta del LLM se cortó a la mitad del JSON (programas muy largos).** Pide al
  LLM que "continúe desde donde paró, siguiendo generando solo JSON". Esto es distinto
  del caso anterior: aquí es la *respuesta* del LLM la que se corta, no tu prompt.
- **ID de equipamiento no encontrado.** El LLM debe usar solo los ids del listado
  `EQUIPMENT` añadido al prompt — no ids inventados. Pega el error del validador y
  pídele que relea el listado de equipamiento.
- **El campo 6 o el listado de equipamiento falta en el prompt.** Tienes que seleccionar
  un club primero. Abre el **Selector de club** en el paso de onboarding "Tu gimnasio",
  en **Ajustes → Mi club** o en esta pantalla de guía; una vez seleccionado el club, la
  app rellena el campo 6 y añade el listado automáticamente.

---

## Usa tu exportación de progreso (campo 8)

Si ya tienes sesiones registradas, la guía añade automáticamente el Markdown de tu
progreso al campo 8 — no hace falta copiar y pegar nada a mano. Una casilla **"Incluir
mi progreso (N sesiones)"**, activada por defecto, controla si se incluye en esta copia
concreta del prompt; desmárcala si prefieres omitirlo. La casilla vuelve a marcarse cada
vez que abres la guía — es una elección por copia, no una preferencia guardada.

El texto tiene este aspecto:

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
  nombre del ejercicio y del equipamiento; define `videoQuery` solo cuando quieras
  sobrescribirla (una variante específica, una demostración preferida, etc.).

Tampoco tienes que limitarte a una fase cada vez: pide al LLM un **plan de varias fases**
e importa cada fase por separado, como su propio `rutina.json` — se quedarán guardadas
juntas en **Mis rutinas** (pestaña Programa), listas para activarlas en orden.

---

## Actualizar tu programa

Tus programas se gestionan en **Mis rutinas**, dentro de la pestaña **Programa**:

1. Abre la pestaña **Programa** y pulsa **Mis rutinas**.
2. Pulsa **Importar rutina** y pega un rutina.json para añadirlo como **entrada nueva** — la importación nunca sobrescribe las que ya tienes.
3. Pulsa **Activar** en una entrada para convertirla en tu programa actual, o su acción **Eliminar** para quitar solo esa.

Al eliminar una entrada nunca se borra tu historial: las sesiones pasadas siguen en **Historial**, atribuidas a su programa incluso después de eliminarlo. Los pesos registrados también viajan entre programas — un ejercicio repetido conserva su tendencia de peso con cualquier entrada activa.
