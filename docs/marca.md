# Marca

El isotipo es una **G** construida por geometría calculada en
[`assets/generate.py`](../assets/generate.py), no dibujada a mano: un anillo
vinotinto con un hueco de 77° arriba a la derecha y una cuña gris biselada que
hace de travesaño.

## Detalles de construcción

**La cuña se recorta contra el disco.** Se dibuja deliberadamente más larga de la
cuenta y un `clipPath` circular la corta, de modo que su borde derecho coincide
exactamente con la silueta del anillo. Ajustarla a ojo dejaba un saliente que
hacía que la cuña pareciera una bandera pegada al círculo.

**El cierre inferior del hueco se deriva, no se fija a ojo.** `GAP_B` se calcula
con `asin((WB - C) / R_OUT)`: el ángulo exacto en el que el arco exterior alcanza
la altura del borde inferior de la cuña. Con el valor fijo anterior el anillo
reaparecía unos 4px más abajo de donde termina la cuña, y por ese resquicio se
veía el fondo. Se le resta un `BLEED` de 2° para que el anillo entre ligeramente
por debajo de la cuña y el antialiasing no deje una costura clara en la unión.

El corte superior (`GAP_A`) sí es un valor elegido: es el que forma la diagonal
que hace legible la **G**, y no debe cerrarse.

**Sin sombra proyectada.** La referencia original tenía un efecto de papel
plegado. A 16px no se lee como profundidad sino como suciedad, así que se eliminó.

## Paleta

| | |
|---|---|
| Vinotinto | `#B4325A` → `#78182F` |
| Gris | `#DDE2E8` → `#9AA3AF` |
| Fondo | `#1B1D23` |

## Dos juegos de iconos

Un solo icono no sirve para los dos sitios donde Chrome lo muestra:

- **`icon*.png`** — cuadrado redondeado con fondo oscuro. Para la página de
  extensiones y la tienda, donde se ve grande y sobre fondo claro.
- **`tb*.png`** — fondo transparente, marca a sangre y grises de luminancia
  media. Para la barra de herramientas: a 16px el cuadrado oscuro se leía como
  una mancha sobre la barra en tema oscuro, y un gris claro habría desaparecido
  en tema claro. Los tonos intermedios sobreviven a ambos temas sin necesidad de
  dos variantes.

## Regenerar

```bash
python3 assets/generate.py
```

Requiere `cairosvg` (`pip install cairosvg`). Genera los SVG en `assets/` y los
PNG empaquetados en `public/icons/`. Los parámetros editables están al principio
del script: radios del anillo, ángulos del hueco, geometría de la cuña y colores.

Los PNG viven en `public/` y no en `assets/` para que Vite los copie tal cual a la
raíz de `dist/`, sin colisionar con el directorio `assets/` que genera el propio
bundler.

## Nota sobre la caché de iconos de Chrome

Si cambias los iconos y Chrome sigue mostrando el anterior (o la «G» gris
genérica), el botón de recargar no basta: hay que **quitar la extensión y volver
a cargarla**. La caché del icono de la barra es persistente, sobre todo si la
extensión se instaló originalmente sin iconos.
