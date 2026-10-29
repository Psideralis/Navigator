# Navigator 1.0.2 — Android Local (cámara 3D visible)

## Qué se corrigió
La versión anterior abría el mapa dentro de un iframe pequeño en la pestaña Mapa GPS. El botón para comenzar navegación aparecía al final de un panel, después de calcular una ruta, por lo que era fácil no encontrarlo.

Ahora la pestaña **Mapa GPS** muestra un enlace grande **ABRIR NAVEGADOR 3D** que abre `map.html` a pantalla completa. En el mapa hay un botón flotante **INICIAR VIAJE · CÁMARA 3D**. Tras seleccionar el destino, ese botón solicita GPS, usa la posición real como origen, calcula una ruta por Internet y activa seguimiento y cámara inclinada. También existe **VER PERSPECTIVA 3D** para probar la inclinación sin iniciar un viaje.

Desde **Conductor > Agenda > Navegar al destino** se abre el mapa con el destino precargado. La ubicación textual se resuelve mediante Photon; si no encuentra el lugar, debes buscarlo manualmente.

## Ejecutar
```bash
npm install
npm run check
npm test
npm run build
npx cap add android   # solo la primera vez
npx cap sync android
npx cap open android
```
Si ya existe `android/`, no repitas `npx cap add android`.

**Importante:** al descomprimir esta entrega en otra carpeta y reutilizar un proyecto Android anterior, sincroniza el proyecto correcto; si Android Studio conserva una versión vieja, desinstala la app anterior y vuelve a instalar.

La cámara se inclina inicialmente 62°, ajusta zoom según velocidad y gira con rumbo GPS cuando el sensor reporta rumbo fiable. Si el dispositivo está quieto o no informa rumbo, la rotación puede no cambiar. Prueba la función estacionado como pasajero, nunca manipulando el móvil mientras conduces.

## Límites
No hay API propia. Las reservas son locales al dispositivo. Los mapas y el cálculo de rutas sí requieren Internet (OpenFreeMap, Photon y OSRM públicos). No hay tráfico real, navegación en segundo plano ni garantía de exactitud para conducción. El código pasa las pruebas de lógica y sintaxis, pero no se ha verificado una compilación APK en este entorno.
