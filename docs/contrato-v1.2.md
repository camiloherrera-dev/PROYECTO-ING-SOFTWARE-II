# Contrato de Servicio — Microservicio de Carrito de Compras (v1.2)

| Campo | Valor |
| --- | --- |
| Versión | 1.2 (reemplaza el borrador v1.0) |
| Fecha | Octubre de 2026 — Sprint 2 |
| Responsable | Camilo Andres Herrera Celis (con Juan David Gómez para los acuerdos con Catálogo) |
| Revisor | Santiago Torres Barbosa |
| Destinatarios | Equipos de Catálogo y Búsqueda; frontend del Carrito |
| Estado | Borrador para revisión. Los puntos marcados **POR CONFIRMAR** dependen de la respuesta de Catálogo |

Este documento describe el contrato REST del Carrito tal como queda implementado al final del Sprint 2. Se alinea con el entregable del Sprint 0 y con el código del repositorio; donde el borrador v1.0 decía otra cosa, prevalece este documento.

## 0. Cambios respecto al borrador v1.0

| # | Tema | v1.0 (borrador) | v1.2 | Motivo |
| --- | --- | --- | --- | --- |
| 1 | Base path | `/api/basket` | `/api/carrito` | Es la ruta del Sprint 0, de Kong y del código |
| 2 | Endpoints | Sin los DELETE | 5 endpoints REST (sección 3), incluidos `DELETE /api/carrito/items/{productId}` y `DELETE /api/carrito` | HU-04 y HU-05 entran en el Sprint 2 |
| 3 | Respuesta del carrito | Solo `subtotal` y `total` | Se agregan `descuentoItems`, `descuentoCarrito`, `descuentosAplicados`, `descuentosDisponibles`; se formaliza `precioAnterior` por ítem | HU-02 (aviso de cambio de precio), HU-06 y HU-07 |
| 4 | Códigos de error | Sin catálogo de códigos | Se formalizan `NO_AUTORIZADO`, `CATALOGO_NO_DISPONIBLE` y `ERROR_INTERNO` (sección 5) | Ya los usa el código desde el Sprint 1 |
| 5 | Descuentos | Servicio externo por gRPC (`discount.proto`) | Módulo interno del mismo proceso (`src/discounts/`); se elimina la sección gRPC/Protobuf | Sprint 0, sección 3.6.3 |
| 6 | Tolerancia a fallos | No se describía | Si Descuentos falla o tarda, el carrito responde sin descuentos y `descuentosDisponibles: false` (sección 6.3) | HU-07 |
| 7 | Checkout | Evento `BasketCheckedOut` a RabbitMQ y servicio de Órdenes | Se elimina. El histórico se guarda en PostgreSQL del propio Carrito (Sprint 4) | Sprint 0, sección 3.6.3. Se reabre solo si otro equipo pide el evento |
| 8 | Cupones | Campo `coupon_code` | Fuera de alcance (backlog) | Catálogo no ha confirmado el campo `categoria` y no hay HU de cupones |
| 9 | Integración con Catálogo | Implícita | Sección 7 con la forma de `GET /api/catalogo/productos/{id}` y los puntos pendientes | Riesgo 11 del Sprint 2 |

## 1. Alcance

El Carrito permite a un cliente autenticado agregar, consultar, modificar, eliminar y vaciar los productos de su carrito, y devuelve en cada respuesta el subtotal, los descuentos aplicados y el total final.

Fuera de este contrato (sprints posteriores): checkout y confirmación de pedido (HU-08, HU-10, Sprint 3), verificación de disponibilidad/stock (HU-09, Sprint 3), histórico en PostgreSQL y recuperación formal del carrito (HU-11, HU-12, Sprint 4), eventos RabbitMQ, Keycloak real y cupones.

## 2. Convenciones generales

