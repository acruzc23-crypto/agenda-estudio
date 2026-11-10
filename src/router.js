// Rutas HTTP: API REST en /api/tareas y archivos estáticos de public/.
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { ValidationError } from "./store.js";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
const LIMITE_CUERPO = 10_000; // bytes

function enviarJson(res, estado, datos) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
  res.end(datos === undefined ? "" : JSON.stringify(datos));
}

async function leerJson(req) {
  let cuerpo = "";
  for await (const trozo of req) {
    cuerpo += trozo;
    if (cuerpo.length > LIMITE_CUERPO) throw new ValidationError("El cuerpo es demasiado grande");
  }
  if (cuerpo === "") return {};
  try {
    const datos = JSON.parse(cuerpo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) throw new Error();
    return datos;
  } catch {
    throw new ValidationError("El cuerpo debe ser un objeto JSON válido");
  }
}

async function servirEstatico(res, carpeta, ruta) {
  const relativa = normalize(ruta === "/" ? "/index.html" : ruta).replace(/^(\.\.[/\\])+/, "");
  const archivo = join(carpeta, relativa);
  if (!archivo.startsWith(carpeta)) return enviarJson(res, 403, { error: "Prohibido" });
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
    res.end(contenido);
  } catch {
    enviarJson(res, 404, { error: "No encontrado" });
  }
}

export function crearManejador(store, carpetaPublica) {
  return async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    try {
      if (pathname === "/api/tareas") {
        if (req.method === "GET") return enviarJson(res, 200, await store.listar());
        if (req.method === "POST") return enviarJson(res, 201, await store.crear(await leerJson(req)));
        return enviarJson(res, 405, { error: "Método no permitido" });
      }

      const coincidencia = pathname.match(/^\/api\/tareas\/([\w-]+)$/);
      if (coincidencia) {
        const id = coincidencia[1];
        if (req.method === "PATCH") {
          const tarea = await store.actualizar(id, await leerJson(req));
          return tarea ? enviarJson(res, 200, tarea) : enviarJson(res, 404, { error: "Tarea no encontrada" });
        }
        if (req.method === "DELETE") {
          return (await store.borrar(id))
            ? enviarJson(res, 204)
            : enviarJson(res, 404, { error: "Tarea no encontrada" });
        }
        return enviarJson(res, 405, { error: "Método no permitido" });
      }

      if (pathname.startsWith("/api/")) return enviarJson(res, 404, { error: "Ruta no encontrada" });
      if (req.method !== "GET") return enviarJson(res, 405, { error: "Método no permitido" });
      return servirEstatico(res, carpetaPublica, pathname);
    } catch (err) {
      if (err instanceof ValidationError) return enviarJson(res, 400, { error: err.message });
      console.error(err);
      return enviarJson(res, 500, { error: "Error interno" });
    }
  };
}
