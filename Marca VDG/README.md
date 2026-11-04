# Marca VDG

Manual de marca y sistema de diseño de valentindg (monograma VDG), sacado de la plantilla CRM (V0.0.14).

**Abrir:** `index.html` con doble clic (no necesita servidor). Para enviarlo: `Manual de marca valentindg.pdf`.

## Qué hay

```text
index.html                    el manual: marca, logo (y logo | nombre de app), color, tipografía, iconos, espacio,
                              bordes y sombras, cristal (Liquid Glass), componentes, claro y oscuro, responsive, movimiento, voz y aplicaciones
Manual de marca valentindg.pdf el mismo manual para imprimir o enviar
design-system/
  tokens.css                  fuente única: colores (claro y oscuro), tipos, espacio, radios, sombras, cristal, movimiento
  tokens.json                 los mismos tokens en formato Design Tokens del W3C (Figma, Style Dictionary…)
  build-tokens.py             regenera tokens.json desde tokens.css
  components.css              componentes de la plantilla CRM, .lg (Liquid Glass) y .lockup (logo | nombre de app)
  build-logo.py               dibuja el monograma con geometría y la versión horizontal con «valentindg»
  build-assets.mjs            regenera los PNG, el avatar y los iconos web a partir del logo
  glass.js                    Liquid Glass: lente en los bordes, brillo bajo el puntero y estados de scroll (módulo ES;
                              el manual usa una copia sin módulos en js/glass.js)
assets/
  logo/                       vdg-tinta, vdg-blanco, vdg-horizontal-tinta, vdg-horizontal-blanco (SVG y PNG de 2400 px),
                              vdg-original (con brillo)
  iconos/                     44 iconos SVG y sprite.svg
  fonts/                      Instrument Sans y DM Mono (woff2, licencia OFL)
  aplicaciones/github/        avatar (el que está en uso)
  aplicaciones/web/           favicon (SVG y 32 px), apple-touch-icon
  capturas/                   pantallas de la plantilla y, en webs/, de las webs y el perfil de GitHub publicados; cada una en claro y en oscuro (-oscuro.webp)
```

## Cambiar algo

- **Un color o un tamaño:** edita `design-system/tokens.css`. El manual lee los valores en directo; después ejecuta
  `python3 design-system/build-tokens.py` para actualizar `tokens.json`.
- **El logo:** ajusta las medidas en `design-system/build-logo.py` y ejecuta
  `pip install fonttools brotli uharfbuzz && python3 design-system/build-logo.py`. Copia el path que imprime a
  `js/components/logo.js` de la plantilla y al símbolo `#vdg-logo` de `index.html`.
- **Las imágenes:** `npm i playwright-core && node design-system/build-assets.mjs` (usa el Chrome instalado).
- **En un proyecto nuevo:** copia `design-system/tokens.css`, `assets/fonts/` y el logo. Las rutas de las fuentes en
  `tokens.css` apuntan a `../assets/fonts/`; ajústalas si cambias la estructura.
