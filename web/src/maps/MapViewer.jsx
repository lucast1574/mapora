import React, { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { api } from "../client";
import { Logo, Notice } from "../ui";
import MapCanvas from "./MapCanvas";
export default function MapViewer() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const token = location.pathname.split("/")[2] || "";
  useEffect(() => {
    let active = true;
    api("/v1/maps/view/" + encodeURIComponent(token))
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main className="map-viewer">
      <header className="viewer-header">
        <Logo />
        <span>{data?.map.title || "Mapa de ubicación"}</span>
        {data && (
          <a
            href={`https://www.google.com/maps?q=${data.map.center.latitude},${data.map.center.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir ubicación <ArrowUpRight size={16} />
          </a>
        )}
      </header>
      {error ? (
        <div className="viewer-message">
          <h1>Este mapa no está disponible</h1>
          <Notice error>{error}</Notice>
          <p>Solicita un enlace vigente a la persona que lo compartió.</p>
        </div>
      ) : data ? (
        <MapCanvas spec={data.map} tileBase={"/v1/maps/view/"+encodeURIComponent(token)+"/tiles"} />
      ) : (
        <div className="viewer-message" role="status">
          Cargando tu mapa…
        </div>
      )}
    </main>
  );
}
