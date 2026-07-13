# Pulse Gym Final

PWA local-first para registrar entrenamiento, progreso y check-ins corporales.

## Uso
1. Publica el contenido de esta carpeta en la raíz de tu repositorio GitHub Pages.
2. En **Settings → Pages**, selecciona `main` y `/(root)`.
3. Abre la URL HTTPS generada. En móvil, instala desde el menú del navegador.

## Datos
Los datos se guardan con IndexedDB en el dispositivo. Usa **Ajustes → Exportar JSON** regularmente. La importación fusiona los datos de la copia con los actuales.

## Actualización desde V1
La base de datos conserva las colecciones `sessions` y `settings` existentes; la versión de IndexedDB añade las nuevas colecciones sin borrar las anteriores. Para actualizar, reemplaza todos los archivos del repositorio por los de esta carpeta.

## Pruebas
- Inicia y finaliza una sesión; revisa volumen e historial.
- Completa un set y prueba temporizador.
- Registra un check-in corporal y abre Progreso.
- Exporta un JSON y pruébalo importándolo.
- Instala la PWA y prueba abrirla sin conexión después de la primera carga.
