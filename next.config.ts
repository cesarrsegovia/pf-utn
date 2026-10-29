import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize y pg resuelven drivers con require dinámicos que el bundler no puede
  // empaquetar; Nodemailer usa módulos nativos de Node (net, tls). Se excluyen del bundle
  // del servidor y se cargan desde node_modules.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore", "nodemailer"],
  // Cache Components queda desactivado (valor por defecto): SIGCAN es un panel interno
  // con datos por request y sesión en cookie; no se usa prerender parcial.
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
