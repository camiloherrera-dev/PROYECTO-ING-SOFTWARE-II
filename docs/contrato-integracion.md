# Contrato de Integración — Carrito + Descuentos con Catálogo, Búsqueda y Host App (v1.0)

| Campo | Valor |
| --- | --- |
| Versión | 1.0 |
| Fecha | 14/11/2026 — Sprint 5 (integración) |
| Equipo | C: Carrito + Descuentos |
| Responsable | Camilo Andres Herrera Celis |
| Revisora | Tatiana Lineros Sanchez |
| Destinatarios | Equipo A (Búsqueda) y equipo B (Catálogo + Host App) |
| Documentos base | `docs/contrato-v1.3.md` y `docs/contrato-v1.4.md` (contrato REST del Carrito), `INTEGRACION-CONTRATOS-v2` de Catálogo (Catálogo v2.4 y Host App v1.2) |
| Plazo para objetar | **Sábado 14/11/2026 a las 8:00 p. m.** |
| Estado | Propuesta enviada a A y B |

Este documento dice qué ofrece el Carrito a los otros equipos, qué espera de cada uno y cómo se arma la entrega integrada del **martes 17/11/2026**. El detalle de cada endpoint del Carrito está en `docs/contrato-v1.4.md`; aquí solo se resume lo que necesita otro equipo.

**Acuerdo y estado actual.** Este documento describe lo que el Carrito tendrá el día de la entrega. Varios puntos se están implementando en el Sprint 5 (tareas INT-05 a INT-11). La sección 12 dice qué ya está en `develop` y qué falta.

**Cómo objetar.** Comenten en el PR de este documento o escriban al Scrum Master (Jose David Ramirez Cacua) antes del plazo. Si A o B objetan, publicamos una versión 1.1. Si no hay objeciones, la v1.0 queda como acordada.

## 0. Historial

| Versión | Fecha | Cambio |
| --- | --- | --- |
| 1.0 | 14/11/2026 | Primera versión. El plazo para objetar se adelantó del martes 17/11 a las 12:00 m. al sábado 14/11 a las 8:00 p. m., porque la entrega integrada pasó del jueves 19/11 al martes 17/11 |

## 1. Equipos y responsabilidades

| Equipo | Servicio | Qué aporta a la integración |
| --- | --- | --- |
| A | Búsqueda | Búsqueda de productos. El Carrito no depende técnicamente de A (sección 7) |
| B | Catálogo + Host App | Productos, stock y precios (Catálogo v2.4); Kong único; Host App que embebe el frontend del Carrito; `docker-compose` de integración |
| C | Carrito + Descuentos | API `/api/carrito` (carrito, disponibilidad, checkout, pedidos, historial y recuperación), Módulo Descuentos interno y frontend embebible |

### 1.1 Decisiones de arquitectura del equipo C

- **Descuentos y Órdenes viven dentro del Carrito.** Descuentos es un módulo interno (`src/discounts/`) y el pedido lo crea el propio Carrito. No hay gRPC entre Carrito y Descuentos ni un servicio de Órdenes aparte.
- **Sin mensajería.** El Carrito no publica ni consume eventos de RabbitMQ.
- **Sin Keycloak ni pago real.** El usuario sale del claim `sub` de un JWT HS256 (sección 3.2) y el pedido nace `CONFIRMADO`.
- **Sin contrato propio con Búsqueda** mientras A no envíe el suyo.

## 2. Arquitectura de la entrega

```
Navegador ── Host App (B) ──iframe──> Frontend del Carrito (C, puerto 5175)
                │                              │
                └──────────────┬───────────────┘
                               ▼
                      Kong de B (puerto 8000)
                 /api/catalogo          /api/carrito
                      │                      │
                      ▼                      ▼
                Catálogo (B)  <──────  Carrito (C, puerto 3000)
                                       ├─ Redis 7
                                       └─ PostgreSQL 16
```

El Carrito llama a Catálogo **a través del Kong de B**, no directo (sección 4.1).

## 3. Lo que ofrece el Carrito (C → A y B)

### 3.1 API

Todas las rutas pasan por Kong con el prefijo `/api/carrito` y necesitan token. Formato JSON y montos en pesos colombianos (enteros).

| Método y ruta | Uso |
| --- | --- |
| `GET /api/carrito` | Consultar el carrito con descuentos y totales |
| `POST /api/carrito/items` | Agregar producto `{ productId, cantidad }` |
| `PUT /api/carrito/items/{productId}` | Cambiar la cantidad |
| `DELETE /api/carrito/items/{productId}` | Quitar un producto |
| `DELETE /api/carrito` | Vaciar el carrito |
| `GET /api/carrito/disponibilidad` | Verificar stock, estado y precio antes de comprar |
| `POST /api/carrito/checkout` | Crear el checkout |
| `POST /api/carrito/checkout/{checkoutId}/confirmar` | Confirmar el pedido (descuenta el stock en Catálogo) |
| `GET /api/carrito/pedidos` | Historial de pedidos (`limit`, `offset`) |
| `GET /api/carrito/pedidos/{pedidoId}` | Detalle de un pedido propio |
| `GET /api/carrito/recuperar` | Carrito con el bloque `recuperacion` |

