export async function api(path, method = "GET", body, headers = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la acción.");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}
export const appURL = location.hostname.endsWith("nexode.app")
  ? "https://app-mapora.nexode.app"
  : "";
export const siteURL = location.hostname.endsWith("nexode.app")
  ? "https://mapora.nexode.app"
  : "";
export const number = (value) =>
  new Intl.NumberFormat("es-PE").format(value || 0);
export const date = (value) =>
  new Date(value).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
