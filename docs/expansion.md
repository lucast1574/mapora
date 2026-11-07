# Mapora: expansión geográfica

La búsqueda y la cartografía vectorial cubren el mundo. El motor de rutas y matrices está activo en toda América, incluidos Estados Unidos y Canadá, según las vías disponibles para cada perfil. No confundir la cobertura mundial de búsqueda/cartografía con la de rutas. La landing y el panel comparten la referencia de `web/src/pages/Docs.jsx` y el catálogo de ejemplos de `web/src/docs/operations.js`.

## Contratos y consumo

Se conservan `/v1/search`, `/v1/reverse`, `/v1/resolve` y `/v1/maps`, las claves existentes y la facturación de Free/Launch/Scale por peticiones HTTP admitidas. Las ampliaciones necesitan permisos nuevos explícitos. No se cambian precios ni suscripciones.

- `GET /v1/autocomplete`: permiso search, mismos filtros que búsqueda. Componente con debounce350ms desde3 caracteres, cancelación, flechas/Enter/Escape y cierre exterior.
- `GET /v1/geocode`: search, campos de dirección estructurados. Los resultados añaden quality (precisión de la fuente, campos faltantes, verified=false); no certifican un domicilio.
- `GET /v1/nearby`: nearby, centro, categoría y radio50–50000m; hasta20 lugares, distancia en línea recta, no tiempo por calles.
- `POST /v1/batch`: batch,1–10 direcciones, resultados ordenados con error por fila. Una llamada admitida = una petición. CSV del panel hasta1000 filas/1MB, lotes10, progreso y descarga protegida contra fórmulas de hoja de cálculo. El archivo no se persiste.
- `POST /v1/coverage`: coverage, punto y1–20 zonas inline. GeoJSON Polygon, anillos cerrados sin cruces, máximo200 vértices y4 huecos; sin antimeridiano. Borde exterior incluido, huecos excluidos. Devuelve todas las coincidencias, no elige arbitrariamente una tarifa.
- `/console/zones`: sesión propietaria, máximo50 zonas; `POST /v1/coverage/check`: coverage y hasta20 IDs de esa cuenta. Tarifas enteras en centavos y monedaISO3; no genera cobros.
- `POST /v1/routes`: routing,2–10 puntos, driving/walking/cycling. Distancia metros, duración segundos, geometría GeoJSON por calles e instrucciones. Sin tráfico en tiempo real. No inventa línea recta si no hay ruta.
- `POST /v1/matrix`: routing,1–10 orígenes y destinos; máximo100pares por petición. null para pares desconectados.
- `/v1/maps`: maps, tema light/dark/grayscale, accent hexadecimal, hasta200marcadores agrupados,10polígonos, LineString de hasta10000puntos. Máximo512KiB. Visores existentes siguen funcionando; su token solo permite leer ese mapa y su cartografía. Revocar la clave/suspender usuario/caducar token impide nuevas lecturas.

Las vistas y sus mosaicos no añaden peticiones geográficas. Los límites del plan por minuto se conservan, también en Scale. Hay límites de concurrencia globales en consulta geográfica(64 peticiones), proveedores(4 Photon/4 rutas) y cartografía(32 transferencias); los motores tienen límites de CPU/RAM. Los fallos admitidos y caché mantienen la contabilización previa. No se guardan cuerpos, consultas ni coordenadas en los registros de consumo.

El motor de rutas conserva límites de distancia para proteger el servicio: 5000 km en automóvil, 250 km a pie y 500 km en bicicleta; para matrices, 400 km en automóvil y 200 km a pie/bicicleta. Estos son límites de admisión del motor, no una promesa de que exista una conexión por carretera entre dos puntos. La cobertura de un continente no garantiza una conexión entre países o islas.

## SDK y claves públicas

`web/public/mapora-client.js`: cliente JavaScript; `sdk/`: componentes React19 distribuidos como `.tgz` en `/downloads/`. No se publican en un registro npm externo. El consumidor instala el archivo y el CSS. Mantener licencias de dependencias y atribución de cartografía.

Claves secretas mp_live_ solo en servidor. Claves de navegador mp_pub_: permisos search/reverse/nearby,1–10 orígenes HTTPS exactos (HTTP solo localhost/loopback para desarrollo), sin comodines/rutas. La restricción Origin es una defensa de navegador, no autentica servidores ni hace secreta la clave. Se valida antes de reservar cuota. Las claves antiguas conservan su tipo y permisos.

## Servicios y operación

Photon ya está privado en `infra/photon`. La cartografía en `infra/tiles` usa el archivo mundial Protomaps verificado, fuentes/sprites locales y un gateway privado; no usa los mosaicos públicos de OpenStreetMap. Valhalla en `infra/routing` se inicia directamente como servidor con datos preparados, sin ejecutar descargas ni reconstrucciones durante el arranque de producción. Todos los servicios son internos en dokploy-network, sin puertos publicados.

`GET /health` comprueba el proceso; `GET /status` consulta motores y conserva sus respuestas hasta un minuto; también comprueba el acceso a PostgreSQL con un timeout de dos segundos. Una caída del almacenamiento devuelve 503 en las operaciones privadas, sin presentarla como una sesión caducada. `/service-status` presenta ese estado; no inventa historial/SLA. El panel Consumo ya conserva operación, estado y latencia por petición; Administración conserva métricas globales.

Antes de migrar: respaldo PostgreSQL cifrado fuera del repositorio, respaldo cifrado de variables, comprobar recuperación en una base aislada. CI también comprueba dump/restore de su base de prueba. Nunca restaurar producción para probar.

Para revertir una versión, usar una imagen que compruebe el tipo de clave y los orígenes permitidos. Las imágenes anteriores a esta expansión desconocen las claves de navegador: volver a ellas sin revocar primero esas claves ampliaría sus permisos. Preferir corregir sobre una versión compatible; conservar el esquema aditivo y los datos de los usuarios.

Las actualizaciones de datos son explícitas: descargar en staging, verificar checksum, construir en ruta nueva, probar ciudades/perfiles/matrices, cambiar el volumen solo tras la validación y conservar la versión anterior hasta cerrar el cambio. Photon/Valhalla/Protomaps son índices separados: actualizar uno no actualiza los otros.

Al combinar extractos regionales, comprobar que el PBF esté ordenado y no tenga múltiples versiones de un objeto. Un merge de instantáneas con fechas distintas puede conservar versiones duplicadas: normalizar con `osmium time-filter` sin fecha y comprobar `osmium fileinfo -e -j` antes de construir. Los datos regionales corregidos se preparan en `/var/lib/mapora-next/routing-v2`, separados del primer intento descartado. El volumen de producción es de solo lectura y el proceso arranca directamente con `valhalla_service`, sin ejecutar el constructor.

Para toda América: unir el extracto fechado y verificado de Norteamérica con el PBF normalizado de Latinoamérica en un área nueva, verificar orden y versiones, construir y probar EE. UU./Canadá además de los trayectos existentes. Reutilizar la base administrativa preparada y conservar exactamente los mismos endpoints. La cobertura se declara como `americas` solo después de validar el motor. No sustituirlo por una demo pública ni anunciar países no cargados.
