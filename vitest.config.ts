import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json: "@/..." apunta a src/.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Recrea la base de test una vez antes de toda la corrida.
    globalSetup: ["tests/setup/global.ts"],
    // Carga .env antes de cada archivo de test.
    setupFiles: ["tests/setup/entorno.ts"],
    // Los archivos comparten la misma base: se ejecutan de a uno para evitar interferencias.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
