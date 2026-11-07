import { defineConfig } from "vite";
export default defineConfig({
  base:"./",
  publicDir:false,
  build: {
    outDir: "../sdk/dist",
    emptyOutDir: true,
    lib: {
      entry: "sdk-entry.jsx",
      formats: ["es"],
      fileName: () => "mapora-react.js",
      cssFileName: "mapora",
    },
    rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
  },
});