Fuera de Kong, el contenedor expone `GET /health` (vivo) y `GET /ready` (Redis y PostgreSQL listos) en el puerto 3000, para los healthchecks del compose.

**Errores.** Siempre `{ "codigo": "...", "mensaje": "..." }`. Los 409 de stock agregan `items`. Los códigos completos están en la sección 5 del contrato v1.4.

### 3.2 Autenticación

- Cabecera `Authorization: Bearer <jwt>`.
- JWT **HS256** firmado con `JWT_SECRET`. El usuario es el claim `sub`; el Carrito nunca lo toma del cuerpo ni de la URL.
- Sin token o con un token inválido: `401 NO_AUTORIZADO`.
- Quien emita los tokens (el Host App o un login de prueba) debe usar el mismo secreto. Para la demo, el frontend usa `VITE_DEV_TOKEN` (sección 5).

### 3.3 Frontend embebible

Ver la sección 5.

## 4. Lo que el Carrito espera de Catálogo (B → C)

### 4.1 URL base

El cliente del Carrito concatena `CATALOG_BASE_URL` con rutas como `/productos/{id}`, así que la base incluye el prefijo cuando lo hay.

| Entorno | `CATALOG_BASE_URL` |
| --- | --- |
| Mock propio (plan B) | `http://catalog-mock:4000/api/catalogo` |
| Kong de B, desde un contenedor del compose de integración | `http://kong:8000/api/catalogo` (Kong quita el prefijo) |
| Kong de B, desde una máquina de desarrollo | `http://localhost:8000/api/catalogo` |
| Catálogo real directo (solo para depurar) | `http://host.docker.internal:8080` (sin prefijo) |

**Acuerdo propuesto:** el compose de integración usa siempre la URL de Kong. El acceso directo a Catálogo queda solo para depurar.

### 4.2 Endpoints de Catálogo v2.4 que usa el Carrito

Ningún endpoint de Catálogo exige token.

**`GET /productos/{id}`**

- `200 { id, nombre, precio, categoria, stock, activo }`. Un producto inactivo responde `200` con `activo: false`.
- `404 PRODUCTO_NO_ENCONTRADO` si el id no existe.

**`POST /productos/descontar-stock`** con `{ referencia?, items: [{ id, cantidad }] }`

| Caso | Respuesta esperada |
| --- | --- |
| Todo alcanza | `200 { referencia?, items: [{ id, stockRestante }] }`. `referencia` solo vuelve si vino en la petición |
| Misma `referencia` con los mismos ítems (reintento) | `200` con el mismo cuerpo, **sin descontar otra vez** |
| Misma `referencia` con otros ítems, o una referencia ya devuelta | `409 REFERENCIA_EN_USO`, sin descontar |
| Stock insuficiente | `409 STOCK_INSUFICIENTE` con `items: [{ id, cantidad, stock }]`. Todo o nada; no registra la referencia |
| Cuerpo inválido, ítems repetidos o cantidad menor que 1 | `400 VALIDACION_FALLIDA` |
| Id inexistente o inactivo | `404` |

**`POST /productos/devolver-stock`** con `{ referencia }`

- `204`, idempotente. Devuelve el stock y **cierra** la referencia.
- Sin `referencia`: `400`.

### 4.3 Cómo interpreta el Carrito cada respuesta

| Respuesta de Catálogo | Lo que hace el Carrito |
| --- | --- |
| Producto `200` con `activo: true` | Usa `nombre`, `precio` y `stock` |
| Producto `200` con `activo: false`, o `404` | Producto no disponible (`INACTIVO`) |
| `409 STOCK_INSUFICIENTE` | `409 STOCK_INSUFICIENTE` con los ítems que fallaron |
| `409 REFERENCIA_EN_USO` | `409 REFERENCIA_EN_USO` ("La referencia de pago ya fue utilizada"); no se muestra como falta de stock |
| Cualquier otro 409, otro código, timeout (3 s) o error de red | `503 CATALOGO_NO_DISPONIBLE`; el frontend lo muestra sin romperse |
| Fallo al devolver stock | Queda en el log para devolverlo a mano |

### 4.4 Referencia por intento (idempotencia)

El Carrito envía el `checkoutId` como `referencia` en `descontar-stock`:

