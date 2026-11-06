# Nexode Maps API

API independiente en Go, sin autenticación, con CORS abierto.

URL: https://maps-api.nexode.app

Contrato completo: https://maps-api.nexode.app/openapi.json

## Buscar direcciones

```javascript
const query = new URLSearchParams({
  q: 'Avenida José Larco',
  countrycodes: 'pe',
  lat: '-12.12',
  lng: '-77.03',
  limit: '5',
});
const { results } = await fetch(`https://maps-api.nexode.app/v1/search?${query}`).then(r => r.json());
```

Los candidatos incluyen `placeName`, `address`, `streetAddress`, `latitude`,
`longitude`, `googleMapsLink`, país, ciudad, distrito y los componentes de dirección
disponibles. `bbox=minLng,minLat,maxLng,maxLat` restringe el área de búsqueda.
`countrycodes=pe,co,ec` permite varios países. `lat/lng` prioriza cercanía y no
restringe el área. En autocompletado, esperar unos 350 ms y descartar las respuestas
de consultas anteriores. Los resultados dependen de la cobertura de OpenStreetMap.

## Resolver Google Maps

```javascript
const location = await fetch('https://maps-api.nexode.app/v1/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.google.com/maps/place/Plaza+Mayor/@-12.0453,-77.0309,17z',
    includeAddress: true,
  }),
}).then(r => r.json());
```

Devuelve `latitude`, `longitude`, `placeName`, `streetAddress`, `address`, el enlace
original en `googleMapsLink`, el enlace expandido en `resolved_url` y
`addressStatus`. Las coordenadas y el nombre seleccionado de Google se conservan;
un POI cercano del geocodificador no los sustituye. El POI cercano aparece en
`matchedPlaceName` y `matchedLatitude/matchedLongitude`.

Con `includeAddress:false` omite la consulta externa de dirección: es el camino
rápido para colocar un marcador. La extracción desde un enlace largo con
coordenadas no necesita consultar Google. Los enlaces cortos sí requieren red.

Si falla el geocodificador, mantiene coordenadas y nombre, usa coordenadas como
texto de dirección y devuelve `addressStatus:"unavailable"`; no debe interpretarse
como una dirección confirmada. `not_requested` indica que se omitió la consulta.
El estado `resolved` significa que el proveedor devolvió una referencia cercana,
no que se haya verificado físicamente la dirección.

`GET /v1/resolve?url=...&includeAddress=false` también está disponible.
`POST /maps/resolve` es un alias compatible con la entrada de The Date.

## Dirección desde coordenadas

```javascript
const location = await fetch('https://maps-api.nexode.app/v1/reverse?lat=-12.12&lng=-77.03')
  .then(r => r.json());
```

También acepta `lon` como alias de `lng`. Las coordenadas principales permanecen
en el punto solicitado; las del resultado cercano están en `matchedLatitude` y
`matchedLongitude`.

## Operación

- Go 1.27, biblioteca estándar, `PORT=4000`, escucha en todas las interfaces.
- `GET /health` comprueba el proceso, no la disponibilidad de proveedores.
- `PHOTON_BASE_URL` cambia el motor sin modificar los clientes. Por defecto utiliza
  `https://photon.komoot.io`. La API Go está alojada en Nexode; el índice de búsqueda
  de datos no está alojado en Nexode.
- El servidor público de Photon permite uso moderado y no garantiza disponibilidad:
  https://github.com/komoot/photon#demo-server. El tráfico externo se limita a dos
  inicios por segundo y cuatro solicitudes pendientes. Para mayor volumen, usar
  un proveedor contratado o una instancia propia mediante `PHOTON_BASE_URL`.
- No se usa el servidor público de Nominatim para autocompletado.
- Caché en memoria con vencimiento: búsqueda 15 min, coordenadas/direcciones 24 h;
  máximo 2048 entradas / 24 MiB. Se pierde al reiniciar. Solicitudes iguales
  concurrentes comparten una consulta. Fallos de proveedor no se guardan.
- Tiempo de trabajo compartido máximo 10 s; solicitud HTTP máximo 12 s. Solicitudes
  limitadas en tamaño y concurrencia. No se registran direcciones ni URLs de usuarios.
- `cached` y `X-Cache` identifican caché; en resolución se refieren a la extracción
  del enlace. `tookMs` mide el procesamiento dentro de la API, sin incluir la red del cliente.
- Mostrar `© OpenStreetMap contributors` junto a los resultados y enlazar a
  https://www.openstreetmap.org/copyright. Los datos geográficos están bajo ODbL.
- Los enlaces de Google se interpretan mediante URLs/redirecciones/HTML. Esto no
  es Google Places y Google puede cambiar los formatos. Los enlaces sin pin
  extraíble devuelven 422. No se aceptan redirecciones fuera de los hosts de Google
  permitidos. No hay acceso a catálogos privados de Ops ni a eventos de The Date.

## Validación

```sh
go test -race ./...
go vet ./...
go build ./cmd/api
docker build -t nexode-maps-api .
docker run --rm -p 4000:4000 nexode-maps-api
```

Las pruebas usan proveedores y respuestas de Google simulados; no consumen APIs
reales. Las comprobaciones públicas de despliegue se ejecutan por separado.
