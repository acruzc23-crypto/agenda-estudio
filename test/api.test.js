import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearServidor } from "../server.js";

let servidor, base, carpeta;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), "agenda-"));
  servidor = crearServidor({ archivoDatos: join(carpeta, "tareas.json") });
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await rm(carpeta, { recursive: true, force: true });
});

const pedir = (ruta, metodo = "GET", cuerpo) =>
  fetch(base + ruta, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

test("empieza sin tareas", async () => {
  const res = await pedir("/api/tareas");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("crea, ordena, actualiza y borra tareas", async () => {
  const lejana = await (await pedir("/api/tareas", "POST", { titulo: "Informe", materia: "Física", entrega: "2026-12-20" })).json();
  const sinFecha = await (await pedir("/api/tareas", "POST", { titulo: "Leer capítulo 3", materia: "Álgebra" })).json();
  const cercana = await (await pedir("/api/tareas", "POST", { titulo: "Ejercicios pilas", materia: "Estructura de Datos", entrega: "2026-11-15" })).json();

  const lista = await (await pedir("/api/tareas")).json();
  assert.deepEqual(lista.map((t) => t.id), [cercana.id, lejana.id, sinFecha.id]);

  const patch = await pedir(`/api/tareas/${cercana.id}`, "PATCH", { hecha: true });
  assert.equal(patch.status, 200);
  assert.equal((await patch.json()).hecha, true);

  assert.equal((await pedir(`/api/tareas/${sinFecha.id}`, "DELETE")).status, 204);
  assert.equal((await (await pedir("/api/tareas")).json()).length, 2);
});

test("valida los datos de entrada", async () => {
  assert.equal((await pedir("/api/tareas", "POST", { titulo: "Sin materia" })).status, 400);
  assert.equal((await pedir("/api/tareas", "POST", { titulo: "X", materia: "Y", entrega: "15/11/2026" })).status, 400);
  const creada = await (await pedir("/api/tareas", "POST", { titulo: "X", materia: "Y" })).json();
  assert.equal((await pedir(`/api/tareas/${creada.id}`, "PATCH", { hecha: "si" })).status, 400);
  const malJson = await fetch(base + "/api/tareas", { method: "POST", body: "{no es json" });
  assert.equal(malJson.status, 400);
});

test("responde 404 a tareas y rutas inexistentes", async () => {
  assert.equal((await pedir("/api/tareas/no-existe", "PATCH", { hecha: true })).status, 404);
  assert.equal((await pedir("/api/tareas/no-existe", "DELETE")).status, 404);
  assert.equal((await pedir("/api/otra-cosa")).status, 404);
});

test("no permite salir de la carpeta public", async () => {
  // fetch normaliza "..", así que se usa http.request para enviar la ruta tal cual
  const { request } = await import("node:http");
  const estado = await new Promise((ok, falla) => {
    const req = request(base + "/", { path: "/../package.json" }, (res) => { res.resume(); ok(res.statusCode); });
    req.on("error", falla);
    req.end();
  });
  assert.notEqual(estado, 200);
});
