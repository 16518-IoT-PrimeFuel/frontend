# ROADMAP — Integración Frontend ↔ Backend (FullTank)

Fuentes: `chapter3.md` (historias de usuario), `chapter5.md` §5.4 (wireframes/mock-ups) y `chapter1.md` §1.3 (segmentos objetivos), rama `develop` del repo Report. Landing page excluida (US-01..04, 36..39).
Fecha: 2026-10-02 · Rama: `feat/w1-backend-integration`

## Veredicto

La integración HTTP es **real**: no hay mocks ni datos hardcodeados, todo `infrastructure/` llama a `/api/...`. De 44 historias web: **26 integradas, 12 parciales, 6 sin implementar**. De ~15 pantallas del cap. 5: 10 completas, 4 parciales y 1 faltante (lista de entregas).
El flujo núcleo (registro → solicitud → aceptación → asignación → entrega → pago) funciona de punta a punta.

**Ajuste por segmento objetivo (§1.3):** tras el refactor, el único segmento es *Distribuidores Logísticos de Combustible*: el distribuidor es el cliente principal y contratante; los compradores son usuarios secundarios (su nivel de tanque inicia el flujo). El distribuidor instala el dispositivo IoT, asocia tanques, recibe pedidos automáticos, asigna conductor/cisterna y supervisa la entrega. La app hoy está orientada al comprador; la brecha real es la **capa de operación del distribuidor** y el **IoT visible en pantalla**. Las prioridades de abajo reflejan eso.

Cumplimiento de las 5 necesidades del segmento:

| Necesidad | Estado |
|---|---|
| Asociar tanques de compradores + detectar umbral | **Desalineada**: el comprador crea sus tanques (`buyerGuard`), sin campo de dispositivo IoT |
| Pedidos automáticos sin transcripción | Parcial: generación en backend OK; el form manual (contingencia, US-05) es hoy la pantalla principal del comprador |
| Aceptar/rechazar y notificar | Cumple |
| Selección automática de conductor y cisterna (capacidad ≥ volumen) | **No cumple**: solo filtra elegibles, el usuario elige (US-49) |
| Telemetría continua, válvula/geocerca, trazabilidad completa | Parcial: tracking y geocerca; falta nivel, válvula y expediente |

Salvedad: los subagentes leyeron títulos/resúmenes de las historias, no todos los escenarios Dado/Cuando/Entonces. "Integrado" = el flujo llama al backend, no que cumpla cada criterio. US-48 no se pudo confirmar (probablemente falta).

## Decisiones tomadas

- **Guards:** `/tanks` pasa a ser del **distribuidor** (asocia tanques y dispositivos de sus compradores). El comprador solo ve sus tanques en lectura. `/ordering/payment-history`: confirmar/reembolsar pertenece al distribuidor; el comprador consulta. (Resuelve la duda previa de guards.)
- **Endpoints de proveedor** bajo `/api/provider/...`, sin relajar los de comprador ni admin.

## Bloqueantes

- [ ] `environment.prod.serverBasePath` = `'TODO: deployed backend URL'`. Bloqueado: aún no hay deploy en Render.
- [ ] Backend: faltan endpoints de proveedor (en implementación por Codex): `GET /api/deliveries`, analytics con período, `/api/provider/buyer-companies`, `/api/provider/tanks` (lectura **y escritura**), `/api/provider/tanks/{id}/refill-episodes`. Ver prompt de Codex.

## P1 — Núcleo del segmento (distribuidor)

- [ ] **US-51 Asociar tanque y dispositivo IoT desde el distribuidor** (dispositivo, producto, umbral). Backend: POST/PUT en `/api/provider/tanks`, campo de dispositivo (migración Flyway). Frontend: mover `/tanks` a rol distribuidor + formulario de asociación.
- [ ] **US-31 / US-32** listado y detalle de empresas, tanques y dispositivos para el distribuidor (backend `/api/provider/...` pendiente).
- [ ] **US-49 Selección automática** de conductor y cisterna (capacidad ≥ volumen). Backend: endpoint de recomendación; frontend: preselección en asignación.
- [ ] **US-52 / US-53 Telemetría y válvula**: nivel de tanque/lecturas IoT y estado de válvula en pantalla; hoy solo tracking y geocerca.
- [ ] **Lista de entregas / "Entregas de hoy"** (wireflow 3). Backend `GET /api/deliveries` (proveedor + fecha); frontend vista y ruta en `fulfillment`.
- [ ] **Dashboard del distribuidor (US-47)**: ya muestra solicitudes PENDING (commit `6c8892c`). Faltan tanques críticos, entregas del día, KPIs del mes, combustible total vendido y gráfico de tendencia.
- [ ] **US-54 Alertas de operación** (nivel, desvío, pérdida de comunicación): sin backend ni frontend.
- [ ] **US-55 Expediente de entrega** completo para el distribuidor (pedido, asignación, telemetría, descarga, recepción); hoy solo export admin.
- [ ] **Guards**: aplicar la decisión de arriba (`/tanks`, pagos).

## P2 — Reportes y cierre de flujo

- [ ] **US-35 / US-14 / US-48**: PDF de ventas/pedidos (hoy `window.print`) y distribución por sector industrial. Backend + frontend.
- [ ] **US-07 / US-13**: recepción con evidencia y "cerrar pedido" explícitos.
- [ ] Verificar que el backend emite las notificaciones de US-29/US-30.

## P3 — Pulido y comprador (secundario)

- [ ] Asignar recursos (mock 5.7b): resumen previo y cisternas deshabilitadas con motivo.
- [ ] Tanque (mock 5.7a): barra vertical con línea de umbral.
- [ ] Pagos: "Confirmar pago" desde la pantalla Pagos del distribuidor.
- [ ] US-24 editar datos de usuario; US-17 invalidar token en logout.
- [ ] US-25 / US-26 (FAQ, contacto): decidir si aplican al alcance web-app.
- [ ] Revisar el `request-form` manual: dejarlo como contingencia (US-05), no flujo principal del comprador.

## Fuera de las historias (existe, no prometido)

`/accept-invitation`, `/admin` (AdminPanel), geofence policies, muestras de tracking, impresión de dossier.

## Matriz de pantallas (cap. 5)

| Pantalla | Estado |
|---|---|
| Login / registro / recuperar contraseña | Completa |
| Panel del distribuidor | Parcial |
| Solicitudes (lista + detalle aceptar/rechazar) | Completa |
| Asignar recursos | Parcial |
| Entregas (lista) | **Falta** |
| Detalle de entrega | Completa |
| Clientes y tanques | Desalineada (solo comprador; debe ser distribuidor) |
| Flota (conductores/cisternas) | Completa |
| Productos | Completa |
| Pagos | Parcial (solo comprador) |
| Reportes | Parcial |
| Notificaciones | Completa |
| Mis pedidos (comprador) | Completa |
| Perfil | Completa |

## Estado tanda 1 (frontend-implementer-pt2)

Commit `6c8892c`: dashboard muestra solicitudes pendientes. Resto bloqueado por backend. `ng build` OK; `ng test` no corre (faltan vitest/jsdom).

## Orden sugerido

1. Endpoints de proveedor en backend (Codex) → 2. Entregas + dashboard completo → 3. Vistas distribuidor: `/tanks` con asociación de dispositivo, empresas, guards (US-51/31/32) → 4. US-49 automático → 5. Telemetría, válvula, alertas, expediente (US-52/53/54/55) → 6. Reportes PDF/sector → 7. P3 y `environment.prod` cuando haya deploy.
