# Contrato de Servicio — Microservicio de Carrito de Compras (v1.4)

| Campo | Valor |
| --- | --- |
| Versión | 1.4 (reemplaza la v1.3) |
| Fecha | Noviembre de 2026 — Sprint 4 (versión del servicio 1.0.0) |
| Responsable | Camilo Andres Herrera Celis (con Juan David Gómez para los acuerdos con Catálogo) |
| Revisor | Santiago Torres Barbosa |
| Destinatarios | Equipos de Catálogo y Búsqueda; frontend del Carrito |
| Estado | Versión final del Sprint 4. Los puntos de la sección 7.2 siguen pendientes de respuesta de Catálogo |

Este documento describe el contrato REST del Carrito al final del Sprint 4: los cinco endpoints del carrito, los tres del flujo de compra (disponibilidad, checkout y confirmación de pedido) y los tres nuevos de historial (HU-11) y recuperación del carrito (HU-12). Donde una versión anterior dice otra cosa, prevalece este documento.

## 0. Cambios v1.3 → v1.4

| Cambio | Detalle |
| --- | --- |
| Nuevo endpoint | `GET /api/carrito/pedidos` (HU-11, sección 3.9): historial paginado con `limit` y `offset` |
| Nuevo endpoint | `GET /api/carrito/pedidos/{pedidoId}` (HU-11, sección 3.10): detalle de un pedido propio |
| Nuevo endpoint | `GET /api/carrito/recuperar` (HU-12, sección 3.11): carrito con el bloque `recuperacion` |
| Errores nuevos | `PEDIDO_NO_ENCONTRADO` (404), `DEMASIADAS_PETICIONES` (429), `SERVICIO_NO_DISPONIBLE` (503) (sección 5) |
| Cabeceras | `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `Retry-After`; `Cache-Control: no-store` y cabeceras de seguridad (sección 2) |
| Límite de cuerpo | 100 kb; un cuerpo mayor responde `400 VALIDACION_FALLIDA` |
| Disponibilidad | Orden de estados: `INACTIVO`, `SIN_STOCK`, `PRECIO_CAMBIO`. `PRECIO_CAMBIO` aparece solo si el precio cambió desde la última vez que el carrito lo vio (sección 3.6) |
| Almacenamiento | PostgreSQL para `pedidos`, `pedido_items` y `reglas_descuento`; Redis agrega `carrito-actividad:{userId}` (sección 8) |
| Operación | `GET /health` y `GET /ready` (no pasan por Kong); el servicio arranca sin PostgreSQL en modo degradado (sección 2) |
| Catálogo | Acuerdos del 27/10: sin reservas, descuento definitivo con `descontar-stock`. Pendientes: `referencia` y `devolver-stock` (sección 7) |
| Configuración | `DATABASE_URL`, `DB_POOL_MAX`, `AUTO_MIGRATE`, `CART_INACTIVITY_HOURS`, `DISCOUNT_RULES_CACHE_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `SHUTDOWN_TIMEOUT_MS` (sección 9) |

Los ocho endpoints de la v1.3 y sus respuestas no cambian, así que un cliente de la v1.3 sigue funcionando. Lo único que puede notar es el `429` si supera el límite de peticiones.

### 0.1 Historial: cambios v1.2 → v1.3

| Cambio | Detalle |
| --- | --- |
| Nuevo endpoint | `GET /api/carrito/disponibilidad` (HU-09, sección 3.6) |
| Nuevo endpoint | `POST /api/carrito/checkout` (HU-08, sección 3.7) |
| Nuevo endpoint | `POST /api/carrito/checkout/{checkoutId}/confirmar` (HU-10, sección 3.8) |
| Errores nuevos | `CARRITO_VACIO`, `CARRITO_NO_DISPONIBLE`, `CHECKOUT_NO_ENCONTRADO`, `CHECKOUT_REEMPLAZADO`, `CHECKOUT_EXPIRADO`, `CONFIRMACION_EN_CURSO`, `STOCK_INSUFICIENTE` (sección 5) |
| Formato de error | Los 409 de checkout y de stock agregan `items` con los productos que fallaron |
| Modelo Redis | `checkout:{id}`, `checkout-usuario:{userId}`, `pedido:{id}`, `pedidos-usuario:{userId}` (sección 8) |
| Catálogo | `stock` en el producto; `POST /productos/descontar-stock` (acordado) y `devolver-stock` (propuesto); `CATALOG_BASE_URL` incluye el prefijo (sección 7) |
| Alcance | Sin pago real: el pedido nace `CONFIRMADO` |

### 0.2 Historial: cambios v1.0 → v1.2

| # | Tema | v1.0 (borrador) | v1.2 | Motivo |
| --- | --- | --- | --- | --- |
| 1 | Base path | `/api/basket` | `/api/carrito` | Es la ruta del Sprint 0, de Kong y del código |
| 2 | Endpoints | Sin los DELETE | 5 endpoints REST, incluidos `DELETE /api/carrito/items/{productId}` y `DELETE /api/carrito` | HU-04 y HU-05 entran en el Sprint 2 |
| 3 | Respuesta del carrito | Solo `subtotal` y `total` | Se agregan `descuentoItems`, `descuentoCarrito`, `descuentosAplicados`, `descuentosDisponibles`; se formaliza `precioAnterior` por ítem | HU-02, HU-06 y HU-07 |
| 4 | Códigos de error | Sin catálogo de códigos | Se formalizan `NO_AUTORIZADO`, `CATALOGO_NO_DISPONIBLE` y `ERROR_INTERNO` | Ya los usa el código desde el Sprint 1 |
| 5 | Descuentos | Servicio externo por gRPC (`discount.proto`) | Módulo interno del mismo proceso (`src/discounts/`) | Sprint 0, sección 3.6.3 |
| 6 | Tolerancia a fallos | No se describía | Si Descuentos falla o tarda, el carrito responde sin descuentos y `descuentosDisponibles: false` | HU-07 |
| 7 | Checkout | Evento `BasketCheckedOut` a RabbitMQ y servicio de Órdenes | Se elimina. El pedido lo crea el propio Carrito (v1.3) y el histórico va a PostgreSQL en el Sprint 4 | Sprint 0, sección 3.6.3 |
| 8 | Cupones | Campo `coupon_code` | Fuera de alcance (backlog) | Catálogo no ha confirmado el campo `categoria` |
| 9 | Integración con Catálogo | Implícita | Forma de `GET /api/catalogo/productos/{id}` y puntos pendientes | Riesgo 11 del Sprint 2 |

## 1. Alcance

