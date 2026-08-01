# Desarrollo

## Comandos

```bash
npm install
npm run build    # genera dist/ — es lo que se carga en Chrome
npm run dev      # servidor de desarrollo con recarga en caliente
```

## `dev` y `build` escriben en el mismo `dist/`

Y gana el último que se ejecute. Si el popup muestra **«CRXJS DEV MODE»**, es que
el servidor de desarrollo está corriendo y ha sobrescrito el build de producción.
Párealo y ejecuta `npm run build` de nuevo.

Para uso diario, usa siempre `npm run build`.

## Vite se enlaza a IPv4 explícitamente

`vite.config.ts` fija `host: '127.0.0.1'`. Vite escucha por defecto en el
*loopback* IPv6 (`[::1]`) mientras Chrome resuelve `localhost` a `127.0.0.1`, así
que sin esto la extensión nunca alcanza el servidor de desarrollo y muestra
«Cannot connect» aunque el proceso esté vivo.

## Recargar la extensión invalida los content scripts

Al recargar la extensión, los content scripts ya inyectados en las pestañas
abiertas quedan huérfanos: no pueden hablar con el service worker nuevo. Grasp lo
detecta y muestra «Grasp se actualizó: recarga la página (F5)», pero conviene
tenerlo presente al depurar — parece un cuelgue y no lo es.

**Tras cada recarga de la extensión, pulsa F5 en la pestaña de prueba.**

## Depurar el service worker

En `chrome://extensions`, el enlace **service worker** de la tarjeta de Grasp abre
su consola. Ahí caen los errores de la API de Gemini, que son los más frecuentes:

| Mensaje | Causa |
|---|---|
| `API key invalida o sin permisos` | La key no tiene habilitada la Generative Language API |
| `Cuota de "<modelo>" agotada` | Límite diario del *free tier*; cambia de modelo |
| `El modelo "<x>" no esta disponible` | Modelo retirado para cuentas nuevas |
| `Peticion rechazada por el modelo` | Parámetro incompatible con esa familia de modelos |

## Estructura

```
src/
  background/   service worker: red, caché, cola
  content/      lo que se inyecta en cada página
  popup/        interfaz de configuración
  lib/          tipos, ajustes y utilidades compartidas
assets/         SVG fuente y el generador del logo
public/icons/   PNG que se empaquetan
docs/           esta documentación
```

## Añadir un tipo de bloque

1. Añade el valor a `BlockKind` en `src/lib/types.ts`.
2. Añádelo a la lista `KINDS` de `src/background/gemini.ts`, que alimenta el
   esquema de respuesta.
3. Define su color en `src/content/tooltip.css` como `.kind-<nombre> .source`.

El modelo ya devuelve el campo `kind`; sin regla CSS el bloque simplemente se
pinta con el color por defecto.
