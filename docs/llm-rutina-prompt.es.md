# Crea tu rutina con un chat de IA

Convierte un programa de entrenamiento que solo existe en tu cabeza (o en las notas de un
entrenador) en una rutina que la app pueda importar. Rutina escribe el prompt por ti, tú
lo pegas en **cualquier** chat de IA (ChatGPT, Claude, Gemini, el que tengas a mano) y
traes la respuesta de vuelta. No hace falta saber JSON, ni cuenta, ni clave API: basta un
chat normal en el navegador.

## El proceso

1. **Empieza.** En la pantalla de importar, pulsa **Preparar prompt**.
2. **Responde unas preguntas (paso 1 de 2).** Elige tu club y rellena tu objetivo
   principal, los días por semana, la duración de sesión y las lesiones o movimientos a
   evitar. El nombre del programa está en **Más opciones**. Todo es opcional. Tus
   respuestas se guardan en este dispositivo, así que la próxima vez las verás en
   **Revisa tus respuestas**. Pulsa **Siguiente**.
3. **Copia el prompt (paso 2 de 2).** Pulsa **Copiar prompt**, pégalo en tu chat de IA y
   envíalo.
4. **Copia la respuesta.** Cuando la IA conteste, copia el bloque JSON completo que te
   devuelva.
5. **Impórtala.** De vuelta en la app, pulsa **Ya tengo el JSON →**, pega la respuesta (o
   pulsa **Elegir archivo .json**) y pulsa **Importar**. Si ya tienes un programa, la app
   te pregunta si quieres **Activar ahora** o **Guardar sin activar**.

**¿La importación muestra errores?** Pulsa **Copiar errores**, pégalos en el mismo chat y
pide a la IA que los corrija y te envíe el JSON completo otra vez. Repite hasta que la
importación funcione.

## Para un mejor resultado

- **Elige tu club.** El prompt lista entonces solo las máquinas que tiene tu club, para
  que la IA cree una rutina que de verdad puedas hacer. Sin tu club no puede saber qué
  máquinas hay.
- **¿A tu club le falta una máquina?** Márcala como ausente y el prompt se reduce en
  consecuencia. En la pestaña **Catálogo**, pulsa el chip bajo su tarjeta (**En mi club**
  ↔ **Fuera de mi club**), o ve a **Ajustes → Mi club → Equipo del club**. Ambos editan la
  misma lista. Con **Solo mi club** activado, la tarjeta excluida desaparece del catálogo;
  desactívalo para volver a verla.
- **Idioma.** El prompt pide la rutina en el idioma actual de la app. ¿Quieres otro?
  Díselo a la IA en el chat, por ejemplo "responde en portugués". Pide un solo idioma, no
  traducciones una junto a otra.
- **Sesiones anteriores.** Cuando ya tienes sesiones registradas, el paso 2 muestra
  **Incluir mis sesiones anteriores**, activada por defecto. La IA ve qué pesos fueron
  manejables y ajusta la siguiente fase. Desmárcala para omitirlas; la elección vale solo
  para esta copia.
- **Varias fases.** Pide a la IA un **plan de varias fases** e importa cada fase por
  separado. Quedan juntas en **Mis rutinas**, listas para activarlas en orden.
- **Mismo ejercicio, mismo nombre.** El progreso y los pesos siguen a cada ejercicio (su
  nombre junto con el equipo que usa). Pide a la IA que reutilice los nombres exactos de
  la fase anterior: un nombre reescrito cuenta como un ejercicio nuevo con historial
  vacío.

## Equipamiento que el catálogo no tiene

Si tu club tiene una máquina que no está en el catálogo, o la IA cambia una máquina que tu
club no tiene por otra, puede dejarlo anotado en la rutina. Tú nunca tienes que escribir
nada de eso. Una máquina añadida así pertenece solo a esa rutina y se registra como
cualquier equipo del catálogo; los cambios se guardan con la rutina, pero no se muestran
en pantalla.

## Solución de problemas

- **El chat cortó el prompt al pegarlo.** Es el problema más habitual con un prompt
  largo. Al final de esta guía, pulsa **Descargar** para guardar el esquema completo,
  adjúntalo al chat e indica a la IA que el prompt pegado se cortó y que use el archivo
  adjunto.
- **La IA añadió una introducción o envolvió el JSON en un bloque de código.** Responde:
  "Envía solo el JSON, sin bloque de código ni explicación."
- **La respuesta se corta a mitad del JSON (programas muy largos).** Pide a la IA que
  "continúe desde donde paró, enviando solo JSON". Si la importación sigue fallando,
  pídele que reenvíe el JSON completo en un solo mensaje.
- **Un error dice que no se encontró un equipo.** La IA debe usar solo las máquinas
  listadas en el prompt. Pulsa **Copiar errores**, pégalos en el chat y pídele que relea
  el listado de equipamiento y corrija la rutina.

## Gestiona tus rutinas

Abre la pestaña **Programa** y luego **Mis rutinas**:

1. Pulsa **Importar rutina** para añadir una nueva. Importar nunca sobrescribe lo que ya
   tienes.
2. Pulsa **Activar** en una entrada para convertirla en tu programa actual.
3. Pulsa el icono de papelera de una entrada y confirma (**Eliminar**) para borrar solo
   esa.

Eliminar una rutina nunca toca tu historial: las sesiones pasadas siguen en
**Historial**, vinculadas a su programa. Los pesos registrados también viajan entre
programas.
