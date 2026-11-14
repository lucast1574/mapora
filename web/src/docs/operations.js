export const apiBase = "https://api.mapora.dev";
const lima = { latitude: -12.1199, longitude: -77.029 };
const destination = { latitude: -12.122, longitude: -77.034 };
const polygon = {
  type: "Polygon",
  coordinates: [[[-77.04, -12.13], [-77.02, -12.13], [-77.02, -12.11], [-77.04, -12.11], [-77.04, -12.13]]],
};

// One reference and one set of runnable examples for public and account docs.
export const operations = [
  {
    id: "search", title: "Buscar direcciones y lugares", method: "GET", path: "/v1/search", scope: "search", group: "buscar",
    description: "Búsqueda mundial de calles, direcciones, distritos y lugares. Devuelve candidatos para que la persona confirme su ubicación.",
    query: "q=Miraflores&countrycodes=PE&limit=5",
    parameters: ["q: texto de 2–200 caracteres, obligatorio.", "limit: 1–20, por defecto 8. countrycodes: hasta 10 códigos ISO de dos letras separados por comas.", "city, district y state: filtros por nombre administrativo normalizado (hasta 200 bytes). Usa countrycodes=PE para el índice propio de calles peruanas.", "lat y lng (o lon): priorizan resultados cercanos; no sustituyen un filtro de área.", "bbox: minLng,minLat,maxLng,maxLat. lang: es, local, en, de o fr; es/local conservan el nombre local disponible."],
    response: "results contiene ubicaciones; count indica cuántas. Cada ubicación puede incluir placeName, address, streetAddress, latitude, longitude, street, houseNumber, district, city, state, country, countryCode, postcode, source, attribution y quality. Los campos descriptivos dependen de la fuente. Las referencias del índice propio añaden match.coordinateType:street_reference, sourceURL y sourceDate; houseNumberMatched:false indica que el número solicitado no fue confirmado.",
  },
  {
    id: "autocomplete", title: "Sugerir mientras se escribe", method: "GET", path: "/v1/autocomplete", scope: "search", group: "buscar",
    description: "Sugerencias de dirección con los filtros y el formato de respuesta de búsqueda.",
    query: "q=Avenida+Larco&countrycodes=PE&limit=5",
    parameters: ["q: 2–200 caracteres. Admite limit, countrycodes, city, district, state, lat/lng, bbox y lang como /v1/search.", "El componente React consulta desde 3 caracteres, espera 350 ms y cancela resultados anteriores. Cada consulta admitida cuenta por separado."],
    response: "results, count y attribution, más los metadatos de caché y tiempo cuando están disponibles. Una lista vacía es una búsqueda válida sin coincidencias.",
  },
  {
    id: "geocode", title: "Buscar por campos de dirección", method: "GET", path: "/v1/geocode", scope: "search", group: "buscar",
    description: "Geocodificación estructurada cuando tu formulario ya tiene separados los componentes de la dirección.",
    query: "street=Avenida+Jose+Larco&city=Lima&countrycodes=PE&limit=5",
    parameters: ["Indica al menos uno: street, housenumber, city, district, state, county o postcode; cada campo admite hasta 200 bytes.", "También admite countrycodes, limit y lang. countrycodes por sí solo no constituye una dirección."],
    response: "results y count, con ubicaciones normalizadas y quality.precision, quality.missingFields y quality.verified:false. Estos datos describen la fuente; no certifican un domicilio.",
  },
  {
    id: "reverse", title: "Obtener una dirección desde un punto", method: "GET", path: "/v1/reverse", scope: "reverse", group: "buscar",
    description: "Busca una referencia cercana manteniendo intactas las coordenadas que enviaste.",
    query: "lat=-12.1199&lng=-77.029",
    parameters: ["lat: entre −90 y 90. lng: entre −180 y 180; también se acepta lon.", "La referencia depende de los datos cercanos disponibles y no equivale a validar una puerta o un predio."],
    response: "Un objeto de ubicación. latitude y longitude conservan tu punto; matchedLatitude, matchedLongitude y matchedPlaceName describen la coincidencia cercana. Guarda el punto original por separado de esa referencia.",
  },
  {
    id: "resolve", title: "Resolver un enlace de Google Maps", method: "POST", path: "/v1/resolve", scope: "resolve", group: "buscar",
    description: "Interpreta enlaces compatibles de Google Maps y enlaces cortos permitidos para obtener el pin y el nombre disponible del lugar.",
    body: { url: "https://www.google.com/maps?q=-12.0453,-77.0309", includeAddress: true },
    parameters: ["url: enlace de Google Maps. No admite URLs arbitrarias ni garantiza resolver enlaces sin coordenadas utilizables.", "includeAddress: true por defecto. false omite la consulta de una referencia de dirección.", "También existe GET /v1/resolve?url=ENLACE_CODIFICADO&includeAddress=false, con el mismo permiso."],
    response: "Ubicación con latitude, longitude, googleMapsLink, resolved_url y placeName cuando está disponible. addressStatus puede ser resolved, not_requested o unavailable. Una referencia no disponible no invalida necesariamente el pin resuelto.",
  },
  {
    id: "nearby", title: "Encontrar lugares cercanos", method: "GET", path: "/v1/nearby", scope: "nearby", group: "descubrir",
    description: "Consulta lugares indexados dentro de un radio y los ordena por distancia en línea recta al centro.",
    query: "lat=-12.1199&lng=-77.029&category=pharmacy&radius=1000&limit=8",
    parameters: ["lat, lng y category son obligatorios. Categorías: pharmacy, restaurant, hospital, fuel, supermarket, hotel, bank, parking y cafe.", "radius: 50–50000 metros, por defecto 5000. limit: 1–20, por defecto 8.", "Son candidatos del índice disponible, no un inventario exhaustivo. La distancia no es un recorrido ni un tiempo de viaje."],
    response: "results con distanceMeters por lugar; count, radiusMeters, category y distanceType:straight_line. Usa /v1/routes o /v1/matrix para medir desplazamientos por calles.",
  },
  {
    id: "batch", title: "Geocodificar un lote", method: "POST", path: "/v1/batch", scope: "batch", group: "descubrir",
    description: "Resuelve varias direcciones en una sola petición y mantiene el orden de entrada, incluso cuando alguna fila falla.",
    body: { items: [{ id: "pedido-1", query: "Miraflores Lima", countrycodes: "PE" }, { id: "pedido-2", query: "Chapinero Bogota", countrycodes: "CO" }] },
    parameters: ["items: de 1 a 10 objetos. query es obligatorio, de 2–200 bytes; id es opcional, de hasta 80 bytes.", "countrycodes es opcional por elemento. Divide archivos mayores en lotes y respeta el límite por minuto de la cuenta."],
    response: "results en el mismo orden con id, query y status: ok (incluye result), not_found o error (incluye code). count es el número de elementos. Un HTTP 200 no significa que todas las filas hayan encontrado dirección.",
  },
  {
    id: "coverage", title: "Comprobar polígonos enviados", method: "POST", path: "/v1/coverage", scope: "coverage", group: "cobertura",
    description: "Comprueba si un punto pertenece a una o varias zonas que envías en la misma petición.",
    body: { point: lima, zones: [{ name: "Miraflores", geometry: polygon, feeCents: 500, currency: "PEN" }] },
    parameters: ["point: objeto con latitude y longitude. zones: de 1 a 20 zonas con name, geometry, feeCents y currency; id es opcional.", "geometry: Polygon GeoJSON con coordenadas [longitud, latitud], anillos cerrados, hasta 200 vértices en total y cuatro huecos.", "No admite anillos cruzados ni cruce del antimeridiano. El borde exterior está incluido; los huecos y sus bordes están excluidos."],
    response: "covered, point y matches con todas las zonas coincidentes; feePolicy:all_matching_zones. feeCents se expresa en centavos y currency en tres letras; las tarifas no crean cobros ni eligen automáticamente una zona ganadora.",
  },
  {
    id: "coverage-check", title: "Consultar zonas guardadas", method: "POST", path: "/v1/coverage/check", scope: "coverage", group: "cobertura",
    description: "Consulta zonas previamente guardadas de la cuenta propietaria de la clave. Para comprobar polígonos administrados por tu integración, envíalos directamente a POST /v1/coverage.",
    body: { point: lima, zoneIds: ["REEMPLAZA_POR_ID_DE_TU_ZONA"] },
    parameters: ["point: latitude y longitude. zoneIds: de 1 a 20 identificadores de tus zonas guardadas.", "La cuenta puede guardar hasta 50 zonas. Sustituye el identificador del ejemplo por uno real de tu cuenta antes de enviar."],
    response: "El mismo formato de cobertura: covered, matches, point y feePolicy. Las zonas de otras cuentas no son accesibles con tu API key.",
  },
  {
    id: "routes", title: "Calcular una ruta por calles", method: "POST", path: "/v1/routes", scope: "routing", group: "rutas",
    description: "Calcula trayectos en América con geometría por calles, distancia, duración estimada e instrucciones en español.",
    body: { locations: [lima, destination], profile: "driving" },
    parameters: ["locations: 2–10 puntos con latitude y longitude, en el orden de visita. profile: driving, walking o cycling; driving es el valor predeterminado.", "Límites del motor: 5000 km en auto, 250 km a pie y 500 km en bicicleta. La cobertura depende de las vías y accesos de cada perfil.", "Sin tráfico en tiempo real, transporte público ni planificación por hora de salida. Si no existe ruta, responde 422 route_not_found."],
    response: "geometry es un LineString GeoJSON [longitud, latitud]; distanceMeters y durationSeconds dan los totales. locations conserva los puntos originales y snappedLocations devuelve los puntos sobre la vía. steps incluye instruction, streetNames, legIndex, beginShapeIndex y endShapeIndex. coverage:americas y traffic:not_included.",
  },
  {
    id: "matrix", title: "Comparar tiempos y distancias", method: "POST", path: "/v1/matrix", scope: "routing", group: "rutas",
    description: "Compara varios orígenes y destinos por calles sin solicitar una geometría para cada combinación.",
    body: { sources: [lima, destination], targets: [lima, destination], profile: "driving" },
    parameters: ["sources y targets: 1–10 puntos cada uno, hasta 100 pares. profile: driving (predeterminado), walking o cycling.", "Límites de distancia del motor: 400 km en auto, 200 km a pie o en bicicleta.", "Una celda null indica que ese par no tiene conexión, por ejemplo entre islas sin vía transitable. No la conviertas en cero."],
    response: "durationSeconds[i][j] y distanceMeters[i][j] corresponden a sources[i] → targets[j]. Devuelve también sources y targets originales, coverage:americas, traffic:not_included y attribution. No contiene polylines ni instrucciones.",
  },
  {
    id: "maps", title: "Crear un mapa para compartir", method: "POST", path: "/v1/maps", scope: "maps", group: "mapas",
    description: "Crea un enlace de lectura y un iframe con cartografía mundial, marcadores, zonas y una geometría de ruta opcional.",
    body: { title: "Mi ubicación", center: lima, zoom: 14, theme: "light", accent: "#174c43", markers: [{ ...lima, label: "Punto de entrega" }], expiresIn: 604800 },
    parameters: ["center: latitude y longitude; si se omite, se usa el primer marcador. markers: hasta 200, con label opcional de hasta 160 bytes y agrupación automática.", "theme: light, dark o grayscale. accent: color hexadecimal de seis dígitos. zoom: 1–19, por defecto 14. title: hasta 160 bytes.", "shapes: hasta 10 Polygon GeoJSON. route: LineString GeoJSON, hasta 10000 puntos. Cuerpo completo: máximo 512 KiB.", "expiresIn: 60–2592000 segundos; por defecto 604800 (7 días). Coordenadas del mapa: latitud entre −85.05112878 y 85.05112878, longitud entre −180 y 180."],
    response: "url, embedHtml, expiresAt y map con la especificación normalizada. GET /v1/maps/view/{token} lee ese mapa mediante su token, sin API key. El token no da acceso a otros mapas ni a tu cuenta. Crear consume una petición; visualizar y cargar cartografía no añade peticiones geográficas.",
  },
];

export const operationGroups = [
  { id: "buscar", title: "Direcciones y enlaces" },
  { id: "descubrir", title: "Cercanos y lotes" },
  { id: "cobertura", title: "Zonas de cobertura" },
  { id: "rutas", title: "Rutas y matrices" },
  { id: "mapas", title: "Mapas interactivos" },
];

export function exampleInput(operation) {
  return operation.method === "GET" ? operation.query : JSON.stringify(operation.body, null, 2);
}

export function curlExample(operation) {
  const target = apiBase + operation.path + (operation.query ? "?" + operation.query : "");
  const lines = [`curl "${target}"`, '  -H "X-API-Key: TU_API_KEY"'];
  if (operation.body) lines.push('  -H "Content-Type: application/json"', `  -d '${JSON.stringify(operation.body)}'`);
  return lines.join(" \\\n");
}
