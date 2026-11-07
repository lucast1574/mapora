import React, { useState } from "react";
import { Play, ArrowUpRight, ChevronDown } from "lucide-react";
import { api } from "../client";
import { Button, Notice, Select } from "../ui";
import { apiBase, operations, operationGroups, exampleInput, curlExample } from "../docs/operations";
import ExpansionDocs from "./ExpansionDocs";
import "../docs/docs.css";

export default function Docs({ heading = "Documentación de Mapora" }) {
  const [operationId, setOperationId] = useState("search");
  const operation = operations.find((item) => item.id === operationId);
  const [key, setKey] = useState("");
  const [input, setInput] = useState(exampleInput(operations[0]));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function choose(id) {
    if (busy) return;
    const next = operations.find((item) => item.id === id);
    setOperationId(id);
    setInput(exampleInput(next));
    setResult(null);
    setError("");
  }
  async function run(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = operation.method === "POST" ? JSON.parse(input) : undefined;
      if (operation.method === "POST" && (!body || typeof body !== "object" || Array.isArray(body)))
        throw new Error("El cuerpo debe ser un objeto JSON.");
      const query = operation.method === "GET" ? new URLSearchParams(input.replace(/^\?/, "")).toString() : "";
      setResult(await api(operation.path + (query ? "?" + query : ""), operation.method, body, { "X-API-Key": key.trim() }));
    } catch (err) {
      setError(err instanceof SyntaxError ? "El cuerpo no es JSON válido. Revisa comillas, comas y llaves." : err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="api-docs">
      <div className="page-title">
        <div><h1>{heading}</h1><p>Direcciones, lugares, cobertura, rutas y mapas. Referencia y ejemplos para cada operación.</p></div>
        <a href="/openapi.json" className="text-link" target="_blank" rel="noreferrer">OpenAPI 3.1 <ArrowUpRight size={17} /></a>
      </div>
      <nav className="docs-index" aria-label="Contenido de la documentación">
        {[["inicio", "Primeros pasos"], ["referencia", "Endpoints"], ["filtros", "País y ciudad"], ["datos", "Datos y coordenadas"], ["probar", "Probar API"], ["guias-rutas", "Rutas"], ["guias-mapas", "Mapas"], ["sdk", "React y JavaScript"], ["cuotas", "Cuotas y errores"], ["panel", "Usar el panel"]].map(([id, title]) => <a href={`#docs-${id}`} key={id}>{title}</a>)}
      </nav>
      <section className="docs-section" id="docs-inicio">
        <h2>Empieza con una petición</h2>
        <p>Base URL: <code>{apiBase}</code>. Crea una clave en API keys con los permisos que vayas a usar. Envía <code>X-API-Key</code> o <code>Authorization: Bearer TU_API_KEY</code>; nunca la clave en la URL.</p>
        <pre>{curlExample(operations[0])}</pre>
        <p><strong>No necesitas mostrar un mapa.</strong> Todos los endpoints de consulta devuelven JSON. Puedes guardar los datos desde tu backend, mostrar solo un buscador o añadir un mapa cuando tu flujo lo requiera.</p>
        <h3>Claves de servidor y de navegador</h3>
        <p><code>mp_live_</code> es una clave privada para tu backend. <code>mp_pub_</code> es una clave visible para navegador y permite únicamente <code>search</code>, <code>reverse</code> y <code>nearby</code>, según los permisos elegidos. Registra de 1 a 10 orígenes HTTPS exactos, sin rutas ni comodines; HTTP se admite solo para localhost y loopback en desarrollo.</p>
        <p>La restricción de Origin limita el uso desde otros navegadores; no autentica servidores ni convierte la clave en un secreto. Para rutas, matrices, cobertura, lotes, resolución de enlaces y creación de mapas, llama desde tu backend con una clave privada. No incluyas secretos en React ni en un repositorio público.</p>
        <p>Permisos disponibles: <code>search</code>, <code>reverse</code>, <code>resolve</code>, <code>maps</code>, <code>nearby</code>, <code>batch</code>, <code>coverage</code> y <code>routing</code>. Las claves existentes conservan sus permisos; crea una nueva si necesitas otras operaciones. La clave completa se muestra solo al crearla y puedes revocarla desde el panel.</p>
      </section>
      <section className="docs-section" id="docs-referencia">
        <h2>Referencia de endpoints</h2>
        <p>Abre una operación para consultar sus parámetros, el formato de respuesta y un ejemplo cURL. Los cuerpos POST usan <code>Content-Type: application/json</code>.</p>
        {operationGroups.map((group) => (
          <div className="docs-endpoint-group" key={group.id}>
            <h3>{group.title}</h3>
            {operations.filter((item) => item.group === group.id).map((item) => (
              <details className="docs-endpoint" id={`endpoint-${item.id}`} key={item.id}>
                <summary><span className="docs-endpoint-name"><span className="method">{item.method}</span><code>{item.path}</code><span>{item.title}</span></span><ChevronDown size={18} aria-hidden="true" /></summary>
                <div className="docs-endpoint-body">
                  <p>{item.description}</p><p>Permiso de la clave: <code>{item.scope}</code>.</p>
                  <h4>Parámetros y límites</h4><ul>{item.parameters.map((parameter) => <li key={parameter}>{parameter}</li>)}</ul>
                  <h4>Ejemplo de petición</h4><pre>{curlExample(item)}</pre>
                  <h4>Cómo leer la respuesta</h4><p>{item.response}</p>
                  <a className="text-link" href="#docs-probar" onClick={() => choose(item.id)}>Probar esta operación <ArrowUpRight size={16} /></a>
                </div>
              </details>
            ))}
          </div>
        ))}
      </section>
      <section className="docs-section" id="docs-filtros">
        <h2>Busca por país, ciudad o área</h2>
        <p><code>countrycodes=PE</code> restringe a Perú; <code>countrycodes=PE,CO</code> permite Perú y Colombia. Omite el parámetro para búsqueda mundial.</p>
        <p>Si tienes la dirección separada en campos, usa <code>/v1/geocode</code> con <code>city</code>, <code>street</code>, <code>housenumber</code> u otros componentes. <code>city</code> es un componente de la consulta estructurada, no un límite administrativo garantizado.</p>
        <pre>{`GET /v1/geocode?street=Avenida+Larco&city=Lima&countrycodes=PE

GET /v1/autocomplete?q=Avenida+Larco&countrycodes=PE&lat=-12.12&lng=-77.03

GET /v1/search?q=Avenida+Larco&countrycodes=PE&bbox=-77.10,-12.20,-76.90,-12.00`}</pre>
        <p>En búsqueda libre y autocompletado no existe un filtro <code>city</code> independiente. <code>lat/lng</code> prioriza cercanía; <code>bbox</code> acota un rectángulo en el orden <code>minLng,minLat,maxLng,maxLat</code>. Confirma el resultado antes de guardarlo.</p>
      </section>
      <section className="docs-section" id="docs-datos">
        <h2>Guarda el nombre y el punto elegido</h2>
        <p>Una ubicación puede incluir <code>placeName</code>, <code>address</code>, <code>streetAddress</code>, <code>latitude</code>, <code>longitude</code>, calle, número, distrito, ciudad, región, país y código postal. Conserva también <code>source</code>, <code>attribution</code> y el enlace original cuando tu flujo lo necesite. No todos los campos están disponibles en todos los lugares.</p>
        <p>En una consulta inversa, <code>latitude/longitude</code> son tu pin. <code>matchedLatitude/matchedLongitude</code> son la referencia cercana: no reemplaces automáticamente el pin con esa coincidencia. Al resolver un enlace, conserva también <code>addressStatus</code> y <code>resolved_url</code>.</p>
        <p><code>quality.precision</code> describe el tipo de dato disponible, <code>quality.missingFields</code> señala componentes faltantes y <code>quality.verified</code> es <code>false</code>. No es una certificación del domicilio ni una garantía de entrega. Muestra la atribución de OpenStreetMap junto a los resultados.</p>
      </section>
      <section className="playground" id="docs-probar" aria-labelledby="docs-playground-title">
        <div>
          <h2 id="docs-playground-title">Prueba cualquier operación</h2>
          <p>Usa tu clave con el permiso indicado. Cada ejecución admitida consume una petición de tu plan, incluso si devuelve un error. Crear un mapa genera un enlace real.</p>
          <form onSubmit={run}>
            <label>Operación<Select value={operationId} onChange={choose} disabled={busy} label="Operación" options={operations.map((item) => ({ value: item.id, label: `${item.method} ${item.path}` }))} /></label>
            <p>Permiso requerido: <code>{operation.scope}</code>. {operation.description}</p>
            <label>Tu API key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="mp_live_…" required autoComplete="off" disabled={busy} /></label>
            <label>{operation.method === "GET" ? "Parámetros de consulta" : "Cuerpo JSON"}<textarea aria-label={operation.method === "GET" ? "Parámetros de consulta" : "Cuerpo JSON"} value={input} onChange={(event) => setInput(event.target.value)} rows={operation.method === "GET" ? 3 : 10} required spellCheck={false} disabled={busy} /></label>
            {operation.id === "coverage-check" && <p>Reemplaza <code>REEMPLAZA_POR_ID_DE_TU_ZONA</code> por el identificador de una zona de tu cuenta.</p>}
            <Button busy={busy}><Play size={16} />Enviar petición real</Button>
          </form>
        </div>
        <div className="playground-response" aria-live="polite" aria-busy={busy}>
          <span>Respuesta JSON</span><Notice error>{error}</Notice><pre>{result ? JSON.stringify(result, null, 2) : "La respuesta de tu petición aparecerá aquí. La clave no se guarda en este formulario."}</pre>
        </div>
      </section>
      <ExpansionDocs />
    </div>
  );
}
