# Mapora: lugares y rutas avanzadas — continuidad

Estado al pausar: 14 de noviembre de 2026 (Lima). Usuario apagará laptop y pide
continuar solo trabajos autónomos del servidor. NO dar por publicada la ampliación.

## Alcance y corrección vigente

Implementar catálogo OSM propio, fichas y CSV, consulta por polígonos/corredores,
cercanos por tiempo, isócronas, orden de paradas, GPS matching y polyline6;
actualizar panel, landing, docs, JS y MCP para usuarios. Sin SerpApi ni Google
scraping. Usuario aclara que el catálogo es SOLO AMÉRICA y autoriza borrar datos
innecesarios de otros continentes. Todo dato nuevo en HDD dedicado Mapora.
No eliminar índices activos mundiales de Photon/PMTiles sin reemplazarlos:
contienen también América y son las dependencias actuales de producción.
Pendiente preparar esos reemplazos limitados a América y limpiar lo restante.

## Servidor y jobs autónomos

SSH `rangel-worker` (rangelserver1) tiene Docker; `rangel-manager` carece de
permisos Docker/sudo. Ruta física de datos: `/srv/mapora-hdd/mapora-next`, vía
`/var/lib/mapora-next`. Photon: `/srv/mapora-hdd/mapora-photon`.

- `mapora-places-import`: extracción NUEVA desde
  `/var/lib/mapora-next/routing-americas/americas.osm.pbf` (~24.6 GB), 4 CPU/8 GiB.
  Produce `/var/lib/mapora-next/places/pois-americas.osm.pbf`, construye
  `places-americas-next.sqlite` y activa `places.sqlite` con mv atómico.
  `PLACES_COVERAGE=americas`, builder corregido montado desde
  `/home/rangel/mapora-places-src/build-americas.py`. Ya se detuvo y renombró la
  extracción mundial equivocada a `mapora-places-world-cancelled`.
- `mapora-remove-unused-world`: limpieza autorizada, independiente. Elimina solo
  directorios inactivos routing-world, routing-americas-europe,
  routing-source-americas-europe; archivo parcial places/pois.osm.pbf y archivo
  comprimido mundial de Photon en staging. NO toca runtime de Photon,
  routing-americas, world.pmtiles, base de clientes ni motores activos.
- `/var/lib/mapora-next/feature-expansion/mapora-feature-prepare.sh`, ejecutado
  con nohup; logs `prepare.log`, fase `status.txt`, PID `prepare.pid`.
  Reejecutará npm ci/test/audit/build, Go race con PostgreSQL aislado, vet/build,
  compilará `mapora-feature-expansion:review`, esperará el importador de América,
  comprobará SQLite y arrancará catálogo PRIVADO `mapora-places-ready` con alias
  `mapora-places_catalog`, sin puertos publicados. Éxito:
  READY_FOR_REVIEW_NOT_PUBLISHED. Si falla, conserva logs y estado FAILED.
  La versión anterior del proceso se detuvo para corregir el alcance.

Comprobar primero estado/logs de esos jobs y espacio libre. Para reintentar un
importador fallido revisar la causa: el constructor no sobrescribe staging
existente. No rehacer índices ya completados sin motivo.

## Implementación local

Repo `/home/lucast/Documents/code/mapora`. Archivos nuevos:
`internal/mapsapi/{advanced.go,places.go,advanced_test.go}`, `infra/places/`,
`web/src/pages/{Intelligence.jsx,intelligence.css}`, `web/src/docs/advanced.js`.
Cambios en rutas, permisos places, migración de claves MCP dedicadas, OpenAPI4,
generador MCP, cliente JS, landing, documentación, legal y estado.
MCP2 añade ocho herramientas; conservan autenticación y cuota REST.
Claves normales conservan permisos; migración amplía solo mcp_connections activas.

Catálogo privado: Python/SQLite RTree+FTS5, nodos y vías OSM, contactos/horarios
opcionales y sin reseñas/fotos de Google. Horarios crudos, sin open-now.
Límites/paginación/truncamiento documentados. Polígono filtra hasta1000 candidatos;
corredor hasta100km evalúa20 candidatos. API principal sigue512 MiB.
Imagen catálogo `192.168.15.8:5005/dokploy/mapora-places:1.0.1` construida y publicada.
`infra/places/build.py` fue corregido después para coverage americas; el importador
lo usa como bind mount. Reconstruir/pinear digest antes de despliegue final.

## Dokploy preparado, NO desplegado

Host `https://cloud.rangel.pro`, sesión Chrome existente.
Proyecto `2lEkMwrh9rcYkg3aqXwFJ`, entorno `3n0UJUU2fc2A5Hw5mEy68`.
App `xNfkBAhfZ6PjjF7gh-NVa` (app-bypass-bluetooth-microchip-rou6q8), main,
GitHub autodeploy ON. Se guardó PLACES_BASE_URL=http://mapora-places_catalog:8090.
Compose nuevo `mxUj1uUGbaa4eNzlOB29O`, appname mapora-places-pfvawb, Stack en
worker. Raw compose guardado con red privada/alias/volumen ro. Nombre UI quedó
“Catálogo mundial de lugares”: RENOMBRAR a América. No está desplegado.
Al promover Stack, retirar el contenedor autónomo mapora-places-ready para evitar
alias duplicado. Autodeploy implica NO push a main hasta estar listo para publicar.

## Evidencia y pendientes de validación

- Frontend19 pruebas, compilación/prerender/SDK y audit0 vulnerabilidades pasaron.
  Hubo cambios posteriores de textos/UI; el job de servidor vuelve a validar.
- Go tests -race ./... con PostgreSQL18 aislado pasaron: mapsapi42.4s,
  platform92.8s, web1.0s. Repetición previa falló por reutilizar DB con datos y
  rate limits; se descartó exclusivamente el esquema de la DB de pruebas y la
  ejecución limpia pasó. No confundir con un fallo de producción.
- Python3 pruebas catálogo pasaron. Constructor real con fixture OSM (nodo y vía)
  produjo2 registros e índice válido. Fixture queda test-fixture.sqlite en HDD.
- Valhalla real respondió isócronas, optimized_route y trace_attributes.
- Desktop landing visto en Chrome: panel de operaciones y nueva sección correctos,
  sin overflow. Prueba móvil con capacidad viewport dejó herramienta de navegador
  sin responder (timeouts); comprobar/reponer viewport al retomar. Panel nuevo aún
  necesita QA visual y funcional completo con backend. No afirmar QA móvil.
- No publicación ni pruebas autenticadas de nuevas rutas REST/MCP en producción.
- El código usa tokens visuales General Sans/verde Mapora, SVG Lucide, selectores
  personalizados, sin focus rings ni controles de pausa, respetando motion reducido.

Siguiente acción: revisar jobs en servidor, resolver cualquier fallo, confirmar
coverage americas y muestras reales. Después QA panel/API/MCP/permisos/cuotas,
revisar diff, desplegar catálogo desde Dokploy, publicar app/landing y verificar
producción. Completar alcance solo América en índices activos según instrucción.
