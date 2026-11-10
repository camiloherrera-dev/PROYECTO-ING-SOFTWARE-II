# Reporte de QA — Sprint 3

**Responsable:** Sofía Victoria Vega Suárez  
**Fecha del reporte:** 3 de noviembre de 2026  
**Versión evaluada:** `develop`, commit `ae649e9` (incluye la integración de HU-10 mediante PR #37)  
**Dedicación estimada:** entre 8 y 9 horas de trabajo, según estimación retrospectiva de QA; no se utilizó cronómetro.  
**Alcance:** verificación del carrito, disponibilidad, checkout y confirmación de pedidos mediante Postman, más revisión de resultados automatizados ya registrados.

## Resumen

Se preparó un entorno Docker aislado basado en `develop` para ejecutar la colección Postman sin detener los contenedores que ya estaban activos. El proxy de QA quedó en `http://localhost:18182` y el mock de Catálogo en `http://localhost:14001`.

Se reportaron como aprobados los casos con resultado confirmado de Sprint 2 y Sprint 3, incluidos los escenarios negativos cuyo resultado esperado era una respuesta HTTP de error. TC-43 y TC-46 continúan fallando por defectos de disponibilidad que no se corrigieron ni integraron en `develop` durante el periodo de entrega.

## Actividades y resultados

| Casos / actividad | Resultado |
|---|---|
| TC-01 a TC-21 | Sofía recuerda haberlos ejecutado anteriormente, pero no recuerda si fue mediante Postman o un comando. La matriz no conserva resultados ni evidencia individual, por lo que queda pendiente consolidar ese registro. |
| TC-22, TC-23, TC-25, TC-28, TC-41 y TC-42 | Pasa, según resultados de QA previamente documentados en `docs/resultados-qa-sprint2-2026-10-22.md`. |
| TC-24 a TC-39 | Pasa según ejecución Postman reportada por Sofía. TC-26, TC-27 y TC-31 produjeron respuestas de error esperadas y se cuentan como aprobados. |
| TC-40 | Pasa en prueba unitaria: `tests/cartTotals.test.js`, 6/6. Incluye fallos asíncronos y síncronos de Descuentos y timeout. |
| TC-43 | Falla. La consulta responde 200 y `disponible: true`, pero marca como `INACTIVO` productos que están activos y tienen stock; se esperaba `OK`. |
| TC-44 y TC-45 | Pasa según ejecución Postman reportada; se restauraron el stock y el estado del producto al terminar. |
| TC-46 | Falla. El cambio de precio no genera `PRECIO_CAMBIO` ni devuelve `precioAnterior`; el producto aparece con estado `INACTIVO`. Se restauró el precio de prueba. |
| TC-47, TC-48 y TC-49 | Pasa según ejecución Postman reportada. TC-48 devolvió 201 y el total esperado de 343.012. |
| TC-50 a TC-58 | Pasa según confirmación de Sofía tras ejecutar Postman sobre la versión con HU-10 integrada. Los 404, 409 y 401 de TC-53 a TC-56 y TC-58 eran resultados negativos esperados; TC-55 incluyó restauración de stock y reintento. |

Las pruebas automatizadas Node y Jest, y la prueba unitaria de TC-40, constan en `docs/resultados-qa-integracion-2026-11-02.md`. La ejecución E2E `npm run e2e -- --pedido` realizada antes de integrar HU-10 devolvió 404 en confirmación. No se repitió esa E2E después del merge de HU-10.

## Trabajo pendiente y motivos

- **Correcciones de TC-43 y TC-46:** no se realizaron durante este sprint porque los cambios correctivos no fueron implementados ni integrados en `develop` antes del cierre. QA identificó y documentó los defectos; la modificación del endpoint corresponde al trabajo de desarrollo. Por eso ambos casos permanecen como *Falla* y no se presentan como aprobados.
- **TC-01 a TC-21:** aunque Sofía recuerda haberlos ejecutado, el método, los resultados por caso y la evidencia no quedaron registrados en la matriz disponible. Se requiere recuperar o repetir esa información antes de afirmar el estado de cada caso individual.
- **Regresión final completa:** queda pendiente volver a ejecutar TC-01 a TC-58 y `npm run e2e -- --pedido` cuando se resuelvan los defectos y esté disponible una versión final integrada. La confirmación previa de TC-24 a TC-42 y TC-50 a TC-58 no sustituye esa corrida final integral.
- **Seguimiento en Jira:** vincular en la matriz las claves de los Bugs correspondientes a TC-43 y TC-46, si todavía no están añadidas.

## Cierre

La dedicación total estimada para las tareas de QA de este reporte fue de **8 a 9 horas**. El resultado de Sprint 3 incluye pruebas aprobadas y dos defectos abiertos de disponibilidad. La falta de corrección de esos defectos se registra como una dependencia de implementación del equipo de desarrollo, no como una verificación aprobada por QA.

## Evidencia relacionada

- `docs/plan-pruebas.md`: matriz de casos y estado registrado.
- `docs/resultados-qa-integracion-2026-11-02.md`: evidencia de integración y resultados comunicados por Postman.
- PR #37: integración de HU-10 en `develop`.
- PR #38: actualización de documentación QA.
