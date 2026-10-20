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

**Tokens:** la colección genera sola los JWT (HS256, claim `sub`) con tres usuarios nuevos en cada corrida, así que no hay que pegar tokens ni limpiar Redis entre ejecuciones. Si el equipo cambia el secreto o el claim del userId (punto abierto con Catálogo), se ajusta en las variables de la colección.

## 2. Matriz de casos de prueba — Sprint 1

Columna **Auto** = se ejecuta en Postman con aserciones. **Manual** = se ejecuta a mano y se adjunta evidencia.

| ID | Criterio de aceptación / regla | Prueba | Resultado esperado | Auto | Resultado (Pasa/Falla) | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-01 | HU-01: agregar un producto disponible | POST `prod_001`, cantidad 2 | 201; el ítem aparece en el carrito | Sí | | |
| TC-02 | HU-01: se registra la cantidad | GET tras TC-01 | cantidad = 2 | Sí | | |
| TC-03 | HU-01: no duplicar entradas | POST `prod_001`, cantidad 1 otra vez | 200; una sola entrada con cantidad 3 | Sí | | |
| TC-04 | RF-14: precio oficial de Catálogo | POST con `precioUnitario: 1` en el body | Se usa el precio del mock | Sí | | |
| TC-05 | RF-13: producto inactivo | POST `prod_003` | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | | |
| TC-06 | RF-13: producto inexistente | POST `prod_999` | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | | |
| TC-07 | Validación de cantidad | POST con 0, -1, 1.5 y `"2"` | 400 `VALIDACION_FALLIDA` (4 requests: a–d) | Sí | | |
| TC-08 | HU-02: consultar productos | GET con 2 productos | Lista con nombre, cantidad y precio | Sí | | |
| TC-09 | HU-02: subtotal y total | GET | subtotal = Σ(precio × cantidad); total = subtotal | Sí | | |
| TC-10 | HU-02: carrito vacío | GET de usuario nuevo | 200; `items: []` y totales en 0 | Sí | | |
| TC-11 | RF-16: cambio de precio | PATCH al mock y GET | Precio nuevo + `precioAnterior` | Sí | | |
| TC-12 | RF-16: producto desactivado | PATCH `activo:false` y GET | `disponible:false`; no suma al total | Sí | | |
| TC-13 | HU-03: aumentar cantidad | PUT `prod_001` con 5 (estaba en 3) | 200; cantidad = 5 | Sí | | |
| TC-14 | HU-03: disminuir cantidad | PUT `prod_001` con 1 | 200; cantidad = 1 | Sí | | |
| TC-15 | HU-03: total actualizado | GET tras TC-13 | `totalItem` = 5 × precio | Sí | | |
| TC-16 | HU-03: cantidad inválida | PUT con 0, -2 y 1.5 | 400; el carrito no cambia (a, b, c, d) | Sí | | |
| TC-17 | HU-03: producto fuera del carrito | PUT `prod_002` sin haberlo agregado | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | | |
| TC-18 | RT-01: sin token | GET, POST y PUT sin Authorization | 401 `NO_AUTORIZADO` (a, b, c) | Sí | | |
| TC-19 | RT-01: token inválido | Token con firma incorrecta | 401 | Sí | | |
| TC-20 | RNF-02: userId del token | POST con `userId` en body y en query | Se usa el del token | Sí | | |
| TC-21 | Aislamiento entre usuarios | Dos tokens distintos | Cada uno ve solo su carrito (a, b) | Sí | | |
| TC-22 | RNF-03: persistencia | `redis-cli HGETALL carrito:{userId}` | El hash existe con los ítems | **Manual** | | |
| TC-23 | RNF-03: TTL | `redis-cli TTL carrito:{userId}` | TTL ≈ 604800 y se renueva al escribir | **Manual** | | |

## 2.1 Matriz de casos de prueba — Sprint 2

Los TC-24 a TC-42 cubren HU-04 a HU-07 y los riesgos de persistencia y concurrencia. Registrar Pasa/Falla y enlazar evidencia solo después de ejecutar cada caso en el entorno integrado.

| ID | Criterio de aceptación / regla | Prueba | Resultado esperado | Auto | Resultado (Pasa/Falla) | Evidencia / Bug |
|---|---|---|---|---|---|---|
| TC-24 | HU-04: eliminar un producto | Con `prod_001` y `prod_002` en el carrito, DELETE `prod_002` | 200; `prod_002` no aparece; total recalculado | Sí | | |
| TC-25 | HU-04: eliminar el último producto | DELETE del único producto | 200; `items: []`, total 0 y `EXISTS carrito:{userId}` = 0 | Sí | | |
| TC-26 | HU-04: producto fuera del carrito | DELETE `prod_002` sin haberlo agregado | 404 `PRODUCTO_NO_ENCONTRADO` | Sí | | |
| TC-27 | HU-04: sin token | DELETE de un ítem sin Authorization | 401 `NO_AUTORIZADO` | Sí | | |
| TC-28 | HU-05: vaciar carrito | DELETE `/api/carrito` con 2 productos | 200; `items: []`, todos los totales en 0 y la clave no existe en Redis | Sí | | |
| TC-29 | HU-05: idempotencia | Repetir TC-28 | 200 con el carrito vacío | Sí | | |
| TC-30 | HU-05: aislamiento | Vaciar con usuario 1 | El carrito del usuario 2 no cambia | Sí | | |
| TC-31 | HU-05: sin token | DELETE `/api/carrito` sin Authorization | 401 y no se borra ningún carrito | Sí | | |
| TC-32 | HU-06: desglose | GET con productos | Respuesta incluye subtotal, descuentos, total y `descuentosAplicados`; se cumplen las identidades de la sección 3.3 del contrato | Sí | | |
| TC-33 | HU-07: porcentaje por producto | Agregar 1 × `prod_002` | `descuentoAplicadoItem` = 12.990 | Sí | | |
| TC-34 | HU-07: cantidad mínima | Probar 2 y luego 3 × `prod_001` | Descuento 0 con 2; 22.455 con 3 | Sí | | |
| TC-35 | HU-07: monto mínimo de carrito | 3 × `prod_001` + 2 × `prod_002` | `descuentoCarrito` = 18.053; total = 343.012 | Sí | | |
| TC-36 | HU-07: umbral sobre base neta | 3 × `prod_001` + 1 × `prod_002` | `descuentoCarrito` = 0 (base neta = 244.155) | Sí | | |
| TC-37 | HU-06: total al modificar | Desde TC-35, PUT `prod_001` a cantidad 2 | Sin descuento de camisetas; `descuentoCarrito` = 16.681; total = 316.939 | Sí | | |
| TC-38 | HU-06: total al eliminar | Desde TC-35, DELETE `prod_002` | Sin descuento de carrito; total = 127.245 | Sí | | |
| TC-39 | HU-07: productos no disponibles | Desde TC-35, desactivar `prod_002` en el mock y hacer GET | `prod_002` tiene `disponible:false` y descuento 0; total = 127.245 | Sí | | |
| TC-40 | HU-07: modo degradado | Simular fallo en `getActiveRules` y consultar el carrito | 200; descuentos en 0; `descuentosDisponibles:false`; total = subtotal | **Manual** | | |
| TC-41 | RNF-03: TTL al eliminar | DELETE de un ítem dejando otro en el carrito; consultar TTL | TTL cercano a 604800 segundos (renovado) | **Manual** | | |
| TC-42 | Concurrencia | 20 POST simultáneos de 1 unidad de `prod_001` | Cantidad final 20; un 201 y diecinueve 200 | **Manual** | | |

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
