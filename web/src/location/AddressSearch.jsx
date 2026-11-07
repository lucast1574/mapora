import React, { useEffect, useId, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";

import { useSuggestions } from "./useSuggestions";
export { geoRequest } from "./geoClient";
export default function AddressSearch({
  apiKey,
  country = "",
  baseURL = "",
  onSelect,
  label = "Buscar dirección",
  bias,
  disabled = false,
}) {
  const id = useId(),
    root = useRef(null),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const chosen = useRef("");
  const { results, error, busy, done } = useSuggestions({
    query,
    apiKey,
    country,
    baseURL,
    bias,
    enabled: query !== chosen.current,
  });
  useEffect(() => {
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => setActive(-1), [query, apiKey, country]);
  function choose(place) {
    chosen.current = place.address;
    setQuery(place.address);
    setOpen(false);
    onSelect?.(place);
  }
  return (
    <div className={`address-search${open ? " is-open" : ""}`} ref={root}>
      <label htmlFor={id}>{label}</label>
      <div className="address-input">
        <Search size={18} />
        <input
          id={id}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={id + "-results"}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results.length > active && active >= 0
              ? id + "-" + active
              : undefined
          }
          autoComplete="off"
          placeholder={
            apiKey
              ? "Escribe calle, ciudad o lugar…"
              : "Introduce una clave para buscar"
          }
          disabled={!apiKey || disabled}
          value={query}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    i + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && results.length) choose(results[Math.max(active, 0)]);
            }
          }}
        />
      </div>
      {open && results.length > 0 && (
        <ul
          id={id + "-results"}
          role="listbox"
          aria-label="Direcciones sugeridas"
        >
          {results.map((p, i) => (
            <li
              key={p.id}
              id={id + "-" + i}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
            >
              <MapPin size={17} />
              <span>
                <strong>{p.placeName || p.street}</strong>
                <small>{p.streetAddress}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="search-feedback" role={error ? "alert" : "status"}>
        {error ||
          (busy
            ? "Buscando direcciones…"
            : open &&
                done &&
                query.length >= 3 &&
                query !== chosen.current &&
                !results.length &&
                apiKey
              ? "Sin coincidencias. Prueba añadiendo la ciudad o cambiando la dirección."
              : "")}
      </div>
    </div>
  );
}
