# Contrato de Servicio — Microservicio de Carrito de Compras (v1.3)

| Campo | Valor |
| --- | --- |
| Versión | 1.3 (reemplaza la v1.2) |
| Fecha | Noviembre de 2026 — Sprint 3 |
| Responsable | Camilo Andres Herrera Celis (con Juan David Gómez para los acuerdos con Catálogo) |
| Revisor | Santiago Torres Barbosa |
| Destinatarios | Equipos de Catálogo y Búsqueda; frontend del Carrito |
| Estado | Borrador para revisión. Los puntos marcados **POR CONFIRMAR** dependen de la respuesta de Catálogo |

Este documento describe el contrato REST del Carrito al final del Sprint 3: los cinco endpoints del carrito (sin cambios) y los tres del flujo de compra (disponibilidad, checkout y confirmación de pedido). Donde una versión anterior dice otra cosa, prevalece este documento.

## 0. Cambios v1.2 → v1.3

| Cambio | Detalle |
| --- | --- |
| Nuevo endpoint | `GET /api/carrito/disponibilidad` (HU-09, sección 3.6) |
| Nuevo endpoint | `POST /api/carrito/checkout` (HU-08, sección 3.7) |
| Nuevo endpoint | `POST /api/carrito/checkout/{checkoutId}/confirmar` (HU-10, sección 3.8) |
| Errores nuevos | `CARRITO_VACIO`, `CARRITO_NO_DISPONIBLE`, `CHECKOUT_NO_ENCONTRADO`, `CHECKOUT_REEMPLAZADO`, `CHECKOUT_EXPIRADO`, `CONFIRMACION_EN_CURSO`, `STOCK_INSUFICIENTE` (sección 5) |
| Formato de error | Los 409 de checkout y de stock agregan `items` con los productos que fallaron |
| Modelo Redis | `checkout:{id}`, `checkout-usuario:{userId}`, `pedido:{id}`, `pedidos-usuario:{userId}` (sección 8) |
| Catálogo | `stock` en el producto; `POST` y `DELETE /api/catalogo/reservas` (sección 7) |
| Alcance | Sin pago real: el pedido nace `CONFIRMADO` |

Los cinco endpoints del Sprint 2 y la respuesta del carrito (sección 4) no cambian, así que un cliente de la v1.2 sigue funcionando.

### 0.1 Historial: cambios v1.0 → v1.2

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

El Carrito permite a un cliente autenticado agregar, consultar, modificar, eliminar y vaciar los productos de su carrito, con el subtotal, los descuentos aplicados y el total en cada respuesta. Desde la v1.3 también permite pasar del carrito a un pedido confirmado: verificar disponibilidad, congelar un resumen de compra y confirmarlo reservando el stock en Catálogo.

Fuera de este contrato: pago real (el pedido nace `CONFIRMADO` sin cobro), histórico de pedidos en PostgreSQL y recuperación del carrito abandonado (HU-11, HU-12, Sprint 4), eventos RabbitMQ (solo si otro equipo los pide), Keycloak real, cupones y descuentos por categoría.

## 2. Convenciones generales

- **Entrada:** todas las peticiones pasan por Kong (`http://localhost:8000` en local). El servicio escucha internamente en el puerto `3000`.
- **Autenticación:** todas las rutas exigen `Authorization: Bearer <JWT>` firmado con HS256. El usuario sale **siempre** del claim `sub` del token; nunca del cuerpo, la query ni la ruta (RNF-02). Un token sin `sub`, expirado, mal firmado o ausente responde `401 NO_AUTORIZADO`.
- **Formato:** JSON en UTF-8 (`Content-Type: application/json`). Los tres endpoints nuevos no llevan cuerpo.
- **Dinero:** pesos colombianos (COP) como enteros. Cada monto calculado se redondea con `Math.round`.
- **Cantidades:** enteros `>= 1`. `1.5`, `0`, negativos o `"3"` (texto) responden `400 VALIDACION_FALLIDA`.
- **Precios:** el precio y el nombre del producto salen siempre de Catálogo, nunca del cliente (RF-13, RF-14).
- **Fechas:** ISO 8601 en UTC (`2026-11-05T15:30:00.000Z`).
- **CORS (Kong):** origen `http://localhost:5173`; métodos `GET, POST, PUT, DELETE, OPTIONS`; cabeceras `Authorization, Content-Type`.
- **Salud:** `GET /health` → `200 { "status": "ok" }` (no pasa por autenticación ni por Kong).

