export const siteOrigin = "https://mapora.dev";
export const pages = {
  "/mcp": {
    title: "MCP de Mapora para Claude Code y Codex",
    description:
      "Conecta Mapora a Claude Code y Codex desde tu panel. Copia la configuración con tu API key incluida y usa tu asistente con el contrato y los permisos de tu cuenta.",
    navTitle: "MCP para IA",
  },
  "/": {
    title: "API de mapas, lugares y rutas en América | Mapora",
    description:
      "Busca lugares, calcula rutas y desvíos en América, ordena paradas y visualiza áreas alcanzables. Catálogo OSM, mapas, API y MCP con plan gratuito.",
  },
  "/documentacion": {
    title: "Documentación de la API de mapas | Mapora",
    description:
      "Referencia de Mapora: catálogo de lugares, CSV, rutas, isócronas, optimización de paradas, GPS, matrices, mapas y SDK. Ejemplos, permisos y probador de API.",
    heading: "Documentación de la API de Mapora",
  },
  "/api-busqueda-direcciones": {
    title: "API de búsqueda de direcciones y lugares | Mapora",
    description:
      "Busca calles y lugares con la API de Mapora. Filtra por país, prioriza una zona y recibe direcciones, coordenadas y contexto geográfico en una respuesta JSON.",
    heading: "Búsqueda de direcciones para tu aplicación.",
    summary:
      "De lo que escribe una persona a un lugar que tu producto puede usar: nombre, dirección, latitud, longitud y contexto geográfico en JSON.",
    navTitle: "Búsqueda de direcciones",
    operation: "GET /v1/search",
    scope: "search",
    code: `curl "https://api.mapora.dev/v1/search?q=Miraflores&countrycodes=pe&limit=5" \\\n  -H "X-API-Key: TU_API_KEY"`,
    sections: [
      {
        title: "Qué devuelve una búsqueda",
        text: "Mapora consulta Photon con datos de OpenStreetMap y normaliza los resultados para que puedas utilizarlos en formularios, entregas o selección de ubicaciones. Cada resultado incluye nombre, dirección, coordenadas, fuente y atribución. Según la información disponible, también puede incluir calle, número, distrito, ciudad, región, código postal y país. Esos campos dependen de la cobertura del proveedor; una coincidencia no equivale a verificar físicamente una dirección.",
      },
      {
        title: "Cómo orientar los resultados",
        text: "El parámetro q contiene el texto de búsqueda y requiere al menos dos caracteres. countrycodes permite limitar los resultados con códigos de país de dos letras, como pe para Perú. Puedes enviar lat y lng para priorizar una zona, o bbox para acotar el área de búsqueda. limit admite de 1 a 20 resultados. El endpoint devuelve una lista de candidatos; deja que la persona confirme el lugar antes de guardarlo.",
      },
      {
        title: "Búsqueda mientras se escribe",
        text: "Usa GET /v1/autocomplete o el componente MaporaAddressSearch para mostrar sugerencias sin obligarte a mostrar un mapa. El componente consulta desde tres caracteres, espera 350 ms y cancela resultados anteriores. Cada petición admitida consume una unidad, también desde caché; cancelar un fetch no garantiza que no haya sido admitido. Invalida la selección anterior cuando la persona edite el texto.",
      },
      {
        title: "País, ciudad y área de búsqueda",
        text: "countrycodes=PE restringe a Perú; puedes enviar hasta diez países separados por comas. Para buscar por componentes separados usa GET /v1/geocode con street, housenumber, city, district, state, county o postcode. La búsqueda libre y el autocompletado también admiten city, district y state como filtros administrativos por nombre. lat/lng prioriza cercanía y bbox acota un rectángulo minLng,minLat,maxLng,maxLat. Perú cuenta además con un índice propio de calles que devuelve referencias de vía cuando el número no está registrado, sin afirmar una coincidencia con la casa. El campo city de geocode forma parte de la consulta y no garantiza un límite administrativo.",
      },
      {
        title: "Del resultado al mapa",
        text: "Guarda el nombre elegido junto con su latitud y longitud y los componentes de dirección disponibles. Mostrar un mapa es opcional: los endpoints devuelven JSON. Puedes consultar una referencia con GET /v1/reverse, generar un mapa con POST /v1/maps o calcular rutas por calles en América con POST /v1/routes y tiempos por pares con POST /v1/matrix. Mapora no es Google Places y no certifica domicilios.",
      },
    ],
  },
  "/resolver-enlaces-google-maps": {
    title: "Resolver enlaces de Google Maps con una API | Mapora",
    description:
      "Convierte enlaces de Google Maps en nombre de lugar y coordenadas con Mapora. Conserva el pin seleccionado y solicita una dirección de referencia si la necesitas.",
    heading: "Un enlace de Google Maps. Datos que puedes guardar.",
    summary:
      "Recibe un enlace compartido, extrae sus coordenadas y conserva el nombre del lugar seleccionado sin desplazar el pin a otro punto cercano.",
    navTitle: "Enlaces de Google Maps",
    operation: "POST /v1/resolve",
    scope: "resolve",
    code: `curl "https://api.mapora.dev/v1/resolve" \\\n  -H "X-API-Key: TU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://www.google.com/maps?q=-12.0453,-77.0309","includeAddress":false}'`,
    sections: [
      {
        title: "Conserva la ubicación que compartieron",
        text: "Una persona puede compartir un lugar, un pin o un enlace corto de Google Maps. Mapora interpreta los formatos compatibles y expande los enlaces cortos permitidos para obtener una ubicación utilizable. La respuesta conserva el nombre seleccionado cuando está disponible, latitude, longitude, googleMapsLink y resolved_url. No todos los enlaces de Google Maps contienen un punto resoluble: un resultado válido depende del formato y de los datos que incluya el enlace.",
      },
      {
        title: "Cuándo consultar una dirección",
        text: "includeAddress es true por defecto. Cuando está activado, Mapora intenta añadir una referencia de dirección desde Photon/OpenStreetMap. Esa referencia puede corresponder a un lugar cercano y no sustituye las coordenadas del pin original. Si tu flujo solo necesita el nombre y el punto, envía includeAddress:false para omitir esta consulta de dirección. La latencia depende del enlace, la caché y los proveedores; no hay un tiempo de respuesta garantizado.",
      },
      {
        title: "Cómo tratar una dirección no disponible",
        text: "Si se consigue el punto pero falla la consulta de dirección, el flujo de resolución puede conservar las coordenadas con addressStatus: unavailable. Cuando se omite la consulta, el estado es not_requested. No descartes un punto válido solo porque no hay una dirección descriptiva y tampoco presentes la referencia como una dirección verificada. Guarda por separado el enlace, el nombre, las coordenadas y el estado de resolución.",
      },
      {
        title: "Alcance de la integración",
        text: "El endpoint interpreta enlaces de Google Maps; no consulta Google Places, reseñas, horarios, fotos ni fichas comerciales. Utiliza únicamente los dominios y formatos admitidos: no funciona como un descargador de URLs arbitrarias. Una vez resuelto el punto, puedes insertarlo en un mapa de Mapora o guardarlo en tu aplicación junto con los datos que necesita tu flujo.",
      },
    ],
  },
  "/geocodificacion-inversa": {
    title: "API de geocodificación inversa | Mapora",
    description:
      "Consulta una dirección de referencia a partir de latitud y longitud. La API de Mapora conserva tu punto y distingue las coordenadas de la coincidencia cercana.",
    heading: "Coordenadas con una dirección de referencia.",
    summary:
      "Añade contexto legible a una latitud y longitud sin cambiar las coordenadas originales que necesita tu aplicación.",
    navTitle: "Geocodificación inversa",
    operation: "GET /v1/reverse",
    scope: "reverse",
    code: `curl "https://api.mapora.dev/v1/reverse?lat=-12.119906&lng=-77.028971" \\\n  -H "X-API-Key: TU_API_KEY"`,
    sections: [
      {
        title: "Qué es la geocodificación inversa",
        text: "La geocodificación inversa convierte unas coordenadas en una referencia de dirección. Sirve para mostrar un texto junto a un pin, contextualizar una visita o ayudar a una persona a reconocer una ubicación guardada. Mapora consulta Photon/OpenStreetMap para encontrar información cercana; no identifica necesariamente una puerta o un predio exacto.",
      },
      {
        title: "El punto original y la coincidencia",
        text: "Envía lat y lng; también se admite lon como nombre alternativo de la longitud. latitude y longitude en la respuesta conservan el punto solicitado. Cuando existe una coincidencia, matchedLatitude y matchedLongitude describen el punto del proveedor utilizado como referencia. Esta distinción evita que una búsqueda de dirección mueva silenciosamente una ubicación elegida por tu usuario.",
      },
      {
        title: "Datos disponibles y casos sin cobertura",
        text: "La respuesta normalizada puede incluir placeName, address, streetAddress, ciudad, región y país, según los datos disponibles. La cobertura puede ser incompleta o distinta entre zonas. Si el proveedor no encuentra una dirección o no responde a tiempo, el endpoint devuelve un error; tu interfaz debe poder conservar las coordenadas y ofrecer reintentar. Para un enlace de Google Maps con dirección opcional, utiliza el flujo de resolución de enlaces.",
      },
      {
        title: "Consumo y caché",
        text: "Las peticiones admitidas consumen una unidad del plan, incluidas las respuestas desde caché y los errores del proveedor. Una consulta repetida puede aprovechar la caché, pero eso no cambia su contabilización. No uses esta operación para validar domicilios, comprobar presencia física ni sustituir la confirmación de una persona cuando tu proceso requiera precisión adicional.",
      },
    ],
  },
  "/mapas-interactivos": {
    title: "API de mapas interactivos para tu web | Mapora",
    description:
      "Genera mapas con marcadores, zoom y pantalla completa. Mapora devuelve un enlace y un iframe para insertar la ubicación en tu web sin publicar la API key.",
    heading: "Tu ubicación, dentro de un mapa interactivo.",
    summary:
      "Convierte unas coordenadas en una vista que puedes abrir, compartir o insertar en otra aplicación con un iframe.",
    navTitle: "Mapas interactivos",
    operation: "POST /v1/maps",
    scope: "maps",
    code: `curl "https://api.mapora.dev/v1/maps" \\\n  -H "X-API-Key: TU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Mi ubicación","center":{"latitude":-12.119906,"longitude":-77.028971},"zoom":14}'`,
    sections: [
      {
        title: "Qué incluye el visor",
        text: "El visor de Mapora utiliza MapLibre y cartografía vectorial de América de OpenStreetMap/Protomaps alojada por Mapora. Permite acercar, alejar, desplazarse, volver a las ubicaciones y abrir pantalla completa cuando el navegador lo admite. Puedes enviar hasta 200 marcadores con latitude, longitude y label. Los controles funcionan con teclado y el movimiento reducido se respeta automáticamente.",
      },
      {
        title: "Cómo insertarlo en otra web",
        text: "El endpoint devuelve url, embedHtml, expiresAt y la especificación normalizada del mapa. Utiliza url para abrir una vista independiente o copia embedHtml en la página que debe mostrarla. También puedes generarlo visualmente desde la sección Mapas del panel. La clave necesita el permiso maps; las claves antiguas conservan sus permisos y no adquieren esta operación automáticamente.",
      },
      {
        title: "Un enlace de lectura, sin compartir la clave",
        text: "La URL contiene un token de lectura para ese mapa, no tu API key. Cualquier persona que tenga el enlace puede ver la ubicación: compártelo solo cuando ese alcance sea apropiado. El enlace dura 7 días por defecto; expiresIn permite configurar de 60 segundos a 30 días. Revocar la clave que lo creó o suspender la cuenta impide cargar sus mapas. Una vista ya cargada en un navegador no se borra de ese dispositivo.",
      },
      {
        title: "Peticiones y límites de la cartografía",
        text: "Generar un mapa consume una petición autenticada admitida. Abrir el visor, moverlo y hacer zoom no añade peticiones al consumo de Mapora. Los mosaicos, fuentes e iconos cartográficos se sirven mediante Mapora. La API admite estilos claro, oscuro y escala de grises, color de marca, agrupación de marcadores, polígonos y geometrías de rutas. No incluye imágenes satelitales, mapas sin conexión ni descarga masiva de la cartografía.",
      },
    ],
  },
  "/legal": {
    title: "Condiciones de servicio y privacidad | Mapora",
    description:
      "Consulta las condiciones de Mapora: cuentas, API keys, planes por peticiones, suscripciones, mapas compartidos, privacidad y proveedores de datos geográficos.",
  },
};
Object.assign(pages, {
  "/api-lugares": {
    "title": "API de lugares y negocios en América | Mapora",
    "description": "Busca negocios y servicios por categoría, radio o polígono. Fichas OSM, contactos disponibles, exportación CSV y paradas durante rutas con Mapora.",
    "heading": "Una API para descubrir lugares.",
    "summary": "Encuentra negocios y servicios en América y utiliza sus datos en buscadores, directorios y experiencias de entrega.",
    "navTitle": "Catálogo de lugares",
    "scope": "places",
    "operation": "GET /v1/places?lat=-12.12&lng=-77.03&radius=3000&category=pharmacy",
    "code": "curl \"https://api.mapora.dev/v1/places?lat=-12.12&lng=-77.03&radius=3000&category=pharmacy\" \\\n  -H \"X-API-Key: TU_API_KEY\"",
    "sections": [
      {
        "title": "Del punto al negocio",
        "text": "Busca con un centro y radio, una caja geográfica o un nombre. Filtra categorías como farmacias, restaurantes, hoteles o supermercados. Cada resultado incluye identificador OSM, nombre, categoría, coordenadas y atribución. Los datos de dirección y contacto dependen de lo publicado en OpenStreetMap."
      },
      {
        "title": "Fichas y exportación",
        "text": "Consulta GET /v1/places/details con el identificador de un resultado. Teléfono, web, correo y horarios se incluyen únicamente cuando existen en el origen. GET /v1/places/export devuelve una página CSV; utiliza X-Has-More y X-Next-Offset para recorrerla. No hay reseñas, puntuaciones ni fotografías de Google."
      },
      {
        "title": "Áreas y paradas de camino",
        "text": "POST /v1/places/area filtra puntos dentro de un polígono GeoJSON y respeta sus huecos. POST /v1/places/along-route compara lugares por el tiempo adicional de desvío entre dos puntos. Su selección tiene límites de candidatos: revisa truncated y hasMore antes de describirla como completa."
      },
      {
        "title": "Qué representa la cobertura",
        "text": "El catálogo corresponde a un snapshot de América. dataset.builtAt indica cuándo se construyó, no cuándo se verificó cada negocio. Los centros de vías OSM son referencias, no entradas comprobadas. countrycodes y city dependen de etiquetas de dirección; para delimitar un territorio utiliza coordenadas o un polígono."
      }
    ]
  },
  "/api-rutas": {
    "title": "API de rutas y optimización de paradas | Mapora",
    "description": "Calcula rutas a pie, en auto o bicicleta en América. Geometría GeoJSON y polyline6, matrices de tiempos y orden de paradas con Mapora.",
    "heading": "Conecta destinos con rutas.",
    "summary": "Calcula recorridos por calles y compara tiempos para organizar entregas, visitas o desplazamientos en América.",
    "navTitle": "Rutas y paradas",
    "scope": "routing",
    "operation": "POST /v1/routes",
    "code": "curl \"https://api.mapora.dev/v1/routes\" \\\n  -H \"X-API-Key: TU_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"locations\":[{\"latitude\":-12.1199,\"longitude\":-77.029},{\"latitude\":-12.125,\"longitude\":-77.032}],\"profile\":\"walking\"}'",
    "sections": [
      {
        "title": "Rutas para tres formas de viajar",
        "text": "Utiliza driving, walking o cycling. Mapora devuelve distancia, duración estimada, geometría y maniobras cuando el motor encuentra un recorrido. La cobertura depende de la red vial disponible en América y no incorpora tráfico en vivo. Un recorrido calculado no acredita que una persona haya viajado por él."
      },
      {
        "title": "GeoJSON y polylines",
        "text": "La respuesta incluye geometría LineString y polyline con polylinePrecision igual a 6. Al decodificar la cadena utiliza precisión de seis decimales. Conserva las ubicaciones originales y distingue el ajuste que realiza la red vial para calcular el trayecto."
      },
      {
        "title": "Orden de paradas y matrices",
        "text": "POST /v1/routes/optimize conserva origen y destino y organiza las paradas intermedias. waypointOrder hace referencia a los índices originales. POST /v1/matrix compara fuentes y destinos por tiempo y distancia. No prometas el óptimo global ni incluyas tiempos de servicio que no has modelado."
      },
      {
        "title": "De un trayecto a una parada útil",
        "text": "Combina una ruta con el catálogo para encontrar farmacias, combustible o servicios durante el viaje. Los candidatos se ordenan por desvío estimado y tienen límites publicados. Consulta el contrato completo para manejar trayectos no disponibles y resultados truncados."
      }
    ]
  },
  "/api-isocronas": {
    "title": "API de isócronas y áreas alcanzables | Mapora",
    "description": "Visualiza hasta dónde se puede llegar en auto, bicicleta o a pie en América. Isócronas por minutos para ubicaciones y zonas de servicio con Mapora.",
    "heading": "Hasta dónde llegas en minutos.",
    "summary": "Compara áreas alcanzables por las calles disponibles, en lugar de tratar una distancia circular como tiempo real de viaje.",
    "navTitle": "Áreas alcanzables",
    "scope": "routing",
    "operation": "POST /v1/isochrones",
    "code": "curl \"https://api.mapora.dev/v1/isochrones\" \\\n  -H \"X-API-Key: TU_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"center\":{\"latitude\":-12.1199,\"longitude\":-77.029},\"minutes\":[5,10,15],\"profile\":\"walking\"}'",
    "sections": [
      {
        "title": "Un área basada en el recorrido",
        "text": "Una isócrona delimita un alcance estimado para un tiempo de viaje. Puede ayudar a estudiar el entorno de una tienda o comparar ubicaciones. No es una garantía de entrega: depende del motor, la red vial y el perfil elegido, sin tráfico en vivo."
      },
      {
        "title": "De minutos a polígonos",
        "text": "Envía un centro, perfil y entre uno y cuatro contornos de minutos distintos, de 1 a 120. La respuesta incluye una FeatureCollection GeoJSON con Polygon o MultiPolygon. Lee la propiedad de cada contorno y utiliza la geometría para dibujar o analizar el área."
      },
      {
        "title": "Isócronas y zonas de cobertura",
        "text": "La isócrona calcula alcance por tiempo. Una zona de cobertura define una regla de negocio que tu aplicación conserva. Puedes combinar ambas, pero mantén separadas la estimación del motor y la política de atención que aplicas a tus usuarios."
      },
      {
        "title": "Integra la visualización",
        "text": "El panel Lugares y recorridos permite probar áreas de 5, 10 y 15 minutos. En tu aplicación utiliza las geometrías devueltas en el visor o SDK, conserva la atribución de datos y comunica el perfil y la ausencia de tráfico en vivo."
      }
    ]
  },
  "/api-ajuste-gps": {
    "title": "API de ajuste GPS a calles | Mapora",
    "description": "Relaciona puntos GPS con la red vial de América. Recorrido original, geometría ajustada, polyline6 e indicadores de confianza con Mapora.",
    "heading": "Del GPS al recorrido probable.",
    "summary": "Interpreta una secuencia de observaciones GPS y conserva la diferencia entre los puntos medidos y el camino inferido.",
    "navTitle": "Ajuste de GPS",
    "scope": "routing",
    "operation": "POST /v1/match",
    "code": "curl \"https://api.mapora.dev/v1/match\" \\\n  -H \"X-API-Key: TU_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"locations\":[{\"latitude\":-12.1199,\"longitude\":-77.029},{\"latitude\":-12.1225,\"longitude\":-77.0305},{\"latitude\":-12.125,\"longitude\":-77.032}],\"profile\":\"walking\"}'",
    "sections": [
      {
        "title": "Qué hace el ajuste de GPS",
        "text": "El map matching relaciona observaciones con segmentos de la red vial. Puede ayudar a representar recorridos con ruido de posición. El resultado es una inferencia del motor y no verifica presencia, identidad, velocidad real ni desplazamiento de una persona."
      },
      {
        "title": "Puntos originales y confianza",
        "text": "La respuesta conserva las observaciones y añade geometría ajustada, segmentos e indicadores de confianza. Guarda el original junto a la inferencia para que puedan revisarse. No sustituyas automáticamente los registros originales por un trazado aparentemente más limpio."
      },
      {
        "title": "Límites de una consulta",
        "text": "Se admiten entre 2 y 2.000 puntos y una longitud acumulada máxima de 200 kilómetros. El perfil debe corresponder al tipo de recorrido. Los huecos de cobertura o puntos lejanos a la red pueden impedir el ajuste. Consulta los errores del contrato antes de reintentar."
      },
      {
        "title": "Privacidad de los recorridos",
        "text": "Una secuencia GPS puede contener ubicaciones personales. Envía solo los datos que estás autorizado a procesar, protege tu API key en el servidor y define tu política de conservación. Evita compartir mapas que expongan un recorrido privado a quien tenga el enlace."
      }
    ]
  },
  "/alternativa-google-maps-api": {
    "title": "Alternativa a Google Maps API para América | Mapora",
    "description": "Conoce Mapora como alternativa para mapas, lugares, geocodificación y rutas en América. Datos OSM, SDK React, MCP y planes por peticiones.",
    "heading": "Una alternativa para construir con mapas.",
    "summary": "Mapora reúne datos y funciones geográficas para productos que atienden América: encuentra lugares, calcula rutas y muestra el resultado en tu aplicación.",
    "navTitle": "Alternativa a Google Maps API",
    "scope": "search",
    "operation": "GET /v1/search?q=Lima&countrycodes=PE",
    "code": "curl \"https://api.mapora.dev/v1/search?q=Lima&countrycodes=PE\" \\\n  -H \"X-API-Key: TU_API_KEY\"",
    "sections": [
      {
        "title": "Cuándo considerar Mapora",
        "text": "Si tu producto necesita direcciones, negocios y servicios, geocodificación inversa o rutas en América, puedes evaluar Mapora con tu propia muestra de ubicaciones. Prueba datos y cobertura en las ciudades que atiendes antes de migrar. La fuente y precisión de cada resultado importan más que una comparación genérica de cantidad de funciones."
      },
      {
        "title": "Lo que puedes integrar",
        "text": "La API incluye autocompletado, búsqueda por país y ciudad, cercanos por distancia o tiempo, catálogo OSM con fichas y CSV, consultas por polígonos y lugares durante rutas. Añade matrices, orden de paradas, isócronas, ajuste GPS y mapas con marcadores, polígonos y recorridos. El SDK React y el MCP facilitan su uso desde aplicaciones y asistentes."
      },
      {
        "title": "Diferencias que debes evaluar",
        "text": "Mapora utiliza sus propios motores y datos de OpenStreetMap y Protomaps. No ofrece reseñas, puntuaciones o fotos de Google, tráfico en vivo, imágenes satelitales ni cobertura de soporte fuera de América. Los horarios y contactos dependen de lo publicado en OSM; una dirección no verifica automáticamente su número de puerta."
      },
      {
        "title": "Cómo plantear una migración",
        "text": "No es un reemplazo con el mismo contrato de Google Maps Platform. Define qué operaciones consume tu aplicación, adapta sus respuestas al contrato de Mapora y revisa coordenadas, errores, atribución y límites. Mantén la clave privada en el backend o utiliza una clave de navegador con orígenes exactos cuando la operación lo permita."
      },
      {
        "title": "Empieza con una prueba real",
        "text": "El plan Free incluye 1.000 peticiones al mes. Cada petición autenticada admitida cuenta una unidad, también desde caché o si el proveedor devuelve un error. No hay cargos automáticos por excedentes. Consulta los planes vigentes en la landing y usa el panel para observar el consumo de tu integración."
      }
    ]
  }
});
export const guides = Object.entries(pages).filter(([, p]) => p.operation);
export const notFound = {
  title: "Página no encontrada | Mapora",
  description:
    "Esta página no existe. Explora la API de mapas y la documentación de Mapora.",
};
