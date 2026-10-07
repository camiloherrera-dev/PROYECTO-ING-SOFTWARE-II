# Integración de HU-02 — Camilo Herrera

Esta entrega implementa el cliente de Catálogo y la lógica de consulta. Todavía no hay servidor HTTP, autenticación, Redis real, Docker, Kong ni frontend. Las pruebas usan dependencias simuladas y un servidor HTTP local efímero para comprobar fetch y timeout.

## Archivos propios que deben conservarse

- `src/clients/catalogClient.js`: exporta `getProduct(productId)`. Devuelve `{ productId, nombre, precio, activo }`, `null` para 404 o `AppError` 503 para fallos. `createCatalogClient` permite pruebas aisladas.
- `src/services/cartService.js`: exporta `getCart(userId)` y la fábrica de pruebas `createCartService`. Integrar este bloque junto con `addItem` de Jeisson y `updateQuantity` de Santiago; conservar los tres exports públicos, imports y la fábrica usada por las pruebas. No reemplazar todo el archivo por la versión de una sola persona.
- `tests/catalogClient.test.js`, `tests/getCart.test.js`: conservar como regresión de HU-02.

## Cambios cuando llegue el trabajo del equipo

| Responsable | Archivo o componente | Acción necesaria |
| --- | --- | --- |
| Sofía | `package.json` y lockfile | Incorporar dependencias y scripts del esqueleto. Hoy no hay dependencias externas. Si se adopta Jest, migrar estas pruebas de `node:test` a Jest, o moverlas a una carpeta independiente y excluirla del descubrimiento de Jest, manteniendo un script para Node y ejecutando ambos en CI. No ejecutar estos archivos como pruebas Jest directamente. |
| Sofía | `src/config/env.js` y `.env.example` | Unificar con configuración de Redis, puerto y JWT. Conservar `catalogBaseUrl` y `catalogTimeoutMs`. Hoy se leen variables del proceso; `.env` no se carga automáticamente. Incorporar dotenv según el esqueleto. |
| Sofía / Jose David | `src/errors/AppError.js` | Conservar o unificar la clase compartida con constructor `(status, codigo, mensaje)`; `mensaje` se almacena en `error.message`. |
| Sofía | `src/services/cartTotals.js` | Unificar el cálculo compartido manteniendo `buildCartResponse(userId, items)`, campos del contrato, `precioAnterior` y exclusión de no disponibles del total. Este archivo es una base mínima, no una implementación de descuentos futuros. |
| Jeisson | `src/repositories/cartRepository.js` | Reemplazar el adaptador pendiente por Redis real: `getAllItems(userId)` devuelve array, `saveItem(userId, item)` crea/reemplaza y renueva TTL; conservar `getItem` para HU-01/HU-03. Nunca guardar `precioAnterior` ni `disponible` como parte del modelo persistido. |
| Sofía / equipo backend | rutas, controlador y app | Conectar `GET /api/carrito` a `await cartService.getCart(userId)` y devolver HTTP 200. Propagar rechazos al middleware de errores. El carrito inexistente devuelve array vacío, no 404. |
| Jose David | JWT y errores | Ejecutar autenticación antes de la ruta. Obtener el usuario exclusivamente del claim `sub` validado, con el nombre de propiedad que acuerde el controlador. Responder errores como `{ codigo, mensaje }`, usando `error.status`, `error.codigo`, `error.message`. |
| Juan David | Catálogo real y mock | Confirmar campos y envoltorio JSON. Si difieren de `{ id o _id, nombre, precio, activo }`, adaptar `mapProduct` y sus tests. Confirmar URL y requisitos de autenticación de Catálogo; hoy no se envían credenciales a ese servicio. |
| Juan David | Docker / Kong / CI | Configurar `CATALOG_BASE_URL` usando el nombre de servicio Docker, `CATALOG_TIMEOUT_MS`, ruteo `/api/carrito` y ejecución de pruebas en CI. |
| Tatiana | vista del carrito | Mostrar `precioAnterior` cuando exista y marcar `disponible: false`. El aviso de precio pertenece a la respuesta que actualiza el caché; una consulta posterior ya no lo devuelve. |

## Acuerdos pendientes del documento

Confirmar formato real de Catálogo, extensión `precioAnterior`, códigos de error, exclusión de no disponibles del total, respuesta 503 cuando falla Catálogo y TTL de siete días. La implementación sigue las reglas propuestas del Sprint 1.

## Validación pendiente de integración

1. Arrancar Redis, mock, API y Kong; generar un JWT de prueba.
2. Comprobar GET vacío: 200 y totales cero; sin token o con token inválido: 401.
3. Agregar mediante HU-01 y consultar: cantidad y precio oficial correctos.
4. Cambiar precio en el mock: GET informa precio anterior, actualiza Redis y recalcula; el siguiente GET no repite el aviso.
5. Desactivar o eliminar un producto: conservarlo en respuesta y excluirlo del total.
6. Detener Catálogo: GET con ítems devuelve 503 con el formato acordado.
7. Comprobar dos usuarios distintos, TTL tras actualización y regresión de POST/PUT.

La revalidación consulta todo Catálogo antes de guardar precios. Las escrituras Redis no son una transacción: fallos durante varias escrituras o cambios concurrentes entre GET/POST/PUT siguen requiriendo coordinación con Jeisson (transacciones, versionado o atomicidad). Las pruebas actuales no certifican concurrencia ni integración HTTP del carrito.

## Coordinación en main

Trabajar directamente en `main` según lo solicitado. Antes de publicar, incorporar commits remotos y volver a ejecutar pruebas. Coordinar cambios en `cartService.js`, `cartTotals.js`, configuración y package/lockfile. No usar push forzado. El documento original exige PR y ramas: el equipo debe reflejar el flujo acordado en su proceso de entrega y comprobar las protecciones de GitHub.
