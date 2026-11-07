import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";
import "./maps.css";

export default function MapCanvas({
  spec,
  onSelect,
  tileBase = "/console/tiles",
  apiKey = "",
}) {
  const host = useRef(null),
    mapRef = useRef(null),
    selectRef = useRef(onSelect),
    lastCenter = useRef(null),
    initialized = useRef(false),
    lastRoute = useRef(null);
  const [ready, setReady] = useState(0),
    [error, setError] = useState("");
  selectRef.current = onSelect;
  const theme = spec.theme || "light",
    accent = spec.accent || "#123f3b";
  useEffect(() => {
    let map;
    setError("");
    initialized.current = false;
    lastCenter.current = null;
    lastRoute.current = null;
    try {
      const flavor = namedFlavor(theme);
      map = new maplibregl.Map({
        container: host.current,
        center: [spec.center.longitude, spec.center.latitude],
        zoom: spec.zoom || 14,
        maxZoom: 19,
        attributionControl: false,
        respectPrefersReducedMotion: true,
        transformRequest: (url) =>
          apiKey && url.startsWith(new URL(tileBase, location.href).href)
            ? { url, headers: { "X-API-Key": apiKey } }
            : { url },
        style: {
          version: 8,
          glyphs: new URL(
            tileBase + "/fonts/{fontstack}/{range}.pbf",
            location.href,
          ).href
            .replaceAll("%7B", "{")
            .replaceAll("%7D", "}"),
          sprite: new URL(
            tileBase + "/sprites/" + (theme === "dark" ? "dark" : "light"),
            location.href,
          ).href,
          sources: {
            mapora: {
              type: "vector",
              tiles: [
                new URL(tileBase + "/{z}/{x}/{y}.mvt", location.href).href
                  .replaceAll("%7B", "{")
                  .replaceAll("%7D", "}"),
              ],
              minzoom: 0,
              maxzoom: 15,
            },
          },
          layers: layers("mapora", flavor, { lang: "es" }),
        },
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(new maplibregl.FullscreenControl(), "top-right");
      map.addControl(
        new maplibregl.AttributionControl({
          compact: false,
          customAttribution:
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a>',
        }),
      );
      map.on("load", () => {
        initialized.current = true;
        setReady((n) => n + 1);
      });
      map.on("error", () =>
        setError(
          "No se pudo cargar una parte del mapa. Puedes seguir usando los datos y reintentar.",
        ),
      );
      map.on("click", (e) => {
        if (selectRef.current)
          selectRef.current({
            latitude: e.lngLat.wrap().lat,
            longitude: e.lngLat.wrap().lng,
          });
      });
    } catch {
      setError(
        "Este navegador no pudo iniciar el mapa. Usa los campos de coordenadas o un navegador con WebGL.",
      );
    }
    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, [theme, tileBase, apiKey]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialized.current) return;
    const markers = spec.markers || [spec.center];
    const data = {
      type: "FeatureCollection",
      features: markers.map((p, i) => ({
        type: "Feature",
        properties: { label: p.label || p.placeName || `Ubicación ${i + 1}` },
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      })),
    };
    if (!map.getSource("locations")) {
      map.addSource("locations", {
        type: "geojson",
        data,
        cluster: true,
        clusterRadius: 45,
      });
      map.addLayer({
        id: "location-dots",
        type: "circle",
        source: "locations",
        paint: {
          "circle-radius": ["case", ["has", "point_count"], 19, 9],
          "circle-color": accent,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "location-counts",
        type: "symbol",
        source: "locations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Medium"],
          "text-size": 12,
        },
        paint: { "text-color": "#fff" },
      });
      map.on("click", "location-dots", async (e) => {
        e.originalEvent.stopPropagation();
        const f = e.features?.[0];
        if (!f) return;
        if (f.properties.cluster) {
          const zoom = await map
            .getSource("locations")
            .getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center: f.geometry.coordinates, zoom });
        } else {
          const p = document.createElement("p");
          p.textContent = f.properties.label;
          new maplibregl.Popup()
            .setLngLat(f.geometry.coordinates)
            .setDOMContent(p)
            .addTo(map);
        }
      });
    } else map.getSource("locations").setData(data);
    map.setPaintProperty("location-dots", "circle-color", accent);
    const shapes = {
      type: "FeatureCollection",
      features: (spec.shapes || []).map((geometry) => ({
        type: "Feature",
        properties: {},
        geometry,
      })),
    };
    if (!map.getSource("coverage")) {
      map.addSource("coverage", { type: "geojson", data: shapes });
      map.addLayer({
        id: "coverage-fill",
        type: "fill",
        source: "coverage",
        paint: { "fill-color": accent, "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "coverage-edge",
        type: "line",
        source: "coverage",
        paint: { "line-color": accent, "line-width": 2 },
      });
    } else map.getSource("coverage").setData(shapes);
    const route = {
      type: "FeatureCollection",
      features: spec.route
        ? [{ type: "Feature", properties: {}, geometry: spec.route }]
        : [],
    };
    if (!map.getSource("route")) {
      map.addSource("route", { type: "geojson", data: route });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": accent, "line-width": 5 },
      });
    } else map.getSource("route").setData(route);
    map.setPaintProperty("coverage-fill", "fill-color", accent);
    map.setPaintProperty("coverage-edge", "line-color", accent);
    map.setPaintProperty("route-line", "line-color", accent);
    const nextCenter = [spec.center.longitude, spec.center.latitude];
    if (
      !lastCenter.current ||
      lastCenter.current[0] !== nextCenter[0] ||
      lastCenter.current[1] !== nextCenter[1]
    ) {
      map.jumpTo({ center: nextCenter });
      lastCenter.current = nextCenter;
    }
    if (spec.route && lastRoute.current !== spec.route) {
      const bounds = new maplibregl.LngLatBounds();
      spec.route.coordinates.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
      lastRoute.current = spec.route;
    }
    let dragMarker;
    if (onSelect) {
      dragMarker = new maplibregl.Marker({ draggable: true, color: accent })
        .setLngLat([spec.center.longitude, spec.center.latitude])
        .addTo(map);
      dragMarker.on("dragend", () => {
        const p = dragMarker.getLngLat().wrap();
        selectRef.current?.({ latitude: p.lat, longitude: p.lng });
      });
    }
    return () => dragMarker?.remove();
  }, [spec, ready, accent, !!onSelect]);
  return (
    <div className="map-canvas">
      <div
        ref={host}
        className="map-surface"
        role="region"
        aria-label="Mapa interactivo. Usa las flechas para desplazarte y más o menos para cambiar el zoom."
      />
      {error && (
        <div className="map-canvas-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
