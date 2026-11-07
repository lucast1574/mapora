export function parseAddresses(text) {
  if (text.length > 1024 * 1024)
    throw new Error("El archivo debe pesar menos de 1 MB.");
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!quoted && value !== "") {
        throw new Error("Comillas inválidas en el CSV.");
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Hay una celda con comillas sin cerrar.");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  const header = rows.shift()?.map((v) => v.trim().toLowerCase()) || [];
  const address = header.findIndex((v) =>
      ["address", "query", "direccion", "dirección"].includes(v),
    ),
    country = header.findIndex((v) =>
      ["country", "countrycode", "countrycodes", "pais", "país"].includes(v),
    );
  if (address < 0)
    throw new Error(
      'Incluye una columna "address". Puedes añadir "country" con el código de dos letras.',
    );
  if (rows.length < 1 || rows.length > 1000)
    throw new Error("Carga de 1 a 1000 direcciones por archivo.");
  return rows.map((row, i) => {
    const query = (row[address] || "").trim(),
      code = (row[country] || "").trim().toUpperCase();
    if (
      query.length < 2 ||
      new TextEncoder().encode(query).length > 200 ||
      (code && !/^[A-Z]{2}$/.test(code))
    )
      throw new Error(`Revisa la dirección o país de la fila ${i + 2}.`);
    return { id: String(i + 1), query, countrycodes: code };
  });
}
export function resultsCSV(results) {
  const cell = (v) =>
    '"' +
    (typeof v === "string"
      ? v.replace(/^[=+@\-\t\r]/, "'$&")
      : String(v ?? "")
    ).replaceAll('"', '""') +
    '"';
  return [
    [
      "id",
      "address",
      "status",
      "latitude",
      "longitude",
      "matchedAddress",
      "precision",
      "error",
    ],
    ...results.map((r) => [
      r.id,
      r.query,
      r.status,
      r.result?.latitude,
      r.result?.longitude,
      r.result?.address,
      r.result?.quality?.precision,
      r.code,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
