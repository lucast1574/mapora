# Catálogo privado de lugares

Servicio Python/SQLite de solo lectura, separado de la API de 512 MiB. Índices
RTree y FTS5. Fuente: snapshot OSM de América conservado en
`/var/lib/mapora-next/routing-americas/americas.osm.pbf`. Datos derivados ODbL;
atribución por registro. Se incluyen nodos y vías, no relaciones. Los centros de
vías son referencias de su bounding box, no entradas verificadas.

La extracción y construcción se ejecutan fuera del arranque del servicio, en un
contenedor limitado a 4 CPU/8 GiB. Filtrar primero con osmium tags-filter las
etiquetas amenity/shop/tourism/office/leisure/healthcare/craft de nodos y vías,
conservando referencias de nodos para poder obtener la geometría de las vías.
Después ejecutar `python build.py /data/pois.osm.pbf /data/places-next.sqlite`.
No sobrescribe una base staging existente. Cada 50000 lugares comprueba que
queden 80 GiB libres. Validar integridad y búsquedas antes de activar mediante
renombrado atómico, conservando la versión anterior. Nunca reemplazar los índices
activos de Photon, rutas o mosaicos. No se reanudan constructores de rutas cancelados.

El snapshot conserva nombre, categoría, coordenadas y atributos comerciales
opcionales presentes en OSM. No infiere teléfonos ni horarios, ni obtiene reseñas
o imágenes de Google. La actualización es explícita; `dataset.builtAt` identifica
la versión del catálogo, no la fecha de cada negocio. Cada lugar puede incluir
`sourceUpdatedAt`. Los filtros countrycodes/city requieren etiquetas addr:country
y addr:city; no sustituyen un cálculo de pertenencia administrativa.

`compose.yml` publica únicamente el alias privado `mapora-places_catalog:8090`
en dokploy-network; no publica puertos ni dominio. Configurar PLACES_BASE_URL en
la API. Imagen publicada en el registro privado y fijada por versión/digest.
Datos en `/var/lib/mapora-next/places`, actualmente bajo `/srv/mapora-hdd`.
El servicio tiene 2 CPU/2 GiB y consultas con un presupuesto SQLite de 4 segundos.
No registra consultas. La API aplica claves, permisos, cuota y concurrencia.

Validación local: `python3 -m unittest discover -s infra/places -p 'test_*.py'`.
Probar también la construcción con un OSM pequeño y una consulta real del
catálogo antes de publicar una imagen o activar un snapshot.
