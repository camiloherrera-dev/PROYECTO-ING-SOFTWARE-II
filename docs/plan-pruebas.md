# Plan de pruebas — Sprint 1 y Sprint 2 (Microservicio de Carrito)

| | |
|---|---|
| **Responsable de QA** | Sofía Victoria Vega Suárez |
| **Alcance** | HU-01 Agregar producto · HU-02 Consultar carrito · HU-03 Modificar cantidad · RT-01 JWT |
| **Base** | Criterios de aceptación del Sprint 0 y Contrato de Servicio v1.1 |
| **Entorno** | `docker compose up --build` (Redis, mock de Catálogo, API y Kong) |
| **Herramientas** | Postman (`docs/postman/carrito.json`), Jest + supertest (`npm test`), `redis-cli` |

## 1. Entorno y datos de prueba

| Variable | Valor |
|---|---|
| `baseUrl` (Kong) | `http://localhost:8000` |
| `mockUrl` (Catálogo simulado) | `http://localhost:4000` |
| `jwtSecret` | `dev-secret-change-me` (el de `.env.example`) |

Productos del mock de Catálogo:

| productId | Nombre | Precio | Estado |
|---|---|---|---|
| `prod_001` | Camiseta básica algodón | 49.900 | Activo |
| `prod_002` | Jean clásico | 129.900 | Activo |
| `prod_003` | Gorra edición limitada | 35.000 | **Inactivo** |
| `prod_999` | — | — | No existe (404) |

**Tokens:** la colección genera sola los JWT (HS256, claim `sub`) con cuatro usuarios nuevos en cada corrida, así que no hay que pegar tokens ni limpiar Redis entre ejecuciones. Si el equipo cambia el secreto o el claim del userId (punto abierto con Catálogo), se ajusta en las variables de la colección.

## 2. Matriz de casos de prueba — Sprint 1

Columna **Auto** = se ejecuta en Postman con aserciones. **Manual** = se ejecuta a mano y se adjunta evidencia.

