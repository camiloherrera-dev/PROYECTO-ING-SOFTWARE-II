# Reporte de QA — Sprint 2

**Responsable:** Sofía Victoria Vega Suárez  
**Fecha de cierre:** 22 de octubre de 2026  
**Versión evaluada:** `develop`, commit `fae1db9` (integración registrada en PR #21)  
**Alcance:** regresión del carrito y verificaciones de HU-04 a HU-07, persistencia y concurrencia.

## Resumen

Se sincronizó la rama de trabajo con los cambios integrados en `develop`, se levantó el entorno local y se ejecutaron las pruebas automatizadas disponibles, la colección Postman y cuatro verificaciones manuales de Redis y concurrencia.

Las pruebas de Jest y Node pasaron. En cambio, la colección Postman detectó que el desglose y los cálculos de descuentos no cumplen los casos de aceptación, y que un producto marcado como no disponible sigue incluido en el total. Estos hallazgos se reportaron como Bugs en Jira.

## Actividades realizadas

- Se actualizó la rama local con la versión integrada de `develop` (PR #21, commit `fae1db9`).
- Se preparó el entorno Docker local. Kong se ejecutó en el puerto local `18000` porque el puerto `8000` estaba ocupado por otro proyecto en esta computadora. Este ajuste es local y no modifica el entorno de los demás integrantes.
- Se ejecutaron `npm run test:jest -- --cacheDirectory .jest-cache` y `npm run test:node`.
- Se ejecutó la colección `docs/postman/carrito.json` a través de Kong.
- Se hicieron las verificaciones manuales TC-25, TC-28, TC-41 y TC-42 con usuarios de prueba aislados.
- Se actualizaron los resultados de QA en `docs/plan-pruebas.md` y en `docs/resultados-qa-sprint2-2026-10-22.md`.
- Se reportaron en Jira los fallos observados en los casos de descuentos y disponibilidad.

## Resultados

| Prueba | Resultado |
|---|---|
| Jest | 6 suites aprobadas; 61 de 61 pruebas pasaron. |
| Node | 19 de 19 pruebas pasaron. |
| Newman / Postman | 84 solicitudes ejecutadas. De 139 aserciones, 130 pasaron y 9 fallaron. |
| TC-22 y TC-23 | Las claves Redis inspeccionadas existían con los ítems y un TTL aproximado de siete días. |
| TC-25 | Al eliminar el último producto, la API respondió 200 y Redis informó `EXISTS = 0`. |
| TC-28 | Al vaciar el carrito, la API respondió 200 y Redis informó `EXISTS = 0`. |
| TC-41 | Después de eliminar un producto y dejar otro, Redis conservó el producto restante y el TTL fue 604.800 segundos. |
| TC-42 | De 20 POST simultáneos, uno respondió 201 y 19 respondieron 200; la cantidad final fue 20. |

## Hallazgos y trabajo pendiente

- **TC-32 a TC-38 — descuentos:** fallaron aserciones del desglose y de los descuentos por producto y por carrito. La respuesta no contenía algunos campos requeridos y los valores calculados no coincidían con los criterios de aceptación.
- **TC-39 — disponibilidad:** después de marcar `prod_002` como no disponible, el total observado fue 149.700; se esperaba 127.245, contando solo la camiseta.
- **TC-40 — modo degradado:** no se pudo ejecutar. En la versión revisada aún no estaba integrado el módulo/cliente de descuentos ni había un mecanismo disponible para simular el fallo de `getActiveRules`. Por tanto, este caso queda pendiente de esa dependencia y no se reporta como una falla observada.
- **Revalidación:** queda pendiente repetir TC-32 a TC-39 cuando estén integradas las correcciones. El resto de verificaciones manuales planificadas para TC-25, TC-28, TC-41 y TC-42 sí se completaron.

## Tiempo y disponibilidad de integración

No se utilizó cronómetro; como estimación retrospectiva, la dedicación activa de QA fue de **aproximadamente 2 a 3 horas**, incluyendo preparación del entorno, ejecución de las pruebas, verificaciones manuales y registro de resultados. La estimación no incluye tiempos de espera por integraciones.

Según la cronología del trabajo, la validación integral pudo comenzar aproximadamente **tres horas antes de la entrega**, cuando estuvieron disponibles en `develop` los cambios necesarios para levantar el entorno y probar los endpoints integrados. Esto redujo el tiempo disponible para completar los casos dependientes de descuentos y repetir pruebas después de eventuales correcciones.

## Evidencia relacionada

- `docs/plan-pruebas.md`: matriz actualizada con los resultados registrados.
- `docs/resultados-qa-sprint2-2026-10-22.md`: resumen técnico de ejecuciones, fallos y verificaciones Redis.
- `docs/postman/carrito.json`: colección utilizada para la regresión automatizada.
- Jira: Bugs creados para los hallazgos de descuentos y disponibilidad (agregar aquí las claves de Jira, si se desea).

