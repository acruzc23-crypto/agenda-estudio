import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TaskStore } from "./src/store.js";
import { crearManejador } from "./src/router.js";

const raiz = dirname(fileURLToPath(import.meta.url));

export function crearServidor({ archivoDatos = join(raiz, "data", "tareas.json") } = {}) {
  const store = new TaskStore(archivoDatos);
  return createServer(crearManejador(store, join(raiz, "public")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 3000);
  crearServidor().listen(puerto, () => {
    console.log(`Agenda de Estudio en http://localhost:${puerto}`);
  });
}
