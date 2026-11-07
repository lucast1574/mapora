import React, { useMemo, useState } from "react";
import { MapPin, Route, Navigation, ArrowUpRight } from "lucide-react";
import { Button, Notice, Select } from "../ui";
import { useData } from "../useData";
import LocationPicker from "../location/LocationPicker";
import AddressSearch, { geoRequest } from "../location/AddressSearch";
import MapCanvas from "../maps/MapCanvas";
import "../location/workspace.css";
const modes = [
  ["location", "Elegir ubicación", MapPin],
  ["nearby", "Lugares cercanos", Navigation],
  ["routes", "Rutas", Route],
];
const center = { latitude: -12.119906, longitude: -77.028971 };
export default function Explore() {
  const { data: serviceStatus } = useData("/status");
  const [mode, setMode] = useState("location"),
    [key, setKey] = useState(""),
    [country, setCountry] = useState(""),
    [theme, setTheme] = useState("light"),
    [point, setPoint] = useState(null),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("pharmacy"),
    [profile, setProfile] = useState("driving"),
    [start, setStart] = useState(null),
    [end, setEnd] = useState(null);
  const spec = useMemo(
    () => ({
      center: mode === "routes" ? start || center : point || center,
      markers:
        mode === "routes"
          ? [start, end].filter(Boolean)
          : result?.results || [point || center],
      route: mode === "routes" ? result?.geometry : undefined,
      zoom: 14,
      theme,
    }),
    [mode, start, end, point, result, theme],
  );
  async function run(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (mode === "nearby") {
        const p = point || center;
        const radius = new FormData(e.currentTarget).get("radius");
        setResult(
          await geoRequest(
            "",
            key,
            "/v1/nearby?" +
              new URLSearchParams({
                lat: p.latitude,
                lng: p.longitude,
                category,
                radius,
                limit: 20,
              }),
          ),
        );
      } else {
        if (!start || !end)
          throw new Error("Elige una sugerencia para el origen y el destino.");
        setResult(
          await geoRequest("", key, "/v1/routes", {
            locations: [
              { latitude: start.latitude, longitude: start.longitude },
              { latitude: end.latitude, longitude: end.longitude },
            ],
            profile,
          }),
        );
      }
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
          <h1>El lugar donde empieza tu integración.</h1>
          <p>Busca, ajusta el pin y prueba las operaciones con datos reales.</p>
        </div>
        <a className="text-link" href="/app/docs">
          Ver integración <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="geo-toolbar">
        <label>
          API key
          <input
            type="password"
            autoComplete="off"
            disabled={busy}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setResult(null);
            }}
            placeholder="mp_live_…"
          />
        </label>
        <label>
          País de búsqueda
          <input
            disabled={busy}
            value={country}
            maxLength={2}
            onChange={(e) =>
              setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
            placeholder="Todos (PE, CO…)"
          />
        </label>
        <label>
          Estilo
          <Select
            label="Estilo del mapa"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Claro" },
              { value: "dark", label: "Oscuro" },
              { value: "grayscale", label: "Escala de grises" },
            ]}
          />
        </label>
      </div>
      <nav className="geo-tabs" aria-label="Herramientas geográficas">
        {modes.map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            aria-current={mode === value ? "page" : undefined}
            disabled={busy}
            onClick={() => {
              setMode(value);
              setResult(null);
              setError("");
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <Notice error>{error}</Notice>
      {mode === "location" ? (
        <div className="geo-workbench">
          <LocationPicker
            apiKey={key}
            country={country}
            onSelect={setPoint}
            theme={theme}
          />
          <aside className="geo-data">
            <span className="geo-eyebrow">TU UBICACIÓN</span>
            <h2>Un dato que puedes guardar.</h2>
            <p>
              El nombre, los componentes de la dirección y el punto elegido
              permanecen juntos.
            </p>
            {point ? (
              <>
                <strong>{point.placeName}</strong>
                <dl>
                  {[
                    ["Dirección", point.streetAddress],
                    ["Calle", point.street],
                    ["Número", point.houseNumber],
                    ["Distrito", point.district],
                    ["Ciudad", point.city],
                    [
                      "Precisión",
                      {
                        address: "Dirección con número",
                        house: "Dirección con número",
                        street: "Calle",
                        city: "Ciudad",
                        district: "Distrito",
                        state: "Región",
                        country: "País",
                        place: "Lugar",
                        pin: "Pin elegido",
                      }[point.quality?.precision] || point.quality?.precision,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Sin dato en la fuente"}</dd>
                    </div>
                  ))}
                </dl>
                <details>
                  <summary>Ver JSON</summary>
                  <pre>{JSON.stringify(point, null, 2)}</pre>
                </details>
              </>
            ) : (
              <div className="geo-empty">
                <MapPin size={28} />
                <p>
                  Selecciona un resultado o un punto en el mapa para ver sus
                  datos.
                </p>
              </div>
            )}
            <small>
              Las referencias cercanas no certifican que una dirección exista o
              sea apta para entregas.
            </small>
          </aside>
        </div>
      ) : (
        <div className="geo-workbench geo-routing-workbench">
          <section>
            <form className="geo-form" onSubmit={run}>
              {mode === "routes" ? (
                <>
                  <AddressSearch
                    disabled={busy}
                    apiKey={key}
                    country={country}
                    label="Origen"
                    onSelect={(p) => {
                      setStart(p);
                      setResult(null);
                    }}
                  />
                  <AddressSearch
                    disabled={busy}
                    apiKey={key}
                    country={country}
                    label="Destino"
                    onSelect={(p) => {
                      setEnd(p);
                      setResult(null);
                    }}
                  />
                  <label>
                    Cómo te mueves
                    <Select
                      disabled={busy}
                      label="Perfil de ruta"
                      value={profile}
                      onChange={(v) => {
                        setProfile(v);
                        setResult(null);
                      }}
                      options={[
                        { value: "driving", label: "En auto" },
                        { value: "walking", label: "A pie" },
                        { value: "cycling", label: "En bicicleta" },
                      ]}
                    />
                  </label>
                </>
              ) : (
                <>
                  <AddressSearch
                    disabled={busy}
                    apiKey={key}
                    country={country}
                    label="Buscar alrededor de"
                    onSelect={(p) => {
                      setPoint(p);
                      setResult(null);
                    }}
                  />
                  <p className="geo-hint">
                    Centro: {(point || center).latitude.toFixed(5)},{" "}
                    {(point || center).longitude.toFixed(5)}
                  </p>
                  <label>
                    Categoría
                    <Select
                      disabled={busy}
                      label="Categoría de lugar"
                      value={category}
                      onChange={(v) => {
                        setCategory(v);
                        setResult(null);
                      }}
                      options={[
                        ["pharmacy", "Farmacias"],
                        ["restaurant", "Restaurantes"],
                        ["hospital", "Hospitales"],
                        ["fuel", "Combustible"],
                        ["supermarket", "Supermercados"],
                        ["hotel", "Hoteles"],
                        ["bank", "Bancos"],
                        ["parking", "Estacionamientos"],
                        ["cafe", "Cafeterías"],
                      ].map(([value, label]) => ({ value, label }))}
                    />
                  </label>
                  <label>
                    Radio en metros
                    <input
                      type="number"
                      name="radius"
                      defaultValue="5000"
                      min="50"
                      max="50000"
                      required
                    />
                  </label>
                </>
              )}
              <Button
                busy={busy}
                disabled={
                  !key ||
                  (mode === "routes" &&
                    serviceStatus?.components.routing !== "operational")
                }
              >
                {mode === "routes"
                  ? "Calcular ruta por calles"
                  : "Buscar lugares"}
              </Button>
              {mode === "routes" &&
                serviceStatus?.components.routing !== "operational" && (
                  <p className="geo-hint" role="status">
                    El motor de rutas se está preparando o no está disponible.
                    Consulta el{" "}
                    <a href="/service-status">estado del servicio</a> antes de
                    calcular.
                  </p>
                )}
            </form>
            <p className="geo-hint">
              Cada ejecución consume una petición. Las sugerencias de búsqueda
              también consumen peticiones. Las duraciones no incluyen tráfico en
              tiempo real.
            </p>
            {result && (
              <div className="geo-results" aria-live="polite">
                {mode === "routes" ? (
                  <>
                    <div className="route-summary">
                      <strong>
                        {(result.distanceMeters / 1000).toFixed(1)} km
                      </strong>
                      <span>
                        {Math.ceil(result.durationSeconds / 60)} min estimados
                      </span>
                    </div>
                    <ol>
                      {result.steps?.map((s, i) => (
                        <li key={i}>{s.instruction}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <>
                    <strong>{result.count} lugares encontrados</strong>
                    <p className="geo-hint">
                      Distancias en línea recta al centro de búsqueda.
                    </p>
                    {result.results.map((p) => (
                      <button
                        className="nearby-result"
                        key={p.id}
                        onClick={() => setPoint(p)}
                      >
                        <span>
                          {p.placeName ||
                            p.streetAddress ||
                            "Lugar sin nombre en la fuente"}
                          <small>{p.streetAddress}</small>
                        </span>
                        <strong>{Math.round(p.distanceMeters)} m</strong>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
          <section className="geo-preview">
            <MapCanvas spec={spec} />
          </section>
        </div>
      )}
    </>
  );
}
