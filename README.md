# Carrito — HU-02 (Camilo Herrera)

Implementación parcial del Sprint 1: cliente de Catálogo y consulta del carrito con revalidación de precios y disponibilidad. Requiere Node.js 20 o superior. No necesita frontend ni instalar paquetes para ejecutar estas pruebas.

## Ejecutar pruebas en Windows

Desde CMD, en la carpeta del proyecto:

```bat
run-tests.cmd
```

Para abrir una ventana CMD independiente y mantener los resultados visibles:

```bat
start "Pruebas HU-02" cmd /k run-tests.cmd
```

También puedes ejecutar `npm test`. El lanzador guarda el resultado en `test-results/latest.log` y el código de salida en `test-results/exit-code.txt` (0 indica éxito). Esos resultados locales no se versionan.

Se prueban mapeo y errores de Catálogo, timeout con HTTP local real, carrito vacío, totales, productos eliminados/inactivos, cambios de precio y fallos de dependencias. Los datos Redis son simulados; no hay aún endpoint HTTP del carrito ni validación JWT.

## Configuración e integración

`CATALOG_BASE_URL` y `CATALOG_TIMEOUT_MS` se leen del entorno del proceso; los valores predeterminados son `http://localhost:4000` y `3000`. `.env.example` es una referencia: esta base todavía no carga archivos `.env` automáticamente.

El repositorio Redis falla explícitamente hasta incorporar el trabajo de Jeisson. Las fábricas `createCartService` y `createCatalogClient` permiten verificar la lógica sin implementar las tareas restantes del equipo.

Consulta [INTEGRACION-EQUIPO.md](INTEGRACION-EQUIPO.md) para ver qué conservar, qué reemplazar, responsables y pruebas pendientes cuando se complete el backend.
