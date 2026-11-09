# Microservicio de Carrito de Compras

Proyecto Final de Ingeniería de Software II. Es un microservicio de carrito con función de descuento.

**Stack:** Node.js 20 + Express · Redis 7 (ioredis) · PostgreSQL 16 (pg) · JWT · Kong API Gateway · Vue.js 3 (Vite + Pinia) · Docker Compose · GitHub Actions.

## Requisitos

- Docker Desktop (con Docker Compose)
- Node.js 20 o superior (para correr pruebas y generar tokens fuera de Docker)
- Git

## Cómo correr el proyecto

```powershell
Copy-Item .env.example .env
npm install
docker compose up --build
```

Esto levanta Redis, PostgreSQL, el mock de Catálogo, la API del carrito y Kong. `docker-compose.override.yml` activa el modo desarrollo (recarga automática). Para probar la imagen de producción:

```powershell
docker compose -f docker-compose.yml up --build
```

En producción `JWT_SECRET` es obligatorio: el servicio no arranca con el secreto de pruebas. Si cambias dependencias, reconstruye con `docker compose up --build -V`.

Para comprobar que todo arrancó (en PowerShell se usa `curl.exe`):

```powershell
curl.exe http://localhost:3000/ready          # {"status":"ok","redis":"up","postgres":"up"}
curl.exe -i http://localhost:8000/api/carrito  # 401 NO_AUTORIZADO (Kong → API, sin token)
```

## Salud del servicio

| Ruta | Para qué sirve | Respuesta |
| --- | --- | --- |
| `GET :3000/health` | El proceso está vivo | 200 `{"status":"ok"}` |
| `GET :3000/ready` | Puede atender peticiones | 200 `ok` o `degraded` (PostgreSQL caído); 503 si Redis cae |

No pasan por Kong. Redis es obligatorio; PostgreSQL es opcional: sin él el carrito funciona y el historial se sirve desde Redis.

## Puertos

| Servicio | Puerto | Uso |
| --- | --- | --- |
| Kong (proxy) | 8000 | Entrada pública: `http://localhost:8000/api/carrito` |
| Kong (admin) | 8001 | Administración de Kong |
| API del carrito | 3000 | Acceso directo (solo desarrollo), `/health` y `/ready` |
| Mock de Catálogo | 4000 | `GET /api/catalogo/productos/:id` |
| Redis | 6379 | Hash `carrito:<userId>`, TTL de 7 días |
| PostgreSQL | 5432 | Historial de pedidos y reglas de descuento (usuario y base `carrito`) |
| Frontend (Vite) | 5173 | Interfaz Vue |

## Endpoints

Todos exigen `Authorization: Bearer <JWT>` y pasan por Kong (`/api/carrito/*`).

| Método y ruta | HU | Descripción |
| --- | --- | --- |
| `GET /api/carrito` | HU-02 | Consultar el carrito (revalida contra Catálogo) |
| `POST /api/carrito/items` | HU-01 | Agregar un producto (suma si ya existe) |
| `PUT /api/carrito/items/{productId}` | HU-03 | Reemplazar la cantidad |
| `DELETE /api/carrito/items/{productId}` | HU-04 | Eliminar un producto |
| `DELETE /api/carrito` | HU-05 | Vaciar el carrito |
| `GET /api/carrito/disponibilidad` | HU-09 | Verificar disponibilidad antes de pagar |
| `POST /api/carrito/checkout` | HU-08 | Congelar el resumen de compra |
| `POST /api/carrito/checkout/{id}/confirmar` | HU-10 | Confirmar el pedido |
| `GET /api/carrito/pedidos` | HU-11 | Historial de pedidos (paginado) |
| `GET /api/carrito/pedidos/{pedidoId}` | HU-11 | Detalle de un pedido |
| `GET /api/carrito/recuperar` | HU-12 | Recuperar el carrito tras un periodo de inactividad |

El detalle de cada respuesta está en `docs/contrato-v1.4.md`.

## Base de datos y migraciones

