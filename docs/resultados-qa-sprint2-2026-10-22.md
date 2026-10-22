# Resultados de QA — Sprint 2

**Fecha:** 2026-10-22  
**Responsable:** Sofía Victoria Vega Suárez  
**Versión revisada:** `develop` sincronizada, commit `fae1db9` (PR #21).  
**Entorno:** Docker Compose local; API a través de Kong en `http://localhost:18000` porque el puerto 8000 estaba ocupado por otro proyecto.

## Resumen de ejecución

- `npm run test:jest -- --cacheDirectory .jest-cache`: 6 suites, 61/61 pruebas aprobadas.
- `npm run test:node`: 19/19 pruebas aprobadas.
- Colección `docs/postman/carrito.json` con Newman: 84 solicitudes; 139 aserciones, 130 aprobadas y 9 fallidas.
- La colección ejecutó sus solicitudes de limpieza y restauró `prod_002` como activo en el mock.
- Verificaciones manuales TC-25, TC-28, TC-41 y TC-42 ejecutadas con usuarios de prueba aislados.

## Casos automatizados

| Casos | Resultado | Observación |
|---|---|---|
| TC-01 a TC-21 | Pasa | Flujos base de carrito, JWT, catálogo y aislamiento. |
| TC-24 a TC-31 | Pasa | Eliminación de ítems/carrito, idempotencia, autorización y aislamiento. |
| TC-32 | Falla | La respuesta GET no incluye `descuentoItems`; la identidad de totales no puede evaluarse (`NaN`). |
| TC-33, TC-34c | Falla | No se aplican los descuentos esperados por jean ni por cantidad de camisetas. |
| TC-34a/b, TC-39 preparación y demás preparación | Pasa | Las solicitudes y respuestas HTTP funcionan; las aserciones funcionales de descuentos se detallan abajo. |
| TC-35 a TC-38 | Falla | Falta `descuentoCarrito` y los descuentos/totales no cumplen los valores de aceptación. |
| TC-39 | Falla | Tras desactivar `prod_002`, el total observado fue 149.700; se esperaba 127.245, solo con la camiseta. |

**Defecto principal:** los endpoints integrados de carrito y eliminación están disponibles, pero el cálculo y desglose de descuentos HU-06/HU-07 no cumple el contrato probado. TC-32 y TC-33 a TC-39 deben quedar abiertos hasta integrar/corregir el módulo de descuentos y volver a ejecutar la colección.

## Redis: verificación manual

| Caso | Resultado observado | Estado |
|---|---|---|
| TC-22/23 | Claves inspeccionadas existían, contenían ítems y tenían TTL entre 604.692 y 604.697 segundos (aprox. 7 días). | Pasa para las claves inspeccionadas |
| TC-25 | DELETE del último producto respondió 200; Redis `EXISTS carrito:{userId}` devolvió 0. | Pasa |
| TC-28 | DELETE del carrito respondió 200; Redis `EXISTS carrito:{userId}` devolvió 0. | Pasa |
| TC-41 | Tras borrar un producto dejando otro, Redis conservó solo `prod_001` y devolvió TTL 604.800 segundos. | Pasa |
| TC-42 | 20 POST simultáneos: 1 respuesta 201, 19 respuestas 200; GET final devolvió cantidad 20. | Pasa |

## Pendiente para cerrar QA

- TC-40: probar modo degradado cuando falle el módulo de descuentos; pendiente de disponibilidad de ese módulo.
- Corregir los fallos de descuentos y repetir TC-32 a TC-39.
- Adjuntar la salida de Redis/solicitudes como evidencia al reporte de QA y a los Bugs correspondientes.

## Nota de entorno

El proyecto `auditorias_backend` ya ocupaba el puerto 8000; por eso Kong se levantó temporalmente en 18000 mediante `docker-compose.qa-override.yml`. El archivo de override es local y no debe incluirse en un commit sin acordarlo con el equipo.