| ID | Criterio de aceptación / regla | Prueba | Resultado esperado | Auto | Resultado (Pasa/Falla) | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-01 | HU-01: agregar un producto disponible | POST `prod_001`, cantidad 2 | 201; el ítem aparece en el carrito | Sí | Pasa | Postman, 2026-11-12: HTTP 201; prod_001 agregado con cantidad 2, subtotal y total 99.800. |
| TC-02 | HU-01: se registra la cantidad | GET tras TC-01 | cantidad = 2 | Sí | Pasa | Postman, 2026-11-12: HTTP 200; GET devuelve prod_001 con cantidad 2 y total 99.800. |
| TC-03 | HU-01: no duplicar entradas | POST `prod_001`, cantidad 1 otra vez | 200; una sola entrada con cantidad 3 | Sí | Pasa | Postman, 2026-11-12: HTTP 200; una entrada de prod_001 con cantidad 3 y descuento de 22.455. |
| TC-04 | RF-14: precio oficial de Catálogo | POST con `precioUnitario: 1` en el body | Se usa el precio del mock | Sí | Pasa | Postman, 2026-11-12: HTTP 201; prod_002 quedó con el precio oficial del mock (129.900), no con el precio manipulado. |
| TC-05 | RF-13: producto inactivo | POST `prod_003` | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | Pasa | Postman, 2026-11-12: HTTP 404 PRODUCTO_NO_ENCONTRADO al agregar producto inactivo; cuerpo esperado. |
| TC-06 | RF-13: producto inexistente | POST `prod_999` | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | Pasa | Postman, 2026-11-12: HTTP 404 PRODUCTO_NO_ENCONTRADO al agregar producto inexistente; cuerpo esperado. |
| TC-07 | Validación de cantidad | POST con 0, -1, 1.5 y `"2"` | 400 `VALIDACION_FALLIDA` (4 requests: a–d) | Sí | Pasa (a–d) | Postman, 2026-11-12: las cuatro cantidades inválidas respondieron HTTP 400 VALIDACION_FALLIDA, mensaje esperado. |
| TC-08 | HU-02: consultar productos | GET con 2 productos | Lista con nombre, cantidad y precio | Sí | Pasa | Postman, 2026-11-12: HTTP 200; GET devuelve los productos con nombre, cantidad y precio. |
| TC-09 | HU-02: subtotal y total | GET | Subtotal = suma(precio × cantidad); total = subtotal - descuentoTotal | Sí | Pasa | Postman, 2026-11-12: HTTP 200; subtotal 279.600, descuentos 35.445 y total 244.155; las identidades del contrato vigente se cumplen. |
| TC-10 | HU-02: carrito vacío | GET de usuario nuevo | 200; `items: []` y totales en 0 | Sí | Pasa | Postman, 2026-11-12: HTTP 200; carrito vacío, todos los totales en 0 y descuentosDisponibles true. |
| TC-11 | RF-16: cambio de precio | PATCH al mock y GET | Precio nuevo + `precioAnterior` | Sí | Pasa (a–b) | Postman, 2026-11-12: PATCH devolvió el precio 59.900; GET informó precioAnterior 49.900 y el nuevo precio. |
| TC-12 | RF-16: producto desactivado | PATCH `activo:false` y GET | `disponible:false`; no suma al total | Sí | Pasa (a–b) | Postman, 2026-11-12: PATCH dejó activo=false; GET marcó prod_001 no disponible y lo excluyó del total. |
| TC-13 | HU-03: aumentar cantidad | PUT `prod_001` con 5 (estaba en 3) | 200; cantidad = 5 | Sí | Pasa | Postman, 2026-11-12: HTTP 200; prod_001 quedó con cantidad 5 y totalItem recalculado. |
| TC-14 | HU-03: disminuir cantidad | PUT `prod_001` con 1 | 200; cantidad = 1 | Sí | Pasa | Postman, 2026-11-12: HTTP 200; prod_001 quedó con cantidad 1 y totalItem recalculado. |
| TC-15 | HU-03: total actualizado | GET tras TC-13 | `totalItem` = 5 × precio | Sí | Pasa | Postman, 2026-11-12: GET ejecutado después de TC-13; prod_001 quedó con cantidad 5 y totalItem 249.500 (5 x 49.900), con total recalculado; resultado esperado. |
| TC-16 | HU-03: cantidad inválida | PUT con 0, -2 y 1.5 | 400; el carrito no cambia (a, b, c, d) | Sí | Pasa (a–d) | Postman, 2026-11-12: TC-16a–c devolvieron HTTP 400 VALIDACION_FALLIDA; TC-16d devolvió HTTP 200 y confirmó que la cantidad permaneció en 1. |
| TC-17 | HU-03: producto fuera del carrito | PUT `prod_002` sin haberlo agregado | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | Pasa | Postman, 2026-11-12: HTTP 404 PRODUCTO_NO_ENCONTRADO, mensaje El producto no está en el carrito; resultado esperado. |
| TC-18 | RT-01: sin token | GET, POST y PUT sin Authorization | 401 `NO_AUTORIZADO` (a, b, c) | Sí | Pasa (a–c) | Postman, 2026-11-12: las tres solicitudes sin token devolvieron HTTP 401 NO_AUTORIZADO, mensaje Token no proporcionado. |
| TC-19 | RT-01: token inválido | Token con firma incorrecta | 401 | Sí | Pasa | Postman, 2026-11-12: HTTP 401 NO_AUTORIZADO, mensaje Token inválido o expirado; resultado esperado. |
| TC-20 | RNF-02: userId del token | POST con `userId` en body y en query | Se usa el del token | Sí | Pasa | Postman, 2026-11-12: HTTP 201; la respuesta usa userId del token2 (qa_u2_...), aunque body y query envían userId=hacker. |
| TC-21 | Aislamiento entre usuarios | Dos tokens distintos | Cada uno ve solo su carrito (a, b) | Sí | Pasa (a–b) | Postman, 2026-11-12: HTTP 200 en ambas consultas; token2 ve solo su carrito y token1 conserva el suyo. |
| TC-22 | RNF-03: persistencia | `redis-cli HGETALL carrito:{userId}` | El hash existe con los ítems | **Manual** | Pasa (claves inspeccionadas) | resultados-qa-sprint2-2026-10-22.md |
| TC-23 | RNF-03: TTL | `redis-cli TTL carrito:{userId}` | TTL ≈ 604800 y se renueva al escribir | **Manual** | Pasa | resultados-qa-sprint2-2026-10-22.md |

