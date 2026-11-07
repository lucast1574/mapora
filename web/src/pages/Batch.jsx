import React, { useRef, useState, useEffect } from "react";
import { Download, FileUp } from "lucide-react";
import { Button, Notice } from "../ui";
import { geoRequest } from "../location/AddressSearch";
import { parseAddresses, resultsCSV } from "../location/csv";
import "../location/workspace.css";
export default function Batch() {
  const [key, setKey] = useState(""),
    [items, setItems] = useState([]),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filename, setFilename] = useState("");
  const stop = useRef(false),
    task = useRef(null);
  useEffect(
    () => () => {
      stop.current = true;
      task.current?.abort();
    },
    [],
  );
  const [waitUntil, setWaitUntil] = useState(0),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= waitUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);
  const waitSeconds = Math.max(0, Math.ceil((waitUntil - clock) / 1000));
  async function load(file) {
    if (!file) return;
    setError("");
    setItems([]);
    setResults([]);
    try {
      if (file.size > 1024 * 1024)
        throw new Error("El archivo debe pesar menos de 1 MB.");
      setItems(parseAddresses(await file.text()));
      setFilename(file.name);
    } catch (e) {
      setError(e.message);
    }
  }
  async function run() {
    if (busy) return;
    stop.current = false;
    task.current = new AbortController();
    setBusy(true);
    setError("");
    let done = results.slice();
    try {
      for (let i = done.length; i < items.length; i += 10) {
        if (stop.current) break;
        const value = await geoRequest(
          "",
          key,
          "/v1/batch",
          {
            items: items.slice(i, i + 10),
          },
          task.current.signal,
        );
        done = [...done, ...value.results];
        setResults(done);
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      if (e.code === "rate_limited") {
        setWaitUntil(Date.now() + Math.max(1, e.retryAfter) * 1000);
        setClock(Date.now());
        setError(
          "Alcanzaste el límite por minuto. Tus resultados están guardados en esta pantalla; continúa cuando termine la espera.",
        );
      } else
        setError(
          e.message +
            (e.status
              ? " Conservamos los resultados completos."
              : " Conservamos los resultados completos. La petición que falló por conexión puede haber contado en tu cuota."),
        );
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + resultsCSV(results)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapora-direcciones.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>De una lista a mil ubicaciones.</h1>
          <p>
            Importa direcciones, revisa cada coincidencia y descarga tus
            resultados.
          </p>
        </div>
      </div>
      <div className="geo-bulk">
        <section className="geo-form">
          <label>
            API key con permiso Lotes
            <input
              type="password"
              autoComplete="off"
              value={key}
              disabled={busy}
              onChange={(e) => setKey(e.target.value)}
              placeholder="mp_live_…"
            />
          </label>
          <label>
            <span>
              <FileUp size={16} /> Archivo CSV
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => load(e.target.files[0])}
            />
          </label>
          <p className="geo-hint">
            Hasta 1000 filas y 1 MB. Columnas: <code>address</code> y{" "}
            <code>country</code> opcional (PE, CO, MX…). Se envían lotes de
            hasta 10 direcciones. Cada lote admitido consume una petición.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                const response = await fetch("/examples/addresses.csv");
                if (!response.ok)
                  throw new Error("No se pudo cargar el ejemplo.");
                setItems(parseAddresses(await response.text()));
                setResults([]);
                setFilename("Ejemplo · 3 direcciones públicas");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Cargar ejemplo de tres direcciones
          </Button>
          <a className="text-link" href="/examples/addresses.csv" download>
            Descargar ejemplo
          </a>
          <Notice error>{error}</Notice>
          <Button
            busy={busy}
            disabled={
              waitSeconds > 0 ||
              !key ||
              !items.length ||
              results.length === items.length
            }
            onClick={run}
          >
            {waitSeconds > 0
              ? `Continuar en ${waitSeconds} s`
              : results.length === items.length && items.length
                ? "Importación completada"
                : results.length
                  ? "Continuar importación"
                  : "Procesar direcciones"}
          </Button>
          {busy && (
            <Button
              variant="secondary"
              onClick={() => {
                stop.current = true;
              }}
            >
              Detener después de este lote
            </Button>
          )}
          {results.length > 0 && (
            <Button variant="secondary" onClick={download}>
              <Download size={16} />
              Descargar resultados
            </Button>
          )}
        </section>
        <section>
          <h2>{filename || "Tu archivo, con resultados por fila."}</h2>
          <p className="geo-hint" role="status">
            {results.length} de {items.length} direcciones procesadas ·{" "}
            {results.filter((r) => r.status === "ok").length} con coincidencia
          </p>
          <progress
            max={items.length || 1}
            value={results.length}
            aria-label="Progreso de la importación"
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Dirección</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      {r.query}
                      <small>{r.result?.address}</small>
                    </td>
                    <td>
                      {r.status === "ok"
                        ? "Encontrada"
                        : r.status === "not_found"
                          ? "Sin coincidencia"
                          : "Error de consulta"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="geo-hint">
            Una coincidencia geográfica no valida la entrega. Revisa precisión y
            campos faltantes antes de utilizar el resultado. El archivo original
            no se almacena; solo se envían sus direcciones al procesarlo.
          </p>
        </section>
      </div>
    </>
  );
}