- Un **reintento por red** (sin respuesta) dentro del mismo intento usa **la misma referencia**, para que Catálogo no descuente dos veces.
- Si el pedido falla al guardarse, el Carrito llama a `devolver-stock` y Catálogo cierra esa referencia. El siguiente intento usa `checkoutId-r1`, luego `checkoutId-r2`, etc.

Así, **confirmar dos veces el mismo checkout no descuenta el stock dos veces**, y un intento nuevo tras una devolución no choca con una referencia cerrada.

### 4.5 Ids de producto para la demo

Catálogo usa ObjectId de MongoDB (24 caracteres hexadecimales). Mientras B no entregue los ids reales, el mock y las reglas de descuento usan estos, con el mismo formato:

| Producto | Id provisional | Precio | Stock | Activo |
| --- | --- | --- | --- | --- |
| Camiseta básica algodón | `64f1a2b3c9e77a001f3d8e21` | 49.900 | 20 | sí |
| Jean clásico | `64f1a2b3c9e77a001f3d8e22` | 129.900 | 10 | sí |
| Gorra edición limitada | `64f1a2b3c9e77a001f3d8e23` | 35.000 | 0 | no |

Las reglas de descuento leen los ids de `DISCOUNT_JEAN_ID` y `DISCOUNT_CAMISETA_ID`. Cuando lleguen los ids reales, se cambian esas variables sin tocar código.

## 5. Frontend del Carrito dentro del Host App (C → B)

| Tema | Acuerdo |
| --- | --- |
| Puerto | `5175` (`strictPort`: si está ocupado, falla en vez de cambiar de puerto) |
| Modo embebido | Si se carga dentro de un iframe, oculta su título y los productos de prueba (los productos los muestra Catálogo) |
| Agregar desde Catálogo | `http://localhost:5175/?agregar={id}` agrega una unidad, quita el parámetro de la URL (un refresco no vuelve a agregar) y muestra el carrito. Un id inexistente o inactivo muestra un error y el carrito sigue usable |
| Rutas | El Host App puede abrir `/carrito`, `/carrito/checkout`, etc. El frontend no usa `vue-router`, así que la ruta se ignora y el flujo interno sigue por estado. **Limitación conocida** |
| API | El frontend llama a `/api/carrito` (en desarrollo, el proxy de Vite lo envía a Kong) |
| Sesión | Sin Keycloak, el token sale de `VITE_DEV_TOKEN` en el `.env.local` del frontend. Debe estar en cada máquina que haga la demo |
| Seguridad | La API envía `X-Frame-Options: DENY`. No afecta al iframe, porque la página del frontend la sirve Vite y no la API |

Ejemplo para el Host App:

```html
<iframe src="http://localhost:5175/?agregar=64f1a2b3c9e77a001f3d8e21" title="Carrito"></iframe>
```

## 6. Kong y compose de integración (C ↔ B)

### 6.1 Kong

**Propuesta:** un solo Kong, el de B, en el puerto 8000, con dos servicios:

| Ruta | Servicio | `strip_path` |
| --- | --- | --- |
| `/api/catalogo` | Catálogo | `true` |
| `/api/carrito` | `http://carrito:3000` | `false` (el Carrito espera el prefijo) |

CORS en `/api/carrito`:

- Orígenes: `http://localhost:5173`, `5174`, `5175` y `5050` (pendiente de confirmar con B, pregunta 5).
- Métodos: `GET, POST, PUT, DELETE, OPTIONS`.
- Cabeceras: `Authorization, Content-Type`.
- Cabeceras expuestas: `X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After`.

El bloque exacto para `kong.yml` lo entrega Juan David Gómez en INT-11.

### 6.2 Servicio del Carrito para el compose de B

El equipo C entrega un fragmento listo para pegar (INT-10, Juan David Gómez). Incluye:

- `carrito-redis` (Redis 7) y `carrito-postgres` (PostgreSQL 16).
- `carrito`, construido desde el repositorio `camiloherrera-dev/PROYECTO-ING-SOFTWARE-II`, en el puerto 3000, con healthcheck a `/ready`.

Variables que necesita el contenedor:

| Variable | Valor en la integración |
| --- | --- |
| `CATALOG_BASE_URL` | `http://kong:8000/api/catalogo` |
| `JWT_SECRET` | El mismo secreto que firma los tokens de la demo |
| `DATABASE_URL` | Apunta a `carrito-postgres` |
| `REDIS_URL` | Apunta a `carrito-redis` |
| `DISCOUNT_JEAN_ID`, `DISCOUNT_CAMISETA_ID` | Ids reales de Catálogo (por defecto, los provisionales de la sección 4.5) |

## 7. Búsqueda (A)

El Carrito **no depende técnicamente** de Búsqueda: no la llama ni recibe llamadas de ella. Si A necesita algo del Carrito (por ejemplo, un enlace "agregar al carrito"), puede usar el mismo `?agregar={id}` de la sección 5 o `POST /api/carrito/items`.