- **Entrada:** todas las peticiones pasan por Kong (`http://localhost:8000` en local). El servicio escucha internamente en el puerto `3000`.
- **Autenticación:** todas las rutas exigen `Authorization: Bearer <JWT>` firmado con HS256. El usuario sale **siempre** del claim `sub` del token; nunca del cuerpo, la query ni la ruta (RNF-02). Un token sin `sub`, expirado, mal firmado o ausente responde `401 NO_AUTORIZADO`.
- **Formato:** JSON en UTF-8 (`Content-Type: application/json`).
- **Dinero:** pesos colombianos (COP) como enteros. Cada monto calculado se redondea con `Math.round`.
- **Cantidades:** enteros `>= 1`. `1.5`, `0`, negativos o `"3"` (texto) responden `400 VALIDACION_FALLIDA`.
- **Precios:** el precio y el nombre del producto salen siempre de Catálogo, nunca del cliente (RF-13, RF-14).
- **CORS (Kong):** origen `http://localhost:5173`; métodos `GET, POST, PUT, DELETE, OPTIONS`; cabeceras `Authorization, Content-Type`.
- **Salud:** `GET /health` → `200 { "status": "ok" }` (no pasa por autenticación ni por Kong).

## 3. Endpoints

| Método y ruta | HU | Cuerpo | Respuestas |
| --- | --- | --- | --- |
| `GET /api/carrito` | HU-02, HU-06 | — | `200` carrito con desglose · `401` · `503` Catálogo caído |
| `POST /api/carrito/items` | HU-01 | `{ productId, cantidad }` | `201` primera vez · `200` si ya existía (suma) · `400` · `404` · `401` · `503` |
| `PUT /api/carrito/items/{productId}` | HU-03 | `{ cantidad }` | `200` (reemplaza) · `400` · `404` si no está en el carrito · `401` |
| `DELETE /api/carrito/items/{productId}` | HU-04 | — | `200` carrito actualizado sin el producto · `404 PRODUCTO_NO_ENCONTRADO` si no está en el carrito · `401` |
| `DELETE /api/carrito` | HU-05 | — | `200` con `items: []` y totales en 0, también si el carrito no existía (idempotente) · `401` |

Todas las respuestas `2xx` devuelven el carrito completo con la forma de la sección 4.

### 3.1 GET /api/carrito — Consultar carrito

- Revalida cada producto contra Catálogo (RF-15, RF-16):
  - Precio distinto al guardado → se actualiza el precio en Redis y el ítem trae `precioAnterior` **solo en esa respuesta**.
  - Producto inactivo o inexistente en Catálogo → el ítem se conserva con `disponible: false` y no cuenta para el subtotal ni para los descuentos.
- Carrito inexistente → `200` con `items: []` y totales en 0 (no `404`).
- Si Catálogo no responde, responde con error o excede el timeout (`CATALOG_TIMEOUT_MS`, 3000 ms por defecto) → `503 CATALOGO_NO_DISPONIBLE`. No se escribe nada en Redis en esa consulta.
- Es el único endpoint que revalida en Catálogo.

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

### 3.4 DELETE /api/carrito/items/{productId} — Eliminar producto (nuevo)

- Elimina el producto y renueva el TTL del carrito.
- Eliminar el último producto responde `200` con `items: []` y totales en 0.
- Producto que no está en el carrito → `404 PRODUCTO_NO_ENCONTRADO`.
- No consulta Catálogo.

### 3.5 DELETE /api/carrito — Vaciar carrito (nuevo)

- Borra el carrito completo y responde `200` con `items: []` y totales en 0.
- Es idempotente: responde `200` aunque el carrito no existiera.
- La confirmación previa ("¿Seguro que quieres vaciar el carrito?") es responsabilidad del frontend; el backend no la pide.

## 4. Respuesta del carrito

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

### 4.1 Campos de cada ítem

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
| `precioAnterior` | entero, opcional | Solo aparece en la respuesta del GET que detectó un cambio de precio |

### 4.2 Campos del carrito

| Campo | Tipo | Significado |
| --- | --- | --- |
| `userId` | string | Claim `sub` del token |
| `items` | array | Ítems del carrito (incluidos los no disponibles) |
| `subtotal` | entero | Suma de `subtotalItem` de los ítems disponibles |
| `descuentoItems` | entero | Suma de `descuentoAplicadoItem` de los ítems disponibles (nuevo) |
| `descuentoCarrito` | entero | Descuento de la regla de carrito; no se reparte entre ítems (nuevo) |
| `descuentoTotal` | entero | `descuentoItems + descuentoCarrito` |
| `total` | entero | `subtotal − descuentoTotal` |
| `descuentosAplicados` | array | Reglas aplicadas con su monto; `productId: null` indica regla de carrito (nuevo) |
| `descuentosDisponibles` | boolean | `false` si el Módulo Descuentos falló o tardó; el total es el subtotal y el frontend muestra un aviso (nuevo) |

