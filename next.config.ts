import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize y pg resuelven drivers con require dinámicos que el bundler no puede
  // empaquetar: se excluyen del bundle del servidor y se cargan desde node_modules.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
