import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  base: "./",
  build: { target: "es2022", outDir: "dist" },
});
