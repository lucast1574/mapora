const center = { latitude: -12.1199, longitude: -77.029 };
const end = { latitude: -12.125, longitude: -77.032 };
const common =
  "Los campos comerciales solo aparecen si están registrados en OpenStreetMap. No hay valoraciones, reseñas ni fotos de Google. Las coordenadas de vías/edificios son referencias; no garantizan una entrada.";
export const advancedOperations = [
  {
    id: "places",
    title: "Buscar en el catálogo de lugares",
    method: "GET",
    path: "/v1/places",
    scope: "places",
    group: "lugares",
    description:
      "Busca negocios y servicios por nombre, categoría, centro o rectángulo en el índice propio OSM de América.",
    query:
      "lat=-12.1199&lng=-77.029&radius=3000&category=amenity:pharmacy&limit=20",
    parameters: [
      "Indica q, bbox o lat y lng. q y city: hasta 200 bytes. category: amenity:pharmacy, shop:bakery, tourism:hotel u otra categoría admitida de OSM.",
      "radius: 50–50000 m (5000 por defecto). bbox: minLng,minLat,maxLng,maxLat, sin cruce del antimeridiano. limit: 1–50 (20 por defecto).",
      "offset: 0–1000000; continúa nextOffset mientras hasMore sea true. El orden es por distancia con centro o por ID del catálogo sin centro. Reinicia la paginación si cambia dataset.builtAt.",
      "countrycodes y city filtran únicamente etiquetas addr:country y addr:city de OSM. Los lugares sin esas etiquetas quedan excluidos. Usa bbox o centro para una zona geográfica.",
      common,
    ],
    response:
      "results, count, hasMore, nextOffset, dataset y attribution. Cada lugar incluye id OSM estable, nombre, categoría y coordenadas. phone, website, email, openingHours, cuisine y wheelchair son opcionales. openingHours conserva la sintaxis OSM; no es un estado abierto ahora.",
  },
  {
    id: "place-details",
    title: "Consultar la ficha de un lugar",
    method: "GET",
    path: "/v1/places/details",
    scope: "places",
    group: "lugares",
    description:
      "Recupera un lugar del catálogo mediante el identificador que devolvió la búsqueda.",
    query: "id=osm:N:4214328591",
    parameters: [
      "id obligatorio, formato osm:N:123 u osm:W:123. Usa los IDs devueltos por el catálogo actual.",
      common,
    ],
    response:
      "place y attribution. Un 404 indica que ese identificador no existe en esta versión del catálogo.",
  },
  {
    id: "places-export",
    title: "Exportar lugares a CSV",
    method: "GET",
    path: "/v1/places/export",
    scope: "places",
    group: "lugares",
    description:
      "Descarga una página del catálogo con atribución y protección contra fórmulas en las celdas de texto.",
    query:
      "lat=-12.1199&lng=-77.029&radius=3000&category=amenity:pharmacy&limit=100",
    parameters: [
      "Mismos filtros que /v1/places; limit permite hasta 1000 filas por petición, 20 por defecto.",
      "Continúa con las cabeceras X-Has-More y X-Next-Offset. Cada página admitida consume una petición. Se conserva ODbL para la base derivada.",
      common,
    ],
    response:
      "CSV UTF-8 con id, name, category, latitude, longitude, address, phone, website, opening_hours, source_updated_at y attribution.",
  },
  {
    id: "places-area",
    title: "Buscar lugares dentro de un polígono",
    method: "POST",
    path: "/v1/places/area",
    scope: "places",
    group: "lugares",
    description:
      "Consulta lugares dentro del contorno enviado, excluyendo huecos.",
    body: {
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-77.04, -12.13],
            [-77.02, -12.13],
            [-77.02, -12.11],
            [-77.04, -12.11],
            [-77.04, -12.13],
          ],
        ],
      },
      category: "amenity:pharmacy",
      limit: 20,
    },
    parameters: [
      "geometry: Polygon GeoJSON [longitud,latitud], cerrado y sin cruces; hasta 200 vértices y cuatro huecos. category y q son opcionales.",
      "limit: 1–50; offset: 0–1000000. Cada llamada examina hasta 1000 candidatos del rectángulo. Una página vacía puede tener hasMore:true: continúa nextOffset.",
      common,
    ],
    response:
      "results, count, hasMore, nextOffset, dataset y attribution. El borde exterior se incluye; los huecos y sus bordes se excluyen.",
  },
  {
    id: "places-along-route",
    title: "Encontrar paradas durante una ruta",
    method: "POST",
    path: "/v1/places/along-route",
    scope: "places",
    group: "lugares",
    description:
      "Busca lugares en un corredor y ordena una selección de candidatos por tiempo adicional de desvío.",
    body: {
      locations: [center, end],
      profile: "driving",
      category: "amenity:fuel",
      corridorMeters: 1000,
      maxDetourSeconds: 600,
      limit: 10,
    },
    parameters: [
      "locations: exactamente dos puntos. profile: driving, walking o cycling. Rutas de hasta 100 km, en América.",
      "category obligatorio. corridorMeters: 50–5000 (1000 por defecto). maxDetourSeconds: 1–7200 (600 por defecto). limit: 1–10.",
      "Se revisan hasta 1000 candidatos del rectángulo y se calculan tiempos para un máximo de veinte. candidateSearchTruncated avisa si se limitó la búsqueda. No garantiza encontrar todos los lugares ni el mejor desvío global.",
    ],
    response:
      "results con detourSeconds (tiempo adicional) y durationSeconds (trayecto completo pasando por ese lugar), baselineDurationSeconds y geometry. No incluye tráfico en vivo ni tiempo de atención en la parada.",
  },
  {
    id: "isochrones",
    title: "Calcular alcance por tiempo",
    method: "POST",
    path: "/v1/isochrones",
    scope: "routing",
    group: "rutas",
    description:
      "Genera contornos de las áreas alcanzables por calles desde un punto.",
    body: { center, minutes: [5, 10, 15], profile: "walking" },
    parameters: [
      "center obligatorio. minutes: de uno a cuatro enteros distintos entre 1 y 120. profile: driving, walking o cycling.",
      "Cobertura de rutas en América, sin tráfico en vivo. geometry es una FeatureCollection de Polygon o MultiPolygon.",
      "Los contornos son estimaciones. Pueden necesitar simplificación o división para convertirse en zonas guardadas, que mantienen sus propios límites.",
    ],
    response:
      "geometry, center, minutes, profile, coverage, traffic:not_included y attribution.",
  },
  {
    id: "optimize",
    title: "Ordenar las paradas de una ruta",
    method: "POST",
    path: "/v1/routes/optimize",
    scope: "routing",
    group: "rutas",
    description:
      "Calcula un orden para las paradas intermedias conservando el origen y el destino.",
    body: {
      locations: [center, { latitude: -12.1225, longitude: -77.0305 }, end],
      profile: "driving",
    },
    parameters: [
      "locations: de 2 a 10 puntos. profile: driving, walking o cycling; mismos límites de distancia de rutas.",
      "No incluye gestión de flotas, capacidades de carga ni ventanas horarias. No afirma un óptimo matemático global.",
    ],
    response:
      "waypointOrder contiene índices de la lista original (desde cero). locations conserva la entrada; snappedLocations sigue el orden recorrido. optimized:true, geometry, polyline con polylinePrecision:6, instrucciones, distancia y duración sin tráfico.",
  },
  {
    id: "match",
    title: "Ajustar observaciones GPS a calles",
    method: "POST",
    path: "/v1/match",
    scope: "routing",
    group: "rutas",
    description:
      "Relaciona una secuencia de puntos con el recorrido probable por la red vial.",
    body: {
      locations: [center, { latitude: -12.1225, longitude: -77.0305 }, end],
      profile: "driving",
    },
    parameters: [
      "locations: de 2 a 2000 observaciones en orden, hasta 200 km de longitud acumulada en línea recta. profile: driving, walking o cycling.",
      "Conserva los puntos originales. El resultado es una inferencia, no una prueba de presencia ni de desplazamiento. Puede fallar con observaciones separadas o fuera de la cobertura.",
    ],
    response:
      "geometry, polyline (precisión 6), matchedPoints, edges, confidence si el motor la devuelve, locations originales, coverage y attribution.",
  },
];
