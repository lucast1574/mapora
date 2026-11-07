import React, { useState } from "react";
import { ArrowUpRight, Copy, MapPin, Check } from "lucide-react";
import { api, date } from "../client";
import { Button, Notice, Select } from "../ui";
import "../maps/maps.css";
export default function Maps() {
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
    const f = new FormData(e.currentTarget);
    try {
      const center = {
        latitude: Number(f.get("lat")),
        longitude: Number(f.get("lng")),
        label: f.get("title"),
      };
      const v = await api(
        "/v1/maps",
        "POST",
        {
          title: f.get("title"),
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
          <h1>Un punto. Tu propio mapa.</h1>
          <p>Genera una vista interactiva y llévala a tu aplicación.</p>
        </div>
        <a className="text-link" href="/app/docs">
          Ver API <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="maps-builder">
        <section className="map-settings">
          <h2>Elige la ubicación</h2>
          <p>
            Usa las coordenadas de una búsqueda o de un enlace resuelto. La
            clave necesita el permiso «Crear mapas».
          </p>
          <form onSubmit={generate}>
            <label>
              API key
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="mp_live_…"
                required
              />
            </label>
            <label>
              Nombre del lugar
              <input
                name="title"
                defaultValue="Miraflores, Lima"
                maxLength={160}
                required
              />
            </label>
            <div className="map-coordinate-fields">
              <label>
                Latitud
                <input
                  type="number"
                  step="any"
                  min="-85.05112878"
                  max="85.05112878"
                  name="lat"
                  defaultValue="-12.119906"
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
                  defaultValue="-77.028971"
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
            <Notice error>{error}</Notice>
            <Button busy={busy}>
              <MapPin size={17} />
              Generar mapa
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
            <div className="map-preview-empty">
              <MapPin size={36} />
              <h2>Aquí comienza el recorrido</h2>
              <p>
                Configura una ubicación y genera tu mapa. Después podrás
                explorar, compartir o copiar el código para tu web.
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