## 2.1 Matriz de casos de prueba — Sprint 2

Los TC-24 a TC-42 cubren HU-04 a HU-07 y los riesgos de persistencia y concurrencia. Registrar Pasa/Falla y enlazar evidencia solo después de ejecutar cada caso en el entorno integrado.

| ID | Criterio de aceptación / regla | Prueba | Resultado esperado | Auto | Resultado (Pasa/Falla/Parcial) | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-24 | HU-04: eliminar un producto | Con `prod_001` y `prod_002` en el carrito, DELETE `prod_002` | 200; `prod_002` no aparece; total recalculado | Sí | Pasa | Ejecución Postman de la regresión comunicada por Sofía el 2026-11-03. |
| TC-25 | HU-04: eliminar el último producto | DELETE del único producto | 200; `items: []`, total 0 y `EXISTS carrito:{userId}` = 0 | API automatizada; Redis manual | Pasa | resultados-qa-sprint2-2026-10-22.md |
| TC-26 | HU-04: producto fuera del carrito | DELETE `prod_002` sin haberlo agregado | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | Pasa (cuerpo esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03: `PRODUCTO_NO_ENCONTRADO`, “El producto no está en el carrito”. Código HTTP no informado. |
| TC-27 | HU-04: sin token | DELETE de un ítem sin Authorization | 401 `NO_AUTORIZADO` | Sí | Pasa (cuerpo esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03: `NO_AUTORIZADO`, “Token no proporcionado”. Código HTTP no informado. |
| TC-28 | HU-05: vaciar carrito | DELETE `/api/carrito` con 2 productos | 200; `items: []`, todos los totales en 0 y la clave no existe en Redis | API automatizada; Redis manual | Pasa | resultados-qa-sprint2-2026-10-22.md |
| TC-29 | HU-05: idempotencia | Repetir TC-28 | 200 con el carrito vacío | Sí | Pasa | Ejecución Postman de la regresión comunicada por Sofía el 2026-11-03. |
| TC-30 | HU-05: aislamiento | Vaciar con usuario 1 | El carrito del usuario 2 no cambia | Sí | Pasa | Ejecución Postman de la regresión comunicada por Sofía el 2026-11-03. |
| TC-31 | HU-05: sin token | DELETE `/api/carrito` sin Authorization | 401 y no se borra ningún carrito | Sí | Pasa (error esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03: cuerpo `NO_AUTORIZADO`, “Token no proporcionado”; Sofía confirma que el caso pasó. |
| TC-32 | HU-06: desglose | GET con productos | Respuesta incluye subtotal, descuentos, total y `descuentosAplicados`; se cumplen las identidades de la sección 3.3 del contrato | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-33 | HU-07: porcentaje por producto | Agregar 1 × `prod_002` | `descuentoAplicadoItem` = 12.990 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-34 | HU-07: cantidad mínima | Probar 2 y luego 3 × `prod_001` | Descuento 0 con 2; 22.455 con 3 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-35 | HU-07: monto mínimo de carrito | 3 × `prod_001` + 2 × `prod_002` | `descuentoCarrito` = 18.053; total = 343.012 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-36 | HU-07: umbral sobre base neta | 3 × `prod_001` + 1 × `prod_002` | `descuentoCarrito` = 0 (base neta = 244.155) | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-37 | HU-06: total al modificar | Desde TC-35, PUT `prod_001` a cantidad 2 | Sin descuento de camisetas; `descuentoCarrito` = 16.681; total = 316.939 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-38 | HU-06: total al eliminar | Desde TC-35, DELETE `prod_002` | Sin descuento de carrito; total = 127.245 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado. |
| TC-39 | HU-07: productos no disponibles | Desde TC-35, desactivar `prod_002` en el mock y hacer GET | `prod_002` tiene `disponible:false` y descuento 0; total = 127.245 | Sí | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03: reporta el caso como aprobado; la colección incluye solicitud de limpieza para restaurar el mock. |
| TC-40 | HU-07: modo degradado | Simular fallo en `getActiveRules` y consultar el carrito | 200; descuentos en 0; `descuentosDisponibles:false`; total = subtotal | Sí | Pasa (unitaria) | `tests/cartTotals.test.js`, 6/6 en `develop` (`0045b12`); incluye error de Descuentos, error síncrono y timeout. Ver `docs/resultados-qa-integracion-2026-11-02.md`. |
| TC-41 | RNF-03: TTL al eliminar | DELETE de un ítem dejando otro en el carrito; consultar TTL | TTL cercano a 604800 segundos (renovado) | **Manual** | Pasa | resultados-qa-sprint2-2026-10-22.md |
| TC-42 | Concurrencia | 20 POST simultáneos de 1 unidad de `prod_001` | Cantidad final 20; un 201 y diecinueve 200 | **Manual** | Pasa | resultados-qa-sprint2-2026-10-22.md |

**Orden y limpieza:** TC-37 a TC-39 modifican estado. Ejecutarlos al final de la colección y después restaurar el mock (`prod_002` activo). TC-40 requiere simular la falla del módulo de descuentos; TC-41 y TC-42 requieren observación manual del entorno.

### Precisiones sobre los casos automatizados

- **TC-04:** se prueba con `prod_002` (precio 129.900) para no alterar la cantidad de `prod_001` que usan TC-03 y siguientes. El resultado esperado es que el ítem quede con 129.900 y no con 1.
- **TC-16:** el caso incluye una cuarta request (d) que consulta el carrito y confirma que la cantidad no cambió después de los tres rechazos (0, -2 y 1.5).
- **TC-17:** se ejecuta con el usuario 3 (carrito vacío) para asegurar que `prod_002` no está en su carrito.
- **TC-11 y TC-12:** modifican el estado del mock de Catálogo, por eso están al final de la colección, seguidas de una request de **limpieza** que restaura `prod_001` (precio 49.900, activo).
- Las requests de la colección **no siguen el orden numérico** de la matriz: se ordenaron por dependencia de estado (por ejemplo, TC-15 va antes que TC-14). El orden correcto de ejecución es el de la colección.

## 3. Cómo ejecutar

1. Levantar el entorno: `cp .env.example .env && docker compose up --build`.
2. Importar `docs/postman/carrito.json` en Postman (File → Import).
3. Ejecutar la colección completa con **Run collection**, en el orden definido. Revisar que todas las aserciones pasen.
4. Ejecutar a mano TC-22 y TC-23 (sección 4).
5. Registrar Pasa/Falla en la columna de resultado de la matriz y adjuntar la evidencia (captura del Runner de Postman y salida de `redis-cli`).
6. Correr `npm test` y confirmar que el pipeline de CI está en verde.

La carpeta **Sprint 2 — HU-04 a HU-07** contiene TC-24 a TC-39 y solicitudes de preparación que dejan aislados sus datos. TC-25 y TC-28 requieren además comprobar manualmente en Redis que `EXISTS carrito:{userId}` devuelve 0. Ejecutar la solicitud de limpieza tras TC-39 para restaurar `prod_002` como activo.

## 4. Casos manuales (Redis)

Usar el `userId` que quedó en la variable `user1` de la colección (ver *Collection variables* en Postman), o ejecutar antes un POST con un usuario conocido.

```bash
docker exec -it carrito_redis redis-cli HGETALL carrito:<userId>   # TC-22: ítems del carrito
docker exec -it carrito_redis redis-cli TTL carrito:<userId>       # TC-23: ~604800
# TC-23 (renovación): esperar unos segundos, hacer un PUT o POST y repetir TTL: debe volver cerca de 604800
```

## 5. Pruebas automáticas en el repositorio

| Archivo | Cubre | Autor |
|---|---|---|
| `tests/node/catalogClient.test.js` | Cliente de Catálogo | Camilo |
| `tests/node/getCart.test.js` | HU-02 | Camilo |
| `tests/addItem.test.js` | HU-01 (servicio) | Jeisson |
| `tests/cartRepository.test.js` | HU-01, HU-04 y HU-05 (repositorio) | Jeisson |
| `tests/cartEndpoints.test.js` | Endpoints HU-01, HU-04 y HU-05 | Sofía (QA) |

### Corrida automatizada en `develop` — 2026-11-11

- Commit evaluado: `8cb8945`.
- Pruebas Node: **26/26 aprobadas**.
- Jest: **16 suites y 146/146 pruebas aprobadas**.
- Jest mostró un aviso de operaciones asíncronas abiertas y no finalizó por sí solo; se interrumpió el proceso después de que reportó todas las suites aprobadas.
- Esta corrida no reemplaza los casos Postman y no incluye `npm run test:integration` ni E2E.

## 6. Gestión de defectos

- Cada fallo se reporta como **Bug** en Jira, vinculado a la historia (SCRUM-19, SCRUM-20 o SCRUM-21), con pasos para reproducir, resultado esperado, resultado obtenido y evidencia.
- Severidad: **crítico** (impide el flujo agregar → consultar → modificar o expone datos de otro usuario), **mayor**, **menor**.
- Un bug crítico abierto impide cerrar el sprint.

## 7. Criterios de salida (QA)

- Los 42 casos están ejecutados y registrados con evidencia.
- No hay bugs críticos abiertos.
- HU-01 a HU-07 cumplen sus criterios de aceptación y reciben el visto bueno de QA para pasar a *Finalizada*.
- `npm test` pasa y el CI está en verde.

## 8. Dependencias y riesgos

| Dependencia | Responsable | Afecta |
|---|---|---|
| Docker Compose, mock de Catálogo y Kong | Juan David | Ejecución de la colección |
| Middleware JWT y manejo de errores | Jose David | TC-18 a TC-21, formato de error |
| Repositorio Redis y POST /items | Jeisson | TC-01 a TC-09, TC-22, TC-23 |
| Cliente de Catálogo y GET /carrito | Camilo | TC-08 a TC-12 |
| Claim del JWT y secreto compartido (pendiente de acordar con Catálogo) | Jose David / Juan David | Generación de tokens en la colección |

## 9. Sprint 3 — Flujo de compra (HU-08, HU-09, HU-10)

Plan añadido para cubrir disponibilidad, checkout, confirmación del pedido y persistencia. Los casos dependientes de los endpoints de Sprint 3 se ejecutan cuando sus cambios estén integrados en `develop`.

| ID | HU | Prueba | Resultado esperado | Tipo | Resultado (Pasa/Falla/Parcial/Bloqueado) | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-43 | HU-09 | Carrito con productos en stock | 200; `disponible: true`; todos los ítems en `OK` | Automática | Pasa (repetición) | Postman, 2026-11-12: tras agregar 3 prod_001 y 2 prod_002, disponibilidad devolvió HTTP 200, disponible=true y ambos productos con estado OK; cantidades y stock esperados. Total del carrito 343.012. |
| TC-44 | HU-09 | Bajar stock del jean a 1 con 2 en el carrito | `SIN_STOCK`; `disponible: false` | Automática | Pasa | `docs/resultados-qa-integracion-2026-11-02.md`: ejecución Postman reportada por Sofía el 2026-11-03; incluye restauración del stock. |
| TC-45 | HU-09 | Desactivar un producto en el mock | Estado `INACTIVO` | Automática | Pasa | `docs/resultados-qa-integracion-2026-11-02.md`: ejecución Postman reportada por Sofía el 2026-11-03; producto reactivado al terminar. |
| TC-46 | HU-09 | Cambiar precio del producto y consultar dos veces | Primera consulta `PRECIO_CAMBIO` con `precioAnterior`; segunda consulta `OK` | Automática | Pasa (repetición) | Postman, 2026-11-12: HTTP 200 detecta PRECIO_CAMBIO con precioAnterior 49.900 y precioUnitario 59.900; segunda consulta HTTP 200 queda OK; mock restaurado a 49.900 y activo. |
| TC-47 | HU-09 | Consultar disponibilidad con carrito vacío | 400 `CARRITO_VACIO` | Automática | Pasa | `docs/resultados-qa-integracion-2026-11-02.md`: ejecución Postman reportada por Sofía el 2026-11-03. |
| TC-48 | HU-08 | Checkout con 3 camisetas y 2 jeans disponibles | 201 con `checkoutId`, `expiraEn` y total 343.012 | Automática | Pasa | `docs/resultados-qa-integracion-2026-11-02.md`: respuesta Postman confirma `checkoutId`, `expiraEn`, 409500 subtotal, 66488 descuentos y 343012 total. |
| TC-49 | HU-08 | Crear checkout con un ítem sin stock | 409 `CARRITO_NO_DISPONIBLE` con `items` | Automática | Pasa | `docs/resultados-qa-integracion-2026-11-02.md`: ejecución Postman reportada por Sofía el 2026-11-03; stock restaurado al terminar. |
| TC-50 | HU-08/HU-10 | Cambiar el carrito después del checkout y confirmar | El pedido usa los datos del snapshot | Automática | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-51 | HU-10 | Confirmar checkout | 201, pedido `CONFIRMADO`, carrito vacío y stock reducido | Automática | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-52 | HU-10 | Confirmar dos veces | Segunda respuesta 200 con el mismo `pedidoId`; stock reducido una sola vez | Automática | Pasa | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-53 | HU-10 | Confirmar checkout vencido (`CHECKOUT_VIGENCIA_SECONDS=30`) | 409 `CHECKOUT_EXPIRADO` | Manual / entorno configurado | Pasa (error esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-54 | HU-10 | Confirmar checkout de otro usuario | 404 `CHECKOUT_NO_ENCONTRADO` | Automática | Pasa (error esperado) | Postman mostró 404 `CHECKOUT_NO_ENCONTRADO`; Sofía confirma que TC-50 a TC-58 pasaron. |
| TC-55 | HU-10 | Agotar stock entre checkout y confirmación; reponerlo y reintentar | 409 `STOCK_INSUFICIENTE`; reintento con stock disponible responde 201 | Automática | Pasa (error esperado y reintento) | Postman mostró 409 al confirmar sin stock; Sofía confirma que TC-50 a TC-58 pasaron. |
| TC-56 | Todas | Llamar endpoints nuevos sin token | 401 `NO_AUTORIZADO` | Automática | Pasa (error esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-57 | HU-10 | Inspeccionar checkout y pedido en Redis | Checkout `CONFIRMADO`; TTL checkout cercano a 24 h y pedido cercano a 30 días | Manual / Redis | Pasa | Ejecución comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |
| TC-58 | HU-10 | Crear dos checkouts y confirmar el primero | 409 `CHECKOUT_REEMPLAZADO`; no se crea pedido | Automática | Pasa (error esperado) | Ejecución Postman comunicada por Sofía el 2026-11-03; resultado esperado confirmado. |

### Preparación y ejecución de Sprint 3

- Ejecutar TC-43 a TC-58 por Kong en el orden disponibilidad → checkout → confirmación. La colección usa un usuario aislado y guarda `checkoutId`/`pedidoId` para los pasos posteriores.
- Para TC-44, TC-45, TC-46 y TC-55, modificar el mock con `PATCH http://localhost:4000/__test/productos/{productId}` y restaurar stock, precio y estado al finalizar cada caso.
- TC-53 requiere levantar el servicio con `CHECKOUT_VIGENCIA_SECONDS=30`, crear un checkout, esperar más de 30 segundos y luego confirmarlo.
- Para TC-57, usar `docker exec carrito_redis redis-cli --scan --pattern 'checkout:*'`, consultar el campo `estado` del hash de checkout y revisar el TTL de `pedido:{pedidoId}`.
- Registrar los resultados y evidencia junto con la regresión final. La revisión final cubre TC-01 a TC-58 y `npm run e2e -- --pedido` después de integrar todas las historias.

## 10. Sprint 4 — Histórico, recuperación, seguridad e infraestructura

Los casos nuevos se ejecutan cuando las rutas y funcionalidades correspondientes estén integradas en `develop`. Los escenarios que requieren bases detenidas se hacen sobre el compose QA aislado.

| ID | HU | Prueba | Resultado esperado | Tipo | Resultado | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-59 | HU-11 | Confirmar un pedido y consultar `GET /pedidos` | 200; pedido reciente primero, fuente `POSTGRES`, unidades y totales correctos | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: TC-59(1) 204; TC-59(2) 200; agregados 3 camisetas y 2 jeans (201); checkout y confirmación 201; GET /pedidos 200, `fuente: POSTGRES`, 5 unidades y total 343012. |
| TC-60 | HU-11 | Consultar detalle del pedido de 3 camisetas y 2 jeans | 200 con ítems, descuentos y total 343.012 | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: respuesta 200; incluye los dos productos, descuentos por ítem y carrito, checkout/pedido confirmados y total 343012. |
| TC-61 | HU-11 | Consultar pedido de otro usuario | 404 `PEDIDO_NO_ENCONTRADO` | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: respuesta 404 `PEDIDO_NO_ENCONTRADO`, mensaje “El pedido no existe”. |
| TC-62 | HU-11 | Paginar 3 pedidos con `limit=2` y `offset=0`, luego `offset=2` | Primero 2 pedidos (total 3); después 1 pedido | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: página `offset=0, limit=2` devuelve 2 pedidos y `total: 3`; página `offset=2` devuelve el tercer pedido. |
| TC-63 | HU-11 | Enviar `limit=0`, `limit=51`, `limit=abc` y `offset=-1` | Cuatro respuestas 400 `VALIDACION_FALLIDA` | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: cuatro variantes inválidas respondieron 400 `VALIDACION_FALLIDA`; mensajes de validación de `limit` y `offset`. |
| TC-64 | HU-11/HU-12 | Consultar lista, detalle y recuperación sin token | 401 `NO_AUTORIZADO` en las tres peticiones | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: todas las solicitudes reportadas devolvieron 401 `NO_AUTORIZADO`, “Token no proporcionado”. |
| TC-65 | HU-11 | Confirmar dos veces el mismo checkout | Un único registro en `pedidos` para ese `checkout_id` | Manual / PostgreSQL | Pasa | Evidencia Postman y PostgreSQL 2026-11-13: primera confirmación 201; repetición 200 devuelve el mismo pedidoId; consulta SQL para checkout `chk_e4c535cc-9624-4c83-8f60-fd05c5da0afc` devuelve una fila con `registros: 1`. |
| TC-66 | HU-11 | Detener PostgreSQL, confirmar un pedido y consultar el historial | Confirmación 201; historial 200 con fuente `REDIS` | Manual / entorno | Pasa | Evidencia Postman 2026-11-13: con PostgreSQL QA detenido, confirmar responde 201 para `ped_de5e049a-7633-49b5-9b84-f01cff0974d2`; consultar historial responde 200, devuelve el mismo pedido y `fuente: REDIS`. |
| TC-67 | HU-12 | Recuperar carrito con actividad reciente | 200; `recuperacion.inactivo: false` | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: recuperación 200; `hayCarrito: true` e `inactivo: false`. |
| TC-68 | HU-12 | Simular 3 horas sin actividad y consultar recuperación dos veces | Primera: inactivo true y ≥180 min; segunda: inactivo false | Manual / Redis | Pasa | Evidencia Postman y Redis 2026-11-13: se sembró actividad antigua; primera recuperación 200 con `inactivo: true` e `inactividadMinutos: 180`; segunda recuperación 200 con `inactivo: false`. |
| TC-69 | HU-12 | Cambiar precio en Catálogo y consultar recuperación | `cambios.preciosCambiados` informa `precioAnterior` | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: al cambiar prod_001 de 49900 a 55000, la recuperación informa ambos precios y actualiza el total a 55000. |
| TC-70 | HU-12 | Desactivar producto en Catálogo y consultar recuperación | Producto en `cambios.noDisponibles`; no suma al total | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: prod_001 desactivado; aparece en `cambios.noDisponibles` y el total resultante es 0. |
| TC-71 | HU-12 | Recuperar carrito de usuario sin carrito | 200; `hayCarrito: false`, `expiraEnSegundos: null` | Manual / Postman | Pasa | Evidencia Postman 2026-11-13: recuperación 200; carrito vacío, `hayCarrito: false` y `expiraEnSegundos: null`. |
| TC-72 | Seguridad | Revisar cabeceras HTTP de una respuesta | `X-Content-Type-Options: nosniff`; `Cache-Control: no-store` | Manual / Postman | Pasa | Sofía confirmó en Postman el 2026-11-11 ambos valores exactos en la respuesta de TC-18a. |
| TC-73 | Seguridad | Configurar `RATE_LIMIT_MAX=5` y hacer 6 peticiones seguidas | Sexta responde 429 `DEMASIADAS_PETICIONES` con `Retry-After` | Manual / entorno | Pasa | Evidencia Postman 2026-11-13: en la sexta petición se recibió 429 `DEMASIADAS_PETICIONES`; headers `X-RateLimit-Limit: 5` y `Retry-After: 26`. |
| TC-74 | Infra | Consultar `/ready` con todo arriba, PostgreSQL detenido y Redis detenido | 200 `ok`; 200 `degraded`; 503 `down` | Manual / entorno | Pasa | Sofía reportó en Postman, el 2026-11-11, esta secuencia de cuerpos: `ok/up/up`; `degraded/up/down`; `ok/up/up` tras restaurar PostgreSQL; `down/down/up` con Redis detenido; y `ok/up/up` tras restaurarlo. |
| TC-75 | Infra | Bajar y reconstruir el compose desde cero | Servicios arriba, migraciones aplicadas y 3 reglas sembradas | Manual / Docker | Pendiente | QA compose aislado; no ejecutar `down -v` sobre otros proyectos. |
| TC-76 | HU-07 (stretch) | Desactivar `DESC-JEAN-10` en PostgreSQL y consultar tras vencer caché | Desaparece el descuento de los jeans | Manual / PostgreSQL | Pendiente | Caso stretch. |

**Estado de integración y ejecución (2026-11-13):** origin/develop en b9bf46c monta las rutas de HU-11 y HU-12. Según evidencia Postman comunicada, TC-59 a TC-64, TC-67 y TC-69 a TC-71 pasan; TC-65 y TC-68 pasan, incluyendo verificación SQL de idempotencia y simulación Redis de 180 minutos; TC-66 pasa: con PostgreSQL detenido, la confirmación devolvió 201 y el historial 200 con `fuente: REDIS`.