Identidades que se cumplen siempre:

- `totalItem = subtotalItem − descuentoAplicadoItem`
- `descuentoTotal = descuentoItems + descuentoCarrito`
- `total = subtotal − descuentoTotal`

Los campos de cada ítem no cambian respecto al Sprint 1, así que un cliente que ignore los campos nuevos sigue funcionando.

## 5. Errores

Formato único para todos los errores:

```json
{ "codigo": "PRODUCTO_NO_ENCONTRADO", "mensaje": "El producto no está en el carrito" }
```

| HTTP | `codigo` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDACION_FALLIDA` | Cantidad o `productId` inválidos, cuerpo ausente o JSON mal formado |
| 401 | `NO_AUTORIZADO` | Token ausente, con formato inválido, expirado, mal firmado o sin claim `sub` |
| 404 | `PRODUCTO_NO_ENCONTRADO` | POST de un producto inexistente o inactivo en Catálogo; PUT o DELETE de un producto que no está en el carrito |
| 404 | `RUTA_NO_ENCONTRADA` | Ruta inexistente |
| 503 | `CATALOGO_NO_DISPONIBLE` | Catálogo no responde, responde con error, excede el timeout o devuelve un formato inválido |
| 500 | `ERROR_INTERNO` | Cualquier error no controlado. El mensaje es genérico y no expone detalles internos |

El Sprint 2 no crea códigos nuevos: los DELETE reutilizan `PRODUCTO_NO_ENCONTRADO`. Un fallo del Módulo Descuentos **nunca** produce un error (sección 6.3).

## 6. Descuentos (módulo interno)

Los descuentos se calculan dentro del mismo proceso del Carrito (`src/discounts/`); no hay gRPC, Protobuf ni servicio externo. `cartTotals.js` es el único punto que invoca al módulo. El motor recibe solo `{ productId, precioUnitario, cantidad, disponible }` de cada ítem y no consulta Catálogo ni Redis.

### 6.1 Tipos de regla

| Tipo | Parámetros | Regla de la demo | Ejemplo |
| --- | --- | --- | --- |
| `PORCENTAJE_PRODUCTO` | `productIds`, `porcentaje` | `DESC-JEAN-10`: 10% en `prod_002` | 1 jean de 129.900 → 12.990 |
| `CANTIDAD_MINIMA` | `productIds`, `cantidadMinima`, `porcentaje` | `DESC-CAMISETA-3X`: 15% en `prod_001` desde 3 unidades | 3 camisetas (149.700) → 22.455; 2 camisetas → 0 |
| `MONTO_MINIMO_CARRITO` | `montoMinimo`, `porcentaje` | `DESC-CARRITO-300K`: 5% si lo que queda tras los descuentos por ítem es ≥ 300.000 | 361.065 → 18.053 |

Cada regla tiene además `id`, `descripcion`, `activa` y, opcionales, `vigenteDesde` / `vigenteHasta`. En el Sprint 2 las reglas viven en `src/discounts/discountRules.js`; pasarlas a PostgreSQL (Sprint 4) solo cambia `getActiveRules()`.

### 6.2 Política de aplicación

1. Por cada ítem disponible se evalúan las reglas de ítem y se aplica solo la de mayor monto (no se acumulan).
2. La regla de carrito se calcula sobre la base `Σ(subtotalItem − descuentoAplicadoItem)` de los ítems disponibles; también se aplica solo la mejor.
3. Los ítems con `disponible: false` no reciben descuento ni cuentan para el umbral.
4. Cada monto se redondea con `Math.round`; ningún descuento supera la base sobre la que se calcula.

### 6.3 Tolerancia a fallos (HU-07)

Si el Módulo Descuentos lanza un error o tarda más de `DISCOUNT_TIMEOUT_MS` (200 ms por defecto), el carrito responde normalmente con:

- `descuentoAplicadoItem: 0` en todos los ítems, `descuentoItems: 0`, `descuentoCarrito: 0`, `descuentoTotal: 0`;
- `descuentosAplicados: []`;
- `total = subtotal`;
- `descuentosDisponibles: false`.

El frontend muestra un aviso ("Los descuentos no están disponibles en este momento"). Nunca se devuelve `500` por culpa de Descuentos.

## 7. Integración con Catálogo

El Carrito consume un único endpoint de Catálogo:

```
GET {CATALOG_BASE_URL}/api/catalogo/productos/{productId}
```

Respuesta esperada (`200`):

```json
{ "id": "prod_001", "nombre": "Camiseta básica algodón", "precio": 49900, "activo": true }
```

| Respuesta de Catálogo | Interpretación en el Carrito |
| --- | --- |
| `200` con `activo: true` | Producto válido; se usan `nombre` y `precio` oficiales |
| `200` con `activo: false` | Producto inactivo: POST → `404`; GET → `disponible: false` |
| `404` | Producto inexistente: igual que inactivo |
| Otro código, timeout (`CATALOG_TIMEOUT_MS`, 3000 ms), error de red o JSON con otro esquema | `503 CATALOGO_NO_DISPONIBLE` |

El identificador se acepta como `id` o `_id`; `precio` como número o texto numérico. Cualquier ajuste a la forma real se limita a `mapProduct` en `src/clients/catalogClient.js` y al mock de `mocks/catalog-mock/`.

### 7.1 Acuerdos pendientes (POR CONFIRMAR con Catálogo — Juan David)

| # | Punto | Supuesto actual del Carrito | Estado |
| --- | --- | --- | --- |
| 1 | Nombres de campo y tipo del precio | `{ id, nombre, precio, activo }`, precio entero en COP | POR CONFIRMAR |
| 2 | Producto inactivo: `404` o `200` con `activo: false` | Se soportan ambos | POR CONFIRMAR |
| 3 | ¿Catálogo expone `categoria`? | No se usa; habilitaría descuentos por categoría en un sprint futuro | POR CONFIRMAR |
| 4 | URL base, puerto y quién opera el Kong compartido | `http://catalog-mock:4000` en Docker Compose | POR CONFIRMAR |
| 5 | Claim del JWT y secreto de pruebas común | Usuario en `sub`; HS256 con `JWT_SECRET` | POR CONFIRMAR |
| 6 | Reserva de stock (bloquea HU-09) | Sin definir | Debe acordarse antes del Sprint 3 |

