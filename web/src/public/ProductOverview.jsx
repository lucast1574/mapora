import React from "react";
import { ArrowUpRight } from "lucide-react";
const features = [
  [
    "places",
    "Encuentra el lugar correcto.",
    "Direcciones, negocios y servicios, con el contexto que necesita tu app.",
    "/api-lugares",
  ],
  [
    "routes",
    "Haz que el camino cuente.",
    "Rutas, paradas ordenadas y lugares que quedan de paso.",
    "/api-rutas",
  ],
  [
    "reach",
    "Descubre hasta dónde llegas.",
    "Compara tiempos de viaje y visualiza áreas alcanzables.",
    "/api-isocronas",
  ],
  [
    "maps",
    "Pon tus datos en el mapa.",
    "Marcadores, zonas y recorridos, con el estilo de tu producto.",
    "/mapas-interactivos",
  ],
  [
    "links",
    "Un enlace, una ubicación.",
    "Convierte enlaces de Google Maps en un punto listo para usar.",
    "/resolver-enlaces-google-maps",
  ],
  [
    "gps",
    "Dale sentido al recorrido.",
    "Ajusta puntos GPS a las calles y conserva el trazado original.",
    "/api-ajuste-gps",
  ],
];
function Scene({ kind }) {
  return (
    <div className={`capability-scene scene-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 320 154" fill="none">
        <path
          className="scene-streets"
          d="M-10 35L340 123M-10 115L340 25M72 -10L100 180M205 -10L173 180M-10 77L340 77"
        />
        {kind === "reach" ? (
          <>
            <ellipse
              cx="160"
              cy="83"
              rx="103"
              ry="60"
              className="scene-area outer"
            />
            <ellipse cx="160" cy="83" rx="70" ry="40" className="scene-area" />
            <ellipse
              cx="160"
              cy="83"
              rx="36"
              ry="23"
              className="scene-area inner"
            />
          </>
        ) : null}
        {["routes", "gps", "maps"].includes(kind) ? (
          <>
            <path
              className="scene-route"
              d="M40 118L92 118Q107 118 110 96L116 53L202 53Q216 53 218 70L226 93L285 93"
            />
            {kind === "gps" ? (
              <path
                d="M37 126L96 112L122 58L202 45L230 100L288 90"
                className="scene-observed"
              />
            ) : null}
            {[40, 116, 226, 285].map((x, i) => (
              <circle
                key={x}
                cx={x}
                cy={[118, 53, 93, 93][i]}
                r="5"
                className="scene-point"
              />
            ))}
          </>
        ) : null}
        {kind === "places" ? (
          <>
            <rect x="24" y="20" width="190" height="35" rx="10" fill="white" />
            <circle
              cx="43"
              cy="36"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M47 40L52 45" stroke="currentColor" strokeWidth="2" />
            <text x="65" y="42">
              Farmacias cerca
            </text>
            <rect x="24" y="66" width="151" height="48" rx="10" fill="white" />
            <text x="38" y="87">
              Tu próximo destino
            </text>
            <path
              d="M39 99H128"
              stroke="currentColor"
              opacity=".25"
              strokeWidth="4"
            />
          </>
        ) : null}
        {kind === "links" ? (
          <>
            <rect x="26" y="57" width="160" height="38" rx="10" fill="white" />
            <text x="43" y="81">
              Un lugar compartido
            </text>
            <path
              d="M195 76H232M222 67L232 76L222 85"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        ) : null}
        {["places", "reach", "links", "maps"].includes(kind) ? (
          <g
            transform={`translate(${kind === "reach" ? 160 : 260},${kind === "reach" ? 80 : 70})`}
          >
            <path
              d="M0 28C-6 20-18 9-18-3A18 18 0 0 1 18-3C18 9 6 20 0 28Z"
              fill="currentColor"
            />
            <circle cy="-3" r="6" fill="#e6f6b0" />
          </g>
        ) : null}
      </svg>
      {kind === "reach" ? (
        <span className="scene-caption">5, 10 o 15 minutos</span>
      ) : null}
    </div>
  );
}
export default function ProductOverview() {
  return (
    <section className="capabilities" id="producto">
      <div className="capabilities-heading">
        <h2>
          Todo lo que pasa
          <br />
          entre aquí y allá.
        </h2>
        <p>
          Una API de mapas para conectar lugares, personas y recorridos en
          América.
        </p>
      </div>
      <div className="capabilities-grid">
        {features.map(([kind, title, copy, url]) => (
          <a className="capability" href={url} key={kind}>
            <Scene kind={kind} />
            <div className="capability-copy">
              <h3>
                {title}
                <ArrowUpRight size={18} />
              </h3>
              <p>{copy}</p>
            </div>
          </a>
        ))}
      </div>
      <div className="capabilities-foot">
        <p>
          También búsquedas en lote, zonas de cobertura y conexión con tu
          asistente de IA.
        </p>
        <a href="/documentacion">
          Conoce todas las posibilidades <ArrowUpRight size={17} />
        </a>
      </div>
    </section>
  );
}
