# Review Packet: TASK-2 — Interfaz web de la agenda

## Plan

Pagina tipo cuaderno cuadriculado: formulario para anotar tareas, lista ordenada por entrega con la fecha en el margen, marcar como hecha, borrar, filtros y resaltado de tareas vencidas. Modo oscuro y version movil.

## Files touched

- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `docs/captura.png`
- `docs/captura-movil.png`

## Guardrails checked

- Foco visible con teclado
- prefers-reduced-motion
- Contraste en tema claro y oscuro

## Decisions

- No se toco server.js porque Concord marco solapamiento con TASK-1
- JS sin frameworks para que el proyecto no tenga dependencias

## Reported outcome

_Not reported_

## Tests run

- `Playwright: capturas a 1100px, 390px y modo oscuro sin scroll horizontal`
- `Playwright: crear tarea, marcarla, filtrar Hechas y validar formulario vacio`

## Assumptions

- El usuario usa un navegador moderno con fetch y modulos ES

## Diff size

_Unknown_

## Open questions

_None_

## Provenance

- tests_run: script local de Playwright

