# Decisiones de diseño

Cada apartado es un problema real que apareció durante el desarrollo y por qué se
resolvió así y no de otra forma.

## Validación de alineamiento

**El problema.** Los LLM omiten, reordenan o «corrigen» palabras al trocear una
frase. Si los bloques no reconstruyen el texto original, la cuadrícula queda
desalineada respecto a lo que el usuario está leyendo, que es justo la
funcionalidad central.

**La solución.** En `gemini.ts`, la concatenación de los campos `source` se
compara con el original usando un *esqueleto* (sólo letras y números, sin espacios
ni puntuación). Si no coinciden, se descartan los bloques y se marca la respuesta
como `degraded`: el tooltip muestra sólo la traducción plana.

Degradar de forma visible es preferible a enseñar una estructura gramatical
equivocada. El objetivo de la herramienta es aprender; un desglose mal alineado
enseña mal.

La comprobación se hace **antes** de cualquier limpieza propia, para no enmascarar
un troceo defectuoso del modelo con nuestro post-procesado.

## Fusión de puntuación

Los modelos ligeros tienden a emitir la puntuación como bloque independiente, lo
que llena la cuadrícula de casillas con un punto o una coma. Se corrige en código
—no pidiéndoselo al prompt— porque el código es determinista y el prompt no.

## Caché de dos niveles

El *free tier* de Gemini limita por peticiones al día. La caché no es una
optimización opcional, es un requisito de arquitectura.

- **Nivel 1, `Map` en memoria.** Instantáneo mientras el service worker viva.
- **Nivel 2, IndexedDB.** Sobrevive a que Chrome termine el worker.

La clave es la frase normalizada (espacios colapsados, comillas tipográficas
unificadas). No se pasa a minúsculas a propósito: el caso cambia el análisis
(«May» el mes frente a «may» el modal).

Las peticiones simultáneas sobre la misma frase se deduplican con un mapa de
*inflight*, para que mover el cursor sobre el mismo texto no dispare dos llamadas.

## Nunca esperar dentro del service worker

**El problema.** Manifest V3 termina el service worker a los ~30 segundos de
inactividad, y un `setTimeout` **no** lo mantiene vivo. La cola original dormía
hasta 60 segundos esperando la ventana de peticiones por minuto. Cuando Chrome
mataba el worker a mitad de esa espera, la respuesta no llegaba nunca y el content
script se quedaba esperando indefinidamente: la extensión parecía colgada.

**La solución.** La cola rechaza con `QueueBusyError` en lugar de esperar más de
4 segundos, y el content script pone un techo de 25 segundos a cualquier
respuesta. Además, el hueco de concurrencia se devuelve si la adquisición falla;
sin eso la cola se secaba tras el primer error.

## El disparador se escucha en teclado y ratón

**El problema.** El gesto natural es parar el cursor sobre la palabra y *entonces*
pulsar la tecla. Eso no genera ningún evento `mousemove`, así que comprobar el
modificador sólo en el evento de ratón hacía que no ocurriera nada.

**La solución.** Un listener de `keydown` repite la consulta en la última posición
conocida del cursor. Las dos formas funcionan: tecla pulsada mientras se mueve, o
cursor parado y luego tecla.

## El tooltip captura el ratón

Con `pointer-events: none` los eventos lo atraviesan: al mover el cursor hacia la
traducción, el navegador lo situaba sobre el texto de la página y relanzaba la
consulta en bucle.

Ahora el recuadro captura el ratón y `App.tsx` define una zona muerta con 12px de
margen: mientras el cursor esté dentro, no se cierra ni se traduce nada de su
interior. El margen cubre el hueco entre el texto y el recuadro para que el
trayecto no lo cierre a mitad de camino.

Contrapartida asumida: mientras está abierto, tapa lo que haya debajo. Es
inevitable si se quiere poder posar el cursor encima. `Esc` lo cierra.

## Elección de modelo y cuotas

Los modelos punteros traen cuotas gratuitas simbólicas. Verificado contra la API:
`gemini-3.6-flash` permite **20 peticiones al día**, lo que deja la extensión
inservible. La gama `flash-lite` es la pensada para volumen y mantiene la calidad
del troceo, que es lo único no negociable.

Hay dos trampas más entre familias de modelos:

- Los `gemini-2.5-*` devuelven **404** a cuentas nuevas. Un ajuste ya guardado
  gana sobre los valores por defecto, así que el service worker reescribe los
  modelos retirados al arrancar.
- Gemini 3 sustituyó `thinkingBudget` (numérico) por `thinkingLevel`, y cada
  familia rechaza con **400** el campo de la otra. `thinkingFor()` elige según el
  modelo. En ambos casos se pide el mínimo de razonamiento: el tooltip aparece
  bajo el cursor y la latencia pesa más que la deliberación.

## Cuota mostrada, no inventada

Gemini no expone la cuota restante por ninguna vía consultable. El tope sólo viaja
dentro del error 429, como `quotaValue` en los detalles y como `limit: N` en el
texto.

Codificar a mano una tabla de topes daría una interfaz más completa desde el
primer momento, pero serían cifras sin verificar que además cambian sin aviso. En
su lugar, Grasp **aprende el tope del propio error** la primera vez que se agota
cada modelo y lo recuerda. Hasta entonces muestra «tope aún desconocido».

Es preferible admitir que no se sabe a mostrar un número falso, sobre todo cuando
la decisión que el usuario toma con ese dato es si sigue estudiando o cambia de
modelo.

El contador es diario y por modelo; los topes no caducan. Sólo cuenta lo que sale
a la red: lo servido desde caché no suma.

## La oración se reconstruye desde el bloque, no desde el nodo

**El problema.** El HTML parte las frases en varios nodos de texto en cuanto hay
un `<b>`, un `<a>` o un `<em>` por medio. Extraer la oración del nodo bajo el
cursor significaba que al pasar el ratón sobre «por bloques **semánticos**» sólo
llegaban esas tres palabras al modelo, sin el resto de la frase. Y el contexto es
justamente lo que permite resolver los bloques.

**La solución.** `caret.ts` sube desde el nodo hasta el primer ancestro que no sea
inline (`display` distinto de `inline`, `contents` o `ruby`), recorre sus nodos de
texto con un `TreeWalker` y concatena el contenido guardando el desplazamiento de
cada pieza. Sobre ese texto completo se segmenta la oración, y los índices
resultantes se mapean de vuelta a nodos para construir un `Range` real.

Ese `Range` sirve además para anclar el tooltip a la oración entera en lugar de al
fragmento, que era otra fuente de desalineación visual.

Las etiquetas de código en línea (`code`, `kbd`, `samp`) sí entran en el texto
—forman parte de la frase en cualquier documentación técnica— pero no disparan la
consulta si el cursor está encima de ellas.

## Filtrado antes de la red

Si no hay texto útil bajo el cursor no se muestra nada ni se consulta a la API.
Una celda con `38` no es un error que reportar al usuario, es ruido. La
comprobación se hace en el content script, antes de cruzar la frontera de
mensajes; la del service worker se queda como defensa.
