import { execSync } from "node:child_process";

/** Se ejecuta una vez por corrida: deja la base de test con el esquema y los datos iniciales. */
export default function prepararBaseDeTest() {
  execSync("npm run db:reset:test", { stdio: "inherit" });
}