## 3. Endpoints

| Método y ruta | HU | Cuerpo | Respuestas |
| --- | --- | --- | --- |
| `GET /api/carrito` | HU-02, HU-06 | — | `200` carrito con desglose · `401` · `503` Catálogo caído |
| `POST /api/carrito/items` | HU-01 | `{ productId, cantidad }` | `201` primera vez · `200` si ya existía (suma) · `400` · `404` · `401` · `503` |
| `PUT /api/carrito/items/{productId}` | HU-03 | `{ cantidad }` | `200` (reemplaza) · `400` · `404` si no está en el carrito · `401` |
| `DELETE /api/carrito/items/{productId}` | HU-04 | — | `200` carrito actualizado sin el producto · `404 PRODUCTO_NO_ENCONTRADO` · `401` |
| `DELETE /api/carrito` | HU-05 | — | `200` con `items: []` y totales en 0, también si el carrito no existía (idempotente) · `401` |
| `GET /api/carrito/disponibilidad` (nuevo) | HU-09 | — | `200` estado por ítem · `400 CARRITO_VACIO` · `401` · `503` |
| `POST /api/carrito/checkout` (nuevo) | HU-08 | — | `201` snapshot con `checkoutId` y `expiraEn` · `400 CARRITO_VACIO` · `409 CARRITO_NO_DISPONIBLE` · `401` · `503` |
| `POST /api/carrito/checkout/{checkoutId}/confirmar` (nuevo) | HU-10 | — | `201` pedido nuevo · `200` ya confirmado (mismo pedido) · `404 CHECKOUT_NO_ENCONTRADO` · `409 CHECKOUT_REEMPLAZADO` / `CHECKOUT_EXPIRADO` / `CONFIRMACION_EN_CURSO` / `STOCK_INSUFICIENTE` · `401` · `503` |

Las respuestas `2xx` de los cinco primeros endpoints devuelven el carrito completo con la forma de la sección 4. Los tres nuevos devuelven las formas de las secciones 4.3 a 4.5.

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

### 3.6 GET /api/carrito/disponibilidad — Verificar disponibilidad (nuevo, HU-09)

- Revalida precio, estado y stock de cada ítem contra Catálogo. No modifica cantidades.
- Cada ítem queda en un estado: `OK`, `SIN_STOCK` (stock menor que la cantidad), `INACTIVO` (inactivo o 404 en Catálogo) o `PRECIO_CAMBIO`.
- `PRECIO_CAMBIO` actualiza el precio en Redis (como el GET) e informa `precioAnterior`. Deja `disponible: false` a propósito: el cliente ve el precio nuevo antes de pagar, y la segunda verificación ya responde `OK`.
- Si Catálogo no envía `stock` (`null`), el ítem no se marca `SIN_STOCK`; la reserva de la confirmación es la que protege.
- Carrito vacío → `400 CARRITO_VACIO`. Catálogo caído → `503` sin escrituras en Redis.

### 3.7 POST /api/carrito/checkout — Crear checkout (nuevo, HU-08)

- Ejecuta la verificación de la sección 3.6. Si algún ítem no está en `OK`, responde `409 CARRITO_NO_DISPONIBLE` con el detalle en `items` y no crea nada.
- Si todo está en `OK`, congela un **snapshot**: los ítems, los precios y los descuentos tal como se ven en ese momento. Responde `201` con la forma de la sección 4.4.
- El snapshot vence a los 15 minutos (`expiraEn`, `CHECKOUT_VIGENCIA_SECONDS`).
- Hay un solo checkout vigente por usuario: crear uno nuevo reemplaza al anterior, que ya no se puede confirmar.
- Si el Módulo Descuentos está caído, el snapshot se crea igual, sin descuentos y con `descuentosDisponibles: false`.
- Modificar el carrito después del checkout no cambia el snapshot.

### 3.8 POST /api/carrito/checkout/{checkoutId}/confirmar — Confirmar pedido (nuevo, HU-10)

