# Avance de Sofía — Sprint 4

**Responsable:** Sofía Victoria Vega Suárez

**Fecha:** 11 de noviembre de 2026

**Versión de referencia:** `develop` en `8cb8945`

**Ramas de trabajo:** `docs/plan-pruebas-sprint4` y `feature/SCRUM-28-frontend-historial`

## Trabajo realizado

### QA

- Se actualizó `docs/plan-pruebas.md` con resultados de TC-07a–d, TC-10, TC-17, TC-18a–c y TC-19, reportados por Sofía desde Postman.
- TC-16a–c respondieron con el error de validación esperado. TC-16d queda pendiente porque requiere verificar que un carrito previamente cargado no cambió.
- TC-72 pasó: las respuestas observadas incluyeron `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`.
- TC-74 pasó en los cuatro estados: dependencias arriba (`ok`), PostgreSQL abajo (`degraded`), Redis abajo (`down`) y recuperación (`ok`).
- En la suite automatizada de `develop`, Node reportó 26/26 aprobadas y Jest 16 suites, 146/146 aprobadas. Jest advirtió que quedaban operaciones asíncronas abiertas y no terminó por sí solo; se detuvo después de imprimir el resumen.

### Frontend HU-11 — Historial de pedidos

- Se implementaron la llamada de listado y detalle, el store de pedidos, la vista de historial con paginación y el acceso desde “Mis pedidos”.
- Se compiló el frontend con `npm run build`; el build terminó correctamente.
- Se añadió una nota para que la persona responsable del CSS revise y alinee el diseño visual del historial con el diseño final de la aplicación. La guía no asigna explícitamente ese ajuste a una persona.

## Dependencias pendientes del equipo

- **Mock de Catálogo:** el contenedor de QA termina inmediatamente y no responde; TC-01 devolvió 503 `CATALOGO_NO_DISPONIBLE`. En el checkout revisado, `mocks/catalog-mock/server.js` define las rutas, pero no inicia un listener. Hace falta dejar el mock escuchando en el puerto 4000 para continuar con las pruebas de agregar y revalidar productos.
- **HU-11, historial:** aunque hay componentes de servicio/controlador en `develop`, `src/app.js` solo monta `cartRoutes`, y esas rutas no exponen `GET /api/carrito/pedidos` ni `GET /api/carrito/pedidos/:pedidoId`. Santiago debe completar/integrar el registro de las rutas para probar la UI por Kong.
- **HU-12, recuperación:** `GET /api/carrito/recuperar` tampoco está montada en las rutas del `develop` revisado. Se necesita la integración del backend de recuperación y registro de actividad, asignada a Camilo y Jeisson en la guía.
- **Datos de historial:** para comprobar la pantalla se necesita que confirmar una compra cree un pedido consultable y que exista al menos un pedido de prueba asociado al usuario del token.
- **Diseño CSS:** dejar identificado en el equipo quién revisa el CSS de la vista del historial; la guía solo asigna la pantalla a Sofía y señala a Jose David como revisor.

## Trabajo de Sofía pendiente

- Completar TC-16d cuando se pueda crear un carrito con productos.
- Añadir a `docs/postman/carrito.json` la carpeta de Sprint 4 con TC-59 a TC-76; las peticiones que requieren rutas inexistentes se podrán ejecutar cuando se integren.
- Crear los tests de endpoints de HU-11/HU-12 después de que ambas rutas y seguridad estén integradas.
- Ejecutar los casos manuales de historial/recuperación y la regresión final TC-01 a TC-76 cuando las dependencias estén en `develop`.
- Repetir TC-43 y TC-46 con el procedimiento corregido tras recuperar el mock de Catálogo; sus resultados anteriores no se cambian sin nueva evidencia.

## Resultado actual

Los casos ejecutados se registran con sus resultados y el frontend compila, pero la pantalla de historial todavía no puede validarse contra la API hasta que estén montadas las rutas de HU-11 y HU-12. La falla del mock mantiene bloqueados los casos que necesitan consultar el Catálogo.
