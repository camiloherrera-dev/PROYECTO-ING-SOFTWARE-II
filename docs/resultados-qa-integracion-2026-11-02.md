# Resultados QA de integración — 2 de noviembre de 2026

## Entorno

- Rama y revisión: `develop`, commit `0045b12`.
- Servicios: Docker Compose con API y mock de Catálogo reconstruidos desde el código actual; Redis y Kong activos.
- URL de Kong: `http://localhost:18000`.
- Para evitar usar imágenes antiguas se ejecutó `docker compose up --build -d carrito catalog-mock` antes de la regresión E2E.

## Pruebas automatizadas

| Comando | Resultado |
|---|---|
| `npm run test:node` | Pasa: 26/26 pruebas. |
| `npm run test:jest -- --cacheDirectory .jest-cache` | Pasa: 90/90 pruebas en 10 suites. |
| `npm run test:jest -- --cacheDirectory .jest-cache tests/cartTotals.test.js` | Pasa: 6/6; TC-40 unitario, incluidos error asíncrono, error síncrono y timeout de Descuentos. |

## E2E Sprint 2 por Kong

Comando ejecutado desde PowerShell:

```powershell
$env:BASE_URL = 'http://localhost:18000'
npm run e2e
```

Resultado: **12/12 verificaciones pasan**. Se validaron autenticación sin token, vaciado idempotente, agregar y acumular ítems, rechazo de producto inactivo, consulta de total con descuentos, actualización de cantidad, validación de cantidad cero, eliminación de ítem, segundo DELETE y vaciado final.

La aserción de consulta valida `total = 343012` y `descuentoTotal = 66488`, sin comprobar por separado cada campo del desglose. En la ejecución posterior de Postman, Sofía informó que TC-32 y TC-35 y los demás casos TC-26 a TC-39 dieron los resultados funcionales esperados; la matriz se actualizó con ese reporte.

## Verificación parcial de Sprint 3

Comando:

```powershell
$env:BASE_URL = 'http://localhost:18000'
npm run e2e -- --pedido
```

Resultados relevantes:

- Las 12 verificaciones del flujo Sprint 2 vuelven a pasar.
- Disponibilidad devuelve 200 con `disponible: true`.
- Crear checkout devuelve 201, `checkoutId` y total `343012`.
- La aserción de esa corrida E2E no comprueba cada estado de ítem de TC-43 ni `expiraEn` de TC-48. La ejecución Postman posterior completó la comprobación de TC-48; TC-43 se verificó directamente y falló por sus estados `INACTIVO`.
- Confirmar el checkout y repetir la confirmación devuelven 404. La ruta de confirmación de HU-10 no está implementada en `develop`; el carrito sigue con 2 ítems y el stock no cambia. TC-51 y TC-52 quedan bloqueados. Los casos posteriores que dependen de confirmar pedido siguen pendientes.
- La comprobación de checkout inexistente devuelve 404, pero no demuestra el comportamiento de HU-10 mientras falte la ruta.

El comando extendido termina con código 1 por las verificaciones de confirmación y sus efectos dependientes; las comprobaciones de disponibilidad y creación del checkout sí respondieron como esperaba el flujo.

## Casos de disponibilidad ejecutados directamente por Kong

Se usaron usuarios aislados `qa_tc43_sofia` y `qa_tc46_sofia`; al terminar, ambos carritos se vaciaron con DELETE. El precio del mock se restauró al valor inicial de `49900`.

| Caso | Resultado observado |
|---|---|
| TC-43, 3 camisetas y 2 jeans con stock | Falla el criterio de estado: la respuesta fue 200 con `disponible: true`, pero ambos ítems aparecieron con `estado: "INACTIVO"` aunque tienen `disponible: true`. |
| TC-46, cambiar precio de `prod_001` de 49900 a 59900 y consultar disponibilidad | Falla: la respuesta siguió mostrando `disponible: true` y `estado: "INACTIVO"`; no informó `PRECIO_CAMBIO` ni `precioAnterior`. Se restauró el precio a 49900. |

Estos resultados requieren corrección del endpoint de disponibilidad antes de marcar TC-43 y TC-46 como aprobados.

## Resultados Postman comunicados el 3 de noviembre de 2026

Sofía ejecutó los grupos TC-44, TC-45, TC-47, TC-48 y TC-49 en la colección Postman e informó que sus aserciones dieron los resultados esperados. TC-44 y TC-49 restauraron el stock de `prod_002` a 10; TC-45 reactivó `prod_001`.

La respuesta compartida para TC-48 confirma:

- HTTP 201, `estado: PENDIENTE`, con `checkoutId` y `expiraEn`.
- Subtotal `409500`; descuentos por ítem `48435`; descuento de carrito `18053`; descuentos totales `66488`.
- Total `343012`; descuentos disponibles y ambos productos disponibles.

Por tanto, TC-44, TC-45, TC-47, TC-48 y TC-49 quedan registrados como **Pasa** en la matriz. TC-43 y TC-46 permanecen como **Falla**, respaldados por las capturas compartidas: el primero mostró Test Results `1/2` y el segundo `0/1`.

## Resultados Postman comunicados el 3 de noviembre de 2026 — Sprint 2

Sofía informó que ejecutó en Postman la regresión TC-24 a TC-39 y que los casos dieron el resultado esperado. Tres aserciones aparecieron rojas en escenarios negativos, pero las respuestas recibidas coincidieron con los cuerpos de error definidos; por ello se registran como **Pasa (error esperado)**:

| Caso | Respuesta observada | Registro |
|---|---|---|
| TC-26 | `PRODUCTO_NO_ENCONTRADO` — “El producto no está en el carrito” | Pasa (error esperado). El código HTTP no fue compartido. |
| TC-27 | `NO_AUTORIZADO` — “Token no proporcionado” | Pasa (error esperado). El código HTTP no fue compartido. |
| TC-31 | `NO_AUTORIZADO` — “Token no proporcionado” | Pasa (error esperado), según confirmación de Sofía. |

TC-32 a TC-39 quedan registrados como **Pasa**, según el reporte de ejecución de Sofía; no se compartieron capturas ni valores individuales de sus respuestas. Los estados quedan reflejados en la matriz de `docs/plan-pruebas.md`.

## Actualización de HU-10 en `develop` — 3 de noviembre de 2026

Después de la ejecución anterior, se integró la PR #37 (`ae649e9`, que incluye `39520f7`) en `develop`. La rama ya contiene `POST /api/carrito/checkout/:checkoutId/confirmar` y la lógica HU-10 para confirmar el checkout. Los 404 anotados en la sección de verificación parcial corresponden a la revisión previa a este merge, por lo que no describen el estado actual del código.

TC-50 a TC-58 quedan pendientes de reejecución con el entorno reconstruido desde el `develop` actualizado. La presencia de la ruta en el código no se toma como evidencia de que los casos funcionales ya pasaron.
