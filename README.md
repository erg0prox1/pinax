# Pinax — bitácora de campo

App web instalable (PWA) sin build ni dependencias. Todo se guarda **en el equipo**
(IndexedDB): un documento por componente, con su foto. No hay servidor, cuentas ni lectura automática de fotos.

## Flujo

1. **Menú:** dos opciones, **Tomar foto** (nuevo componente) y **Consultar**.
2. **Tomar foto:** eliges *Tomar foto* (cámara) o *Elegir de la biblioteca*. También hay *Continuar sin foto*.
3. **Ficha de componente**, en este orden:
   - Foto (toca la miniatura para verla ampliada; ahí se puede eliminar).
   - **Comentarios:** cuadro con texto de ejemplo en gris (MARCA, MODELO, SERIE, CALIBRE, MATERIAL…). Se llena a mano.
   - **Fecha y hora:** se llenan solas con el momento actual; se pueden corregir.
   - **Nombre** (obligatorio).
   - **Clasificación (opcional):** Tipo de componente (13 tipos), Tipo de sistema (P60, CVIL, ZBV, ZPORTAL) y Sitio (Miguel Alemán, Camargo y **OTRO**: abre un cuadro para agregar un sitio nuevo con *Confirmar* o *Cancelar*; el sitio nuevo queda en la lista).
   - **Guardar:** guarda todo en un solo registro y regresa al menú.
4. **Consultar:** lista con búsqueda general (nombre, comentarios, tipo, sistema y sitio; ignora acentos y mayúsculas) y filtros por Sitio, Sistema y Tipo. Al tocar un registro se ve la **ficha completa** con **Editar** y **Borrar**.

Si venías de la versión anterior (sitio → sistema → componente), tus componentes se convierten solos la primera vez que abres esta versión: el sitio y el ID del sistema pasan a ser los campos Sitio y Tipo de sistema.

## Arrancar en tu PC

1. Descomprime el zip.
2. Abre una terminal dentro de la carpeta.
3. Levanta un servidor local: `python3 -m http.server 8080` (o `npx serve .`).
4. Abre `http://localhost:8080`.

No uses doble clic sobre `index.html`: los módulos JS y el almacenamiento no funcionan desde `file://`.

## Usarla en el celular (campo)

Hay que publicarla con **HTTPS** (la instalación y el modo sin conexión lo exigen). Con GitHub Pages:
*Settings → Pages → Deploy from a branch → `main` y `/ (root)`*. Con `index.html` en la raíz del repositorio.

1. Abre la dirección en el celular **con señal**. Ahí se guarda la app.
2. Agrégala a la pantalla de inicio desde el menú del navegador (Android: *Instalar app*; iPhone: *Compartir → Añadir a pantalla de inicio*).
3. Desde entonces abre y guarda **sin señal**. Los datos quedan en ese celular.

**Actualizar:** sube los archivos nuevos, abre la app con señal y, si no ves el cambio, ciérrala por completo y ábrela otra vez.
**No cambies el nombre del repo ni la dirección** después de empezar a capturar: los datos pertenecen a esa dirección.

Probado: Chromium simulando un Pixel 5 (flujo completo, migración, sin señal). **No probado:** celular real (cámara, instalación) ni iPhone/Safari. En iPhone, de mi conocimiento y sin verificar, Safari puede borrar datos de sitios que no se usan por un tiempo; haz respaldos.

## APK de Android (opcional)

El APK es la misma app dentro de un contenedor nativo (Capacitor); se genera en los servidores de GitHub, no en tu PC.

1. Copia **todo** el contenido de esta carpeta a tu repo, incluida la carpeta oculta `.github` (en Windows activa "Elementos ocultos"; en Mac `Cmd+Shift+.`), y haz push.
2. (Recomendado, una sola vez) Para poder **actualizar el APK sin perder datos**: en GitHub ve a *Settings → Secrets and variables → Actions → New repository secret*, nombre `DEBUG_KEYSTORE_B64`, y pega el contenido completo del archivo `debug.keystore.base64.txt` que te mandé aparte. **No subas ese archivo al repo.**
3. Pestaña **Actions → Generar APK → Run workflow**. Tarda unos minutos.
4. Al terminar, abre la ejecución y descarga **pinax-apk** (llega en un .zip; dentro está `app-debug.apk`).
5. Pasa el APK al celular, ábrelo y permite "instalar apps desconocidas" para ese origen (Archivos, Chrome, etc.).

Notas:
- El `appId` es `com.martin.pinax` (en `capacitor.config.json`). Cámbialo antes del primer APK si quieres otro; después queda fijo.
- Es un APK de depuración: sirve para instalar en tu celular, **no** para subir a Google Play.
- Sin el secreto del paso 2, cada APK sale con una llave nueva y Android no deja instalarlo encima del anterior (habría que desinstalar y se pierden los datos).
- La app dentro del APK guarda sus datos aparte de la versión instalada desde el navegador.
- Sin probar aún en un celular real, ni la cámara dentro del APK.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Página única |
| `app.js` | Pantallas y navegación (por `#/ruta`) |
| `db.js` | Guardado local (IndexedDB) y migración |
| `styles.css` | Estilos |
| `sw.js`, `manifest.webmanifest`, `icon*` | Modo sin conexión e instalación |
| `package.json`, `capacitor.config.json`, `build-web.mjs`, `.github/workflows/apk.yml` | Solo para generar el APK |
| `referencia-wireframe/` | Wireframe del flujo anterior (**desactualizado**) |

## Datos y respaldo

- Las fotos se reducen a 1600 px y se guardan como JPEG.
- Todo vive en el navegador de ese dispositivo. Si se borran los datos del sitio, se desinstala la app o se cambia de equipo, **se pierde**. Usa **Exportar respaldo** (menú): baja un JSON con todo, fotos incluidas. Todavía no hay "Importar".

## Lo que NO hace todavía

- Importar respaldo.
- Leer la foto automáticamente (se descartó por ahora; se llena a mano).
- Agregar tipos de sistema nuevos (la lista es fija: P60, CVIL, ZBV, ZPORTAL).
- Rama Mediciones, hora y GPS automáticos.
