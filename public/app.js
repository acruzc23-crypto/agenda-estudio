// Interfaz de la agenda. Usa el contrato acordado con el backend por Concord:
// GET/POST /api/tareas, PATCH/DELETE /api/tareas/:id
const $ = (selector) => document.querySelector(selector);
const lista = $("#lista");
const vacio = $("#vacio");
const resumen = $("#resumen");
const formulario = $("#formulario");
const error = $("#error");
const plantilla = $("#plantilla-tarea");

let tareas = [];
let filtro = "pendientes";

const hoy = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
const formatoFecha = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" });

async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    ...opciones,
    headers: opciones.body ? { "Content-Type": "application/json" } : {},
  });
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? `El servidor respondió ${res.status}`);
  return datos;
}

function mostrarError(mensaje) {
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

function textoFecha(entrega) {
  if (!entrega) return "sin fecha";
  const diferencia = Math.round((Date.parse(entrega) - Date.parse(hoy())) / 86_400_000);
  if (diferencia === 0) return "hoy";
  if (diferencia === 1) return "mañana";
  return formatoFecha.format(new Date(`${entrega}T12:00:00`));
}

function pintar() {
  const visibles = tareas.filter((t) =>
    filtro === "todas" ? true : filtro === "hechas" ? t.hecha : !t.hecha,
  );
  lista.replaceChildren(
    ...visibles.map((t) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      const fecha = nodo.querySelector(".fecha");
      fecha.textContent = textoFecha(t.entrega);
      fecha.classList.toggle("sin-fecha", !t.entrega);
      if (t.entrega) fecha.dateTime = t.entrega;
      nodo.querySelector(".titulo").textContent = t.titulo;
      nodo.querySelector(".materia").textContent = t.materia;
      const check = nodo.querySelector("input");
      check.checked = t.hecha;
      check.addEventListener("change", () => cambiarEstado(t, check.checked));
      const borrar = nodo.querySelector(".borrar");
      borrar.setAttribute("aria-label", `Borrar “${t.titulo}”`);
      borrar.addEventListener("click", () => borrarTarea(t));
      nodo.classList.toggle("hecha", t.hecha);
      nodo.classList.toggle("vencida", Boolean(t.entrega) && t.entrega < hoy());
      return nodo;
    }),
  );

  const pendientes = tareas.filter((t) => !t.hecha);
  const vencidas = pendientes.filter((t) => t.entrega && t.entrega < hoy()).length;
  resumen.textContent =
    tareas.length === 0
      ? "Todavía no anotas nada."
      : `${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"}` +
        (vencidas ? `, ${vencidas} con la fecha ya pasada.` : ".");

  vacio.hidden = visibles.length > 0;
  vacio.textContent =
    tareas.length === 0
      ? "Anota tu primera tarea arriba."
      : filtro === "hechas"
        ? "Aún no marcas ninguna como hecha."
        : filtro === "pendientes"
          ? "No tienes nada pendiente."
          : "";

  $("#materias").replaceChildren(
    ...[...new Set(tareas.map((t) => t.materia))].map((m) => Object.assign(document.createElement("option"), { value: m })),
  );
}

async function cargar() {
  try {
    tareas = await api("/api/tareas");
    pintar();
  } catch (err) {
    resumen.textContent = "No se pudo conectar con el servidor. Revisa que esté corriendo con npm start.";
  }
}

async function cambiarEstado(tarea, hecha) {
  try {
    Object.assign(tarea, await api(`/api/tareas/${tarea.id}`, { method: "PATCH", body: JSON.stringify({ hecha }) }));
    mostrarError("");
  } catch (err) {
    mostrarError(`No se guardó el cambio: ${err.message}`);
  }
  pintar();
}

async function borrarTarea(tarea) {
  if (!confirm(`¿Borrar “${tarea.titulo}”?`)) return;
  try {
    await api(`/api/tareas/${tarea.id}`, { method: "DELETE" });
    tareas = tareas.filter((t) => t.id !== tarea.id);
    mostrarError("");
    pintar();
  } catch (err) {
    mostrarError(`No se borró la tarea: ${err.message}`);
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = formulario.querySelector("button");
  const datos = Object.fromEntries(new FormData(formulario));
  boton.disabled = true;
  try {
    await api("/api/tareas", { method: "POST", body: JSON.stringify(datos) });
    tareas = await api("/api/tareas"); // el servidor devuelve el orden por fecha
    formulario.reset();
    mostrarError("");
    if (filtro === "hechas") filtro = "pendientes";
    actualizarFiltros();
    pintar();
    $("#titulo").focus();
  } catch (err) {
    mostrarError(`No se anotó la tarea: ${err.message}`);
  } finally {
    boton.disabled = false;
  }
});

function actualizarFiltros() {
  for (const b of document.querySelectorAll("[data-filtro]")) {
    b.setAttribute("aria-pressed", String(b.dataset.filtro === filtro));
  }
}
document.querySelector(".filtros").addEventListener("click", (evento) => {
  const boton = evento.target.closest("[data-filtro]");
  if (!boton) return;
  filtro = boton.dataset.filtro;
  actualizarFiltros();
  pintar();
});

cargar();
