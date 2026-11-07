import { useEffect, useState } from "react";
import { geoRequest } from "./geoClient.js";
const empty = { results: [], error: "", busy: false, done: false };
export function useSuggestions({
  query,
  apiKey,
  country = "",
  baseURL = "",
  bias,
  enabled = true,
}) {
  const [state, setState] = useState(empty);
  useEffect(() => {
    setState(empty);
    if (!enabled || !apiKey || query.trim().length < 3) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setState({ ...empty, busy: true });
      const params = new URLSearchParams({ q: query, limit: "6" });
      if (country) params.set("countrycodes", country);
      if (bias) {
        params.set("lat", bias.latitude);
        params.set("lng", bias.longitude);
      }
      try {
        const value = await geoRequest(
          baseURL,
          apiKey,
          "/v1/autocomplete?" + params,
          undefined,
          controller.signal,
        );
        if (active) setState({ ...empty, results: value.results, done: true });
      } catch (e) {
        if (active && e.name !== "AbortError")
          setState({ ...empty, error: e.message, done: true });
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    apiKey,
    country,
    baseURL,
    bias?.latitude,
    bias?.longitude,
    enabled,
  ]);
  return state;
}
