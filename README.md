# Gestor de causas penales

Gestor de causas penales para estudios jurídicos chicos (1 a 5 abogados), pensado para el
**proceso penal acusatorio de Neuquén** (CPP Ley 2784): la agenda de audiencias es el eje,
no el expediente.

> Estado: en construcción. Todos los datos del repositorio son **ficticios**.

La documentación completa (arquitectura, cómo correrlo y capturas) se completa a medida que
avanza el [ROADMAP](ROADMAP.md).

## Cómo se construye

El proyecto se desarrolla con un flujo autónomo de agentes de IA: Claude Code orquesta,
OpenCode escribe el backend con modelos gratuitos y Claude el frontend. Cada tarea del
[ROADMAP](ROADMAP.md) termina en un PR verificado y documentado. Detalle en
[docs/AUTOPILOT.md](docs/AUTOPILOT.md) y decisiones en [docs/DECISIONS.md](docs/DECISIONS.md).
