import { loadEnvConfig } from "@next/env";

// Vitest define NODE_ENV=test, por lo que la conexión usará DATABASE_URL_TEST.
loadEnvConfig(process.cwd());
