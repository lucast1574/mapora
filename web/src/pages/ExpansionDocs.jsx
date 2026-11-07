import React from "react";
export default function ExpansionDocs() {
  return (
    <section className="docs-intro">
      <h2>Más herramientas, el mismo contrato.</h2>
      <p>
        Autocompletado y búsqueda mundial, direcciones estructuradas, cobertura,
        lotes y rutas por calles. Las claves antiguas conservan sus permisos;
        crea una nueva con las operaciones que necesites.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Operación</th>
              <th>Permiso</th>
              <th>Uso y límites</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "GET /v1/autocomplete",
                "search",
                "q, countrycodes, lat/lng, limit. Sugerencias desde 2 caracteres; el componente espera 350 ms y empieza desde 3.",
              ],
              [
                "GET /v1/geocode",
                "search",
                "street, housenumber, city, district, state, county, postcode, countrycodes. Al menos un componente.",
              ],
              [
                "GET /v1/nearby",
                "nearby",
                "lat, lng, category, radius (50–50000 metros), limit (1–20). Resultados ordenados por distancia en línea recta.",
              ],
              [
                "POST /v1/batch",
                "batch",
                "items: hasta 10 objetos con id, query y countrycodes opcional. Devuelve ok, not_found o error por fila.",
              ],
              [
                "POST /v1/coverage",
                "coverage",
                "point y hasta 20 zones con Polygon GeoJSON, name, feeCents y currency. Devuelve todas las zonas coincidentes.",
              ],
              [
                "POST /v1/coverage/check",
                "coverage",
                "point y hasta 20 zoneIds guardadas en tu cuenta. Nunca consulta zonas de otra cuenta.",
              ],
              [
                "POST /v1/routes",
                "routing",
                "locations: 2–10 puntos; profile: driving, walking o cycling. Geometría GeoJSON, distancia en metros, segundos e instrucciones.",
              ],
              [
                "POST /v1/matrix",
                "routing",
                "sources y targets: 1–10 puntos cada uno. Matrices de metros y segundos; null significa que no existe conexión.",
              ],
            ].map(([operation, scope, description]) => (
              <tr key={operation}>
                <td>
                  <code>{operation}</code>
                </td>
                <td>{scope}</td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Unidades de uso y cobertura</h3>
      <p>
        Una petición HTTP autenticada admitida consume una petición del plan,
        incluidos los lotes de hasta 10 direcciones y las matrices de hasta 100
        pares. Los límites mensuales y por minuto de tu plan se conservan. Cada
        consulta de autocompletado y de dirección inversa cuenta por separado.
        Las descargas del SDK, el estado del servicio y las visualizaciones de
        mapas no suman peticiones geográficas.
      </p>
      <p>
        La búsqueda y el fondo cartográfico tienen cobertura mundial. Las rutas
        comienzan en Latinoamérica (Sudamérica, México, Centroamérica y Caribe);
        la ampliación a toda América y Europa se activa tras validar su índice. No
        incluyen tráfico en tiempo real, transporte público, imágenes
        satelitales ni navegación sin conexión. Un trayecto fuera del índice,
        desconectado o inaccesible para el perfil devuelve route_not_found, sin
        inventar una línea recta.
      </p>
      <p>
        El motor admite rutas de hasta 5000 km en automóvil, 250 km a pie y
        500 km en bicicleta. Las matrices admiten hasta 400 km en automóvil y
        200 km a pie o en bicicleta. La cobertura no garantiza una conexión
        transitable entre dos puntos.
      </p>
      <h3>Direcciones con información sobre su precisión</h3>
      <p>
        Los resultados mantienen los campos existentes y añaden{" "}
        <code>quality.precision</code>, <code>quality.missingFields</code> y{" "}
        <code>quality.verified:false</code>. Indican los datos disponibles en la
        fuente; no certifican el domicilio. En la consulta inversa y el
        selector, guarda las coordenadas elegidas: las coordenadas matched
        describen una referencia cercana.
      </p>
      <h3>Instala el selector en React</h3>
      <p>
        <a
          className="text-link"
          href="/downloads/mapora-react-2.0.0.tgz"
          download
        >
          Descargar paquete React 2.0.0
        </a>{" "}
        ·{" "}
        <a className="text-link" href="/downloads/mapora-client.js" download>
          Descargar cliente JavaScript
        </a>
      </p>
      <pre>{`npm install ./mapora-react-2.0.0.tgz

import { MaporaLocationPicker } from '@mapora/react';
import '@mapora/react/style.css';

<MaporaLocationPicker
  apiKey="mp_pub_TU_CLAVE_DE_NAVEGADOR"
  baseURL="https://maps-api.nexode.app"
  country="PE"
  theme="light"
  onSelect={(location) => guardarDireccion(location)}
/>`}</pre>
      <p>
        El paquete se distribuye directamente como archivo, no desde el registro
        público de npm. Requiere React 19 y WebGL. Omite country para buscar en
        todo el mundo. Puedes ajustar accent con un color hexadecimal y theme
        con light, dark o grayscale.
      </p>
      <h3>Claves para navegador y servidor</h3>
      <p>
        Usa una clave privada mp_live_ en tu backend. Para React crea una clave
        mp_pub_ con los permisos search y reverse y los orígenes HTTPS exactos
        que usarán el selector. Las claves públicas son visibles a los
        visitantes; el filtro de Origin limita su reutilización desde otros
        navegadores, pero no autentica servidores. No permite crear mapas,
        ejecutar lotes, resolver enlaces, consultar cobertura ni calcular rutas.
        Sus peticiones también están sujetas a la cuota y los límites de la
        cuenta.
      </p>
      <h3>Polígonos y mapas de tu marca</h3>
      <p>
        POST /v1/maps admite theme, accent, hasta 200 markers (agrupados
        automáticamente), hasta 10 shapes de tipo Polygon y una route de tipo
        LineString de hasta 10000 puntos. Las coordenadas GeoJSON se escriben
        [longitud, latitud]. Cada polígono permite hasta 200 vértices, anillo
        exterior y hasta cuatro huecos; no debe cruzarse ni atravesar el
        antimeridiano. Los bordes exteriores cuentan como cobertura y los huecos
        quedan excluidos. Las tarifas se expresan en centavos y no generan
        cobros automáticos.
      </p>
      <p>
        Consulta el <a href="/service-status">estado de los motores</a>. Los
        registros de consumo muestran operación, estado y latencia; no guardan
        direcciones, coordenadas ni el contenido de tus peticiones.
      </p>
    </section>
  );
}
