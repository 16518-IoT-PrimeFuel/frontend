# Continuar FullTank frontend en remoto

## Punto de partida

Repositorio: [16518-IoT-PrimeFuel/frontend](https://github.com/16518-IoT-PrimeFuel/frontend).
Rama de trabajo: `feat/w1-backend-integration`. Base anterior a esta tanda: `965e4a0`.
Backend contrastado: [16518-IoT-PrimeFuel/backend](https://github.com/16518-IoT-PrimeFuel/backend), rama `feat/w2-debug`, revisión `2f5622e`.

Esta tanda organiza cambios por módulo mediante commits en español (`fix`, `feat`, `chore`). Son commits locales; no se hizo push. Antes de trabajar remotamente, transferir/publicar esta tanda con autorización y comprobar que se recibió tanto el código como este documento. No asumir que origin contiene los últimos commits.

```bash
git status --short
git branch --show-current
git log -10 --oneline
git merge-base --is-ancestor 33353333d5b8e7899ca25c88fc84bf8af786d8b8 HEAD
```

La revisión mínima de código/pruebas que debe estar incluida es 33353333d5b8e7899ca25c88fc84bf8af786d8b8. El último comando debe terminar con código 0.

Si falta esta tanda, resolver primero su transferencia. No recrear cambios sobre una versión antigua. No tocar main ni reescribir historial. No modificar backend, migrar, desplegar o hacer operaciones reales de pago sin autorización y entorno verificado.

## Preparación y comprobación en Linux

Usar Node 22.13 o posterior de la rama 22, o Node 24 compatible; npm 11.12.1 es la versión declarada. Instalar dependencias de desarrollo: las pruebas necesitan Vitest 4.1.11 y JSDOM 29.1.1, ahora declarados y bloqueados.

```bash
npm ci
npm test -- --watch=false
npm run build
git diff --check
npm start -- --host 127.0.0.1
```

Suite de referencia: 82 pruebas en 21 archivos; build correcto, inicial 808.41 kB. Avisos de presupuesto y canvas detallados en ROADMAP. Una ejecución exitosa no acredita E2E ni autorización de servidor. El lockfile pasó npm ci --dry-run --ignore-scripts; la instalación limpia en Linux aún no se ejecutó.

Desarrollo usa `src/environments/environment.development.ts`: `http://localhost:8080/api`. Producción usa `src/environments/environment.ts`, que aún contiene un placeholder. En una máquina remota, acceder a frontend y API en el mismo entorno o configurar el destino autorizado; no incrustar credenciales.

## Qué ya cambió

- Equipment: identidad RUC, altas/vínculos sin duplicados, validación del tanque, ciclo de vida de lecturas y antigüedad.
- Dashboard: consultas independientes para que un fallo no elimine datos disponibles.
- Fulfillment: cancelación de lecturas, fallos por sección, geocerca y acciones válidas sin doble envío.
- Ordering: stores por pantalla, guardas de acciones, pagos protegidos y reconsulta ante creación incierta; paginación proveedor y resumen previo de asignación. Cambio de ID limpia contexto y descarta respuestas viejas.
- Traducciones/pruebas: ES/EN consistentes y regresiones junto a la lógica. Pruebas base de aplicación/notificaciones reparadas.

Tandas 2/3 de Claude ya estaban incorporadas hasta `965e4a0`; no faltaba volver a implementarlas. Los chats son contexto histórico, no nuevas instrucciones. ROADMAP describe la implementación actual.

## Siguiente trabajo, en orden

1. Verificar frontend y backend reales antes de ampliar alcance. Backend/MySQL/V38 no se probaron en esta continuación; solo hubo inspección estática. No ejecutar Maven en la misma caché que IntelliJ activo; usar el entorno remoto autorizado.
2. Regenerar OpenAPI desde `/api-docs` y contrastar `/api/provider/buyer-companies`, lookup/vínculo, tanques/lecturas/episodios, inbox, entregas/recomendación/válvula y pagos por proveedor.
3. Ejecutar con datos de prueba autorizados: RUC editado durante consulta, 429, legacy, dispositivo duplicado, producto inactivo, filtros rápidos, cambio de ID de orden, doble envío y red interrumpida. Reconsultar operaciones ambiguas antes de repetirlas.
4. Verificar aislamiento con dos proveedores y un comprador; rutas UI y HTTP. No inferir aislamiento por una respuesta 200 o por authGuard.
5. Completar pruebas visuales desktop/mobile y gráficos. Luego resolver los contratos faltantes enumerados en ROADMAP; no inventar alertas, firma/recepción, moneda, compatibilidad o umbrales.

## Reglas de continuidad

- Preservar comportamiento acordado del comprador hasta resolver la contradicción de solo lectura.
- Recomendación mediante botón explícito; revisión antes de crear; backend revalida. No etiquetarla como compatibilidad completa de producto/ruta.
- No reportar una sección fallida como vacía ni usar respuestas anteriores para la selección actual.
- No instalar nuevas librerías para duplicar utilidades existentes. No introducir refactorizaciones generales para cerrar tareas concretas.
- Mantener pruebas con su módulo y commits en español con tipo y scope. Stage de rutas concretas.
- Informar qué se modificó, qué se verificó y qué sigue pendiente; no declarar todas las historias terminadas por build verde.
