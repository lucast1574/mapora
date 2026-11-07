export async function geoRequest(baseURL, key, path, body, signal) {
  const response = await fetch(baseURL + path, {
    method: body ? "POST" : "GET",
    credentials: "omit",
    headers: {
      "X-API-Key": key,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("El servidor no devolvió una respuesta válida.");
  }
  if (!response.ok) {
    const error = new Error(
      result.error || "No se pudo completar la consulta.",
    );
    error.code = result.code;
    error.status = response.status;
    error.retryAfter = Number(response.headers.get("Retry-After")) || 0;
    throw error;
  }
  return result;
}
