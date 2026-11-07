import { mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync("dist/downloads", { recursive: true });
copyFileSync("../sdk/index.d.ts", "../sdk/dist/index.d.ts");
if (!process.env.npm_execpath)
  throw new Error("Run SDK packaging through npm run build");
execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "pack",
    "../sdk",
    "--pack-destination",
    "dist/downloads",
    "--ignore-scripts",
  ],
  { stdio: "inherit" },
);
copyFileSync("public/mapora-client.js", "dist/downloads/mapora-client.js");
// Keep the original archive available at its versioned URL.
copyFileSync("../sdk/releases/mapora-react-2.0.0.tgz", "dist/downloads/mapora-react-2.0.0.tgz");
copyFileSync("../internal/mapsapi/data/peru-streets.json.gz", "dist/downloads/peru-streets.json.gz");
copyFileSync("../internal/mapsapi/data/peru-streets.json.manifest.json", "dist/downloads/peru-streets.manifest.json");