Las respuestas de Catálogo y Búsqueda se registran en el README del proyecto y en la siguiente versión de este contrato.

## 8. Persistencia (referencia para otros equipos)

| Elemento | Valor |
| --- | --- |
| Estructura | Hash de Redis `carrito:{userId}` |
| Campo → valor | `productId` → JSON `{ productId, nombre, precioUnitario, cantidad }`. No se guardan `disponible`, `precioAnterior` ni descuentos: se calculan en cada respuesta |
| TTL | 7 días (`CART_TTL_SECONDS=604800`), renovado en cada escritura y al eliminar un ítem |
| HU-01 | Script Lua `cartAddItem`: lee, suma y escribe en una sola operación atómica |
| HU-04 | `HDEL` + `EXPIRE` en `MULTI`; si era el último campo, Redis borra la clave |
| HU-05 | `DEL carrito:{userId}` |

## 9. Configuración

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto interno del servicio |
| `REDIS_URL` | `redis://localhost:6379` | Conexión a Redis |
| `CART_TTL_SECONDS` | `604800` | TTL del carrito |
| `CATALOG_BASE_URL` | `http://localhost:4000` | URL base de Catálogo |
| `CATALOG_TIMEOUT_MS` | `3000` | Timeout de cada consulta a Catálogo |
| `DISCOUNT_TIMEOUT_MS` | `200` | Tiempo máximo del Módulo Descuentos antes de responder sin descuentos |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto HS256 (solo desarrollo) |
