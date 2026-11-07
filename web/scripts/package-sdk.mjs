import { mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync("dist/downloads", { recursive: true });
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
