# Motor privado de rutas

El archivo compose ejecuta únicamente el servidor. Nunca usar el entrypoint de
construcción como entrypoint de producción: un reinicio no debe descargar datos,
reconstruir el índice ni modificarlo. El volumen se monta de solo lectura y no se
publica ningún puerto. La API accede por `http://mapora-routing_engine:8002`.

## Preparación de datos

La primera cobertura se construye en `/var/lib/mapora-next/routing-v2` con
Sudamérica, Centroamérica/Caribe y México de Geofabrik. Sus checksums se verifican
antes de unirlos. Instantáneas regionales diferentes pueden duplicar versiones de
un objeto OSM: normalizar el resultado con `osmium time-filter` sin timestamp y
comprobar `osmium fileinfo -e -j` (`objects_ordered=true`,
`multiple_versions=false`) antes de iniciar Valhalla.

La ampliación seleccionada es toda América, preparada por separado en
`/var/lib/mapora-next/routing-americas`. Combinar el extracto Geofabrik
`north-america-261105.osm.pbf` (19 543 728 071 bytes) con el PBF normalizado de
Latinoamérica ya preparado. Usar el archivo fechado y verificar su `.md5`; el
alias `latest` no publica un `.md5` en este caso.

Unir con `osmium merge` y normalizar con `osmium time-filter` para evitar versiones
duplicadas en México. Comprobar `osmium fileinfo -e -j` antes de construir.
Reutilizar `admins.sqlite` y `default_speeds.json` ya preparados; el
constructor usa `build_admins=False` porque la base existe, no porque se eliminen
las reglas administrativas. La base administrativa proviene de la instantánea
OSMF del 2 de noviembre de 2026. Los constructores mundial y América/Europa
anteriores se detuvieron por decisión del propietario y no deben reanudarse.

La imagen se fija al mismo digest del compose. La construcción regional usa
4 hilos, 6 CPU y hasta 24 GiB; toda América, 16 hilos, 16 CPU y hasta 36 GiB sin
swap adicional. Se ejecutan secuencialmente para reservar recursos al resto de las
aplicaciones. Los datos de elevación y zonas horarias están desactivados: no se
ofrece planificación con hora de salida ni cálculos basados en elevación.
Se conserva la base administrativa para fronteras. Los límites del contenedor
no sustituyen la comprobación previa del espacio libre.

El constructor genera el extracto tar al cerrar el grafo. Se detiene si quedan
menos de 80 GiB disponibles; nunca
borra índices activos ni modifica parámetros del kernel del servidor. Medir el
espacio y el rendimiento reales antes de decidir si generar el extracto tar.

## Validación y activación

1. Confirmar salida 0 del constructor, presencia del grafo y configuración.
2. Iniciar el servidor privado con ese directorio de solo lectura y verificar
   `/status`, rutas por calles, perfiles auto/pedestrian/bicycle y matrices.
3. Para Latinoamérica probar países de Sudamérica, México, Centroamérica y
   Caribe, además de un cruce fronterizo. Para ampliar, añadir ciudades de
   EE. UU., Canadá y un cruce entre ambos. Conservar un reporte con
   distancias, duraciones y latencias. Comprobar también puntos sin conexión.
4. Solo después activar `ROUTING_BASE_URL` en la API y declarar
   `ROUTING_COVERAGE=latin_america` o `americas` según los datos efectivamente
   validados. Conservar los mismos endpoints y las claves existentes.
5. Verificar desde la API pública coordenadas originales, geometría GeoJSON,
   instrucciones, cuotas y el panel real. Conservar el índice anterior para
   revertir el volumen sin restaurar bases de clientes.

toda América se activan cambiando el volumen del compose a su directorio una
vez validado; no cambiar solamente la etiqueta de cobertura. El servicio mantiene
2 hilos, 4 CPU y 8 GiB, con healthcheck privado y sin exposición de Valhalla.
Los límites de distancia del motor se documentan en `docs/expansion.md`.

## Fuentes

- [Valhalla Docker oficial](https://github.com/valhalla/valhalla/blob/master/docker/README.md)
- [Instantáneas OSMF](https://planet.openstreetmap.org/)
- [Extractos Geofabrik](https://download.geofabrik.de/)
- [Osmium time-filter](https://docs.osmcode.org/osmium/latest/osmium-time-filter.html)
