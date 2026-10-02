# ROADMAP — FullTank frontend

Estado revisado: 2026-10-02. Rama: `feat/w1-backend-integration`.
Backend contrastado, sin modificar: `feat/w2-debug`, `2f5622e`.
Fuentes: [chapter3](https://github.com/16518-IoT-PrimeFuel/Report/blob/develop/docs/chapter3.md) y [chapter5](https://github.com/16518-IoT-PrimeFuel/Report/blob/develop/docs/chapter5.md).

## Estado de implementación por módulo

Los checks acreditan código y pruebas frontend; no acreditan historias completas ni operación integrada.

| Módulo | Estado actual |
|---|---|
| Dashboard | Inbox, KPIs mensuales, tendencia diaria/semanal/mensual, top 5 tanques críticos y entregas del día. Cargas y errores independientes. |
| Equipment / clientes | `/clients`: listado/búsqueda por nombre y RUC, sector, sitios, tanques/dispositivos y pedidos por comprador. Lookup exacto, vínculo/alta, cooldown 429 y aviso legacy sin organización activa. |
| Equipment / tanques | Alta/edición con producto activo al seleccionarlo, sitio del comprador, números finitos y deviceId/channel juntos. Detalle por ID, nivel/umbral, gráfico y tabla 48 h, episodios y antigüedad reactiva. |
| Fulfillment | Lista de entregas con fecha de Lima y filtros. Detalle, tracking, transiciones, timeline, observaciones de válvula y nivel del tanque. Errores por sección, validación de geocerca/volumen y bloqueo de doble envío. |
| Ordering / despacho | Recomendación explícita con «Usar recomendación», selección manual, capacidad normalizada, cisternas deshabilitadas con motivo, ventana válida y resumen previo. Reintento de asignación conserva commandId ante fallo de red. |
| Ordering / solicitudes y órdenes | Store por pantalla; guardas de rol/propietario/estado para decisiones y confirmación/cancelación. Cambio de ID recarga el detalle, limpia pago/asignación y cancela respuestas anteriores. |
| Ordering / pagos | `/payments` proveedor: filtros con límites de Lima, paginación de 20, confirmar/reembolsar con diálogo y manejo de conflicto. Pago comprador valida orden, propietario, importe y método; reconsulta tras creación incierta. |
| Traducciones y pruebas | Mensajes ES/EN, regresiones de concurrencia, validación y ciclo de vida; Vitest/JSDOM declarados para instalación reproducible. |

## Decisiones vigentes

- Distribuidor como segmento principal; `/clients`, `/payments` y `/fulfillment` requieren authGuard/providerGuard.
- `/tanks` y `/ordering/payment-history` conservan las vistas del comprador acordadas posteriormente. No crear un comprador duplicado ni permitir elegir customerAccountId arbitrariamente.
- Formularios de comprador y tanque separados; RUC exacto antes de vincular o crear.
- Lecturas 48 h y dato antiguo después de 1 h. Ausencia de observaciones no implica válvula cerrada.
- Sin umbral inventado para «en observación», moneda histórica ni compatibilidad de producto/ruta inexistente.
- El servidor revalida disponibilidad, propiedad y transiciones; las guardas UI no sustituyen esa autorización.

## Validación actual

- [x] `npm test -- --watch=false`: 82 pruebas, 21 archivos.
- [x] `npm run build`: correcto; inicial 808.41 kB.
- [x] Claves ES/EN coincidentes: 1.057.
- [x] `git diff --check`: sin errores.
- [x] `npm ci --dry-run --ignore-scripts`: lockfile consistente; no sustituye instalación limpia en Linux.
- Avisos existentes: presupuesto inicial 500 kB y request-list.css 4.87 kB frente a 4 kB. JSDOM avisa de canvas no implementado: no hay prueba visual del gráfico.
- Backend sin escuchar en 8080 durante la revisión; MySQL escucha en 3306, pero V38 no se consultó ni verificó. No se ejecutó Maven ni migraciones.
- Vitest 4.1.11 y JSDOM 29.1.1 se declararon usando las versiones locales verificadas. La instalación limpia en Linux sigue pendiente.

## Pendientes priorizados

1. **Integración real:** levantar backend en entorno autorizado, verificar MySQL/V38, contratos de `/api-docs`, permisos/aislamiento y flujo RUC → tanque → solicitud → orden → asignación → entrega → pago. Verificar visualmente desktop/mobile, gráfico y errores reales.
2. **Contrato y despliegue:** regenerar snapshot OpenAPI desde servidor; configurar URL real en `src/environments/environment.ts`. Actualmente contiene un placeholder y no permite declarar producción lista.
3. **Backend pendiente:** pago de orden cancelada puede devolver 500; límite lookup por instancia y organizaciones legacy requieren resolución del servidor.
4. **US-49 completa:** faltan compatibilidad de combustible/ruta y detalle por recurso de reservas en conflicto.
5. **US-51/52/53 completas:** provisión de token/hardware, vínculo duplicado completo, sincronización de eventos y autorización física/geocerca/conductor no validadas.
6. **US-54/55 y US-07/13:** contratos de alertas/acuse, expediente completo y recepción con evidencia ausentes. Notificaciones/impresión no completan esos requisitos.
7. **US-35/14 y US-48:** PDF de ventas/pedidos y agregado por sector pendientes. Sector visible en clientes no equivale a reporting por sector.
8. **Decisiones de producto:** aclarar comprador solo lectura frente a preservación posterior de controles; definir «en observación» antes de agregar filtro. No alterar permisos por interpretación.
9. **Pulido opcional:** contingencia manual/perfil/logout requieren contraste específico antes de declarar US-24/17 completas. No sumar importes de pagos como divisa confirmada sin moneda histórica.

## Continuidad

[CONTINUAR-REMOTO.md](CONTINUAR-REMOTO.md) contiene el procedimiento de recuperación, verificación y próximas tareas. La documentación histórica se retiró de `plan`; permanece en el historial Git cuando estaba versionada.
