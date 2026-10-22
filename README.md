# Microservicio de Carrito de Compras

Proyecto Final de Ingeniería de Software II. Es un microservicio de carrito con función de descuento.

**Stack:** Node.js 20 + Express · Redis 7 (ioredis) · JWT · Kong API Gateway · Vue.js 3 (Vite + Pinia) · Docker Compose · GitHub Actions.

## Requisitos

- Docker Desktop (con Docker Compose)
- Node.js 20 o superior (para correr pruebas y generar tokens fuera de Docker)
- Git

## Cómo correr el proyecto

```bash
cp .env.example .env          # en PowerShell: Copy-Item .env.example .env
npm install
docker compose up --build
```

Esto levanta Redis, el mock de Catálogo, la API del carrito y Kong. Para comprobar que todo arrancó:

```bash
curl http://localhost:3000/health          # {"status":"ok"}
curl -i http://localhost:8000/api/carrito  # 401 NO_AUTORIZADO (Kong → API, sin token)
```

En los logs del contenedor `carrito_api` debe aparecer `Redis connection successful`.

### Puertos

| Servicio | Puerto | Uso |
| --- | --- | --- |
| Kong (proxy) | 8000 | Entrada pública: `http://localhost:8000/api/carrito` |
| Kong (admin) | 8001 | Administración de Kong |
| API del carrito | 3000 | Acceso directo (solo desarrollo) y `/health` |
| Mock de Catálogo | 4000 | `GET /api/catalogo/productos/:id` |
| Redis | 6379 | Hash `carrito:<userId>`, TTL de 7 días |
| Frontend (Vite) | 5173 | Interfaz Vue |

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
```

Productos del mock de Catálogo: `prod_001` (49.900), `prod_002` (129.900) y `prod_003` (inactivo → 404).

## Pruebas

```bash
npm test            # node:test (tests/node/) + Jest (tests/*.test.js)
npm run test:node   # solo las pruebas de HU-02 con node:test
npm run test:jest   # solo Jest
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
  app.js, server.js        Express y arranque (conecta Redis antes de escuchar)
  config/env.js            Variables de entorno (dotenv)
  redis/redisClient.js     Cliente ioredis
  middlewares/             authJwt (RT-01) y manejador de errores
  routes/ services/        Rutas y lógica del carrito
  repositories/            Único módulo que habla con Redis
  clients/catalogClient.js Cliente HTTP de Catálogo
tests/                     Jest; tests/node/ usa node:test
Frontend/                  Vue 3 + Vite + Pinia
mocks/catalog-mock/        Mock de Catálogo para desarrollo
kong/kong.yml              Configuración declarativa de Kong
docs/                      Plan de pruebas, colección Postman, contrato
```

## Flujo de trabajo

- Todo PR apunta a `develop`. `main` solo recibe el merge de cierre de cada sprint.
- Una rama por tarea, creada desde `develop` actualizado: `feature/SCRUM-XX-descripcion`.
- Commits con Conventional Commits y la clave de Jira: `feat(SCRUM-22): eliminar producto del carrito`.
- Antes del PR: `npm test` en verde y `git diff --stat origin/develop` con solo los archivos de la tarea.

## Reglas de descuento

Se documentan cuando entre el Módulo Descuentos (HU-06/HU-07, `src/discounts/`).

## Acuerdos con Catálogo

Pendientes de confirmar con el equipo de Catálogo (responsable: Juan David):

- Forma exacta de `GET /api/catalogo/productos/{id}` (nombres de campo y tipo del precio).
- Si un producto inactivo responde 404 o 200 con `activo: false` (el cliente soporta ambos).
- Si Catálogo expone `categoria`.
- URL base, puerto y quién opera el Kong compartido.
- Claim del JWT (`sub`) y secreto de pruebas común.
- Reserva de stock (bloquea HU-09 en el Sprint 3).

El historial de la integración del Sprint 1 está en `docs/historico/INTEGRACION-EQUIPO.md`.