- Solo el dueño del checkout puede confirmarlo. Un `checkoutId` inexistente o de otro usuario responde `404 CHECKOUT_NO_ENCONTRADO`.
- Confirma lo que el cliente vio: reserva en Catálogo las cantidades del snapshot y crea el pedido con sus precios y descuentos, sin recalcular.
- Al confirmar: se reserva el stock, se guarda el pedido, el checkout pasa a `CONFIRMADO` y se vacía el carrito. Responde `201` con la forma de la sección 4.5.
- **Idempotente:** repetir con el mismo `checkoutId` responde `200` con el mismo pedido, sin reservar otra vez.
- Un checkout reemplazado por uno más nuevo → `409 CHECKOUT_REEMPLAZADO`. Así un usuario no puede crear dos pedidos con dos resúmenes.
- Después de `expiraEn` → `409 CHECKOUT_EXPIRADO`; el cliente vuelve a iniciar el pago.
- Si otra petición está confirmando el mismo checkout en ese momento → `409 CONFIRMACION_EN_CURSO`.
- Catálogo rechaza la reserva → `409 STOCK_INSUFICIENTE` con los productos que fallaron; el checkout vuelve a `PENDIENTE` y se puede reintentar.
- Ningún fallo deja stock reservado sin pedido: si guardar el pedido falla después de reservar, se libera la reserva.
- Vaciar el carrito borra también lo que el cliente agregó después del checkout. Un fallo al vaciarlo no deshace el pedido.

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
  "reservaId": "res_1",
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
| `reservaId` | Reserva de stock que devolvió Catálogo |
| `items`, `subtotal`, `descuentoTotal`, `total` | Copiados del snapshot: el cliente paga lo que vio |

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
| 400 | `VALIDACION_FALLIDA` | Cantidad o `productId` inválidos, cuerpo ausente o JSON mal formado |
| 400 | `CARRITO_VACIO` (nuevo) | Disponibilidad o checkout con el carrito vacío |
| 401 | `NO_AUTORIZADO` | Token ausente, con formato inválido, expirado, mal firmado o sin claim `sub` |
| 404 | `PRODUCTO_NO_ENCONTRADO` | POST de un producto inexistente o inactivo en Catálogo; PUT o DELETE de un producto que no está en el carrito |
| 404 | `CHECKOUT_NO_ENCONTRADO` (nuevo) | El checkout no existe, venció en Redis o es de otro usuario |
| 404 | `RUTA_NO_ENCONTRADA` | Ruta inexistente |
| 409 | `CARRITO_NO_DISPONIBLE` (nuevo) | Checkout con algún ítem que no está en `OK`; trae `items` |
| 409 | `CHECKOUT_REEMPLAZADO` (nuevo) | Se creó un checkout más nuevo; el viejo ya no se puede confirmar |
| 409 | `CHECKOUT_EXPIRADO` (nuevo) | Confirmar después de `expiraEn` (15 min) |
| 409 | `CONFIRMACION_EN_CURSO` (nuevo) | Otra petición está confirmando el mismo checkout |
| 409 | `STOCK_INSUFICIENTE` (nuevo) | Catálogo rechazó la reserva; trae `items` |
| 503 | `CATALOGO_NO_DISPONIBLE` | Catálogo no responde, responde con error, excede el timeout o devuelve un formato inválido |
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

Cada regla tiene además `id`, `descripcion`, `activa` y, opcionales, `vigenteDesde` / `vigenteHasta`. Las reglas viven en `src/discounts/discountRules.js`; pasarlas a PostgreSQL (Sprint 4) solo cambia `getActiveRules()`.

### 6.2 Política de aplicación

1. Por cada ítem disponible se evalúan las reglas de ítem y se aplica solo la de mayor monto (no se acumulan).
2. La regla de carrito se calcula sobre la base `Σ(subtotalItem − descuentoAplicadoItem)` de los ítems disponibles; también se aplica solo la mejor.
3. Los ítems con `disponible: false` no reciben descuento ni cuentan para el umbral.
4. Cada monto se redondea con `Math.round`; ningún descuento supera la base sobre la que se calcula.

### 6.3 Tolerancia a fallos (HU-07)

