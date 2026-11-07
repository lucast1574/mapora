import React from "react";
import { useData } from "../useData";
import { Logo, Notice } from "../ui";
import "../location/workspace.css";
export default function Status() {
  const { data, error, reload } = useData("/status");
  return (
    <main className="status-page">
      <Logo />
      <div className="page-title">
        <div>
          <h1>El estado de Mapora.</h1>
          <p>
            Comprobaciones actuales del motor geográfico y del motor de rutas.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => reload().catch(() => {})}
        >
          Actualizar estado
        </button>
      </div>
      <Notice error>{error}</Notice>
      <div className="geo-status">
        {data && (
          <>
            <div>
              <strong>
                {data.status === "operational"
                  ? "Servicios operativos"
                  : "Servicio degradado"}
              </strong>
              <span>{new Date(data.checkedAt).toLocaleString("es-PE")}</span>
            </div>
            {Object.entries(data.components).map(([name, status]) => (
              <div key={name}>
                <strong>
                  {name === "search" ? "Búsqueda y direcciones" : name === "cartography" ? "Fondo cartográfico mundial" : "Rutas y matrices"}
                </strong>
                <span>
                  {status === "operational"
                    ? "Operativo"
                    : status === "not_configured"
                      ? "En preparación"
                      : "No disponible"}
                </span>
              </div>
            ))}
            <p>
              El estado se comprueba como máximo una vez por minuto. No
              representa un historial de disponibilidad ni un SLA.{" "}
              Búsqueda mundial; rutas: {data.coverage?.routing==="world"?"mundiales":data.coverage?.routing==="latin_america"?"Latinoamérica":"cobertura por confirmar"}. <a href="/app">Ir al panel</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
