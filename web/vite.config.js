import { defineConfig } from "vite";
const devAPI = process.env.MAPORA_DEV_API_URL || "http://127.0.0.1:4000";
export default defineConfig({
  server: {
    proxy: {
      "/console": devAPI,
      "/v1": devAPI,
      "/status": devAPI,
      "/health": devAPI,
      "/openapi.json": devAPI,
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