PostgreSQL guarda el historial de pedidos (`pedidos`, `pedido_items`) y las reglas de descuento (`reglas_descuento`). Las migraciones son archivos SQL numerados en `db/migrations/` y se aplican solas al arrancar (`AUTO_MIGRATE=false` lo desactiva). Para correrlas a mano: `npm run migrate`.

## Variables de entorno

Ver `.env.example`. Las del Sprint 4: `DATABASE_URL`, `DB_POOL_MAX`, `AUTO_MIGRATE`, `CART_INACTIVITY_HOURS`, `DISCOUNT_RULES_CACHE_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` y `SHUTDOWN_TIMEOUT_MS`.

## Token de prueba

Todas las rutas de `/api/carrito` exigen `Authorization: Bearer <JWT>`. El `userId` sale del claim `sub`.

```bash
npm run token -- usr_demo
```

El secreto es `JWT_SECRET` en `.env`. Es un secreto simulado solo para pruebas; Keycloak real queda fuera del alcance.

### Probar el carrito por Kong

```bash
export TOKEN=$(npm run --silent token -- usr_test)

# HU-01: agregar (201 la primera vez; 200 y cantidad sumada si se repite)
curl -i -X POST http://localhost:8000/api/carrito/items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":"prod_001","cantidad":2}'

# HU-02: consultar
curl -i http://localhost:8000/api/carrito -H "Authorization: Bearer $TOKEN"

# HU-03: reemplazar la cantidad
curl -i -X PUT http://localhost:8000/api/carrito/items/prod_001 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cantidad":5}'

# Redis: el hash y su TTL (~604800)
docker exec -it carrito_redis redis-cli HGETALL carrito:usr_test
docker exec -it carrito_redis redis-cli TTL carrito:usr_test

# HU-12: recuperar el carrito (bloque "recuperacion")
curl -i http://localhost:8000/api/carrito/recuperar -H "Authorization: Bearer $TOKEN"

# HU-11: historial de pedidos
curl -i "http://localhost:8000/api/carrito/pedidos?limit=10&offset=0" -H "Authorization: Bearer $TOKEN"
```

Productos del mock de Catálogo: `prod_001` (49.900), `prod_002` (129.900) y `prod_003` (inactivo → 404).

## Pruebas

```powershell
npm test                      # node:test + Jest (sin bases de datos)
npm run test:integration      # necesita Redis y PostgreSQL levantados (docker compose up -d redis postgres)
npm run e2e                   # flujo por Kong; con --pedido llega al pedido y con --historial al historial
```

En Windows también funciona `run-tests.cmd`, que guarda la salida en `test-results/latest.log`.

## Frontend

```bash
cd Frontend
npm install
npm run dev   # http://localhost:5173
```

El frontend habla con Kong (`http://localhost:8000/api/carrito`), así que el backend debe estar corriendo con Docker Compose.

## Estructura

```
src/
  app.js, server.js        Express, arranque (Redis obligatorio, PostgreSQL opcional) y cierre ordenado
  config/env.js            Variables de entorno (dotenv)
  db/                      Pool de PostgreSQL y corredor de migraciones
  redis/redisClient.js     Cliente ioredis
  middlewares/             authJwt (RT-01) y manejador de errores
  routes/ services/        Rutas y lógica del carrito
  repositories/            Únicos módulos que hablan con Redis y PostgreSQL
  clients/catalogClient.js Cliente HTTP de Catálogo
  discounts/               Módulo Descuentos (reglas y cálculo)
db/migrations/             Migraciones SQL numeradas
tests/                     Jest; tests/node/ usa node:test
Frontend/                  Vue 3 + Vite + Pinia
mocks/catalog-mock/        Mock de Catálogo para desarrollo
kong/kong.yml              Configuración declarativa de Kong
docs/                      Plan de pruebas, colección Postman, contrato v1.4
```

## Flujo de trabajo

- Todo PR apunta a `develop`. `main` solo recibe el merge de cierre de cada sprint.
- Una rama por tarea, creada desde `develop` actualizado: `feature/SCRUM-XX-descripcion`.
- Commits con Conventional Commits y la clave de Jira: `feat(SCRUM-22): eliminar producto del carrito`.
- Antes del PR: `npm test` en verde y `git diff --stat origin/develop` con solo los archivos de la tarea.