Si el Módulo Descuentos lanza un error o tarda más de `DISCOUNT_TIMEOUT_MS` (200 ms por defecto), el carrito responde normalmente con descuentos en 0, `descuentosAplicados: []`, `total = subtotal` y `descuentosDisponibles: false`. El frontend muestra un aviso. Nunca se devuelve `500` por culpa de Descuentos.

## 7. Integración con Catálogo

El Carrito consume tres endpoints de Catálogo. Cualquier ajuste a la forma real se limita a `src/clients/catalogClient.js` y al mock de `mocks/catalog-mock/`.

| Endpoint de Catálogo | Uso | Respuesta esperada |
| --- | --- | --- |
| `GET {CATALOG_BASE_URL}/api/catalogo/productos/{id}` | Precio, nombre y estado (todas las HU); `stock` (HU-09) | `200 { id, nombre, precio, activo, stock }` · `404` |
| `POST {CATALOG_BASE_URL}/api/catalogo/reservas` (nuevo) | HU-10: reservar el stock del pedido | `201 { reservaId }` · `409 { codigo: "STOCK_INSUFICIENTE", items }` |
| `DELETE {CATALOG_BASE_URL}/api/catalogo/reservas/{reservaId}` (nuevo) | HU-10: liberar la reserva si falla guardar el pedido | `204` (también si no existe) |

**Producto:**

```json
{ "id": "prod_001", "nombre": "Camiseta básica algodón", "precio": 49900, "activo": true, "stock": 20 }
```

**Reserva (cuerpo del POST).** Es idempotente por `referencia`: repetir la misma referencia devuelve la misma reserva sin descontar stock otra vez. El Carrito usa el `checkoutId` como referencia.

```json
{ "referencia": "chk_7f3a9c21-...", "items": [{ "productId": "prod_001", "cantidad": 3 }, { "productId": "prod_002", "cantidad": 2 }] }
```

| Respuesta de Catálogo | Interpretación en el Carrito |
| --- | --- |
| Producto `200` con `activo: true` | Producto válido; se usan `nombre`, `precio` y `stock` |
| Producto `200` con `activo: false`, o `404` | Inactivo: POST → `404`; GET → `disponible: false`; disponibilidad → `INACTIVO` |
| Producto sin `stock` | `stock: null`: no rompe GET ni POST; la reserva es la que protege |
| Reserva `201` | Se guarda el `reservaId` en el pedido |
| Reserva `409` | `409 STOCK_INSUFICIENTE` con los `items` que manda Catálogo |
| Otro código, timeout (`CATALOG_TIMEOUT_MS`, 3000 ms), error de red o JSON con otro esquema | `503 CATALOGO_NO_DISPONIBLE` |
| Fallo al liberar una reserva | Se registra en el log y no se propaga al cliente |

### 7.1 Acuerdos con Catálogo (POR CONFIRMAR — Juan David)

| # | Punto | Supuesto actual del Carrito | Estado |
| --- | --- | --- | --- |
| 1 | Nombres de campo y tipo del precio | `{ id, nombre, precio, activo }`, precio entero en COP | POR CONFIRMAR |
| 2 | Producto inactivo: `404` o `200` con `activo: false` | Se soportan ambos | POR CONFIRMAR |
| 3 | Campo `stock` en el producto | Entero ≥ 0, opcional | POR CONFIRMAR |
| 4 | `POST` y `DELETE /api/catalogo/reservas`, idempotente por `referencia` | Como en esta sección; el mock lo implementa | POR CONFIRMAR. Si no está antes del 05/11, HU-10 se demuestra contra el mock y la reserva real pasa al Sprint 4 |
| 5 | ¿Las reservas vencen solas en Catálogo? ¿En cuánto tiempo? | No se asume vencimiento | POR CONFIRMAR |
| 6 | ¿Catálogo expone `categoria`? | No se usa; habilitaría descuentos por categoría en un sprint futuro | POR CONFIRMAR |
| 7 | URL base, puerto y quién opera el Kong compartido | `http://catalog-mock:4000` en Docker Compose | POR CONFIRMAR |
| 8 | Claim del JWT y secreto de pruebas común | Usuario en `sub`; HS256 con `JWT_SECRET` | POR CONFIRMAR |

Las respuestas de Catálogo y Búsqueda se registran en el README del proyecto y en la siguiente versión de este contrato.

## 8. Persistencia (referencia para otros equipos)

