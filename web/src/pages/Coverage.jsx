import React, { useMemo, useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { api } from "../client";
import { useData } from "../useData";
import { Button, Notice } from "../ui";
import AddressSearch, { geoRequest } from "../location/AddressSearch";
import MapCanvas from "../maps/MapCanvas";
import "../location/workspace.css";
const center = { latitude: -12.119906, longitude: -77.028971 };
export default function Coverage() {
  const { data, error: loadError, reload } = useData("/console/zones");
  const [vertices, setVertices] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(""),
    [point, setPoint] = useState(null),
    [result, setResult] = useState(null),
    [viewCenter, setViewCenter] = useState(center);
  const geometry = useMemo(
    () =>
      vertices.length >= 3
        ? { type: "Polygon", coordinates: [[...vertices, vertices[0]]] }
        : null,
    [vertices],
  );
  const spec = useMemo(
    () => ({
      center: viewCenter,
      markers: vertices.map(([longitude, latitude], i) => ({
        longitude,
        latitude,
        label: `Vértice ${i + 1}`,
      })),
      shapes: geometry ? [geometry] : data?.zones.map((z) => z.geometry) || [],
      zoom: 14,
    }),
    [vertices, geometry, data, viewCenter],
  );
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (!geometry) {
      setError("Coloca al menos tres vértices en el mapa.");
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api("/console/zones", "POST", {
        name: f.get("name"),
        geometry,
        feeCents: Math.round(Number(f.get("fee")) * 100),
        currency: f.get("currency").toUpperCase(),
      });
      setVertices([]);
      await reload();
      setMessage("Zona guardada. Ya puedes consultarla desde la API.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    setBusy(true);
    setError("");
    try {
      await api("/console/zones/" + id, "DELETE");
      await reload();
      setResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    if (!point || busy) return;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      setResult(
        await geoRequest("", key, "/v1/coverage/check", {
          point: { latitude: point.latitude, longitude: point.longitude },
          zoneIds: data.zones.slice(0, 20).map((z) => z.id),
        }),
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
          <h1>Tu área. Tus reglas de entrega.</h1>
          <p>
            Dibuja zonas, asigna una tarifa y comprueba si una ubicación está
            cubierta.
          </p>
        </div>
      </div>
      <Notice error>{loadError || error}</Notice>
      <Notice>{message}</Notice>
      <div className="geo-workbench">
        <section className="geo-preview">
          <AddressSearch
            apiKey={key}
            label="Centrar el mapa en una dirección"
            onSelect={(p) => setViewCenter(p)}
          />
          <MapCanvas
            spec={spec}
            onSelect={(p) => {
              if (vertices.length < 199)
                setVertices((v) => [...v, [p.longitude, p.latitude]]);
            }}
          />
          <p className="geo-hint">
            Cada clic añade un vértice. El contorno se cierra automáticamente al
            tener tres puntos. También puedes introducir coordenadas con el
            teclado.
          </p>
          <form
            className="coordinate-editor"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (vertices.length < 199)
                setVertices((v) => [
                  ...v,
                  [Number(f.get("lng")), Number(f.get("lat"))],
                ]);
            }}
          >
            <label>
              Latitud
              <input
                name="lat"
                type="number"
                step="any"
                min="-85"
                max="85"
                required
              />
            </label>
            <label>
              Longitud
              <input
                name="lng"
                type="number"
                step="any"
                min="-180"
                max="180"
                required
              />
            </label>
            <Button
              variant="secondary"
              disabled={busy || vertices.length >= 199}
            >
              Añadir vértice
            </Button>
          </form>
          <Button
            variant="secondary"
            disabled={!vertices.length || busy}
            onClick={() => setVertices((v) => v.slice(0, -1))}
          >
            <Undo2 size={15} />
            Deshacer punto
          </Button>
        </section>
        <section>
          <form className="geo-form" onSubmit={save}>
            <h2>Nueva zona</h2>
            <label>
              Nombre
              <input
                name="name"
                minLength={2}
                maxLength={120}
                placeholder="Entrega Miraflores"
                required
              />
            </label>
            <div className="coordinate-editor">
              <label>
                Tarifa
                <input
                  name="fee"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  defaultValue="5"
                  required
                />
              </label>
              <label>
                Moneda ISO
                <input
                  name="currency"
                  defaultValue="PEN"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                />
              </label>
            </div>
            <Button busy={busy} disabled={!geometry}>
              Guardar zona
            </Button>
          </form>
          <h2>Zonas guardadas</h2>
          {data?.zones.map((z) => (
            <div className="zone-item" key={z.id}>
              <div>
                <strong>{z.name}</strong>
                <p>
                  {z.currency} {(z.feeCents / 100).toFixed(2)}
                </p>
                <code>{z.id}</code>
              </div>
              <button
                className="icon-button"
                aria-label={"Eliminar zona " + z.name}
                disabled={busy}
                onClick={() => remove(z.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <section className="geo-form">
            <h2>Prueba tu cobertura</h2>
            <label>
              API key con permiso Cobertura
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="mp_live_…"
              />
            </label>
            <AddressSearch
              apiKey={key}
              label="Dirección a comprobar"
              onSelect={(p) => {
                setPoint(p);
                setResult(null);
              }}
            />
            <Button
              variant="secondary"
              busy={busy}
              disabled={!key || !point || !data?.zones.length}
              onClick={check}
            >
              Comprobar cobertura
            </Button>
            {result && (
              <Notice>
                {result.covered
                  ? "Dentro de cobertura: " +
                    result.matches
                      .map(
                        (z) =>
                          z.name +
                          " · " +
                          z.currency +
                          " " +
                          (z.feeCents / 100).toFixed(2),
                      )
                      .join("; ")
                  : "Fuera de las zonas consultadas."}
              </Notice>
            )}
            <p className="geo-hint">
              La prueba consulta hasta las primeras 20 zonas. Si se superponen,
              se devuelven todas las tarifas coincidentes; tu integración decide
              cuál aplicar.
            </p>
          </section>
        </section>
      </div>
    </>
  );
}
