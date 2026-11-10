// Interfaz de la agenda. Usa el contrato acordado con el backend por Concord:
// GET/POST /api/tareas, PATCH/DELETE /api/tareas/:id
const $ = (selector) => document.querySelector(selector);
const lista = $("#lista");
const formulario = $("#formulario");
const error = $("#error");
const plantilla = $("#plantilla-tarea");

let tareas = [];
let filtro = "pendientes";
let materiaElegida = null;
let recienCreada = null;

// Colores de bolígrafo: cada materia recibe siempre el mismo
const BOLIGRAFOS = ["#1f6feb", "#d7263d", "#2a9d5b", "#8e44ad", "#e67e22", "#0f8b8d", "#c2185b", "#6d4c41"];
function colorDe(materia) {
  let h = 0;
  for (const letra of materia.toLowerCase()) h = (h * 31 + letra.codePointAt(0)) >>> 0;
  return BOLIGRAFOS[h % BOLIGRAFOS.length];
}

const aIso = (fecha) => fecha.toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
const hoy = () => aIso(new Date());
const diasHasta = (iso) => Math.round((Date.parse(iso) - Date.parse(hoy())) / 86_400_000);
const fechaCorta = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" });
const fechaLarga = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long" });
const diaSemana = new Intl.DateTimeFormat("es-EC", { weekday: "short" });

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
  const d = diasHasta(entrega);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  return fechaCorta.format(new Date(`${entrega}T12:00:00`));
}

function textoFaltan(entrega, hecha) {
  if (!entrega || hecha) return "";
  const d = diasHasta(entrega);
  if (d < 0) return d === -1 ? "se pasó por 1 día" : `se pasó por ${-d} días`;
  if (d === 0) return "se entrega hoy";
  return d === 1 ? "falta 1 día" : `faltan ${d} días`;
}

function saludo(pendientes, vencidas, paraHoy) {
  const hora = new Date().getHours();
  const inicio = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  if (tareas.length === 0) return `${inicio}. Anota tu primera tarea y aquí verás cuándo toca entregarla.`;
  if (pendientes === 0) return `${inicio}. Ya no tienes nada pendiente, así que aprovecha para descansar.`;
  if (vencidas > 0) return `${inicio}. Hay ${vencidas === 1 ? "una entrega atrasada" : `${vencidas} entregas atrasadas`}; empieza por ahí.`;
  if (paraHoy > 0) return `${inicio}. Hoy ${paraHoy === 1 ? "se entrega una tarea" : `se entregan ${paraHoy} tareas`}.`;
  return `${inicio}. Vas al día; lo próximo está más abajo.`;
}

function pintarSemana() {
  const inicio = new Date();
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + i);
    const iso = aIso(fecha);
    const delDia = tareas.filter((t) => t.entrega === iso && !t.hecha);
    const li = document.createElement("li");
    li.className = "dia";
    li.classList.toggle("hoy", i === 0);
    li.classList.toggle("cargado", delDia.length > 0);
    li.innerHTML = `<span class="dia-nombre"></span><span class="dia-numero"></span><span class="dia-puntos"></span>`;
    li.querySelector(".dia-nombre").textContent = diaSemana.format(fecha).replace(".", "");
    li.querySelector(".dia-numero").textContent = fecha.getDate();
    li.querySelector(".dia-puntos").append(
      ...delDia.slice(0, 4).map((t) => Object.assign(document.createElement("i"), { style: `--c:${colorDe(t.materia)}`, title: t.titulo })),
    );
    li.setAttribute("aria-label", `${fechaLarga.format(fecha)}: ${delDia.length === 0 ? "sin entregas" : `${delDia.length} entrega${delDia.length === 1 ? "" : "s"}`}`);
    dias.push(li);
  }
  $("#dias").replaceChildren(...dias);
}

function pintarMaterias() {
  const materias = [...new Set(tareas.map((t) => t.materia))].sort((a, b) => a.localeCompare(b, "es"));
  if (materiaElegida && !materias.includes(materiaElegida)) materiaElegida = null;
  $("#materias-filtro").replaceChildren(
    ...(materias.length > 1 ? materias : []).map((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = m;
      b.style.setProperty("--c", colorDe(m));
      b.setAttribute("aria-pressed", String(m === materiaElegida));
      b.addEventListener("click", () => {
        materiaElegida = materiaElegida === m ? null : m;
        pintar();
      });
      return b;
    }),
  );
  $("#materias").replaceChildren(...materias.map((m) => Object.assign(document.createElement("option"), { value: m })));
}