## Reglas de descuento

El Módulo Descuentos (`src/discounts/`) calcula los descuentos de cada respuesta del carrito. Las reglas viven en la tabla `reglas_descuento` (con las del código como respaldo) y se leen con una caché de 60 segundos.

| Regla | Tipo | Efecto |
| --- | --- | --- |
| `DESC-JEAN-10` | Porcentaje por producto | 10% en Jean clásico |
| `DESC-CAMISETA-3X` | Cantidad mínima | 15% llevando 3 o más camisetas |
| `DESC-CARRITO-300K` | Monto mínimo del carrito | 5% adicional si, tras los descuentos por ítem, la compra llega a $300.000 |

Política: por ítem se aplica solo la mejor regla (no se acumulan); la regla de carrito se calcula sobre lo que queda tras los descuentos por ítem; los productos no disponibles no reciben descuento; los montos son pesos enteros. Si el módulo falla o tarda más de 200 ms, la respuesta sale sin descuentos con `descuentosDisponibles: false`: los descuentos nunca bloquean el carrito.

## Acuerdos con Catálogo

Respuesta del equipo de Catálogo del 27/10/2026 (responsable en Carrito: Juan David).

| Tema | Acuerdo |
| --- | --- |
| Producto | `GET /productos/{id}` → `{ id, nombre, precio, activo, stock, categoria, ... }`. Los ids son ObjectId de MongoDB (24 caracteres hexadecimales) |
| Stock | Entero ≥ 0, ya disponible |
| Inactivo | 200 con `activo: false`; el 404 es solo para un id que no existe |
| Categoría | Viene el id (por ejemplo `cat-ropa`); los nombres salen de `GET /categorias`. Falta confirmar el nombre exacto del campo |
| Descontar stock | `POST /productos/descontar-stock` con `{ items: [{ id, cantidad }] }` → 200 `{ items: [{ id, stockRestante }] }` · 409 `STOCK_INSUFICIENTE` con los ids en el mensaje. Todo o nada |
| Reservas | No existen: el descuento es definitivo y no vence |
| Token | Ningún endpoint de Catálogo valida token (Keycloak no está integrado en esta entrega) |
| URL | Por su Kong: `http://localhost:8000/api/catalogo`. Directo: `http://localhost:8080`, sin el prefijo. Por ahora cada equipo levanta su propio Kong |

**Configuración:** `CATALOG_BASE_URL` incluye el prefijo. Mock: `http://catalog-mock:4000/api/catalogo` (por defecto en `docker-compose.yml`). Catálogo real directo desde Docker: `http://host.docker.internal:8080`. Nuestro Kong y el de Catálogo usan los dos el puerto 8000, así que para integrar se usa el acceso directo.

**Propuesto a Catálogo, pendiente de respuesta:**

- `referencia` opcional (el `checkoutId`) en `descontar-stock`, para que un reintento no descuente dos veces. El cliente ya la envía.
- `POST /productos/devolver-stock` con `{ referencia }`, para devolver el stock si falla guardar el pedido. Mientras no exista, el fallo queda en consola para devolverlo a mano.
- Que el 409 traiga también `items` en el cuerpo. El cliente ya lo usa si llega.

**Riesgo conocido** hasta que exista la `referencia`: si la respuesta de Catálogo llega después de nuestro timeout, el carrito responde 503 y un reintento del cliente descontaría el stock dos veces. El mock ya implementa la propuesta completa.

El historial de la integración del Sprint 1 está en `docs/historico/INTEGRACION-EQUIPO.md`.

## Limitaciones conocidas

- Un pedido confirmado mientras PostgreSQL está caído queda solo en Redis (30 días); no hay reconciliación automática.
- Catálogo no tiene reservas: el descuento de stock es definitivo. Pendientes de Catálogo: `referencia` para no descontar dos veces y `devolver-stock`.
- El límite de peticiones vive en la memoria de cada instancia.
- El frontend corre por separado; su integración con el Host App no está resuelta.
