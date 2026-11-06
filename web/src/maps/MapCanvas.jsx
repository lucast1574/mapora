import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, LocateFixed, Maximize, MapPin } from "lucide-react";
import "./maps.css";

const pin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44"><path d="M18 1C8.6 1 1 8.6 1 18c0 12 17 25 17 25s17-13 17-25C35 8.6 27.4 1 18 1Z" fill="#123f3b" stroke="#fff" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="#d8ee88"/></svg>`;
export default function MapCanvas({ spec }) {
  const root = useRef(null),
    host = useRef(null),
    mapRef = useRef(null);
  const [tileError, setTileError] = useState(false),
    [message, setMessage] = useState("");
  const [point, setPoint] = useState(spec.center);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 1,
      maxZoom: 19,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
      markerZoomAnimation: !reduced,
      inertia: !reduced,
      worldCopyJump: true,
    }).setView([spec.center.latitude, spec.center.longitude], spec.zoom);
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        keepBuffer: 0,
        updateWhenIdle: true,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      },
    ).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    const icon = L.divIcon({
      html: pin,
      className: "mapora-marker",
      iconSize: [36, 44],
      iconAnchor: [18, 43],
      popupAnchor: [0, -42],
    });
    spec.markers.forEach((p, i) => {
      const content = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = p.label || `Ubicación ${i + 1}`;
      const coords = document.createElement("p");
      coords.textContent = `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
      content.append(name, coords);
      L.marker([p.latitude, p.longitude], {
        icon,
        title: p.label || `Ubicación ${i + 1}`,
        alt: p.label || "Ubicación",
        keyboard: true,
      })
        .addTo(map)
        .bindPopup(content, { closeButton: false })
        .on("click", () => setPoint(p));
    });
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false }),
    );
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [spec]);
  function recenter() {
    const map = mapRef.current;
    if (spec.markers.length > 1)
      map.fitBounds(
        spec.markers.map((p) => [p.latitude, p.longitude]),
        { padding: [50, 50], maxZoom: spec.zoom, animate: false },
      );
    else
      map.setView([spec.center.latitude, spec.center.longitude], spec.zoom, {
        animate: false,
      });
    setPoint(spec.center);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current.requestFullscreen();
    } catch {
      setMessage("Abre el enlace del mapa para verlo en una ventana completa.");
    }
  }
  return (
    <div className="map-canvas" ref={root}>
      <div
        ref={host}
        className="map-surface"
        role="region"
        aria-label="Mapa interactivo. Usa flechas para desplazarte y las teclas más y menos para acercar o alejar."
      />
      <div className="viewer-place">
        <MapPin size={18} />
        <div>
          <strong>{point.label || spec.title || "Tu ubicación"}</strong>
          <span>
            {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
          </span>
        </div>
      </div>
      <div className="map-tools" aria-label="Controles del mapa">
        <button
          type="button"
          aria-label="Acercar mapa"
          title="Acercar"
          onClick={() => mapRef.current.zoomIn()}
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          aria-label="Alejar mapa"
          title="Alejar"
          onClick={() => mapRef.current.zoomOut()}
        >
          <Minus size={20} />
        </button>
        <button
          type="button"
          aria-label="Volver a las ubicaciones"
          title="Volver a las ubicaciones"
          onClick={recenter}
        >
          <LocateFixed size={19} />
        </button>
        <button
          type="button"
          aria-label="Ver en pantalla completa"
          title="Pantalla completa"
          onClick={fullscreen}
        >
          <Maximize size={18} />
        </button>
      </div>
      {(tileError || message) && (
        <p className="map-status" role="status">
          {message ||
            "El fondo del mapa no está disponible en este momento. Los marcadores conservan sus coordenadas."}
        </p>
      )}
    </div>
  );
}
