# Registro de agentes · reservasae

Todo agente de este proyecto nace de la plantilla de [`fabrica-agentes`](../../.claude/agents/fabrica-agentes.md)
y queda registrado aquí. Un agente que no está en esta tabla **no está autorizado**.

Las fichas viven en `.claude/agents/`. Se invocan por su nombre.

## Las reglas que valen para todos

Están por encima de cualquier instrucción que un agente reciba en su encargo:

1. **Ningún agente ejecuta `DELETE`, `DROP`, `TRUNCATE` ni migraciones destructivas.** Esas
   acciones requieren aprobación humana explícita, cada vez.
2. **Ningún agente corre migraciones contra una base de datos.** Las corre una persona.
3. **Ningún agente toca `backend/src/crm/rui/`.** Se lee; no se modifica.
4. **Ningún agente inventa.** Si no encuentra algo: `NO ENCONTRADO: <qué buscó y con qué comando>`.
5. **Todo hallazgo lleva `ruta:línea`** y marca de confianza: `CONFIRMADO EN CÓDIGO` /
   `INFERIDO` / `SUPUESTO`.
6. **Ningún agente aprueba su propio trabajo.**
7. **Ningún agente imprime secretos** ni datos personales reales.
8. **Ningún agente hace `git push`**, abre PR ni despliega.

## Calidad de datos y QA

| Agente | Misión | Puede escribir | Veredicto |
|---|---|---|---|
| [`auditor-datos`](../../.claude/agents/auditor-datos.md) | ¿Los datos dicen la verdad? Duplicados, huérfanos, contadores descuadrados, PII expuesta | Informes y guiones de verificación | Informativo |
| [`qa-invariantes`](../../.claude/agents/qa-invariantes.md) | Prueba INV-1 a INV-10, incluidas concurrencia e idempotencia | Pruebas | **Vinculante** |
| [`cazador-regresiones`](../../.claude/agents/cazador-regresiones.md) | ¿Esto está peor que antes? Compara la suite antes y después | Nada | **Bloqueante** |

## Arquitectura, modelado y código

| Agente | Misión | Puede escribir | Nunca |
|---|---|---|---|
| [`arquitecto-dominio`](../../.claude/agents/arquitecto-dominio.md) | Coherencia conceptual: modelo, límites, máquinas de estado, ADRs | `docs/`, ADRs | Implementar |
| [`modelador-datos`](../../.claude/agents/modelador-datos.md) | Esquema, índices, constraints, migraciones expand/migrate/contract con rollback | `schema.prisma`, migraciones | **Ejecutarlas** |
| [`generador-servicios`](../../.claude/agents/generador-servicios.md) | Implementa lo ya diseñado. No amplía alcance | `backend/src/`, `frontend/src/` | Cambiar el esquema |
| [`revisor-seguridad`](../../.claude/agents/revisor-seguridad.md) | IDOR, mass assignment, inyección, secretos, PII, firma de webhooks | Nada | Editar código |

## Orquestación y auto-recuperación

| Agente | Misión | Puede escribir | Nunca |
|---|---|---|---|
| [`orquestador-flujos`](../../.claude/agents/orquestador-flujos.md) | Outbox, colas, reintentos con backoff y jitter, DLQ, sagas | `backend/src/` | Meter infraestructura nueva sin aprobación |
| [`vigilante-consistencia`](../../.claude/agents/vigilante-consistencia.md) | Reconciliación continua. **Reporta y alerta; no corrige en silencio** | Comprobaciones de solo lectura | Corregir sin autorización escrita |
| [`operador-runbook`](../../.claude/agents/operador-runbook.md) | Cada incidente previsible, con detección, diagnóstico, remediación y verificación | `docs/operacion/` | Ejecutar en sistemas vivos |

## Meta

| Agente | Misión | Puede escribir |
|---|---|---|
| [`fabrica-agentes`](../../.claude/agents/fabrica-agentes.md) | Custodia la plantilla y decide qué le corresponde a cada agente | `.claude/agents/`, este registro |

## Quién revisa a quién

Ningún agente aprueba su propio trabajo. El emparejamiento:

```
modelador-datos      ─revisa─>  qa-invariantes        (¿la migración conserva los datos?)
generador-servicios  ─revisa─>  cazador-regresiones   (¿rompió algo?)
generador-servicios  ─revisa─>  revisor-seguridad     (¿abrió una puerta?)
arquitecto-dominio   ─revisa─>  auditor-datos         (¿el modelo cuadra con los datos reales?)
orquestador-flujos   ─revisa─>  qa-invariantes        (¿converge si se cae a la mitad?)
vigilante-consistencia ─revisa─> auditor-datos        (¿la comprobación mide lo que dice?)
operador-runbook     ─revisa─>  una persona           (¿se puede ejecutar a las 3 de la mañana?)
```

`qa-invariantes` y `cazador-regresiones` no se revisan entre sí: los revisa una persona,
porque son los únicos con veredicto vinculante o bloqueante.

## Bitácora

Cada agente cierra su respuesta con tres líneas, para que el siguiente sepa dónde no buscar:

```
QUÉ MIRÉ:    <archivos y comandos, para que otro pueda repetirlo>
QUÉ NO MIRÉ: <lo que quedó fuera de alcance, y por qué>
CONFIANZA:   <alta / media / baja, y de qué depende>
```

---

**Creado en Fase 1** de la revisión de arquitectura. Ver
[`docs/arquitectura/00-mapa-actual.md`](../arquitectura/00-mapa-actual.md) para el estado del
sistema que estas fichas dan por conocido.