El contrato de A no ha llegado. Mientras no llegue, este documento no asume nada de Búsqueda.

## 8. Requisitos no funcionales que garantiza el Carrito

| Requisito | Garantía |
| --- | --- |
| Resiliencia | Si Catálogo cae, el Carrito responde `503 CATALOGO_NO_DISPONIBLE` y el frontend lo muestra sin romperse. Si Descuentos falla, el carrito responde sin descuentos |
| Idempotencia | Confirmar dos veces el mismo checkout no descuenta el stock dos veces (sección 4.4) |
| Aislamiento | El módulo funciona solo, con `npm run dev`, con o sin Host App |
| Seguridad | El usuario sale siempre del claim `sub` del JWT |
| Límite de peticiones | 120 peticiones por usuario por minuto; luego `429 DEMASIADAS_PETICIONES` con `Retry-After` |

## 9. Modos de la demo

| Modo | Qué se muestra | Cuándo se usa |
| --- | --- | --- |
| A. Completo | Host App de B + Kong de B + Catálogo real + Carrito | Si el compose de B funciona el lunes 16/11 a las 8:00 p. m. y Catálogo v2.4 está implementado |
| B. Propio | Compose del Carrito (con el mock de Catálogo v2.4) + frontend en 5175 + Postman | Si falla algo externo pero el Carrito está sano |
| C. Grabado | Video de 3 minutos del flujo completo en modo B, más capturas | Si no hay nada que mostrar en vivo |

El modo lo decide el Scrum Master en el go/no-go del lunes 16/11 a las 8:00 p. m. Si Catálogo real no implementa la v2.4 a tiempo, el Carrito sigue funcionando con él: la referencia se ignora y `devolver-stock` falla en el log.

## 10. Preguntas abiertas

| # | Pregunta | Para | Se necesita | Respuesta |
| --- | --- | --- | --- | --- |
| 1 | ¿Cuándo estará implementado Catálogo v2.4 (referencia idempotente, `devolver-stock`, `items` en el 409)? | B | Sábado 14/11 | Pendiente |
| 2 | ¿Cuándo estarán listos el compose de integración y el Host App? ¿Cuáles son los dos componentes del Host App que quedaron pendientes? | B | Sábado 14/11 | Pendiente |
| 3 | ¿Cuáles son los ids de los productos de prueba y cómo se restaura el stock entre demos? | B | Sábado 14/11 | Pendiente |
| 4 | ¿Búsqueda necesita algo del Carrito? ¿Cuándo envía su contrato? | A | Viernes 13/11 | Pendiente |
| 5 | ¿Se usa el Kong de B como único Kong, con CORS para los puertos 5173, 5174, 5175 y 5050? | B | Sábado 14/11 | Pendiente |

## 11. Riesgos que afectan a otros equipos

| Riesgo | Mitigación |
| --- | --- |
| Catálogo no implementa la v2.4 a tiempo | El mock v2.4 permite mostrar el flujo completo (modo B) |
| El compose o el Host App de B llegan tarde | Modo B o C. El fragmento del compose y el bloque de Kong quedan listos para que B no espere por nosotros |
| Los ids reales no llegan | Los descuentos leen los ids de variables de entorno; se cambian el día de la demo sin PR |
| El token de desarrollo no está en el iframe | `VITE_DEV_TOKEN` en el `.env.local` de la máquina de la demo |
| CORS en el Kong de B bloquea el puerto 5175 | INT-11 entrega el bloque exacto de CORS |
| Referencia cerrada tras `devolver-stock` | Referencia por intento (sección 4.4). Si no llega, queda como limitación en el contrato v1.4 |

## 12. Estado en `develop` (14/11/2026)

| Punto | Estado | Tarea |
| --- | --- | --- |
| API `/api/carrito` (sección 3.1), JWT con `sub`, `/health` y `/ready` | En `develop` | Sprints 1 a 4 |
| `referencia` (el `checkoutId`) en `descontar-stock` y llamada a `devolver-stock` | En `develop` | Sprint 4 |
| Distinguir `REFERENCIA_EN_USO` de `STOCK_INSUFICIENTE`; base URL por Kong | Pendiente | INT-05 (Santiago) |
| Referencia por intento (`checkoutId-rN`) | Pendiente, prioridad "debería" | INT-06 (Santiago) |
| Reglas de descuento con ids por variables de entorno | Pendiente | INT-07 (Santiago) |
| Mock de Catálogo v2.4 con ids ObjectId | Pendiente | INT-03 (Jeisson) |
| Frontend en 5175, `?agregar` y modo embebido | Pendiente (hoy: 5173, sin `?agregar`) | INT-08 (Sofía) |
| Fragmento del compose de B, Kong (CORS) y CI | Pendiente | INT-10 e INT-11 (Juan David) |
