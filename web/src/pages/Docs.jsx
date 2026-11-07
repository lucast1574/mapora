import React, { useState } from "react";
import { Play, ArrowUpRight } from "lucide-react";
import { api, appURL } from "../client";
import { Button, Notice, Select } from "../ui";
import ExpansionDocs from "./ExpansionDocs";
export default function Docs({ heading = "De la dirección al dato" }) {
  const [operation, setOperation] = useState("search"),
    [key, setKey] = useState(""),
    [input, setInput] = useState("Miraflores"),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let path, body;
      if (operation === "search")
        path = "/v1/search?" + new URLSearchParams({ q: input, limit: "5" });
      else if (operation === "reverse") {
        const [lat, lng] = input.split(",").map((v) => v.trim());
        path = "/v1/reverse?" + new URLSearchParams({ lat, lng });
      } else {
        path = "/v1/resolve";
        body = { url: input };
      }
      setResult(
        await api(path, body ? "POST" : "GET", body, { "X-API-Key": key }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{heading}</h1>
          <p>Integra una operación y prueba una petición real.</p>
        </div>
        <a
          href="/openapi.json"
          className="text-link"
          target="_blank"
          rel="noreferrer"
        >
          OpenAPI
          <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="docs-intro">
        <h2>Una clave en cada petición</h2>
        <p>
          Base URL: <code>https://maps-api.nexode.app</code>
        </p>
        <pre>{`curl "https://maps-api.nexode.app/v1/search?q=Miraflores" \\\n  -H "X-API-Key: TU_API_KEY"`}</pre>
        <p>
          También se admite <code>Authorization: Bearer TU_API_KEY</code>. No
          envíes la clave en la URL ni la guardes en un repositorio público.
        </p>
      </div>
      <div className="docs-operations">
        {[
          [
            "GET",
            "/v1/search",
            "q, countrycodes, lat, lng, limit, bbox",
            "Busca direcciones y lugares. limit acepta de 1 a 20 resultados.",
          ],
          [
            "GET",
            "/v1/reverse",
            "lat, lng (o lon)",
            "Obtiene una referencia cercana. Conserva las coordenadas solicitadas.",
          ],
          [
            "POST",
            "/v1/resolve",
            "url, includeAddress",
            "Resuelve un enlace de Google Maps. includeAddress:false omite la consulta de dirección.",
          ],
          [
            "POST",
            "/v1/maps",
            "center, markers, title, zoom, expiresIn",
            "Genera un enlace y un iframe para mostrar un mapa interactivo. Requiere el permiso maps.",
          ],
        ].map(([method, path, params, description]) => (
          <article key={path}>
            <div>
              <span className="method">{method}</span>
              <code>{path}</code>
            </div>
            <p>{description}</p>
            <small>Parámetros: {params}</small>
          </article>
        ))}
      </div>
      <div className="playground">
        <div>
          <h2>Prueba tu integración</h2>
          <p>
            Utiliza tu propia API key. Cada ejecución cuenta como una petición
            de tu plan.
          </p>
          <form onSubmit={run}>
            <label>
              Operación
              <Select
                value={operation}
                onChange={(v) => {
                  setOperation(v);
                  setInput(
                    v === "search"
                      ? "Miraflores"
                      : v === "reverse"
                        ? "-12.12, -77.03"
                        : "https://www.google.com/maps?q=-12.0453,-77.0309",
                  );
                }}
                label="Operación"
                options={[
                  { value: "search", label: "Buscar dirección" },
                  { value: "reverse", label: "Dirección desde coordenadas" },
                  { value: "resolve", label: "Resolver enlace de Google Maps" },
                ]}
              />
            </label>
            <label>
              Tu API key
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="mp_live_…"
                required
                autoComplete="off"
              />
            </label>
            <label>
              {operation === "search"
                ? "Dirección o lugar"
                : operation === "reverse"
                  ? "Latitud, longitud"
                  : "Enlace de Google Maps"}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
              />
            </label>
            <Button busy={busy}>
              <Play size={16} />
              Enviar petición real
            </Button>
          </form>
        </div>
        <div className="playground-response">
          <span>Respuesta</span>
          <Notice error>{error}</Notice>
          <pre>
            {result
              ? JSON.stringify(result, null, 2)
              : "La respuesta de tu petición aparecerá aquí."}
          </pre>
        </div>
      </div>
      <div className="docs-notes">
        <h2>Mapas con interfaz gráfica</h2>
        <p>
          Con el permiso <code>maps</code>, llama a <code>POST /v1/maps</code>{" "}
          para obtener un enlace y un <code>embedHtml</code> listo para
          insertar. También puedes{" "}
          <a href={`${appURL}/app/maps`}>generarlo desde el panel</a>.
        </p>
        <pre>{`curl "https://maps-api.nexode.app/v1/maps" \\\n  -H "X-API-Key: TU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Mi ubicación","center":{"latitude":-12.119906,"longitude":-77.028971},"zoom":14,"expiresIn":604800}'`}</pre>
        <p>
          El visor permite zoom, desplazamiento, pantalla completa y hasta 200{" "}
          <code>markers</code> con <code>latitude</code>, <code>longitude</code>{" "}
          y <code>label</code>. El centro conserva las coordenadas enviadas. El
          enlace caduca en 7 días por defecto; <code>expiresIn</code> acepta
          entre 60 segundos y 30 días. Si omites el centro, se toma el primer
          marcador.
        </p>
        <p>
          Generar el mapa consume una petición; sus visualizaciones y los
          mosaicos cartográficos no suman peticiones a Mapora. Quien recibe el
          enlace puede ver ese mapa, pero no obtiene la API key. Revocar la
          clave o suspender la cuenta invalida sus enlaces. El fondo usa los
          mosaicos públicos de OpenStreetMap, con disponibilidad limitada; no
          incluye uso sin conexión ni descarga masiva.
        </p>
        <h2>Cuotas, respuestas y datos</h2>
        <p>
          Las cabeceras <code>X-Quota-Limit</code>,{" "}
          <code>X-Quota-Remaining</code> y <code>X-Quota-Reset</code> indican el
          estado de tu cuota. HTTP 401 identifica una clave ausente o inválida;
          403, un permiso faltante; 429, cuota o velocidad excedida. Respeta{" "}
          <code>Retry-After</code>.
        </p>
        <p>
          La resolución puede devolver coordenadas con{" "}
          <code>addressStatus: unavailable</code> si el proveedor no responde.
          No lo interpretes como una dirección verificada. Los errores del
          proveedor también cuentan como peticiones admitidas por tu clave.
        </p>
        <p>
          Muestra la atribución{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors
          </a>{" "}
          junto a los resultados. Photon/OpenStreetMap aporta los datos de
          búsqueda; Google Maps aporta el enlace y el pin seleccionado. Mapora
          no es Google Places.
        </p>
      </div>
      <ExpansionDocs/>
    </>
  );
}
