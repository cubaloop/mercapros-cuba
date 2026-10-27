# Diseño de Mercapros

La página usa `styles.css`, generado y versionado para GitHub Pages. No requiere ejecutar Tailwind en el navegador.

Para modificar el diseño:

```sh
npm ci
# Editar design.css y las clases en index.html / app.js
npm run build:css
```

Conservar `styles.css` junto con los cambios de origen. El servidor existente se ejecuta con `npm start`; el sitio también funciona como archivos estáticos.

## Validación visual

Con Python y Playwright instalados y una vista previa en el puerto 5187:

```sh
python tools/check_visual.py http://127.0.0.1:5187/
```

El script comprueba 360, 390, 430, 768, 1280 y 1920 píxeles; catálogo, monedas, roles, modo sin fotos, claro/oscuro, carrito, mapa y las cinco pestañas del panel. Intercepta `window.open` para verificar el enlace del ticket sin abrir WhatsApp ni enviar pedidos. Usa un contexto nuevo por tamaño, sin datos del navegador del usuario. Genera capturas y resultados locales en `visual-artifacts/`.

El rediseño conserva `data.js`, su clave de almacenamiento, productos, precios, fotografías, permisos y cálculo de pedidos. Los cambios de `app.js` se limitan a clases, colores y presentación del importe. `ui.js` añade etiquetas accesibles, cierre con Escape y gestión del foco a los diálogos existentes.