function pintar() {
  const visibles = tareas.filter(
    (t) =>
      (filtro === "todas" || (filtro === "hechas" ? t.hecha : !t.hecha)) &&
      (!materiaElegida || t.materia === materiaElegida),
  );
  lista.replaceChildren(
    ...visibles.map((t) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      const fecha = nodo.querySelector(".fecha");
      fecha.textContent = textoFecha(t.entrega);
      if (t.entrega) fecha.dateTime = t.entrega;
      nodo.querySelector(".faltan").textContent = textoFaltan(t.entrega, t.hecha);
      nodo.querySelector(".titulo").textContent = t.titulo;
      nodo.querySelector(".materia-nombre").textContent = t.materia;
      nodo.querySelector(".punto").style.setProperty("--c", colorDe(t.materia));
      const check = nodo.querySelector("input");
      check.checked = t.hecha;
      check.addEventListener("change", () => cambiarEstado(t, check.checked));
      const borrar = nodo.querySelector(".borrar");
      borrar.setAttribute("aria-label", `Borrar “${t.titulo}”`);
      borrar.addEventListener("click", () => borrarTarea(t));
      const d = t.entrega ? diasHasta(t.entrega) : null;
      nodo.classList.toggle("hecha", t.hecha);
      nodo.classList.toggle("sin-fecha", !t.entrega);
      nodo.classList.toggle("vencida", d !== null && d < 0);
      nodo.classList.toggle("urgente", d !== null && d >= 0 && d <= 1);
      nodo.classList.toggle("nueva-entrada", t.id === recienCreada);
      return nodo;
    }),
  );
  recienCreada = null;

  const pendientes = tareas.filter((t) => !t.hecha);
  const vencidas = pendientes.filter((t) => t.entrega && diasHasta(t.entrega) < 0).length;
  const paraHoy = pendientes.filter((t) => t.entrega === hoy()).length;
  const hechas = tareas.length - pendientes.length;
  $("#saludo").textContent = saludo(pendientes.length, vencidas, paraHoy);
  $("#resumen").textContent =
    tareas.length === 0 ? "Aún no hay tareas." : `Llevas ${hechas} de ${tareas.length} tareas hechas.`;
  $("#trazo").style.strokeDashoffset = String(100 - (tareas.length ? (hechas / tareas.length) * 100 : 0));

  const vacio = $("#vacio");
  vacio.hidden = visibles.length > 0;
  $("#vacio-texto").textContent =
    tareas.length === 0
      ? "Hoja en blanco. Anota tu primera tarea arriba."
      : filtro === "hechas"
        ? "Todavía no tachas ninguna. Ya llegará."
        : materiaElegida
          ? `Nada pendiente en ${materiaElegida}.`
          : "Nada pendiente. Bien hecho.";

  pintarSemana();
  pintarMaterias();
}

function sellar() {
  const sello = $("#sello");
  sello.classList.remove("activo");
  void sello.offsetWidth; // reinicia la animación
  sello.classList.add("activo");
}

async function cargar() {
  $("#fecha-hoja").textContent = fechaLarga.format(new Date());
  try {
    tareas = await api("/api/tareas");
    pintar();
  } catch {
    $("#saludo").textContent = "No se pudo conectar con el servidor. Revisa que esté corriendo con npm start.";
    $("#resumen").textContent = "";
  }
}

async function cambiarEstado(tarea, hecha) {
  try {
    Object.assign(tarea, await api(`/api/tareas/${tarea.id}`, { method: "PATCH", body: JSON.stringify({ hecha }) }));
    mostrarError("");
    if (hecha) sellar();
  } catch (err) {
    mostrarError(`No se guardó el cambio: ${err.message}`);
  }
  // deja ver el tachado antes de que la tarea salga de "Pendientes"
  setTimeout(pintar, hecha && filtro === "pendientes" ? 650 : 0);
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
    const creada = await api("/api/tareas", { method: "POST", body: JSON.stringify(datos) });
    tareas = await api("/api/tareas"); // el servidor devuelve el orden por fecha
    recienCreada = creada.id;
    formulario.reset();
    $("#materia").value = datos.materia; // casi siempre se anotan varias de la misma materia
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
