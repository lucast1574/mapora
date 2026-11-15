import React from "react";
import { ArrowRight, Cable } from "lucide-react";
import { appURL } from "../client";
import { PublicHeader, PublicFooter } from "./PublicPage";
import { ClaudeIcon, OpenAIIcon } from "../assistant-icons";
import "../mcp.css";

export function AssistantLinks() {
  return <div className="mcp-assistants" aria-label="Conecta tu asistente con MCP">
    <span>Conecta tu IA</span>
    <a href={`${appURL}/app?connect=claude`}><ClaudeIcon />Claude Code</a>
    <a href={`${appURL}/app?connect=codex`}><OpenAIIcon />Codex · OpenAI</a>
  </div>;
}

export function McpPromo() {
  return (
    <section className="mcp-promo" id="mcp">
      <div>
        <span className="mcp-eyebrow">MCP · TU CUENTA YA CONECTADA</span>
        <h2>Tu asistente también sabe de mapas.</h2>
        <AssistantLinks />
        <p>
          Busca direcciones y lugares, convierte enlaces de Google Maps, calcula
          rutas, ordena paradas, consulta áreas alcanzables y crea mapas. Busca fichas de lugares OSM, exporta datos y encuentra paradas durante el trayecto. Tu asistente puede consultar el contrato de la API
          y tu consumo antes de integrar.
        </p>
        <a className="button" href={`${appURL}/app?connect=codex`}>
          Conectar mi asistente <ArrowRight size={18} />
        </a>
        <a className="text-link" href="/mcp">
          Cómo funciona
        </a>
      </div>
      <div className="mcp-example">
        <Cable size={28} aria-hidden="true" />
        <blockquote>
          Conecta Mapora a mi app: quiero un buscador de direcciones en Perú y
          un mapa con la ubicación elegida.
        </blockquote>
        <p>Una copia desde tu Resumen. Tu cuenta ya va conectada.</p>
      </div>
    </section>
  );
}
export default function McpPage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="mcp-public">
        <nav className="breadcrumbs" aria-label="Ruta de navegación">
          <a href="/">Mapora</a>
          <span>/</span>
          <span>MCP</span>
        </nav>
        <span className="mcp-eyebrow">MODEL CONTEXT PROTOCOL</span>
        <h1>Conecta Mapora a Claude Code y Codex.</h1>
        <p>
          Busca direcciones y lugares, convierte enlaces de Google Maps, calcula
          rutas, ordena paradas, consulta áreas alcanzables y crea mapas. Busca fichas de lugares OSM, exporta datos y encuentra paradas durante el trayecto. Tu asistente puede consultar el contrato de la API
          y tu consumo antes de integrar.
        </p>
        <a className="button" href={`${appURL}/app?connect=codex`}>
          Conectar desde mi panel <ArrowRight size={18} />
        </a>
        <section>
          <h2>Tu cuenta, lista para copiar.</h2>
          <ol>
            <li>
              Inicia sesión en{" "}
              <a href="https://app.mapora.dev">app.mapora.dev</a> y abre
              Conectar mi asistente en el Resumen.
            </li>
            <li>
              Elige tu asistente y copia las instrucciones. Tu API key privada
              ya viene incluida.
            </li>
            <li>
              Pega el texto en Codex o Claude Code en tu computadora y deja que
              configure el MCP.
            </li>
            <li>
              Recarga la conexión cuando el asistente lo indique. Verifica tu
              cuenta con <code>mapora_me</code>.
            </li>
          </ol>
          <p>
            No necesitas crear claves manualmente ni instalar un servidor. La
            conexión utiliza MCP por HTTPS.
          </p>
        </section>
        <section>
          <h2>Un asistente que conoce la API.</h2>
          <p>
            El MCP incluye herramientas para consultar tu cuenta y consumo, leer
            el contrato OpenAPI completo y ejecutar las operaciones de Mapora.
            Consulta <code>mapora_documentation</code> antes de generar una
            integración.
          </p>
          <p>
            Busca direcciones y lugares, convierte enlaces de Google Maps,
            calcula rutas, ordena paradas, consulta áreas alcanzables y crea mapas. Busca fichas de lugares OSM, exporta datos y encuentra paradas durante el trayecto. Tu asistente puede consultar el contrato
            de la API y tu consumo antes de integrar.
          </p>
          <p>
            Prueba: “Conecta Mapora a mi app: quiero un buscador de direcciones
            en Perú y un mapa con la ubicación elegida.”
          </p>
        </section>
        <section>
          <h2>Dominios de producción y documentación.</h2>
          <p>
            Sitio: <a href="https://mapora.dev">mapora.dev</a>. Panel:{" "}
            <a href="https://app.mapora.dev">app.mapora.dev</a>. API:{" "}
            <code>https://api.mapora.dev</code>.
          </p>
          <p>
            Endpoint MCP: <code>https://api.mapora.dev/mcp</code>. Requiere{" "}
            <code>Authorization: Bearer TU_API_KEY</code>; la clave se envía en
            una cabecera, nunca en la URL.
          </p>
          <a className="text-link" href="/documentacion">
            Referencia y ejemplos de la API
          </a>{" "}
          · <a href="https://api.mapora.dev/openapi.json">Contrato OpenAPI</a>
        </section>
        <section>
          <h2>Los mismos permisos y límites de tu plan.</h2>
          <p>
            Conectar el asistente no cambia tu suscripción. Consultar tu cuenta
            y la documentación no consume cuota. Las operaciones de datos
            consumen lo mismo que una petición directa a la API, incluidas las
            respuestas desde caché y los errores de proveedor admitidos. Respeta
            Retry-After cuando la API solicite esperar.
          </p>
          <p>
            La conexión se comparte entre tus asistentes y puedes revocarla
            desde API keys. El texto copiado contiene una credencial privada:
            úsalo solo en tu asistente y conserva sus confirmaciones.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
