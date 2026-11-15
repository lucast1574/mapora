# Instrucción vigente: conservar datos de Photon

El usuario pidió detener la limpieza y conservar los datos restantes fuera de
América. photon-filter.pid y activation.pid fueron detenidos y verificados;
photon-activation.json marca cancelled_by_user. NO reanudar scripts ni activar el
índice staging sin una nueva solicitud. La cobertura del producto sigue América.
La ampliación anterior se publicó en 2ad2f7d, con 16 smoke checks públicos aprobados.

El siguiente cambio añade correos React Email/Resend, notificaciones persistentes,
SEO y una landing visual más breve. Evidencia de su publicación final en
`/home/rangel/mapora-mail-release/release.json`; no confundir con el release anterior.
Las claves de Resend se guardan solo en Dokploy, con permiso de envío por dominio.

---

# Mapora: lugares y rutas avanzadas — continuidad

Estado de publicación: candidato validado; publicar este commit por main y comprobar
el SHA en Dokploy antes de dar por terminado. Evidencia final de publicación en
`/var/lib/mapora-next/feature-expansion/release.json` en rangel-worker.

## Alcance

Solo América; catálogo OSM propio sin SerpApi. Fichas y CSV, consultas por polígonos
y corredores, cercanos por tiempo, isócronas, orden de paradas, GPS matching y
polyline6. Panel, landing, OpenAPI 4, JS y MCP 2 actualizados. MCP: 23 herramientas,
incluido mapora_status. Permiso places privado; migración amplía únicamente claves
referenciadas por conexiones MCP activas. Las claves normales conservan permisos.

Catálogo de América terminado: 14,279,003 registros, SQLite 9,365,901,312 bytes.
Servicio privado mapora-places-americas, alias mapora-places_catalog, red
 dokploy-network, sin puerto público, volumen de datos readonly, restart unless-stopped.
Imagen 1.1.0 fijada por digest en infra/places/compose.yml.
La app necesita PLACES_BASE_URL=http://mapora-places_catalog:8090.

## HDD y mantenimiento autónomo

SSH rangel-worker (rangelserver1), Docker disponible. Datos físicos:
`/srv/mapora-hdd/mapora-next` y `/srv/mapora-hdd/mapora-photon`; enlaces
`/var/lib/mapora-next` y `/var/lib/mapora-photon`.

Limpieza de fuentes inactivas de otros continentes completada (~220 GB).
PMTiles regional extraído, verificado y activado; archivo mundial retirado.
`tiles/world.pmtiles` es enlace de compatibilidad a `americas.pmtiles`.
619 GiB libres observados después del cambio (comprobar df para valor actual).
Los mosaicos de resumen a zoom bajo pueden conservar contexto global compartido.

Photon: depuración en índice staging, NO confundir con una limpieza física terminada.
Scripts infra/regions/photon-americas.py y activate-americas.py en /home/rangel.
Log y PID: /var/lib/mapora-next/regions/photon-filter.{log,pid},
activation.{log,pid}. Estados photon-activation.json y tiles-activation.json.
El activador verifica ausencia de documentos fuera de América y consultas PE/US/CA/BR/MX,
conserva clon de reversión durante cambio, y elimina originales solo tras validación.
No lanzar un segundo importador ni borrar índices usados por producción.
La API ya filtra respuestas a América durante el mantenimiento.

## Validación

Frontend: 19 pruebas, build/prerender/SDK, audit 0. Backend: go test -race ./...,
go vet ./..., go build pasaron contra PostgreSQL aislado. Prueba adicional real
reveló que Photon /reverse rechaza countrycode; corregido y cubierto por regresión,
segunda ejecución mapsapi -race pasó. Python catálogo: 3 pruebas y fixture real.
Smoke del candidato y producción: logs smoke-final.log y smoke-production.log.
Revisar resultado y SHA antes de comunicar publicación completada.

QA: landing 320 px, panel con lugares reales e isócronas, desktop, selectores
personalizados y controles sin anillos. Las fuentes y sprites son propios.

## Despliegue y limpieza de QA

Repo git@github.com:lucast1574/mapora.git; main autodeploy Dokploy.
Servicio app-bypass-bluetooth-microchip-rou6q8 en worker.
URLs https://mapora.dev, https://app.mapora.dev, https://api.mapora.dev.
Git checkout Dokploy: /etc/dokploy/applications/app-bypass-bluetooth-microchip-rou6q8/code.
Logs bajo /etc/dokploy/logs/app-bypass-bluetooth-microchip-rou6q8.
Registro Compose preparado en Dokploy aún no desplegado: mxUj1uUGbaa4eNzlOB29O;
nombre viejo mundial debe corregirse cuando haya sesión administrativa disponible.
El contenedor privado persistente sirve el catálogo independientemente.

Fixture QA exclusivo usr_qa_features_20261114, email
qa-mapora-features-20261114@example.invalid: retirar solo sus filas tras smoke público,
no tocar clientes ni intentos de login globales. Eliminar archivos temporales de clave
sin imprimirlos; apagar candidato, proxy, Vite y túnel propios al terminar.
