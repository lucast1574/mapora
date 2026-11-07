export const siteOrigin = "https://mapora.nexode.app";
export const pages = {
  "/": {
    title: "Mapora | API de mapas, direcciones y geocodificación",
    description:
      "Integra búsqueda mundial, autocompletado, rutas por calles en América, matrices, zonas y mapas. API keys y planes por peticiones, con un plan gratuito.",
  },
  "/documentacion": {
    title: "Documentación de la API de mapas | Mapora",
    description:
      "Referencia de Mapora: direcciones, filtros por país y ciudad, lotes, cobertura, rutas, matrices, mapas y SDK. Ejemplos, claves, cuotas y probador de API.",
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
    code: `curl "https://maps-api.nexode.app/v1/search?q=Miraflores&countrycodes=pe&limit=5" \\\n  -H "X-API-Key: TU_API_KEY"`,
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
        text: "countrycodes=PE restringe a Perú; puedes enviar hasta diez países separados por comas. Para buscar por componentes separados usa GET /v1/geocode con street, housenumber, city, district, state, county o postcode. En búsqueda libre y autocompletado, lat/lng prioriza cercanía y bbox acota un rectángulo minLng,minLat,maxLng,maxLat; no existe un filtro city independiente en esos endpoints. El campo city de geocode forma parte de la consulta y no garantiza un límite administrativo.",
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
    code: `curl "https://maps-api.nexode.app/v1/resolve" \\\n  -H "X-API-Key: TU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://www.google.com/maps?q=-12.0453,-77.0309","includeAddress":false}'`,
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
    code: `curl "https://maps-api.nexode.app/v1/reverse?lat=-12.119906&lng=-77.028971" \\\n  -H "X-API-Key: TU_API_KEY"`,
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
    code: `curl "https://maps-api.nexode.app/v1/maps" \\\n  -H "X-API-Key: TU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Mi ubicación","center":{"latitude":-12.119906,"longitude":-77.028971},"zoom":14}'`,
    sections: [
      {
        title: "Qué incluye el visor",
        text: "El visor de Mapora utiliza MapLibre y cartografía vectorial mundial de OpenStreetMap/Protomaps alojada por Mapora. Permite acercar, alejar, desplazarse, volver a las ubicaciones y abrir pantalla completa cuando el navegador lo admite. Puedes enviar hasta 200 marcadores con latitude, longitude y label. Los controles funcionan con teclado y el movimiento reducido se respeta automáticamente.",
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
export const guides = Object.entries(pages).filter(([, p]) => p.operation);
export const notFound = {
  title: "Página no encontrada | Mapora",
  description:
    "Esta página no existe. Explora la API de mapas y la documentación de Mapora.",
};
