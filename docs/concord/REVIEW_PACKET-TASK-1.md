# Review Packet: TASK-1 — API REST de tareas de estudio

## Plan

API REST /api/tareas (GET, POST, PATCH, DELETE) con node:http, almacenamiento JSON con escritura atomica y cola de escrituras, y servidor de archivos estaticos para public/.

## Files touched

- `server.js`
- `src/store.js`
- `src/router.js`
- `test/api.test.js`
- `package.json`

## Guardrails checked

- Validacion de entrada con 400
- Limite de 10 KB en el cuerpo
- Bloqueo de path traversal

## Decisions

- Sin dependencias externas para que el proyecto se ejecute con solo Node
- Contrato de API acordado con codex:frontend por mensaje de Concord

## Reported outcome

_Not reported_

## Tests run

- `npm test (5/5 ok)`
- `curl --path-as-is para /../, ..%2f y %2e%2e -> 404`

## Assumptions

- Un solo proceso del servidor escribe data/tareas.json

## Diff size

+330 / -0

## Open questions

_None_

## Provenance

- tests_run: salida local de node --test