| Clave | Valor | TTL |
| --- | --- | --- |
| `carrito:{userId}` | Hash `productId` → JSON `{ productId, nombre, precioUnitario, cantidad }`. No se guardan `disponible`, `precioAnterior` ni descuentos | 7 días (`CART_TTL_SECONDS`), renovado en cada escritura y al eliminar un ítem |
| `checkout:{checkoutId}` (nuevo) | Hash: `data` (JSON del snapshot, no cambia), `estado` (`PENDIENTE`, `CONFIRMANDO`, `CONFIRMADO`), `userId`, `pedidoId`, `confirmandoDesde` | 24 h (`CHECKOUT_TTL_SECONDS`). La vigencia para comprar es `expiraEn`: 15 min (`CHECKOUT_VIGENCIA_SECONDS`) |
| `checkout-usuario:{userId}` (nuevo) | `checkoutId` del checkout vigente | 24 h |
| `pedido:{pedidoId}` (nuevo) | JSON del pedido | 30 días (`PEDIDO_TTL_SECONDS`), hasta que entre PostgreSQL en el Sprint 4 |
| `pedidos-usuario:{userId}` (nuevo) | Lista de `pedidoId`, el más reciente primero | 30 días |

| Operación | Implementación |
| --- | --- |
| HU-01 agregar | Script Lua `cartAddItem`: lee, suma y escribe en una sola operación atómica |
| HU-04 eliminar | `HDEL` + `EXPIRE` en `MULTI`; si era el último campo, Redis borra la clave |
| HU-05 vaciar | `DEL carrito:{userId}` |
| HU-10 bloqueo | Script Lua `checkoutConfirm`: pasa `PENDIENTE` → `CONFIRMANDO` en una sola operación. Un `CONFIRMANDO` de más de 30 s (`CHECKOUT_LOCK_MS`) se considera abandonado y se puede retomar |
| HU-10 pedido | Guardar el pedido y marcar el checkout `CONFIRMADO` van en el mismo `MULTI` |

La clave del checkout dura más que su vigencia para poder responder confirmaciones repetidas y distinguir un checkout vencido (`409`) de uno inexistente (`404`).

## 9. Configuración

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto interno del servicio |
| `REDIS_URL` | `redis://localhost:6379` | Conexión a Redis |
| `CART_TTL_SECONDS` | `604800` | TTL del carrito (7 días) |
| `CATALOG_BASE_URL` | `http://localhost:4000` | URL base de Catálogo |
| `CATALOG_TIMEOUT_MS` | `3000` | Timeout de cada llamada a Catálogo (productos y reservas) |
| `DISCOUNT_TIMEOUT_MS` | `200` | Tiempo máximo del Módulo Descuentos antes de responder sin descuentos |
| `CHECKOUT_TTL_SECONDS` (nuevo) | `86400` | Vida de la clave del checkout en Redis (24 h) |
| `CHECKOUT_VIGENCIA_SECONDS` (nuevo) | `900` | Vigencia del checkout para confirmar (15 min) |
| `CHECKOUT_LOCK_MS` (nuevo) | `30000` | Tiempo tras el cual un `CONFIRMANDO` se considera abandonado |
| `PEDIDO_TTL_SECONDS` (nuevo) | `2592000` | Vida del pedido en Redis (30 días) |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto HS256 (solo desarrollo) |

## 10. Reglas de negocio del flujo de compra

- Siguen las del Sprint 2: precio oficial de Catálogo, POST suma, PUT reemplaza, Descuentos nunca bloquea el carrito.
- La compra va en tres pasos separados: verificar (HU-09), congelar un resumen (HU-08) y confirmar (HU-10). El cliente ve el total final antes de comprometer stock.
- Disponibilidad no modifica cantidades. `PRECIO_CAMBIO` deja `disponible: false` a propósito.
- `stock: null` se deja pasar; la reserva de HU-10 es la que protege.
- El snapshot congela precios y descuentos: confirmar cobra lo que el cliente vio.
- Un checkout vigente por usuario: uno nuevo reemplaza al anterior.
- Confirmar es idempotente: repetir con el mismo `checkoutId` responde `200` con el mismo pedido.
- Sin pago real: el pedido nace `CONFIRMADO`.
