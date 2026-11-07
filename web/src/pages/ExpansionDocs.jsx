import React from "react";
import { appURL } from "../client";

export default function ExpansionDocs() {
  return (
    <>
      <section className="docs-section" id="docs-guias-rutas">
        <h2>Rutas por calles en América</h2>
        <p>La búsqueda y la cartografía cubren el mundo. El motor de rutas y matrices cubre América: Sudamérica, Centroamérica, Caribe, México, Estados Unidos y Canadá, según las vías disponibles para el perfil. Europa queda fuera de la cobertura de rutas actual.</p>
        <p>Envía las paradas en orden a <code>POST /v1/routes</code>. La respuesta incluye geometría GeoJSON, distancia en metros, duración estimada en segundos e instrucciones en español. <code>locations</code> conserva tus coordenadas; <code>snappedLocations</code> identifica los puntos sobre la vía. Los índices <code>beginShapeIndex</code> y <code>endShapeIndex</code> de cada instrucción apuntan a la geometría completa; <code>legIndex</code> identifica el tramo.</p>
        <p>Para comparar destinos usa <code>POST /v1/matrix</code>: cada fila corresponde a un origen y cada columna a un destino. <code>null</code> significa que no hay conexión para ese par. La cobertura de un país no implica que exista un trayecto entre países o islas.</p>
        <div className="table-scroll"><table><caption>Límites de distancia del motor</caption><thead><tr><th>Perfil</th><th>Ruta: 2–10 puntos</th><th>Matriz: hasta 10 × 10 pares</th></tr></thead><tbody><tr><td>driving</td><td>5000 km</td><td>400 km</td></tr><tr><td>walking</td><td>250 km</td><td>200 km</td></tr><tr><td>cycling</td><td>500 km</td><td>200 km</td></tr></tbody></table></div>
        <p>No incluye tráfico en tiempo real, transporte público, elevación ni planificación por hora de salida. Un trayecto fuera del índice o inaccesible devuelve <code>422 route_not_found</code>, sin inventar una línea recta. Puedes consumir toda la respuesta como JSON, sin mostrar un mapa.</p>
      </section>
      <section className="docs-section" id="docs-guias-mapas">
        <h2>Mapas de tu marca, cuando los necesites</h2>
        <p><code>POST /v1/maps</code> devuelve <code>url</code>, <code>embedHtml</code>, <code>expiresAt</code> y la especificación del mapa. Abre el enlace o inserta el iframe. También puedes <a href={`${appURL}/app/maps`}>crear el mapa desde el panel</a>.</p>
        <p>Admite estilos <code>light</code>, <code>dark</code> y <code>grayscale</code>, color <code>accent</code>, hasta 200 marcadores agrupados automáticamente, 10 polígonos y una ruta <code>LineString</code> de hasta 10000 puntos. GeoJSON usa <code>[longitud, latitud]</code>; los objetos de ubicación usan <code>{"{ latitude, longitude }"}</code>.</p>
        <h3>Mostrar una ruta calculada</h3>
        <p>Desde tu backend, conserva la geometría de rutas y pásala al campo <code>route</code> del mapa. Son dos operaciones admitidas y consumen dos peticiones. Una geometría de más de 10000 puntos debe simplificarse antes de enviarla al visor.</p>
        <pre>{`// Backend: API_KEY es privada; no la incluyas en el frontend.
async function postMapora(path, body) {
  const response = await fetch('https://maps-api.nexode.app' + path, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
const points = [
  { latitude: -12.1199, longitude: -77.029 },
  { latitude: -12.122, longitude: -77.034 }
];
const route = await postMapora('/v1/routes', {
  locations: points, profile: 'driving'
});
const map = await postMapora('/v1/maps', {
  title: 'Mi recorrido', center: points[0], markers: points,
  route: route.geometry, theme: 'light', accent: '#174c43'
});
// Devuelve map.url o map.embedHtml a tu aplicación.`}</pre>
        <p>Quien recibe el enlace puede ver ese mapa, sin conocer tu API key. El token solo autoriza la lectura de esa vista y su cartografía. El enlace caduca en 7 días por defecto, configurable de 60 segundos a 30 días. La caducidad, revocar la clave creadora o suspender la cuenta impide nuevas lecturas; no borra una vista ya cargada en otro navegador.</p>
        <p>Crear el mapa consume una petición. Abrirlo, moverlo, hacer zoom y cargar mosaicos no añade peticiones geográficas. La cartografía vectorial mundial usa datos de OpenStreetMap y Protomaps. No incluye imágenes satelitales, descarga masiva ni uso sin conexión.</p>
      </section>
      <section className="docs-section" id="docs-sdk">
        <h2>React y JavaScript</h2>
        <p><a href="/downloads/mapora-react-2.0.0.tgz" download>Descargar React 2.0.0</a> · <a href="/downloads/mapora-client.js" download>Descargar cliente JavaScript</a>. El paquete React se instala desde el archivo; no está publicado en el registro público de npm. Requiere React 19 y un bundler compatible; el mapa necesita WebGL.</p>
        <pre>{`npm install ./mapora-react-2.0.0.tgz`}</pre>
        <h3>Solo buscador, sin mapa</h3>
        <pre>{`import { MaporaAddressSearch } from '@mapora/react';
import '@mapora/react/style.css';

<MaporaAddressSearch
  apiKey="mp_pub_TU_CLAVE_DE_NAVEGADOR"
  country="PE"
  bias={{ latitude: -12.12, longitude: -77.03 }}
  onQueryChange={() => invalidarSeleccionAnterior()}
  onSelect={(location) => guardarDireccion(location)}
/>`}</pre>
        <p><code>country</code> es opcional y limita el país; <code>bias</code> prioriza una zona. El componente gestiona sugerencias, espera de 350 ms desde tres caracteres, cancelación y navegación por teclado. Invalida la selección anterior al editar el texto antes de enviar una ruta o comprobar cobertura.</p>
        <h3>Buscador con pin ajustable</h3>
        <pre>{`import { MaporaLocationPicker } from '@mapora/react';
import '@mapora/react/style.css';

<MaporaLocationPicker
  apiKey="mp_pub_TU_CLAVE_DE_NAVEGADOR"
  baseURL="https://maps-api.nexode.app"
  country="PE"
  theme="light"
  accent="#174c43"
  initialCenter={{ latitude: -12.12, longitude: -77.03 }}
  onSelect={(location) => guardarDireccion(location)}
/>`}</pre>
        <p>Usa una clave de navegador con <code>search</code> y <code>reverse</code> y registra el origen exacto de tu web. Omite <code>country</code> para búsqueda mundial. Puedes cambiar <code>theme</code>, <code>accent</code>, <code>className</code> y <code>style</code>. <code>onSelect</code> puede recibir primero el pin y luego su referencia de dirección: conserva siempre las coordenadas elegidas. Incluye declaraciones TypeScript y un worker empaquetado para el mapa.</p>
        <h3>Cliente JavaScript para los endpoints</h3>
        <pre>{`// Guarda el archivo descargado en tu proyecto.
import { Mapora } from './mapora-client.js';
const maps = new Mapora({ apiKey: API_KEY });
const results = await maps.geocode({
  street: 'Avenida Larco', city: 'Lima', countrycodes: 'PE'
});`}</pre>
        <p>El cliente expone <code>search</code>, <code>autocomplete</code>, <code>geocode</code>, <code>reverse</code>, <code>nearby</code>, <code>resolve</code>, <code>batch</code>, <code>coverage</code>, <code>checkCoverage</code>, <code>routes</code>, <code>matrix</code> y <code>map</code>. Usa claves privadas solo en servidor; en navegador se aplican las restricciones de <code>mp_pub_</code>. Los errores HTTP incluyen <code>status</code>, <code>code</code> y <code>retryAfter</code>.</p>
      </section>
      <section className="docs-section" id="docs-cuotas">
        <h2>Consumo, cuotas y errores</h2>
        <p>Una petición HTTP autenticada admitida equivale a una unidad, también desde caché o si devuelve un error de validación o proveedor. Un lote de hasta 10 direcciones cuenta como una petición; una matriz de hasta 100 pares también. Cada consulta de autocompletado o inversa cuenta por separado. Cancelar un fetch no garantiza que el servidor no lo haya admitido.</p>
        <p>Los rechazos por clave, permiso, origen o cuota no consumen unidades. Las visualizaciones de mapas, cartografía, descargas del SDK y consultas de estado no añaden peticiones geográficas. Scale elimina la cuota mensual, pero conserva el límite por minuto y las protecciones del servicio. Consulta los límites vigentes en Plan y facturación; no hay cobros automáticos por excedentes.</p>
        <p>Las cabeceras <code>X-Quota-Limit</code>, <code>X-Quota-Remaining</code> y <code>X-Quota-Reset</code> muestran la cuota. Respeta <code>Retry-After</code> al recibir 429. Algunas respuestas incluyen <code>cached</code>, <code>tookMs</code> y <code>X-Cache</code>; la caché no cambia el consumo.</p>
        <div className="table-scroll"><table><caption>Cómo tratar las respuestas HTTP</caption><thead><tr><th>Estado</th><th>Significado</th><th>Qué hacer</th></tr></thead><tbody>
          {[["200 / 201", "Consulta correcta / mapa creado", "Lee la respuesta y, en lotes, el status de cada fila."], ["400", "Entrada inválida", "Revisa coordenadas, campos, JSON y límites del endpoint."], ["401", "Clave ausente, inválida o revocada", "Comprueba tu API key."], ["403", "Permiso, origen o tipo de clave no permitido; cuenta suspendida", "Revisa permisos y orígenes en API keys."], ["405", "Método HTTP incorrecto", "Usa el método documentado."], ["422", "No se encontró una ruta transitable", "Conserva los puntos; ofrece otro perfil o destino, sin inventar una línea."], ["429", "Cuota o velocidad excedida", "Respeta Retry-After y consulta tu plan."], ["502 / 503", "Proveedor o servicio no disponible", "Conserva los datos de entrada y permite reintentar con espera."]].map(([code, meaning, action]) => <tr key={code}><td>{code}</td><td>{meaning}</td><td>{action}</td></tr>)}
        </tbody></table></div>
        <p>Los errores JSON tienen <code>{'{ "code": "…", "error": "…" }'}</code>. Usa <code>code</code> para decidir el comportamiento; el mensaje es legible para personas. No sustituyas una dirección no disponible por una dirección verificada.</p>
        <h3>Estado del servicio</h3>
        <p><code>GET /health</code> comprueba el proceso. <code>GET /status</code> devuelve el estado de búsqueda, cartografía, rutas y base de datos, con caché de hasta un minuto y cobertura actual. No requieren clave ni son un historial de disponibilidad. Consulta también el <a href="/service-status">estado visual de los motores</a>.</p>
      </section>
      <section className="docs-section" id="docs-panel">
        <h2>Del panel a tu integración</h2>
        <dl className="docs-workflows">
          <div><dt>API keys</dt><dd>Crea claves por proyecto, elige permisos y registra orígenes para navegador. Guarda la clave completa al crearla; revócala cuando deje de usarse. Hasta diez claves activas por cuenta.</dd></div>
          <div><dt>Explorar</dt><dd>Busca por país, confirma una dirección o ajusta un pin. Consulta lugares cercanos y prueba rutas en auto, bicicleta o a pie con tu propia clave.</dd></div>
          <div><dt>Mapas</dt><dd>Genera un enlace o iframe con ubicación, marcadores, tema y color de marca. Para geometrías avanzadas usa la API de mapas.</dd></div>
          <div><dt>Zonas de cobertura</dt><dd>Crea, edita y elimina hasta 50 polígonos de tu cuenta. Copia sus identificadores para /v1/coverage/check. Las tarifas en centavos describen tu zona y no generan cobros.</dd></div>
          <div><dt>Importar direcciones</dt><dd>Procesa un CSV de hasta 1000 filas y 1 MB, en lotes de 10. Usa la plantilla del panel, revisa el resultado por fila y descarga los resultados. El archivo no se guarda; cada lote admitido consume una petición.</dd></div>
          <div><dt>Consumo y facturación</dt><dd>Consulta peticiones por operación, estado y latencia. Los registros de consumo no guardan direcciones, coordenadas ni cuerpos de las consultas. Gestiona plan, facturas y suscripción de Stripe desde Plan y facturación.</dd></div>
          <div><dt>Mi perfil</dt><dd>Gestiona tu cuenta y cierra sesión. Las herramientas del panel usan tu sesión; la API geográfica usa API keys. No son credenciales intercambiables.</dd></div>
        </dl>
        <p>La documentación del sitio y del panel comparte esta misma referencia. La especificación <a href="/openapi.json">OpenAPI 3.1</a> contiene los esquemas de petición y respuesta para generar clientes.</p>
      </section>
    </>
  );
}
