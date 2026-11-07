import React, { useState } from "react";
import { ArrowUpRight, Copy, MapPin, Check } from "lucide-react";
import { api, date } from "../client";
import { Button, Notice, Select } from "../ui";
import AddressSearch from "../location/AddressSearch";
import MapCanvas from "../maps/MapCanvas";
import "../maps/maps.css";
export default function Maps() {
  const [point, setPoint] = useState(null),
    [title, setTitle] = useState("");
  const [key, setKey] = useState(""),
    [zoom, setZoom] = useState("14"),
    [days, setDays] = useState("7"),
    [theme, setTheme] = useState("light"),
    [accent, setAccent] = useState("#123f3b");
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState("");
  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setCopied("");
    try {
      if (!point) throw new Error("Selecciona primero un punto en el mapa.");
      const center = { ...point, label: title };
      const v = await api(
        "/v1/maps",
        "POST",
        {
          title,
          center,
          zoom: Number(zoom),
          theme,
          accent,
          expiresIn: Number(days) * 86400,
        },
        { "X-API-Key": key },
      );
      setResult(v);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(value, what) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setError(
        "No se pudo copiar. Selecciona el código y cópialo manualmente.",
      );
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Crea un mapa para compartir</h1>
          <p>
            Elige un lugar, ajusta el pin y obtén un enlace o un mapa para tu
            web.
          </p>
        </div>
        <a className="text-link" href="/app/docs">
          Ver API <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="maps-builder">
        <section className="map-settings">
          <h2>1. Elige el lugar</h2>
          <p>
            Haz clic en el mapa o busca una dirección. Después podrás ajustar el
            pin con otro clic.
          </p>
          <form onSubmit={generate}>
            <label>
              API key con permiso Crear mapas
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="mp_live_…"
                required
              />
            </label>
            <AddressSearch
              apiKey={key}
              label="Buscar el lugar (opcional)"
              onSelect={(p) => {
                setPoint({ latitude: p.latitude, longitude: p.longitude });
                setTitle(p.placeName || p.street || p.address);
                setResult(null);
              }}
            />
            <p className="map-usage-note">
              Para buscar direcciones, tu clave también necesita el permiso
              Búsqueda.
            </p>
            <h2>2. Dale un nombre</h2>
            <label>
              Nombre del lugar
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre que verán tus visitantes"
                maxLength={160}
                required
              />
            </label>
            <details className="builder-details">
              <summary>Coordenadas y apariencia</summary>
              <div className="map-coordinate-fields">
                <label>
                  Latitud
                  <input
                    type="number"
                    step="any"
                    min="-85.05112878"
                    max="85.05112878"
                    name="lat"
                    value={point?.latitude ?? ""}
                    onChange={(e) => {
                      setResult(null);
                      setPoint({
                        latitude:
                          e.target.value === "" ? "" : Number(e.target.value),
                        longitude: point?.longitude ?? "",
                      });
                    }}
                    required
                  />
                </label>
                <label>
                  Longitud
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    name="lng"
                    value={point?.longitude ?? ""}
                    onChange={(e) => {
                      setResult(null);
                      setPoint({
                        longitude:
                          e.target.value === "" ? "" : Number(e.target.value),
                        latitude: point?.latitude ?? "",
                      });
                    }}
                    required
                  />
                </label>
              </div>
              <label>
                Acercamiento
                <Select
                  value={zoom}
                  onChange={setZoom}
                  label="Acercamiento"
                  options={[
                    { value: "10", label: "Ciudad" },
                    { value: "14", label: "Barrio" },
                    { value: "17", label: "Calle" },
                    { value: "19", label: "Detalle" },
                  ]}
                />
              </label>
              <label>
                Validez del enlace
                <Select
                  value={days}
                  onChange={setDays}
                  label="Validez del enlace"
                  options={[
                    { value: "1", label: "1 día" },
                    { value: "7", label: "7 días" },
                    { value: "30", label: "30 días" },
                  ]}
                />
              </label>
              <label>
                Estilo del mapa
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
              <label>
                Color de marcadores
                <input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  pattern="#[0-9a-fA-F]{6}"
                  maxLength={7}
                  required
                />
              </label>
            </details>
            <Notice error>{error}</Notice>
            <Button
              busy={busy}
              disabled={
                !point ||
                !Number.isFinite(point.latitude) ||
                !Number.isFinite(point.longitude)
              }
            >
              <MapPin size={17} />
              Crear enlace del mapa
            </Button>
          </form>
          <p className="map-usage-note">
            Generarlo consume 1 petición. Ver el mapa, desplazarse y hacer zoom
            no añaden consumo de Mapora.
          </p>
        </section>
        <section className="map-preview" aria-label="Vista previa del mapa">
          {result ? (
            <>
              <div className="map-preview-title">
                <strong>Listo para compartir</strong>
                <Button variant="secondary" onClick={() => setResult(null)}>
                  Ajustar ubicación
                </Button>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  Abrir mapa <ArrowUpRight size={16} />
                </a>
              </div>
              <iframe
                key={result.url}
                src={result.url}
                title="Vista previa de tu mapa"
                allow="fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="map-delivery">
                <label>
                  Enlace
                  <input value={result.url} readOnly />
                </label>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => copy(result.url, "link")}
                >
                  {copied === "link" ? <Check size={16} /> : <Copy size={16} />}
                  Copiar enlace
                </Button>
                <label>
                  Código para insertar
                  <textarea value={result.embedHtml} readOnly rows={4} />
                </label>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => copy(result.embedHtml, "embed")}
                >
                  {copied === "embed" ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  Copiar iframe
                </Button>
                <p>
                  Válido hasta el {date(result.expiresAt)}. Quien tenga el
                  enlace puede ver esta ubicación; nunca recibe tu API key.
                  Revocar la clave invalida sus mapas.
                </p>
              </div>
            </>
          ) : (
            <div className="map-draft">
              <div className="map-preview-title">
                <strong>
                  {point
                    ? "Ubicación seleccionada"
                    : "Haz clic para colocar tu pin"}
                </strong>
                <span>Vista previa</span>
              </div>
              <MapCanvas
                showSelectionMarker={!!point}
                spec={{
                  center:
                    point &&
                    Number.isFinite(point.latitude) &&
                    Number.isFinite(point.longitude)
                      ? point
                      : { latitude: -12.119906, longitude: -77.028971 },
                  markers:
                    point &&
                    Number.isFinite(point.latitude) &&
                    Number.isFinite(point.longitude)
                      ? [point]
                      : [],
                  zoom: Number(zoom),
                  theme,
                  accent,
                }}
                onSelect={(p) => {
                  setPoint(p);
                  setResult(null);
                }}
              />
              <p className="builder-caption">
                {point
                  ? "¿Está bien ubicado? Ponle un nombre y crea el enlace."
                  : "Todavía no has elegido una ubicación. Puedes mover y acercar el mapa."}
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="map-provider-note">
        La cartografía vectorial mundial se sirve desde Mapora con datos de
        OpenStreetMap y Protomaps. No incluye mapas sin conexión ni imágenes
        satelitales.
      </p>
    </>
  );
}
