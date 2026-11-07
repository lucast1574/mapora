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
  const [task, setTask] = useState("create"),
    [drawing, setDrawing] = useState(false),
    [viewedZone, setViewedZone] = useState(null);
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
      setDrawing(false);
      await reload();
      setTask("saved");
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
      if (viewedZone?.id === id) setViewedZone(null);
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
          <h1>Zonas de cobertura</h1>
          <p>
            Define dónde entregas o atiendes y comprueba si una dirección está
            dentro.
          </p>
        </div>
      </div>
      <Notice error>{loadError || error}</Notice>
      <Notice>{message}</Notice>
      <nav className="geo-tabs" aria-label="Tareas de cobertura">
        {[
          ["create", "Crear zona"],
          ["saved", `Mis zonas (${data?.zones.length || 0})`],
          ["check", "Comprobar dirección"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={task === id ? "page" : undefined}
            onClick={() => {
              setTask(id);
              setResult(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {task === "create" && (
        <div className="geo-workbench coverage-builder">
          <section className="geo-preview">
            <div className="builder-heading">
              <h2>1. Dibuja el área</h2>
              <span aria-live="polite">{vertices.length} puntos</span>
            </div>
            <p className="geo-hint">
              Mueve el mapa hasta tu zona. Pulsa «Empezar dibujo» y marca al
              menos tres esquinas del área.
            </p>
            <details className="builder-details geo-form">
              <summary>Buscar una dirección para centrar el mapa</summary>
              <label>
                API key con permiso Búsqueda
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
                label="Centrar el mapa en una dirección"
                onSelect={setViewCenter}
              />
            </details>
            <div className="builder-actions">
              <Button
                variant={drawing ? "secondary" : ""}
                disabled={busy || (drawing && vertices.length < 3)}
                onClick={() => setDrawing(!drawing)}
              >
                {drawing
                  ? "Terminar dibujo"
                  : vertices.length
                    ? "Editar contorno"
                    : "Empezar dibujo"}
              </Button>
              <Button
                variant="secondary"
                disabled={!vertices.length || busy}
                onClick={() => {
                  setVertices((v) => v.slice(0, -1));
                  setDrawing(true);
                }}
              >
                <Undo2 size={15} />
                Deshacer punto
              </Button>
              <Button
                variant="secondary"
                disabled={!vertices.length || busy}
                onClick={() => {
                  setVertices([]);
                  setDrawing(false);
                }}
              >
                Borrar dibujo
              </Button>
            </div>
            <p className="builder-caption" role="status">
              {drawing
                ? vertices.length < 3
                  ? `Marca ${3 - vertices.length} ${vertices.length === 2 ? "punto más" : "puntos más"} para formar el área.`
                  : "El área está lista. Puedes añadir más puntos o terminar el dibujo."
                : geometry
                  ? "Contorno terminado. Ponle un nombre y guarda la zona."
                  : "Puedes mover el mapa sin añadir puntos."}
            </p>
            <MapCanvas
              spec={spec}
              onSelect={
                drawing && !busy
                  ? (p) => {
                      if (vertices.length < 199)
                        setVertices((v) => [...v, [p.longitude, p.latitude]]);
                    }
                  : undefined
              }
            />
            <details className="builder-details">
              <summary>Añadir puntos con coordenadas</summary>
              <form
                className="coordinate-editor geo-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (vertices.length < 199) {
                    setVertices((v) => [
                      ...v,
                      [Number(f.get("lng")), Number(f.get("lat"))],
                    ]);
                    setDrawing(true);
                  }
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
                  Añadir punto
                </Button>
              </form>
            </details>
          </section>
          <section className="coverage-settings">
            <form className="geo-form" onSubmit={save}>
              <h2>2. Guarda tu zona</h2>
              <label>
                Nombre de la zona
                <input
                  name="name"
                  minLength={2}
                  maxLength={120}
                  placeholder="Por ejemplo: Entrega centro"
                  required
                />
              </label>
              <details className="builder-details">
                <summary>Asignar una tarifa (opcional)</summary>
                <p className="geo-hint">
                  Es el precio de entrega de tu negocio. Mapora solo lo devuelve
                  como dato; guardar una tarifa no genera un cobro.
                </p>
                <div className="coordinate-editor">
                  <label>
                    Tarifa de entrega
                    <input
                      name="fee"
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label>
                    Moneda (código de 3 letras)
                    <input
                      name="currency"
                      defaultValue="PEN"
                      pattern="[A-Za-z]{3}"
                      maxLength={3}
                      required
                    />
                  </label>
                </div>
              </details>
              <Button busy={busy} disabled={!geometry || drawing}>
                Guardar zona
              </Button>
              {(!geometry || drawing) && (
                <p className="geo-hint">
                  Termina el dibujo del área para poder guardarla.
                </p>
              )}
            </form>
            <div className="builder-explainer">
              <h3>¿Para qué sirve?</h3>
              <p>
                Tu aplicación puede preguntar si la ubicación de un cliente
                pertenece a esta zona y obtener su tarifa de entrega.
              </p>
              <a className="text-link" href="/app/docs#endpoint-coverage-check">
                Ver cómo usarlo en la API
              </a>
            </div>
          </section>
        </div>
      )}
      {task === "saved" && (
        <section className="coverage-list">
          <h2>Tus zonas guardadas</h2>
          {!data?.zones.length && (
            <div className="builder-explainer">
              <h3>Aún no tienes zonas</h3>
              <p>
                Dibuja tu primera área de atención para empezar a comprobar
                direcciones.
              </p>
              <Button onClick={() => setTask("create")}>
                Crear mi primera zona
              </Button>
            </div>
          )}
          {data?.zones.map((z) => (
            <div className="zone-item" key={z.id}>
              <div>
                <strong>{z.name}</strong>
                <p>
                  Tarifa: {z.currency} {(z.feeCents / 100).toFixed(2)}
                </p>
                <details>
                  <summary>Identificador para la API</summary>
                  <code>{z.id}</code>
                </details>
              </div>
              <div className="builder-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setViewedZone(z);
                  }}
                >
                  Ver en el mapa
                </Button>
                <button
                  className="icon-button"
                  aria-label={"Eliminar zona " + z.name}
                  disabled={busy}
                  onClick={() => remove(z.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {viewedZone && (
            <div className="geo-preview">
              <div className="builder-heading">
                <h3>{viewedZone.name}</h3>
                <Button variant="secondary" onClick={() => setViewedZone(null)}>
                  Cerrar vista
                </Button>
              </div>
              <MapCanvas
                spec={{
                  center: {
                    longitude: viewedZone.geometry.coordinates[0][0][0],
                    latitude: viewedZone.geometry.coordinates[0][0][1],
                  },
                  zoom: 14,
                  markers: [],
                  shapes: [viewedZone.geometry],
                }}
              />
            </div>
          )}
        </section>
      )}
      {task === "check" && (
        <section className="geo-form coverage-check">
          <h2>¿Esta dirección está cubierta?</h2>
          <p className="geo-hint">
            Elige una dirección y comprueba si está dentro de tus zonas
            guardadas. Esta consulta consume una petición; la búsqueda también
            usa tu cuota.
          </p>
          {!data?.zones.length && (
            <Notice>Primero crea y guarda al menos una zona.</Notice>
          )}
          <label>
            API key con permisos Búsqueda y Cobertura
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setPoint(null);
                setResult(null);
              }}
              placeholder="mp_live_…"
            />
          </label>
          <AddressSearch
            key={key}
            apiKey={key}
            label="Dirección a comprobar"
            onQueryChange={() => {
              setPoint(null);
              setResult(null);
            }}
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
                : "Esta dirección está fuera de las zonas consultadas."}
            </Notice>
          )}
          <p className="geo-hint">
            Se comprueban hasta las primeras 20 zonas. Si coinciden varias, tu
            aplicación decide qué tarifa aplicar.
          </p>
        </section>
      )}
    </>
  );
}
