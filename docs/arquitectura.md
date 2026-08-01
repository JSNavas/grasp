# Arquitectura

Grasp es una extensión Manifest V3 con tres piezas que no comparten memoria y se
comunican por mensajes.

```
┌─────────────────────┐   chrome.runtime   ┌──────────────────────┐
│  content script     │ ─────────────────► │  service worker      │
│  (en cada página)   │ ◄───────────────── │  (background)        │
│                     │                    │                      │
│  · detecta el hover │                    │  · caché             │
│  · extrae la frase  │                    │  · cola con RPM      │
│  · pinta el tooltip │                    │  · llama a Gemini    │
└─────────────────────┘                    └──────────┬───────────┘
         ▲                                            │
         │ chrome.storage.local                       ▼
┌─────────────────────┐                    ┌──────────────────────┐
│  popup              │                    │  Gemini API          │
│  · API key          │                    └──────────────────────┘
│  · modelo, ajustes  │
│  · consumo del día  │
└─────────────────────┘
```

## Content script — `src/content/`

Se inyecta en todas las páginas y monta React dentro de un **Shadow DOM cerrado**.
Sin ese aislamiento, el CSS de cualquier web (y hay webs muy agresivas) deformaría
el tooltip, y nuestro CSS podría romper la página.

| Fichero | Responsabilidad |
|---|---|
| `index.tsx` | Crea el host, adjunta el shadow root e inyecta el CSS como string (`?inline`) |
| `App.tsx` | Escucha ratón y teclado, decide cuándo consultar, gestiona el ciclo de vida |
| `caret.ts` | Traduce coordenadas de pantalla a la oración que hay debajo |
| `Tooltip.tsx` | Posiciona y pinta la cuadrícula de bloques |

## Service worker — `src/background/`

Todo lo que toca la red o el estado persistente vive aquí. Es lo que mantiene la
API key fuera del contexto de la página: una web maliciosa no puede leerla porque
nunca llega al content script.

| Fichero | Responsabilidad |
|---|---|
| `index.ts` | Recibe mensajes, orquesta caché → cola → API, cuenta el consumo |
| `gemini.ts` | Prompt, esquema de respuesta, validación y normalización |
| `cache.ts` | Dos niveles: `Map` en memoria + IndexedDB |
| `queue.ts` | Ventana deslizante de peticiones por minuto |

## Popup — `src/popup/`

Un formulario sobre `chrome.storage.local`. Los cambios se propagan en caliente:
el content script escucha `chrome.storage.onChanged`, así que cambiar el modelo o
la tecla de disparo tiene efecto sin recargar nada.

## Flujo de una traducción

1. El usuario para el cursor sobre una frase y mantiene la tecla de disparo.
2. `caret.ts` localiza el nodo de texto y **`Intl.Segmenter` extrae la oración
   completa** que lo contiene.
3. El content script envía esa oración al service worker.
4. El worker mira la caché. Si acierta, responde en microsegundos sin gastar cuota.
5. Si falla, la cola comprueba el límite por minuto y llama a Gemini pidiendo un
   JSON con esquema estricto.
6. La respuesta se **valida contra el texto original** antes de aceptarla.
7. El content script pinta la cuadrícula.

## Por qué la oración entera y no la palabra

El valor de Grasp es agrupar `give up` en un bloque en lugar de traducir «dar» y
«arriba» por separado. Eso sólo es posible si el modelo ve el contexto. Mandar la
palabra suelta daría exactamente el resultado que la herramienta quiere evitar.
