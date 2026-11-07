import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AddressSearch, { geoRequest } from "./AddressSearch";
import MapCanvas from "../maps/MapCanvas";
import "./location.css";

export default function LocationPicker({
  apiKey,
  baseURL = "",
  country = "",
  city = "",
  district = "",
  state = "",
  onSelect,
  theme = "light",
  accent = "#123f3b",
  initialCenter = { latitude: -12.119906, longitude: -77.028971 },
  className = "",
  style,
}) {
  const [point, setPoint] = useState(initialCenter),
    [message, setMessage] = useState(
      "Busca una dirección o coloca el pin en el mapa.",
    ),
    [busy, setBusy] = useState(false),
    [draftLat, setDraftLat] = useState(String(initialCenter.latitude)),
    [draftLng, setDraftLng] = useState(String(initialCenter.longitude));
  const task = useRef(null),
    revision = useRef(0),
    notify = useRef(onSelect);
  notify.current = onSelect;
  useEffect(
    () => () => {
      revision.current++;
      task.current?.abort();
    },
    [],
  );
  useEffect(() => {
    revision.current++;
    task.current?.abort();
    setBusy(false);
  }, [apiKey, baseURL]);
  const select = useCallback(
    async (p) => {
      task.current?.abort();
      const version = ++revision.current;
      setPoint(p);
      setBusy(false);
      setDraftLat(String(p.latitude));
      setDraftLng(String(p.longitude));
      if (p.address) {
        setMessage(p.match?.coordinateType === "street_reference"
          ? "Calle seleccionada. Ajusta el pin para indicar el punto exacto."
          : "Dirección seleccionada. Puedes ajustar el pin.");
        notify.current?.(p);
        setBusy(false);
        return;
      }
      const provisional = {
        ...p,
        addressStatus: "not_requested",
        source: "user_pin",
        placeName: "Ubicación seleccionada",
      };
      notify.current?.(provisional);
      if (!apiKey) {
        setMessage(
          "Coordenadas seleccionadas. Introduce una clave para consultar su dirección.",
        );
        return;
      }
      const controller = new AbortController();
      task.current = controller;
      setBusy(true);
      setMessage("Buscando una referencia cercana…");
      try {
        const result = await geoRequest(
          baseURL,
          apiKey,
          "/v1/reverse?" +
            new URLSearchParams({ lat: p.latitude, lng: p.longitude }),
          undefined,
          controller.signal,
        );
        if (version !== revision.current) return;
        const selected = {
          ...result,
          placeName:
            result.placeName || result.street || "Ubicación seleccionada",
          latitude: p.latitude,
          longitude: p.longitude,
          source: "user_pin",
        };
        setPoint(selected);
        notify.current?.(selected);
        setMessage("Pin confirmado. La dirección es una referencia cercana.");
      } catch (e) {
        if (e.name !== "AbortError" && version === revision.current) {
          setMessage(
            e.message + " Las coordenadas del pin siguen disponibles.",
          );
          notify.current?.({ ...provisional, addressStatus: "unavailable" });
        }
      } finally {
        if (version === revision.current) setBusy(false);
      }
    },
    [apiKey, baseURL],
  );
  const spec = useMemo(
    () => ({ center: point, markers: [point], zoom: 15, theme, accent }),
    [point, theme, accent],
  );
  return (
    <section
      className={`location-picker ${className}`}
      style={style}
      aria-label="Selector de ubicación"
    >
      <AddressSearch
        apiKey={apiKey}
        baseURL={baseURL}
        country={country}
        city={city}
        district={district}
        state={state}
        onSelect={select}
      />
      {baseURL && !apiKey ? (
        <div className="picker-map-empty" role="status">
          Introduce una clave pública de navegador para cargar el mapa.
        </div>
      ) : (
        <MapCanvas
          spec={spec}
          onSelect={select}
          tileBase={baseURL ? baseURL + "/v1/tiles" : "/console/tiles"}
          apiKey={apiKey}
        />
      )}
      <div className="picker-footer">
        <div>
          <strong>{point.placeName || "Ubicación seleccionada"}</strong>
          <p>
            {point.streetAddress ||
              "El pin conserva las coordenadas que elijas."}
          </p>
        </div>
        <output>
          {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
        </output>
      </div>
      <form
        className="coordinate-editor"
        onSubmit={(e) => {
          e.preventDefault();
          const latitude = Number(draftLat),
            longitude = Number(draftLng);
          if (
            Number.isFinite(latitude) &&
            Math.abs(latitude) <= 85 &&
            Number.isFinite(longitude) &&
            Math.abs(longitude) <= 180
          )
            select({ latitude, longitude });
        }}
      >
        <label>
          Latitud
          <input
            type="number"
            step="any"
            min="-85"
            max="85"
            required
            value={draftLat}
            onChange={(e) => setDraftLat(e.target.value)}
          />
        </label>
        <label>
          Longitud
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            required
            value={draftLng}
            onChange={(e) => setDraftLng(e.target.value)}
          />
        </label>
        <button type="submit" className="button secondary">
          Actualizar pin
        </button>
      </form>
      <p className="picker-message" role="status" aria-busy={busy}>
        {message}
      </p>
    </section>
  );
}
