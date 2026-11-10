// Almacenamiento de tareas en un archivo JSON, sin dependencias externas.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {}

function limpiarTexto(valor, campo, max) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ValidationError(`El campo "${campo}" es obligatorio`);
  }
  const texto = valor.trim();
  if (texto.length > max) throw new ValidationError(`"${campo}" admite máximo ${max} caracteres`);
  return texto;
}

function validarEntrega(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !FECHA.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new ValidationError('"entrega" debe tener el formato AAAA-MM-DD');
  }
  return valor;
}

// Tareas sin fecha van al final; las demás, de la más próxima a la más lejana.
function ordenar(tareas) {
  return [...tareas].sort((a, b) => {
    if (a.entrega === b.entrega) return a.creada.localeCompare(b.creada);
    if (a.entrega === null) return 1;
    if (b.entrega === null) return -1;
    return a.entrega.localeCompare(b.entrega);
  });
}

export class TaskStore {
  constructor(archivo) {
    this.archivo = archivo;
    this.cola = Promise.resolve(); // serializa las escrituras
  }

  async #leer() {
    try {
      return JSON.parse(await readFile(this.archivo, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async #guardar(tareas) {
    await mkdir(dirname(this.archivo), { recursive: true });
    const temporal = `${this.archivo}.${process.pid}.tmp`;
    await writeFile(temporal, JSON.stringify(tareas, null, 2));
    await rename(temporal, this.archivo); // escritura atómica
  }

  #enCola(operacion) {
    const resultado = this.cola.then(operacion);
    this.cola = resultado.catch(() => {});
    return resultado;
  }

  async listar() {
    return ordenar(await this.#leer());
  }

  crear(datos) {
    return this.#enCola(async () => {
      const tarea = {
        id: randomUUID(),
        titulo: limpiarTexto(datos.titulo, "titulo", 120),
        materia: limpiarTexto(datos.materia, "materia", 60),
        entrega: validarEntrega(datos.entrega),
        hecha: false,
        creada: new Date().toISOString(),
      };
      const tareas = await this.#leer();
      tareas.push(tarea);
      await this.#guardar(tareas);
      return tarea;
    });
  }

  actualizar(id, cambios) {
    return this.#enCola(async () => {
      const tareas = await this.#leer();
      const tarea = tareas.find((t) => t.id === id);
      if (!tarea) return null;
      if ("titulo" in cambios) tarea.titulo = limpiarTexto(cambios.titulo, "titulo", 120);
      if ("materia" in cambios) tarea.materia = limpiarTexto(cambios.materia, "materia", 60);
      if ("entrega" in cambios) tarea.entrega = validarEntrega(cambios.entrega);
      if ("hecha" in cambios) {
        if (typeof cambios.hecha !== "boolean") throw new ValidationError('"hecha" debe ser true o false');
        tarea.hecha = cambios.hecha;
      }
      await this.#guardar(tareas);
      return tarea;
    });
  }

  borrar(id) {
    return this.#enCola(async () => {
      const tareas = await this.#leer();
      const restantes = tareas.filter((t) => t.id !== id);
      if (restantes.length === tareas.length) return false;
      await this.#guardar(restantes);
      return true;
    });
  }
}
