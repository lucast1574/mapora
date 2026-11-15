import { render, toPlainText } from "react-email";
import React from "react";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import { Transactional } from "../emails/Transactional.mjs";
const brand = {
  brand: "Mapora",
  site: "https://mapora.dev",
  accent: "#174c43",
  background: "#edf4f0",
  tagline: "Lugares, rutas y mapas de América",
};
const html = await render(React.createElement(Transactional, brand));
await mkdir("../internal/platform/mailtemplates", { recursive: true });
await writeFile("../internal/platform/mailtemplates/transactional.html", html);
await writeFile(
  "../internal/platform/mailtemplates/transactional.txt",
  toPlainText(html).replaceAll("{{.TITLE}}", "{{.Title}}"),
);
const logo = await readFile("public/logo.svg", "utf8");
await writeFile(
  "public/email-logo.png",
  new Resvg(logo, { fitTo: { mode: "width", value: 304 } }).render().asPng(),
);
console.log("React Email HTML, text and brand logo generated.");