El Carrito permite a un cliente autenticado agregar, consultar, modificar, eliminar y vaciar los productos de su carrito, con el subtotal, los descuentos aplicados y el total en cada respuesta. Desde la v1.3 también permite pasar del carrito a un pedido confirmado: verificar disponibilidad, congelar un resumen de compra y confirmarlo descontando el stock en Catálogo. Desde la v1.4 el cliente consulta el historial de sus pedidos (guardado en PostgreSQL) y recupera su carrito después de un periodo de inactividad, con aviso de lo que cambió.

Fuera de este contrato: pago real (el pedido nace `CONFIRMADO` sin cobro), despliegue conjunto con los otros microservicios, eventos RabbitMQ (solo si otro equipo los pide), Keycloak real, Module Federation con el Host App, cupones y descuentos por categoría, y la devolución de stock mientras Catálogo no publique `devolver-stock`.

## 2. Convenciones generales

- **Entrada:** todas las peticiones pasan por Kong (`http://localhost:8000` en local). El servicio escucha internamente en el puerto `3000`.
- **Autenticación:** todas las rutas exigen `Authorization: Bearer <JWT>` firmado con HS256. El usuario sale **siempre** del claim `sub` del token; nunca del cuerpo, la query ni la ruta (RNF-02). Un token sin `sub`, expirado, mal firmado o ausente responde `401 NO_AUTORIZADO`.
- **Formato:** JSON en UTF-8 (`Content-Type: application/json`). Solo `POST /items` y `PUT /items/{productId}` llevan cuerpo. El cuerpo admite hasta 100 kb; uno mayor responde `400 VALIDACION_FALLIDA`.
- **Dinero:** pesos colombianos (COP) como enteros. Cada monto calculado se redondea con `Math.round`.
- **Cantidades:** enteros `>= 1`. `1.5`, `0`, negativos o `"3"` (texto) responden `400 VALIDACION_FALLIDA`.
- **Precios:** el precio y el nombre del producto salen siempre de Catálogo, nunca del cliente (RF-13, RF-14).
- **Fechas:** ISO 8601 en UTC (`2026-11-05T15:30:00.000Z`).
- **CORS (Kong):** orígenes `http://localhost:5173` y cualquier `http(s)://localhost` o `127.0.0.1` con puerto (integración local con el Host App); métodos `GET, POST, PUT, DELETE, OPTIONS`; cabeceras `Authorization, Content-Type`; expone `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `Retry-After`. Al desplegar, la expresión se reemplaza por los orígenes reales en `kong/kong.yml`.
- **Cabeceras de seguridad (nuevo):** todas las respuestas llevan `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store`.
- **Límite de peticiones (nuevo):** por usuario (claim `sub`), `RATE_LIMIT_MAX` peticiones (120) por ventana de `RATE_LIMIT_WINDOW_MS` (60 s). Cada respuesta de `/api/carrito/*` trae `X-RateLimit-Limit` y `X-RateLimit-Remaining`; al superarlo responde `429 DEMASIADAS_PETICIONES` con `Retry-After` (segundos). El contador vive en la memoria de cada instancia.
- **Salud (puerto 3000, sin autenticación y sin Kong):**

| Ruta | Para qué sirve | Respuesta |
| --- | --- | --- |
| `GET /health` | El proceso está vivo | `200 { "status": "ok" }` |
| `GET /ready` (nuevo) | Puede atender peticiones | `200 { "status": "ok", "redis": "up", "postgres": "up" }` · `200` con `status: "degraded"` y `postgres: "down"` si PostgreSQL cae · `503` con `status: "down"` si Redis cae |

- **Arranque:** Redis es obligatorio: sin Redis el servicio no arranca. PostgreSQL es opcional: sin él el servicio arranca sin histórico y `/ready` responde `degraded`. Al recibir `SIGTERM` o `SIGINT` deja de aceptar peticiones y cierra Redis y PostgreSQL en menos de `SHUTDOWN_TIMEOUT_MS` (10 s).

## 3. Endpoints

| Método y ruta | HU | Cuerpo | Respuestas |
| --- | --- | --- | --- |
| `GET /api/carrito` | HU-02, HU-06 | — | `200` carrito con desglose · `401` · `503` Catálogo caído |
| `POST /api/carrito/items` | HU-01 | `{ productId, cantidad }` | `201` primera vez · `200` si ya existía (suma) · `400` · `404` · `401` · `503` |
| `PUT /api/carrito/items/{productId}` | HU-03 | `{ cantidad }` | `200` (reemplaza) · `400` · `404` si no está en el carrito · `401` |
| `DELETE /api/carrito/items/{productId}` | HU-04 | — | `200` carrito actualizado sin el producto · `404 PRODUCTO_NO_ENCONTRADO` · `401` |
| `DELETE /api/carrito` | HU-05 | — | `200` con `items: []` y totales en 0, también si el carrito no existía (idempotente) · `401` |
| `GET /api/carrito/disponibilidad` | HU-09 | — | `200` estado por ítem · `400 CARRITO_VACIO` · `401` · `503` |
| `POST /api/carrito/checkout` | HU-08 | — | `201` snapshot con `checkoutId` y `expiraEn` · `400 CARRITO_VACIO` · `409 CARRITO_NO_DISPONIBLE` · `401` · `503` |
| `POST /api/carrito/checkout/{checkoutId}/confirmar` | HU-10 | — | `201` pedido nuevo · `200` ya confirmado (mismo pedido) · `404 CHECKOUT_NO_ENCONTRADO` · `409 CHECKOUT_REEMPLAZADO` / `CHECKOUT_EXPIRADO` / `CONFIRMACION_EN_CURSO` / `STOCK_INSUFICIENTE` · `401` · `503` |
| `GET /api/carrito/pedidos?limit=10&offset=0` (nuevo) | HU-11 | — | `200` lista paginada · `400 VALIDACION_FALLIDA` · `401` |
| `GET /api/carrito/pedidos/{pedidoId}` (nuevo) | HU-11 | — | `200` pedido completo · `404 PEDIDO_NO_ENCONTRADO` (no existe o es de otro usuario) · `401` |
| `GET /api/carrito/recuperar` (nuevo) | HU-12 | — | `200` carrito con el bloque `recuperacion` · `401` · `503` si Catálogo cae |

Cualquier endpoint de `/api/carrito/*` puede responder además `429 DEMASIADAS_PETICIONES` y `503 SERVICIO_NO_DISPONIBLE` (Redis o PostgreSQL sin conexión). Las respuestas `2xx` de los cinco primeros endpoints devuelven el carrito completo con la forma de la sección 4. Los demás devuelven las formas de las secciones 4.3 a 4.7.

### 3.1 GET /api/carrito — Consultar carrito

- Revalida cada producto contra Catálogo (RF-15, RF-16):
  - Precio distinto al guardado → se actualiza el precio en Redis y el ítem trae `precioAnterior` **solo en esa respuesta**.
  - Producto inactivo o inexistente en Catálogo → el ítem se conserva con `disponible: false` y no cuenta para el subtotal ni para los descuentos.
- Carrito inexistente → `200` con `items: []` y totales en 0 (no `404`).
- Si Catálogo no responde, responde con error o excede el timeout (`CATALOG_TIMEOUT_MS`, 3000 ms por defecto) → `503 CATALOGO_NO_DISPONIBLE`. No se escribe nada en Redis en esa consulta.

### 3.2 POST /api/carrito/items — Agregar producto

```json
{ "productId": "prod_001", "cantidad": 2 }
```

- Consulta el producto en Catálogo y guarda su nombre y precio oficial.
- Si el producto ya estaba en el carrito, **suma** la cantidad (operación atómica en Redis) y responde `200`; si es nuevo responde `201`.
- `productId` ausente o vacío, o `cantidad` inválida → `400 VALIDACION_FALLIDA`.
- Producto inexistente o inactivo en Catálogo → `404 PRODUCTO_NO_ENCONTRADO`.
- Catálogo caído → `503 CATALOGO_NO_DISPONIBLE`.

### 3.3 PUT /api/carrito/items/{productId} — Modificar cantidad

```json
{ "cantidad": 5 }
```

- **Reemplaza** la cantidad (no la suma).
- Cuerpo ausente o cantidad inválida → `400 VALIDACION_FALLIDA`.
- Producto que no está en el carrito → `404 PRODUCTO_NO_ENCONTRADO`.
- No consulta Catálogo: responde con los precios guardados.

### 3.4 DELETE /api/carrito/items/{productId} — Eliminar producto

- Elimina el producto y renueva el TTL del carrito.
- Eliminar el último producto responde `200` con `items: []` y totales en 0.
- Producto que no está en el carrito → `404 PRODUCTO_NO_ENCONTRADO`.
- No consulta Catálogo.

### 3.5 DELETE /api/carrito — Vaciar carrito

- Borra el carrito completo y responde `200` con `items: []` y totales en 0.
- Es idempotente: responde `200` aunque el carrito no existiera.
- La confirmación previa ("¿Seguro que quieres vaciar el carrito?") es responsabilidad del frontend; el backend no la pide.

### 3.6 GET /api/carrito/disponibilidad — Verificar disponibilidad (HU-09)

- Revalida precio, estado y stock de cada ítem contra Catálogo. No modifica cantidades.
- Cada ítem queda en un estado: `OK`, `SIN_STOCK` (stock menor que la cantidad), `INACTIVO` (inactivo o 404 en Catálogo) o `PRECIO_CAMBIO`.
- **Prioridad (aclarado en la v1.4, SCRUM-65 y SCRUM-66):** se evalúa en el orden `INACTIVO`, luego `SIN_STOCK`, luego `PRECIO_CAMBIO`. Un producto inactivo nunca muestra `PRECIO_CAMBIO`.
- `PRECIO_CAMBIO` aparece solo si el precio cambió desde la última vez que el carrito lo vio. Si un `GET /api/carrito` ya revalidó y guardó el precio nuevo, la disponibilidad responde `OK` para ese ítem: el cambio ya se informó con `precioAnterior` en ese GET.
- `PRECIO_CAMBIO` actualiza el precio en Redis (como el GET) e informa `precioAnterior`. Deja `disponible: false` a propósito: el cliente ve el precio nuevo antes de pagar, y la segunda verificación ya responde `OK`.
- Si Catálogo no envía `stock` (`null`), el ítem no se marca `SIN_STOCK`; el descuento de stock de la confirmación es el que protege.
- Carrito vacío → `400 CARRITO_VACIO`. Catálogo caído → `503` sin escrituras en Redis.

### 3.7 POST /api/carrito/checkout — Crear checkout (HU-08)

- Ejecuta la verificación de la sección 3.6. Si algún ítem no está en `OK`, responde `409 CARRITO_NO_DISPONIBLE` con el detalle en `items` y no crea nada.
- Si todo está en `OK`, congela un **snapshot**: los ítems, los precios y los descuentos tal como se ven en ese momento. Responde `201` con la forma de la sección 4.4.
- El snapshot vence a los 15 minutos (`expiraEn`, `CHECKOUT_VIGENCIA_SECONDS`).
- Hay un solo checkout vigente por usuario: crear uno nuevo reemplaza al anterior, que ya no se puede confirmar.
- Si el Módulo Descuentos está caído, el snapshot se crea igual, sin descuentos y con `descuentosDisponibles: false`.
- Modificar el carrito después del checkout no cambia el snapshot.

### 3.8 POST /api/carrito/checkout/{checkoutId}/confirmar — Confirmar pedido (HU-10)

- Solo el dueño del checkout puede confirmarlo. Un `checkoutId` inexistente o de otro usuario responde `404 CHECKOUT_NO_ENCONTRADO`.
- Confirma lo que el cliente vio: descuenta en Catálogo las cantidades del snapshot y crea el pedido con sus precios y descuentos, sin recalcular.
- Al confirmar: se descuenta el stock, se guarda el pedido, el checkout pasa a `CONFIRMADO` y se vacía el carrito. Responde `201` con la forma de la sección 4.5.
- **Idempotente:** repetir con el mismo `checkoutId` responde `200` con el mismo pedido, sin descontar stock otra vez.
- Un checkout reemplazado por uno más nuevo → `409 CHECKOUT_REEMPLAZADO`. Así un usuario no puede crear dos pedidos con dos resúmenes.
- Después de `expiraEn` → `409 CHECKOUT_EXPIRADO`; el cliente vuelve a iniciar el pago.
- Si otra petición está confirmando el mismo checkout en ese momento → `409 CONFIRMACION_EN_CURSO`.
- Catálogo rechaza el descuento → `409 STOCK_INSUFICIENTE` con los productos que fallaron; el checkout vuelve a `PENDIENTE` y se puede reintentar.
- Si guardar el pedido falla después de descontar, se pide a Catálogo devolver el stock (`devolver-stock`, propuesto; ver sección 7.2). Mientras Catálogo no lo exponga, el fallo queda en el log para devolverlo a mano.
- Vaciar el carrito borra también lo que el cliente agregó después del checkout. Un fallo al vaciarlo no deshace el pedido.
- **Desde la v1.4:** después de guardar el pedido en Redis se registra en el histórico de PostgreSQL (sección 3.9). Si PostgreSQL falla, el pedido no se pierde ni se rechaza: el error queda en el log y la respuesta es la misma. El registro es idempotente por `checkout_id`.

### 3.9 GET /api/carrito/pedidos — Historial de pedidos (nuevo, HU-11)

- Lista los pedidos del usuario del token, del más reciente al más antiguo, con la forma de la sección 4.6.
- `limit`: entero entre 1 y 50, por defecto 10. `offset`: entero ≥ 0, por defecto 0. Un valor fuera de rango o que no sea entero responde `400 VALIDACION_FALLIDA`.
- Lee PostgreSQL primero (`fuente: "POSTGRES"`). Si PostgreSQL no responde, usa el respaldo de Redis con los pedidos de los últimos 30 días (`fuente: "REDIS"`).
- Un usuario sin pedidos recibe `200` con `pedidos: []` y `total: 0`.

### 3.10 GET /api/carrito/pedidos/{pedidoId} — Detalle de un pedido (nuevo, HU-11)

- Devuelve el pedido tal como lo creó la confirmación (sección 4.5).
- Un pedido inexistente o de otro usuario responde `404 PEDIDO_NO_ENCONTRADO`; no se distingue entre los dos casos para no revelar pedidos ajenos.
- Si PostgreSQL no responde, se busca en Redis (30 días).

### 3.11 GET /api/carrito/recuperar — Recuperar carrito (nuevo, HU-12)

- Devuelve el carrito revalidado contra Catálogo (igual que `GET /api/carrito`) más el bloque `recuperacion` (sección 4.7).
- **Actividad:** cuentan como actividad agregar (`POST /items`), modificar la cantidad (`PUT /items/{productId}`) y eliminar un producto (`DELETE /items/{productId}`). Las revalidaciones automáticas (`GET /api/carrito` y la disponibilidad) no cuentan.
- **Inactividad:** el cliente está inactivo si pasaron `CART_INACTIVITY_HOURS` (1 hora por defecto) desde su última actividad. Llamar a `/recuperar` con un carrito cuenta como actividad, así que el aviso sale una sola vez por periodo de inactividad.
- **Cambios:** informa los precios que cambiaron (con el precio anterior) y los productos que ya no están disponibles.
- **Carrito vencido o vacío:** pasados 7 días sin actividad Redis borra el carrito y `/recuperar` responde `200` con `items: []` y `hayCarrito: false`. En ese caso no se registra actividad.
- **Carrito sin registro de actividad** (creado antes de la v1.4): `inactivo: false`, `ultimaActividad: null`; desde esa visita empieza a registrarse.
- Catálogo caído → `503 CATALOGO_NO_DISPONIBLE`, sin escrituras y sin registrar actividad.
- Registrar la actividad es de mejor esfuerzo: si falla, la operación del carrito igual responde bien.

## 4. Respuestas

### 4.1 Respuesta del carrito

Sin cambios respecto a la v1.2.

```json
{
  "userId": "usr_demo",
  "items": [
    {
      "productId": "prod_001", "nombre": "Camiseta básica algodón", "cantidad": 3,
      "precioUnitario": 49900, "subtotalItem": 149700,
      "descuentoAplicadoItem": 22455, "totalItem": 127245, "disponible": true
    },
    {
      "productId": "prod_002", "nombre": "Jean clásico", "cantidad": 2,
      "precioUnitario": 129900, "subtotalItem": 259800,
      "descuentoAplicadoItem": 25980, "totalItem": 233820, "disponible": true
    }
  ],
  "subtotal": 409500,
  "descuentoItems": 48435,
  "descuentoCarrito": 18053,
  "descuentoTotal": 66488,
  "total": 343012,
  "descuentosAplicados": [
    { "reglaId": "DESC-CAMISETA-3X", "tipo": "CANTIDAD_MINIMA", "descripcion": "15% llevando 3 o más camisetas", "productId": "prod_001", "monto": 22455 },
    { "reglaId": "DESC-JEAN-10", "tipo": "PORCENTAJE_PRODUCTO", "descripcion": "10% en Jean clásico", "productId": "prod_002", "monto": 25980 },
    { "reglaId": "DESC-CARRITO-300K", "tipo": "MONTO_MINIMO_CARRITO", "descripcion": "5% adicional en compras desde $300.000", "productId": null, "monto": 18053 }
  ],
  "descuentosDisponibles": true
}
```

**Campos de cada ítem**

| Campo | Tipo | Significado |
| --- | --- | --- |
| `productId` | string | Identificador del producto en Catálogo |
| `nombre` | string | Nombre oficial de Catálogo |
| `cantidad` | entero ≥ 1 | Unidades en el carrito |
| `precioUnitario` | entero | Precio oficial vigente (COP) |
| `subtotalItem` | entero | `precioUnitario × cantidad` |
| `descuentoAplicadoItem` | entero | Descuento de la mejor regla de ítem; 0 si no aplica ninguna |
| `totalItem` | entero | `subtotalItem − descuentoAplicadoItem` |
| `disponible` | boolean | `false` si Catálogo lo reporta inactivo o inexistente en la última revalidación |
| `precioAnterior` | entero, opcional | Solo aparece en la respuesta que detectó un cambio de precio |

**Campos del carrito**

| Campo | Tipo | Significado |
| --- | --- | --- |
| `userId` | string | Claim `sub` del token |
| `items` | array | Ítems del carrito (incluidos los no disponibles) |
| `subtotal` | entero | Suma de `subtotalItem` de los ítems disponibles |
| `descuentoItems` | entero | Suma de `descuentoAplicadoItem` de los ítems disponibles |
| `descuentoCarrito` | entero | Descuento de la regla de carrito; no se reparte entre ítems |
| `descuentoTotal` | entero | `descuentoItems + descuentoCarrito` |
| `total` | entero | `subtotal − descuentoTotal` |
| `descuentosAplicados` | array | Reglas aplicadas con su monto; `productId: null` indica regla de carrito |
| `descuentosDisponibles` | boolean | `false` si el Módulo Descuentos falló o tardó; el total es el subtotal y el frontend muestra un aviso |

Identidades que se cumplen siempre: `totalItem = subtotalItem − descuentoAplicadoItem`; `descuentoTotal = descuentoItems + descuentoCarrito`; `total = subtotal − descuentoTotal`.

### 4.2 Respuesta de error

Ver sección 5.

### 4.3 Disponibilidad (HU-09)

`disponible` es `true` solo si todos los ítems están en `OK`.

```json
{
  "disponible": false,
  "items": [
    { "productId": "prod_001", "cantidad": 3, "stock": 20, "estado": "OK" },
    { "productId": "prod_002", "cantidad": 2, "stock": 1, "estado": "SIN_STOCK" },
    { "productId": "prod_003", "cantidad": 1, "stock": 0, "estado": "INACTIVO" }
  ]
}
```

| Campo del ítem | Tipo | Significado |
| --- | --- | --- |
| `productId` | string | Producto del carrito |
| `cantidad` | entero | Unidades en el carrito |
| `stock` | entero o `null` | Stock que informa Catálogo; `null` si no lo envía |
| `estado` | string | `OK`, `SIN_STOCK`, `INACTIVO` o `PRECIO_CAMBIO` |
| `precioUnitario`, `precioAnterior` | entero, solo en `PRECIO_CAMBIO` | Precio nuevo (ya guardado) y precio anterior |

### 4.4 Checkout (HU-08)

La respuesta del carrito de la sección 4.1 más `checkoutId`, `estado` y `expiraEn`.

```json
{
  "checkoutId": "chk_7f3a9c21-...",
  "estado": "PENDIENTE",
  "expiraEn": "2026-11-05T15:30:00.000Z",
  "userId": "usr_demo",
  "items": [ "..." ],
  "subtotal": 409500, "descuentoItems": 48435, "descuentoCarrito": 18053,
  "descuentoTotal": 66488, "total": 343012,
  "descuentosAplicados": [ "..." ], "descuentosDisponibles": true
}
```

### 4.5 Pedido (HU-10)

```json
{
  "pedidoId": "ped_b2c1...",
  "checkoutId": "chk_7f3a9c21-...",
  "userId": "usr_demo",
  "estado": "CONFIRMADO",
  "creadoEn": "2026-11-05T15:21:10.000Z",
  "reservaId": "chk_7f3a9c21-...",
  "items": [ "..." ],
  "subtotal": 409500, "descuentoTotal": 66488, "total": 343012
}
```

| Campo | Significado |
| --- | --- |
| `pedidoId` | Identificador del pedido (`ped_` + UUID) |
| `checkoutId` | Checkout del que nace; la misma confirmación repetida devuelve el mismo pedido |
| `estado` | Siempre `CONFIRMADO` en este sprint (sin pago real) |
| `creadoEn` | Momento de la confirmación |
| `reservaId` | Referencia con la que se descontó el stock en Catálogo. Hoy es el mismo `checkoutId`, porque Catálogo no devuelve un id propio |
| `items`, `subtotal`, `descuentoTotal`, `total` | Copiados del snapshot: el cliente paga lo que vio |

`GET /api/carrito/pedidos/{pedidoId}` (HU-11) devuelve esta misma forma.

### 4.6 Historial (HU-11, nuevo)

```json
{
  "pedidos": [
    {
      "pedidoId": "ped_b2c1...", "checkoutId": "chk_7f3a...", "estado": "CONFIRMADO",
      "creadoEn": "2026-11-10T15:21:10.000Z", "unidades": 5,
      "subtotal": 409500, "descuentoTotal": 66488, "total": 343012
    }
  ],
  "total": 1, "limit": 10, "offset": 0, "fuente": "POSTGRES"
}
```

| Campo | Significado |
| --- | --- |
| `pedidos` | Resumen de cada pedido, del más reciente al más antiguo. `unidades` es la suma de las cantidades. El detalle de los ítems está en `GET /pedidos/{pedidoId}` |
| `total` | Cantidad total de pedidos del usuario (no solo los de esta página) |
| `limit`, `offset` | Los valores aplicados (los recibidos o los de por defecto) |
| `fuente` | `POSTGRES`, o `REDIS` cuando PostgreSQL no responde y se usa el respaldo de los últimos 30 días |

### 4.7 Recuperación (HU-12, nuevo)

La respuesta del carrito de la sección 4.1 más el bloque `recuperacion`.

```json
{
  "userId": "usr_demo",
  "items": [ "..." ],
  "subtotal": 409500, "descuentoItems": 48435, "descuentoCarrito": 18053,
  "descuentoTotal": 66488, "total": 343012,
  "descuentosAplicados": [ "..." ], "descuentosDisponibles": true,
  "recuperacion": {
    "hayCarrito": true,
    "inactivo": true,
    "ultimaActividad": "2026-11-10T09:00:00.000Z",
    "inactividadMinutos": 185,
    "expiraEnSegundos": 601200,
    "cambios": {
      "preciosCambiados": [
        { "productId": "prod_001", "nombre": "Camiseta básica algodón", "precioAnterior": 49900, "precioUnitario": 54900 }
      ],
      "noDisponibles": [ { "productId": "prod_003", "nombre": "Gorra edición limitada" } ]
    }
  }
}
```

| Campo de `recuperacion` | Tipo | Significado |
| --- | --- | --- |
| `hayCarrito` | boolean | `false` si el carrito está vacío o venció |
| `inactivo` | boolean | `true` si hay carrito y pasaron `CART_INACTIVITY_HOURS` o más desde la última actividad |
| `ultimaActividad` | fecha ISO o `null` | Última vez que el cliente agregó, modificó o eliminó; `null` si no hay registro |
| `inactividadMinutos` | entero | Minutos desde `ultimaActividad`; 0 si no hay registro |
| `expiraEnSegundos` | entero o `null` | Segundos que le quedan al carrito antes de vencer (TTL de Redis); `null` si no hay carrito |
| `cambios.preciosCambiados` | array | Productos cuyo precio cambió en esta revalidación, con `precioAnterior` y `precioUnitario` (nuevo) |
| `cambios.noDisponibles` | array | Productos con `disponible: false` (inactivos o inexistentes en Catálogo) |

## 5. Errores

Formato único para todos los errores:

```json
{ "codigo": "PRODUCTO_NO_ENCONTRADO", "mensaje": "El producto no está en el carrito" }
```

Los 409 `CARRITO_NO_DISPONIBLE` y `STOCK_INSUFICIENTE` agregan `items` con los productos que fallaron. Los campos extra nunca reemplazan `codigo` ni `mensaje`:

```json
{ "items": [{ "productId": "prod_002", "cantidad": 2, "stock": 1 }], "codigo": "STOCK_INSUFICIENTE", "mensaje": "No hay stock suficiente para algunos productos" }
```

| HTTP | `codigo` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDACION_FALLIDA` | Cantidad o `productId` inválidos, cuerpo ausente, JSON mal formado, cuerpo mayor de 100 kb, o `limit` / `offset` inválidos en el historial |
| 400 | `CARRITO_VACIO` | Disponibilidad o checkout con el carrito vacío |
| 401 | `NO_AUTORIZADO` | Token ausente, con formato inválido, expirado, mal firmado o sin claim `sub` |
| 404 | `PRODUCTO_NO_ENCONTRADO` | POST de un producto inexistente o inactivo en Catálogo; PUT o DELETE de un producto que no está en el carrito |
| 404 | `CHECKOUT_NO_ENCONTRADO` | El checkout no existe, venció en Redis o es de otro usuario |
| 404 | `PEDIDO_NO_ENCONTRADO` (nuevo) | El pedido no existe o pertenece a otro usuario |
| 404 | `RUTA_NO_ENCONTRADA` | Ruta inexistente |
| 409 | `CARRITO_NO_DISPONIBLE` | Checkout con algún ítem que no está en `OK`; trae `items` |
| 409 | `CHECKOUT_REEMPLAZADO` | Se creó un checkout más nuevo; el viejo ya no se puede confirmar |
| 409 | `CHECKOUT_EXPIRADO` | Confirmar después de `expiraEn` (15 min) |
| 409 | `CONFIRMACION_EN_CURSO` | Otra petición está confirmando el mismo checkout |
| 409 | `STOCK_INSUFICIENTE` | Catálogo rechazó el descuento de stock; trae `items` |
| 429 | `DEMASIADAS_PETICIONES` (nuevo) | El usuario superó el límite de peticiones; la respuesta trae `Retry-After` |
| 503 | `CATALOGO_NO_DISPONIBLE` | Catálogo no responde, responde con error, excede el timeout o devuelve un formato inválido |
| 503 | `SERVICIO_NO_DISPONIBLE` (nuevo) | Redis o PostgreSQL no responden (error de conexión: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `EPIPE`). El historial no lo produce por PostgreSQL: usa el respaldo de Redis |
| 500 | `ERROR_INTERNO` | Cualquier error no controlado. El mensaje es genérico y no expone detalles internos |

Un fallo del Módulo Descuentos **nunca** produce un error (sección 6.3).

## 6. Descuentos (módulo interno)

Los descuentos se calculan dentro del mismo proceso del Carrito (`src/discounts/`); no hay gRPC, Protobuf ni servicio externo. `cartTotals.js` es el único punto que invoca al módulo. El motor recibe solo `{ productId, precioUnitario, cantidad, disponible }` de cada ítem y no consulta Catálogo ni Redis. El checkout congela el resultado: confirmar no vuelve a calcular descuentos.

### 6.1 Tipos de regla

| Tipo | Parámetros | Regla de la demo | Ejemplo |
| --- | --- | --- | --- |
| `PORCENTAJE_PRODUCTO` | `productIds`, `porcentaje` | `DESC-JEAN-10`: 10% en `prod_002` | 1 jean de 129.900 → 12.990 |
| `CANTIDAD_MINIMA` | `productIds`, `cantidadMinima`, `porcentaje` | `DESC-CAMISETA-3X`: 15% en `prod_001` desde 3 unidades | 3 camisetas (149.700) → 22.455; 2 camisetas → 0 |
| `MONTO_MINIMO_CARRITO` | `montoMinimo`, `porcentaje` | `DESC-CARRITO-300K`: 5% si lo que queda tras los descuentos por ítem es ≥ 300.000 | 361.065 → 18.053 |

Cada regla tiene además `id`, `descripcion`, `activa` y, opcionales, `vigenteDesde` / `vigenteHasta`. Las reglas se leen con `getActiveRules()` desde `src/discounts/discountRules.js`. La tabla `reglas_descuento` ya existe en PostgreSQL con las tres reglas de la demo sembradas, pero leerlas de ahí (con caché de `DISCOUNT_RULES_CACHE_MS` y respaldo en el código) es el stretch SCRUM-27 y **todavía no está activo**. Cuando entre, solo cambia `getActiveRules()` y el comportamiento visible es el mismo.

### 6.2 Política de aplicación

1. Por cada ítem disponible se evalúan las reglas de ítem y se aplica solo la de mayor monto (no se acumulan).
2. La regla de carrito se calcula sobre la base `Σ(subtotalItem − descuentoAplicadoItem)` de los ítems disponibles; también se aplica solo la mejor.
3. Los ítems con `disponible: false` no reciben descuento ni cuentan para el umbral.
4. Cada monto se redondea con `Math.round`; ningún descuento supera la base sobre la que se calcula.

### 6.3 Tolerancia a fallos (HU-07)

Si el Módulo Descuentos lanza un error o tarda más de `DISCOUNT_TIMEOUT_MS` (200 ms por defecto), el carrito responde normalmente con descuentos en 0, `descuentosAplicados: []`, `total = subtotal` y `descuentosDisponibles: false`. El frontend muestra un aviso. Nunca se devuelve `500` por culpa de Descuentos.

## 7. Integración con Catálogo

Acuerdo con el equipo de Catálogo del 27/10/2026. Catálogo **no tiene reservas**: confirmar un pedido descuenta el stock de forma definitiva. Cualquier ajuste a la forma real se limita a `src/clients/catalogClient.js` y al mock de `mocks/catalog-mock/`.

`CATALOG_BASE_URL` **incluye el prefijo**: `http://catalog-mock:4000/api/catalogo` (mock, por defecto en Docker Compose) o `http://host.docker.internal:8080` (Catálogo real directo, sin prefijo). Nuestro Kong y el de Catálogo usan los dos el puerto 8000, así que para integrar se usa el acceso directo.

| Endpoint de Catálogo | Uso | Respuesta | Estado |
| --- | --- | --- | --- |
| `GET {CATALOG_BASE_URL}/productos/{id}` | Precio, nombre y estado (todas las HU); `stock` (HU-09) | `200 { id, nombre, precio, activo, stock, categoria, ... }` · `404` solo si el id no existe | Acordado |
| `POST {CATALOG_BASE_URL}/productos/descontar-stock` | HU-10: descontar el stock del pedido, todo o nada | `200 { items: [{ id, stockRestante }] }` · `409 STOCK_INSUFICIENTE` con los ids en el `mensaje` | Acordado |
| `POST {CATALOG_BASE_URL}/productos/devolver-stock` | HU-10: devolver el stock si falla guardar el pedido | `204` | **Propuesto**, aún no existe en Catálogo |

**Producto.** Los ids reales son ObjectId de MongoDB (24 caracteres hexadecimales); el mock usa `prod_00X`.

```json
{ "id": "prod_001", "nombre": "Camiseta básica algodón", "precio": 49900, "activo": true, "stock": 20, "categoria": "cat-ropa" }
```

**Descontar stock (cuerpo del POST).** El Carrito envía el `checkoutId` como `referencia`. Catálogo la ignora hoy; si la acepta (propuesta), un reintento con la misma referencia no descontará dos veces. El mock ya implementa la propuesta.

```json
{ "referencia": "chk_7f3a9c21-...", "items": [{ "id": "prod_001", "cantidad": 3 }, { "id": "prod_002", "cantidad": 2 }] }
```

| Respuesta de Catálogo | Interpretación en el Carrito |
| --- | --- |
| Producto `200` con `activo: true` | Producto válido; se usan `nombre`, `precio` y `stock` |
| Producto `200` con `activo: false`, o `404` | Inactivo: POST → `404`; GET → `disponible: false`; disponibilidad → `INACTIVO` |
| Producto sin `stock` | `stock: null`: no rompe GET ni POST; el descuento de stock de HU-10 es el que protege |
| Descontar `200` | El pedido guarda la `referencia` (el `checkoutId`) en `reservaId`; Catálogo no devuelve un id propio |
| Descontar `409` | `409 STOCK_INSUFICIENTE`. `items` = los productos del pedido cuyo id aparece en el `mensaje` (o los `items` del cuerpo, si Catálogo algún día los envía) |
| Otro código, timeout (`CATALOG_TIMEOUT_MS`, 3000 ms), error de red o JSON con otro esquema | `503 CATALOGO_NO_DISPONIBLE` |
| Fallo al devolver stock | Se registra en el log para devolverlo a mano en Catálogo; no se propaga al cliente |

### 7.1 Acuerdos con Catálogo

| # | Tema | Acuerdo (27/10/2026) |
| --- | --- | --- |
| 1 | Producto | `{ id, nombre, precio, activo, stock, categoria, ... }`; ids ObjectId de MongoDB |
| 2 | Producto inactivo | `200` con `activo: false`; el `404` es solo para un id que no existe |
| 3 | Stock | Entero ≥ 0, ya disponible |
| 4 | Categoría | Viene el id (por ejemplo `cat-ropa`); los nombres salen de `GET /categorias`. Falta confirmar el nombre exacto del campo |
| 5 | Descontar stock | `POST /productos/descontar-stock`, todo o nada |
| 6 | Reservas | No existen: el descuento es definitivo y no vence |
| 7 | Token | Ningún endpoint de Catálogo valida token (Keycloak no está integrado en esta entrega) |
| 8 | URL | Por su Kong: `http://localhost:8000/api/catalogo`. Directo: `http://localhost:8080`, sin prefijo. Cada equipo levanta su propio Kong |

### 7.2 Propuesto a Catálogo, pendiente de respuesta

| # | Propuesta | Por qué |
| --- | --- | --- |
| 1 | `referencia` opcional (el `checkoutId`) en `descontar-stock`, idempotente | Que un reintento no descuente dos veces. El Carrito ya la envía |
| 2 | `POST /productos/devolver-stock` con `{ referencia }` | Devolver el stock si falla guardar el pedido. Mientras no exista, el fallo queda en el log para devolverlo a mano |
| 3 | Que el `409` traiga `items` en el cuerpo | No depender de leer los ids en el `mensaje`. El Carrito ya los usa si llegan |

> **Riesgo conocido** hasta que exista la `referencia`: si la respuesta de Catálogo llega después de nuestro timeout, el Carrito responde `503`, el checkout vuelve a `PENDIENTE`, y un reintento del cliente descontaría el stock dos veces.

## 8. Persistencia (referencia para otros equipos)

Redis sigue siendo la fuente del carrito, del checkout y del respaldo del historial. PostgreSQL guarda el histórico de pedidos y las reglas de descuento. Solo los repositorios tocan Redis o PostgreSQL; servicios y controladores no escriben SQL (RNF-07).

### 8.1 Redis

| Clave | Valor | TTL |
| --- | --- | --- |
| `carrito:{userId}` | Hash `productId` → JSON `{ productId, nombre, precioUnitario, cantidad }`. No se guardan `disponible`, `precioAnterior` ni descuentos | 7 días (`CART_TTL_SECONDS`), renovado en cada escritura y al eliminar un ítem |
| `carrito-actividad:{userId}` (nuevo) | Texto con la fecha ISO de la última actividad del cliente (HU-12) | 7 días, igual que el carrito. Se borra al vaciar el carrito |
| `checkout:{checkoutId}` | Hash: `data` (JSON del snapshot, no cambia), `estado` (`PENDIENTE`, `CONFIRMANDO`, `CONFIRMADO`), `userId`, `pedidoId`, `confirmandoDesde` | 24 h (`CHECKOUT_TTL_SECONDS`). La vigencia para comprar es `expiraEn`: 15 min (`CHECKOUT_VIGENCIA_SECONDS`) |
| `checkout-usuario:{userId}` | `checkoutId` del checkout vigente | 24 h |
| `pedido:{pedidoId}` | JSON del pedido | 30 días (`PEDIDO_TTL_SECONDS`). Es el respaldo del historial cuando PostgreSQL cae |
| `pedidos-usuario:{userId}` | Lista de `pedidoId`, el más reciente primero | 30 días |

### 8.2 PostgreSQL (nuevo)

| Tabla | Estructura | Notas |
| --- | --- | --- |
| `pedidos` | Clave `pedido_id`; `checkout_id` único; `user_id`, `estado`, totales (`subtotal`, `descuento_total`, `total`), `creado_en` y `snapshot` JSONB | El índice por usuario y fecha sirve al listado. `checkout_id` único hace idempotente el registro |
| `pedido_items` | Un renglón por producto del pedido | Se borra en cascada con el pedido |
| `reglas_descuento` | Reglas del Módulo Descuentos | Con tres reglas de demostración sembradas. Todavía no se lee (stretch SCRUM-27) |
| `schema_migrations` | Migraciones aplicadas | La llena el corredor de migraciones (`db/migrations/*.sql`) |

| Operación | Implementación |
| --- | --- |
| HU-01 agregar | Script Lua `cartAddItem`: lee, suma y escribe en una sola operación atómica |
| HU-04 eliminar | `HDEL` + `EXPIRE` en `MULTI`; si era el último campo, Redis borra la clave |
| HU-05 vaciar | `DEL carrito:{userId} carrito-actividad:{userId}` |
| HU-12 actividad | `SET carrito-actividad:{userId} <fecha ISO> EX 604800` después de agregar, modificar o eliminar; `TTL carrito:{userId}` para `expiraEnSegundos` |
| HU-11 histórico | `INSERT` en `pedidos` y `pedido_items` en una transacción, `ON CONFLICT (checkout_id) DO NOTHING` |
| HU-10 bloqueo | Script Lua `checkoutConfirm`: pasa `PENDIENTE` → `CONFIRMANDO` en una sola operación. Un `CONFIRMANDO` de más de 30 s (`CHECKOUT_LOCK_MS`) se considera abandonado y se puede retomar |
| HU-10 pedido | Guardar el pedido y marcar el checkout `CONFIRMADO` van en el mismo `MULTI` |

La clave del checkout dura más que su vigencia para poder responder confirmaciones repetidas y distinguir un checkout vencido (`409`) de uno inexistente (`404`).

## 9. Configuración

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto interno del servicio |
| `REDIS_URL` | `redis://localhost:6379` | Conexión a Redis |
| `CART_TTL_SECONDS` | `604800` | TTL del carrito (7 días) |
| `CATALOG_BASE_URL` | `http://localhost:4000/api/catalogo` | URL base de Catálogo, **con** el prefijo (ver sección 7) |
| `CATALOG_TIMEOUT_MS` | `3000` | Timeout de cada llamada a Catálogo (productos y stock) |
| `DISCOUNT_TIMEOUT_MS` | `200` | Tiempo máximo del Módulo Descuentos antes de responder sin descuentos |
| `CHECKOUT_TTL_SECONDS` | `86400` | Vida de la clave del checkout en Redis (24 h) |
| `CHECKOUT_VIGENCIA_SECONDS` | `900` | Vigencia del checkout para confirmar (15 min) |
| `CHECKOUT_LOCK_MS` | `30000` | Tiempo tras el cual un `CONFIRMANDO` se considera abandonado |
| `PEDIDO_TTL_SECONDS` | `2592000` | Vida del pedido en Redis (30 días) |
| `DATABASE_URL` (nuevo) | `postgres://carrito:carrito_dev@localhost:5432/carrito` | Conexión a PostgreSQL |
| `DB_POOL_MAX` (nuevo) | `5` | Tamaño del pool de conexiones |
| `AUTO_MIGRATE` (nuevo) | `true` | Con `false` no se corren migraciones al arrancar |
| `CART_INACTIVITY_HOURS` (nuevo) | `1` | Umbral de inactividad de HU-12 |
| `DISCOUNT_RULES_CACHE_MS` (nuevo) | `60000` | Caché de las reglas en PostgreSQL (se usa cuando entre SCRUM-27) |
| `RATE_LIMIT_MAX` (nuevo) | `120` | Peticiones por usuario y ventana |
| `RATE_LIMIT_WINDOW_MS` (nuevo) | `60000` | Ventana del límite de peticiones |
| `SHUTDOWN_TIMEOUT_MS` (nuevo) | `10000` | Tiempo máximo del cierre ordenado |
| `DOCKER_CATALOG_BASE_URL` (nuevo, solo Docker Compose) | mock | `CATALOG_BASE_URL` que recibe el contenedor. Catálogo real directo: `http://host.docker.internal:8080` |
| `KONG_PROXY_PORT`, `KONG_ADMIN_PORT` (nuevo, solo Docker Compose) | `8000`, `8001` | Puertos de nuestro Kong en el host; `8100`/`8101` para convivir con el Kong de Catálogo |
| `POSTGRES_HOST_PORT` (nuevo, solo Docker Compose) | `5432` | Puerto de PostgreSQL en el host |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto HS256. En producción es obligatorio cambiarlo: el servicio no arranca con el valor por defecto |

## 10. Reglas de negocio

### 10.1 Flujo de compra (v1.3)

- Siguen las del Sprint 2: precio oficial de Catálogo, POST suma, PUT reemplaza, Descuentos nunca bloquea el carrito.
- La compra va en tres pasos separados: verificar (HU-09), congelar un resumen (HU-08) y confirmar (HU-10). El cliente ve el total final antes de comprometer stock.
- Disponibilidad no modifica cantidades. `PRECIO_CAMBIO` deja `disponible: false` a propósito.
- `stock: null` se deja pasar; el descuento de stock de HU-10 es el que protege.
- El descuento de stock en Catálogo es definitivo: no hay reservas que venzan.
- El snapshot congela precios y descuentos: confirmar cobra lo que el cliente vio.
- Un checkout vigente por usuario: uno nuevo reemplaza al anterior.
- Confirmar es idempotente: repetir con el mismo `checkoutId` responde `200` con el mismo pedido.
- Sin pago real: el pedido nace `CONFIRMADO`.

### 10.2 Historial y recuperación (nuevo en la v1.4)

- **Registro en el histórico:** ocurre después de guardar el pedido en Redis. Si PostgreSQL falla, el pedido no se pierde ni se rechaza: el error se registra y el pedido sigue siendo válido. El registro es idempotente por `checkout_id`.
- **Lectura del historial:** PostgreSQL primero; si falla, se responde con los pedidos recientes de Redis y `fuente: "REDIS"`.
- **Actividad:** cuenta como actividad agregar, modificar cantidad o eliminar un producto. Las revalidaciones automáticas (GET y disponibilidad) no cuentan.
- **Inactividad:** el cliente está inactivo si pasó `CART_INACTIVITY_HOURS` (1 hora por defecto) desde su última actividad. Llamar a `/recuperar` cuenta como actividad, así que el aviso sale una sola vez por periodo de inactividad.
- **Recuperar revalida contra Catálogo**, igual que `GET /api/carrito`: precios cambiados y productos no disponibles se informan en `cambios`.
- **Carrito vencido:** pasados 7 días sin actividad Redis lo borra y `/recuperar` responde `hayCarrito: false`.
- **Arranque con PostgreSQL caído:** el servicio arranca igual, sin histórico, y `/ready` responde `degraded`. Sin Redis no arranca.
- **Reglas en PostgreSQL (stretch SCRUM-27, pendiente):** cuando entre, se leerán con caché de 60 segundos y, si la base falla, se usarán las reglas del código. Hoy las reglas salen del código. Los descuentos nunca bloquean el carrito.
- **Limitación conocida:** un pedido confirmado mientras PostgreSQL está caído queda solo en Redis (30 días); no hay reconciliación automática hacia PostgreSQL.
