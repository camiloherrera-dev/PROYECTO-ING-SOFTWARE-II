# Resultados QA de integración — 2 de noviembre de 2026

## Entorno

- Rama y revisión: `develop`, commit `0045b12`.
- Servicios: Docker Compose con API y mock de Catálogo reconstruidos desde el código actual; Redis y Kong activos.
- URL de Kong: `http://localhost:18000`.
- Para evitar usar imágenes antiguas se ejecutó `docker compose up --build -d carrito catalog-mock` antes de la regresión E2E.

## Pruebas automatizadas

| Comando | Resultado |
|---|---|
| `npm run test:node` | Pasa: 26/26 pruebas. |
| `npm run test:jest -- --cacheDirectory .jest-cache` | Pasa: 90/90 pruebas en 10 suites. |
| `npm run test:jest -- --cacheDirectory .jest-cache tests/cartTotals.test.js` | Pasa: 6/6; TC-40 unitario, incluidos error asíncrono, error síncrono y timeout de Descuentos. |

## E2E Sprint 2 por Kong

Comando ejecutado desde PowerShell:

```powershell
$env:BASE_URL = 'http://localhost:18000'
npm run e2e
```

Resultado: **12/12 verificaciones pasan**. Se validaron autenticación sin token, vaciado idempotente, agregar y acumular ítems, rechazo de producto inactivo, consulta de total con descuentos, actualización de cantidad, validación de cantidad cero, eliminación de ítem, segundo DELETE y vaciado final.

La aserción de consulta valida `total = 343012` y `descuentoTotal = 66488`. No comprueba por separado cada campo del desglose; por eso TC-32 y TC-35 se registran como parciales en la matriz.

## Verificación parcial de Sprint 3

Comando:

```powershell
$env:BASE_URL = 'http://localhost:18000'
npm run e2e -- --pedido
```

Resultados relevantes:

- Las 12 verificaciones del flujo Sprint 2 vuelven a pasar.
- Disponibilidad devuelve 200 con `disponible: true`.
- Crear checkout devuelve 201, `checkoutId` y total `343012`.
- La aserción E2E no comprueba cada estado de ítem de TC-43 ni `expiraEn` de TC-48; ambos quedan parciales hasta revisar esos campos directamente.
- Confirmar el checkout y repetir la confirmación devuelven 404. La ruta de confirmación de HU-10 no está implementada en `develop`; el carrito sigue con 2 ítems y el stock no cambia. TC-51 y TC-52 quedan bloqueados. Los casos posteriores que dependen de confirmar pedido siguen pendientes.
- La comprobación de checkout inexistente devuelve 404, pero no demuestra el comportamiento de HU-10 mientras falte la ruta.

El comando extendido termina con código 1 por las verificaciones de confirmación y sus efectos dependientes; las comprobaciones de disponibilidad y creación del checkout sí respondieron como esperaba el flujo.

## Casos de disponibilidad ejecutados directamente por Kong

Se usaron usuarios aislados `qa_tc43_sofia` y `qa_tc46_sofia`; al terminar, ambos carritos se vaciaron con DELETE. El precio del mock se restauró al valor inicial de `49900`.

| Caso | Resultado observado |
|---|---|
| TC-43, 3 camisetas y 2 jeans con stock | Falla el criterio de estado: la respuesta fue 200 con `disponible: true`, pero ambos ítems aparecieron con `estado: "INACTIVO"` aunque tienen `disponible: true`. |
| TC-46, cambiar precio de `prod_001` de 49900 a 59900 y consultar disponibilidad | Falla: la respuesta siguió mostrando `disponible: true` y `estado: "INACTIVO"`; no informó `PRECIO_CAMBIO` ni `precioAnterior`. Se restauró el precio a 49900. |

Estos resultados requieren corrección del endpoint de disponibilidad antes de marcar TC-43 y TC-46 como aprobados.
