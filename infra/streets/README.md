# Índice propio de calles de Perú

La API carga un índice inmutable en memoria durante el arranque. No consulta
proveedores externos para este índice ni descarga datos durante las peticiones.
Photon privado conserva la búsqueda mundial, POI y direcciones con numeración.

El índice inicial contiene 190651 registros de vías, no calles únicas:
190298 segmentos nombrados de OpenStreetMap y 353 referencias cartográficas
municipales de Trujillo. Tiene registros en los 25 departamentos; no implica
cobertura completa de las calles o domicilios de cada departamento.

## Fuentes y precisión

- Extracto Perú Geofabrik `peru-261105.osm.pbf`, 257311800 bytes, MD5
  `0000a5e658777d61fdc853fa0751588c`. Datos OSM al 5 de noviembre de 2026,
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Límites referenciales de departamentos, provincias y distritos publicados por
  [INEI](https://ide.inei.gob.pe/) mediante sus servicios WFS. Los atributos
  consultados corresponden a la cartografía publicada en 2022. Se usan para el
  contexto administrativo; no constituyen deslindes jurídicos actualizados.
- Planos públicos de trabajo PLANDET de los sectores 06, 08, 20 y 22 de
  [Municipalidad Provincial de Trujillo](https://munitrujillo.gob.pe/).
  Sus fechas de documento son 2020–2021. El manifiesto registra URL y SHA-256.

Para OSM se usa un vértice intermedio de la vía, sin inventar números de puerta.
En los planos municipales se extraen únicamente etiquetas de calles: sus puntos
se calculan con los controles GeoPDF y el sistema WGS84/UTM 17S declarado en los
documentos. Se excluyen los mapas de ubicación insertados y textos de leyenda.
La posición de la etiqueta es una referencia aproximada de la calle, no una
entrada ni necesariamente un punto situado exactamente sobre el eje vial.

La extracción es general para todas las etiquetas compatibles de esos planos.
No utiliza coordenadas de Google, domicilios aportados por clientes ni reglas
especiales para una dirección de prueba. Otros municipios pueden incorporarse
mediante fuentes públicas verificadas y su correspondiente transformación.

## Consulta y compatibilidad

`/v1/search`, `/v1/autocomplete`, `/v1/geocode` y `/v1/batch` usan el mismo índice.
Seleccionarlo con `countrycodes=PE`, contexto administrativo o una pista
geográfica; una consulta mundial sin contexto conserva su comportamiento previo.

La búsqueda admite acentos, tipos de vía abreviados y prefijos de la última
palabra. Primero busca nombres completos y conserva vías numéricas (por ejemplo
28 de Julio y Pasaje 101); si no hay coincidencia, puede separar un número final.
Los filtros `city`, `district` y `state` comparan nombres normalizados; `city`
puede coincidir con distrito o provincia. `bbox` sigue siendo un límite rectangular.

Los resultados propios usan `source:mapora_streets`, `quality.precision:street`
y `match.coordinateType:street_reference`. `match.houseNumberMatched:false`
impide interpretarlos como una casa confirmada; `requestedHouseNumber` conserva
el número consultado cuando se separó. No se asigna un número ni se sustituye
un pin original. El frontend permite ajustar el pin y avisa del número pendiente.

Los permisos, claves, cuotas y contrato anterior se conservan. La selección
interna de candidatos no crea unidades extra: una petición admitida sigue siendo
una unidad. Los resultados exactos del proveedor en la misma calle y número se
conservan. Si Photon falla, una referencia local disponible puede responder.

## Reconstrucción reproducible

Ejecutar fuera de producción y con una carpeta de caché fuera del repositorio:

```sh
python -m pip install osmium shapely pymupdf pypdf pyproj numpy
python scripts/download-peru-streets.py --cache /ruta/staging/peru-streets
python scripts/build-peru-streets.py --cache /ruta/staging/peru-streets \
  --output internal/mapsapi/data/peru-streets.json.gz
go test ./internal/mapsapi
```

El constructor comprueba el checksum del PBF y los controles geográficos de cada
plano. Conserva una caché derivada del PBF, invalidada por los hashes de los límites
y la versión del archivo fuente. El manifiesto registra las fuentes y el hash del
índice final. Actualizar versiones y fuentes deliberadamente, probar nombres,
filtros, precisión y recursos, y publicar el artefacto solo después de validar.

El paquete comprimido ocupa aproximadamente 5.4 MB. La API tiene un límite suave
Go de memoria de 384 MiB dentro del contenedor existente de 512 MiB. Mantener el
índice y sus límites de lectura compatibles con ese presupuesto al ampliarlo.
El SDK 2.1.0 incorpora filtros administrativos; la descarga 2.0.0 original se conserva.

Se ofrece el índice derivado y su manifiesto en `/downloads/peru-streets.json.gz`
y `/downloads/peru-streets.manifest.json` con atribuciones por registro. La base
derivada de OSM conserva ODbL; la descarga no concede derechos sobre datos de Google.
