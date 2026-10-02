# FRONTEND — TANDA 2 (plan para frontend-implementer-pt2)

Fecha: 2026-10-02. Frontend: rama `feat/w1-backend-integration` (HEAD `17f8aeb`). Backend: rama `feat/w2-debug` (HEAD `99d0f0f`).
Método: contratos verificados leyendo controllers, records `*Resource`, `CurrentUserAccess`, `GlobalExceptionHandler` y `ErrorResponseAssembler` del backend. Los `docs/api-ledger/provider-*.md` se contrastaron con el código; las diferencias están en la sección 1.4. Nada se ejecutó (ni Maven ni `ng`).
Fuentes de historias: `docs/chapter3.md` y `docs/chapter5.md` (repo Report, rama develop). Roadmap: `plan/ROADMAP.md`.

Nota sobre hashes: los hashes del encargo (626904f, 0491f36, ffa490d, 35250f2, cea8c52, cc096a2, 5f8a9fc, 0bd53e8, 55535b2, 56bdbe3, 31dd151) NO existen en el repo backend actual (probable reescritura de historia). El rango real `77e23c6..HEAD` tiene 23 commits; el mapeo está en 1.1.

---

## 0. Lectura rápida (lo que más importa)

1. El frontend NO llama a ningún endpoint eliminado o renombrado. Se verificó por grep: no hay `fuel-requests`, `/vehicles`, `/notifications` (usa `/me/notifications`), `provider-ratings`, `/inventory`, `/reporting`. Roturas reales son otras (sección 3).
2. Todo el backend nuevo es aditivo y exclusivo de `ROLE_PROVIDER` (con `providerId` en el JWT). Ningún comprador puede leerlo. Desbloquea casi todo P1.
3. Hallazgo crítico de repo: el commit `6c8892c` (dashboard con solicitudes pendientes del inbox) NO está en la rama; el rebase lo dejó huérfano (reflog: `rebase (start): checkout 6c8892c^` y solo se re-aplicó `fix(ordering)`). El ROADMAP lo da por hecho pero `dashboard.ts` no usa `requestInbox`. Primera tarea: recuperarlo (T0).
4. `/tanks` no puede simplemente abrirse al distribuidor: `GET/POST /api/tanks`, `/api/customers` y `/refill-policy` están acotados a la organización activa (membresía) del usuario. Un distribuidor vería (y crearía) activos en SU organización, no los de sus compradores. Debe usar `/api/provider/*` (sección 3, R2).
5. No existe endpoint para listar pagos del distribuidor: `GET /api/payments/company/{id}` es solo comprador y `GET /api/payments` solo ADMIN. El distribuidor solo puede `GET /api/payments/order/{orderId}`. La pantalla Pagos del distribuidor queda condicionada (sección 6).
6. Unidades: los endpoints `/api/provider/*` devuelven/exigen `LITRE` | `GALLON`; el frontend usa `LITERS`/`GALLONS` en tanques del comprador, productos y cisternas. Hace falta un mapeo único (T5).
7. Entregas son solo del distribuidor: `GET /api/deliveries/{id}`, `/transitions`, `/timeline`, `/tracking` y `/valve-observations` no admiten comprador. El comprador no tiene hoy ninguna vista de entregas en backend.

---

## 1. Resumen de cambios del backend

### 1.1 Commits del rango `77e23c6..HEAD` (orden cronológico)

| Hash | Cambio | Impacto frontend |
|---|---|---|
| 117e0d1 | Distribuidor destinatario puede leer `GET /api/replenishment-requests/{id}` | request-detail ya lo asume; correcto |
| 9e82af7 | Invitaciones: solo OWNER/ADMIN invitan; OWNER no invitable (400) | profile ya ofrece solo ADMIN/MEMBER; sin cambio |
| bf55716 | `PUT /api/provider-companies/{id}` ignora `rating` y lo conserva | frontend aún lo reenvía; inofensivo |
| 3b6600f | `POST /api/payments/{id}/refund`: solo pago COMPLETED; otro estado => 409 | `refundPayment` del store ya restringe a COMPLETED; manejar 409 |
| 93760d2 | Test | ninguno |
| 9320644, e4a900a | Analytics extraído a módulo `analytics` (misma ruta `/api/analytics/*`) | ninguno |
| 94832d2, b0782de, df34cd6 | `GET /api/replenishment-requests/inbox` | ya usado (`requestInbox`) |
| 08f8211 | `POST /api/fuel-products/provider/{providerId}/empty-catalog-alert` (solo comprador; 204/409/404) | ya usado (commit 17f8aeb) |
| 0a670da | NUEVO `GET /api/deliveries` (lista del distribuidor) | desbloquea Entregas |
| df80e5b | Analytics proveedor: `from`/`to`, `pendingOrders`, `totalFuelSoldLitres`, `salesTrend` | desbloquea US-47 |
| 568a3f9 | NUEVO `GET /api/provider/buyer-companies` | US-31 |
| c38022b | NUEVO `POST /api/provider/buyer-companies` (migración V38 `provider_buyer_links`) | alta de comprador |
| 8eae94d | NUEVO `GET /api/provider/tanks` | US-31/51 |
| 03513b3 | NUEVO `POST /api/provider/tanks` | US-51 |
| 11fdd7e | NUEVO `PUT /api/provider/tanks/{tankId}` | US-51 |
| 31c4e4c | NUEVO `GET /api/provider/tanks/{tankId}/refill-episodes` | US-32 |
| 283c7b7 | NUEVO `GET /api/deliveries/recommendation` | US-49 |
| 3f4f661 | NUEVO `GET /api/provider/tanks/{tankId}/readings` | US-52 |
| 99d0f0f | NUEVO `GET /api/deliveries/{id}/valve-observations` | US-53 |

Árbol de trabajo backend (sin commitear): 3 archivos en `equipment` que solo desacoplan módulos (la interfaz `ProviderBuyerAccess` gana `linkedBuyerCompany` con `@Override`, y `ProviderTankQueryServiceImpl` inyecta la interfaz en vez de la implementación). Sin cambio de contrato. Además `docs/api-ledger/provider-inbox.md` está sin trackear.

### 1.2 Contexto del refactor de segmento (77e23c6, ya anterior a esta tanda)
Backend ya expone: `/api/replenishment-requests` (+ `/inbox`, `/{id}/accept|reject|cancel`), `/api/fuel-orders`, `/api/deliveries` (+ `POST` asignación, `/assign|start|arrive|complete|fail|cancel`, `/transitions`, `/timeline`, `/tracking`, `/tracking/samples`, `/geofence-policies`, `/valve-observations`), `/api/drivers`, `/api/tankers` (+ `/eligible`, `/eligibility`, `/activate`, `/deactivate`), `/api/customers`, `/api/tanks` (+ `/refill-policy`, `/refill-episodes`), `/api/me/notifications`, `/api/me/organizations`, `/api/onboarding`, `/api/invitations`, `/api/admin/*`, `/api/analytics/*`. El frontend ya consume todo esto correctamente.

### 1.3 Seguridad (verificada)
- `WebSecurityConfiguration`: público solo `POST /api/buyer-companies`, `POST /api/provider-companies`, `POST /api/telemetry/readings` (token de dispositivo), `/api/authentication/**` y Swagger. El resto exige JWT.
- `@currentUserAccess.isProvider()` = autoridad `ROLE_PROVIDER` Y `providerId != null`. Un ADMIN NO pasa. Todas las rutas nuevas lo exigen; sin ello: 403 con cuerpo `{code:"FORBIDDEN",message,details}`.
- `ownsProvider(providerId)` en `GET /api/analytics/providers/{providerId}`: otro proveedor => 403.
- Formato de error común (`ErrorResource`): `{ "code", "message", "details" }` (`details` se omite si es null). `message` se localiza con `Accept-Language` (el interceptor del frontend ya lo envía). Mapeo `code` -> HTTP: `FORBIDDEN` 403; `VALIDATION_ERROR` 400; `*_NOT_FOUND` 404; `*_CONFLICT` 409; `BUSINESS_RULE_VIOLATION` 422; resto 500. Para rutas de proveedor, ids no positivos o fechas/instantes inválidos => 400 `VALIDATION_ERROR` (`request-parameters`).
- Códigos concretos observados: `BUYERCOMPANY_NOT_FOUND`, `FUELPRODUCT_NOT_FOUND`, `TANK_NOT_FOUND`, `ORDER_NOT_FOUND`, `DEVICEBINDING_CONFLICT`, `PROVIDERBUYERLINK_CONFLICT`, `BUYERCOMPANY_CONFLICT` (RUC duplicado), `ORDER_CONFLICT` (recomendación: solicitud no aceptada o ya asignada), `PROVIDERRESOURCE_CONFLICT` (violación de integridad genérica).

### 1.4 Diferencias documento vs código (importantes)
1. `GET /api/provider/tanks/{id}/refill-episodes`: el 404 devuelve CUERPO VACÍO (`ResponseEntity.notFound().build()`), no `ErrorResource`. El frontend ya tiene el fallback `equipment.request-failed` para cuerpo vacío.
2. 422 (`BUSINESS_RULE_VIOLATION`) existe en el backend y no se documenta en el ledger de proveedor. El helper de errores del frontend ya contempla 422.
3. 409 de dispositivo duplicado: `details` es texto fijo en inglés (`"Device already linked to tank 23"` o `"Device already linked; existing tenant details are private"`). Distinguir por `code === 'DEVICEBINDING_CONFLICT'` y mostrar texto i18n propio. Extraer el tankId con regex `tank (\d+)` es frágil (no verificado como contrato estable).
4. `POST /api/provider/buyer-companies` con RUC ya registrado => 409 `BUYERCOMPANY_CONFLICT` ("explicitly link the existing buyerCompanyId"), pero el distribuidor NO tiene forma de descubrir ese `buyerCompanyId`: `GET /api/buyer-companies` es solo ADMIN. Ver duda D2.
5. `ProviderBuyerCompanyResource` NO incluye `ruc` ni `sector` (el cap. 5 pide filtro por "Nombre o RUC" y US-48 pide sector). No se puede filtrar por RUC ni agrupar por sector con lo que existe.
6. `ProviderDeliveryResource.status` es el estado LEGADO (`SCHEDULED|DISPATCHED|DELIVERED|FAILED`); el estado real es `physicalState` (`ASSIGNED|STARTED|ARRIVED|DELIVERING|COMPLETED|FAILED|CANCELLED`). La UI debe basarse en `physicalState`.
7. Riesgo de zona horaria: `date` de `/api/deliveries` filtra `scheduledDate` exacto (fecha de negocio Lima). El frontend debe calcular "hoy" en `America/Lima`, no con `toISOString()` en UTC.

---

## 2. Tabla de contratos por endpoint (nuevos y modificados)

Convenciones: todos son `Authorization: Bearer <JWT>`; base `${environment.serverBasePath}` (= `.../api`). Rol "PROVIDER" = `ROLE_PROVIDER` con `providerId`. Instants ISO-8601 UTC con `Z`. `LocalDate` = `yyyy-MM-dd`.

### 2.1 Nuevos (solo PROVIDER)

| # | Método y ruta | Parámetros | Request | Response 2xx | Errores |
|---|---|---|---|---|---|
| N1 | `GET /deliveries` | query opcionales `providerId` (>0, debe ser el propio), `date` (`yyyy-MM-dd`, filtra `scheduledDate`) | - | 200 `ProviderDelivery[]` (orden por id asc; `[]` si no hay) | 400 id/fecha inválida; 403 rol o `providerId` ajeno |
| N2 | `GET /deliveries/recommendation` | query `orderId` (obligatorio, >0); opcionales `windowStart`, `windowEnd` (Instant; deben ir juntos) | - | 200 `DeliveryRecommendation` | 400 ventana/id inválida o sin fecha y sin ventana; 403; 404 orden ajena/sin solicitud propia (`ORDER_NOT_FOUND`); 409 solicitud no aceptada o ya asignada (`ORDER_CONFLICT`) |
| N3 | `GET /deliveries/{deliveryId}/valve-observations` | path `deliveryId` >0 | - | 200 `ValveObservation[]` ascendente (`[]` = sin observaciones, NO cerrada) | 400; 403; 404 entrega ajena |
| N4 | `GET /provider/buyer-companies` | - | - | 200 `ProviderBuyerCompany[]` | 403 |
| N5 | `POST /provider/buyer-companies` | - | ver abajo | 201 `ProviderBuyerCompany` | 400 (RUC no 11 dígitos, email, nombres vacíos); 403; 404 `BUYERCOMPANY_NOT_FOUND` (buyerCompanyId inexistente o sin organización CUSTOMER activa con el mismo RUC); 409 `BUYERCOMPANY_CONFLICT` (RUC existente) o `PROVIDERBUYERLINK_CONFLICT` (ya vinculado) |
| N6 | `GET /provider/tanks` | query opcional `buyerCompanyId` (>0, id de buyer-companies) | - | 200 `ProviderTank[]` activos, id asc | 400; 403; 404 si el filtro apunta a comprador no vinculado |
| N7 | `POST /provider/tanks` | - | ver abajo | 201 `ProviderTank` | 400 (capacidad, unidad, umbral, cuenta/sitio ajenos); 403; 404 `BUYERCOMPANY_NOT_FOUND` o `FUELPRODUCT_NOT_FOUND` (producto ajeno/inactivo); 409 `DEVICEBINDING_CONFLICT` |
| N8 | `PUT /provider/tanks/{tankId}` | path `tankId` >0 | ver abajo | 200 `ProviderTank` | 400 (deviceId y channel deben ir juntos, umbral); 403; 404 `TANK_NOT_FOUND`/`FUELPRODUCT_NOT_FOUND`; 409 `DEVICEBINDING_CONFLICT` |
| N9 | `GET /provider/tanks/{tankId}/readings` | query opcionales `from`, `to` (Instant, inclusivos, filtran `capturedAt`) | - | 200 `ProviderTankReading[]` ascendente por `capturedAt`,`id`; excluye QUARANTINED | 400; 403; 404 tanque no vinculado |
| N10 | `GET /provider/tanks/{tankId}/refill-episodes` | path | - | 200 `RefillEpisode[]` | 403; 404 CUERPO VACIO |

Request N5 (nuevo comprador): `{ "name":"...", "ruc":"20999888777", "sector":"...", "address":"...", "contactEmail":"...", "phone":"...", "siteName":"..." }` (`name` y `ruc` obligatorios; `ruc` = `[0-9]{11}`; `siteName` por defecto = `name`). Request N5 (existente): `{ "buyerCompanyId": 4 }`. No crea usuario IAM ni credenciales.

Request N7: `{ "buyerCompanyId":4, "customerAccountId":7, "siteId":10, "name":"Tanque diésel", "fuelProductId":5, "capacity":1000, "unit":"LITRE"|"GALLON", "initialLevel":150, "lowLevelPercent":20, "deviceId":"sensor-23", "channel":"level", "autoGenerateEnabled":true }`. Obligatorios: `buyerCompanyId`, `customerAccountId`, `siteId`, `name` (<=150), `fuelProductId`, `capacity` (>0), `unit`, `lowLevelPercent` (>0 y <=90), `deviceId` (<=120), `channel` (<=60). `initialLevel` >=0 (<= capacidad, por defecto 0). `autoGenerateEnabled` por defecto true. `customerAccountId` y `siteId` salen de `sites[]` de N4.

Request N8: `{ "fuelProductId"?, "lowLevelPercent"?, "deviceId"?, "channel"?, "autoGenerateEnabled"? }`. Omitidos se conservan. `deviceId` y `channel` se envían juntos o ninguno (si no, 400 `VALIDATION_ERROR` campo `device`). No cambia propietario, sitio ni capacidad. Activar `autoGenerateEnabled` sin producto => 400.

Responses (campos exactos de los records):

- `ProviderDelivery` (N1): `{ id, orderId, status, physicalState, driver:{id,firstName,lastName}|null, tanker:{id,licensePlate}|null, scheduledDate:"yyyy-MM-dd"|null, windowStart:Instant|null, windowEnd:Instant|null, buyerCompanyId|null, buyerCompanyName|null, customerAccountId|null, siteId|null, deliveryAddress|null, requestedVolume:number|null, unit:string|null, deliveredVolume:number|null }`. Muchos campos pueden ser `null` en datos heredados; la UI debe tolerar `null` (mostrar "-").
- `DeliveryRecommendation` (N2): `{ orderId, recommended:boolean, reason:string|null, driverId|null, driverName|null, tankerId|null, licensePlate|null, tankerCapacityLitres:number|null, requestedVolumeLitres:number, windowStart:Instant, windowEnd:Instant, criterion:string }`. Sin candidatos: 200 con `recommended=false` y `reason` en `NO_ELIGIBLE_DRIVER | NO_SUFFICIENT_ELIGIBLE_TANKER | RESERVATION_CONFLICT`. Sin ventana usa el día programado completo en UTC (00:00Z a 00:00Z siguiente). Criterio: cisterna de menor capacidad suficiente (litros), empate por menor id; conductor elegible de menor id sin conflicto. No crea reservas. NO considera compatibilidad cisterna/producto ni ruta (el modelo no las tiene).
- `ValveObservation` (N3): `{ id, state:"OPEN"|"CLOSED", unauthorized:boolean, commandId:string|null, recordedAt:Instant }`. `recordedAt` es publicación del evento, no `capturedAt` de hardware.
- `ProviderBuyerCompany` (N4/N5): `{ id, name, organizationId:number|null, tankCount, criticalTankCount, activeOrderCount, historicalOrderCount, sites:[{id, customerAccountId, name, address}] }`. `id` = `buyerCompanyId`. Si `organizationId` es null: sin tanques ni sitios.
- `ProviderTank` (N6/N7/N8): `{ id, buyerCompanyId, organizationId, customerAccountId, siteId, name, siteName, deliveryAddress, fuelType, fuelProductId:number|null, capacity, currentLevel, unit:"LITRE"|"GALLON", levelPercent, lowLevelPercent, critical:boolean, levelObservedAt:Instant|null, levelSource:string, devices:[{deviceId, channel, validFrom}] }`. `critical` = `levelPercent <= lowLevelPercent`. `levelSource` observado en ledger: `MANUAL`, `VALIDATED` (otros valores no verificados). `devices` puede estar vacío; nunca incluye tokens.
- `ProviderTankReading` (N9): `{ id, tankId, deviceId, channel, sequence, level, unit, capturedAt, receivedAt, quality }` (`quality` ej. `ACCEPTED`; el resto de valores no verificado).
- `RefillEpisode` (N10): `{ id, episodeKey, tankId, organizationId, policyVersion, status:"OPEN"|..., openedAt, openedLevelPercent, openedLevel, targetLevel, requestedVolume, unit, requestEmitted:boolean, requestId:number|null, closedAt:Instant|null, closedLevelPercent:number|null, version }`. NOTA: el modelo frontend actual `RefillEpisode` omite `episodeKey`, `tankId`, `organizationId`, `policyVersion`, `closedLevelPercent`, `version` (aditivo, no rompe).

### 2.2 Modificado

| Método y ruta | Cambio | Detalle |
|---|---|---|
| `GET /analytics/providers/{providerId}` | ampliado, retrocompatible | Query opcionales `from`, `to` (`yyyy-MM-dd`, inclusivos; 400 si `from > to` o formato inválido). Response: `{ providerId, totalOrders, confirmedOrders, cancelledOrders, totalRevenue, monthlyRevenue:[{month:"yyyy-MM", monthIndex, amount}], pendingOrders, totalFuelSoldLitres, salesTrend:[{date:"yyyy-MM-dd", litres}] }`. Sin fechas: acumulados. `salesTrend` es serie diaria DISPERSA y ordenada: el frontend agrupa semana/mes y rellena días vacíos con 0. Litros = por pago COMPLETED, una vez por orden, en la fecha del primer pago; no es volumen descargado. Pedidos filtran por `createdAt` UTC; ingresos por `paidAt`. 403 si no es el proveedor propietario. |
| `POST /payments/{id}/refund` | nuevo 409 | Solo pagos COMPLETED; repetir sobre uno ya reembolsado es idempotente. PENDING/FAILED => 409. |
| `GET /replenishment-requests/{id}` | acceso ampliado | También lo lee el distribuidor destinatario. |
| `POST /organizations/{id}/invitations` y `DELETE /invitations/{id}` | restringido | OWNER/ADMIN; `role=OWNER` => 400. |
| `PUT /provider-companies/{id}` | `rating` ignorado | Se conserva el valor existente. |

### 2.3 Sin cambio pero relevantes para esta tanda (verificados)
- `GET /fuel-orders/provider/{providerId}` (owner provider): `FuelOrderResource { id, requestId, companyId, providerId, fuelProductId, equipmentId, requestedQuantity, totalPrice, status, deliveryAddress, scheduledDate }`. `companyId` = `buyerCompanyId`. Sirve para historial por comprador (filtrar en cliente por `companyId`).
- `GET /replenishment-requests/inbox`: `ReplenishmentRequestResource { id, organizationId, customerAccountId, tankId, providerId, fuelProductId, quantity, unit, unitPrice, status, source, rejectionReason, orderId, deliveryAddress, deliveryDate, version }`, todas las solicitudes del proveedor, id desc.
- `POST /deliveries` (asignación): `{ commandId, orderId, driverId, tankerId, windowStart, windowEnd, scheduledDate?, notes? }` -> 201 `{ deliveryId, orderId, providerId, driverId, tankerId, supplyReservationId, fleetReservationId, physicalState, commandId }`. Idempotente por `commandId`.
- `GET /deliveries/{id}`: `{ id, orderId, providerId, driverId, vehicleId, legacyStatus, physicalState, requestedVolume, deliveredVolume, dispatchedAt, startedAt, arrivedAt, deliveringAt, deliveredAt, notes, version }` (solo proveedor dueño; si no, 404). `delivery-detail` ya lo usa bien.
- `GET /deliveries/{id}/timeline`: `[{occurredAt, type, summary, refId}]`; accesible a proveedor dueño o conductor asignado (403 si no).
- `GET /payments/order/{orderId}`: comprador de la orden o proveedor de la orden (404 si no).
- `POST /payments/{id}/complete` y `/refund`: comprador o proveedor de la orden (404 si no).
- `POST /fuel-orders/{id}/confirm`: SOLO comprador dueño; `POST /fuel-orders/{id}/cancel`: comprador o proveedor.
- `GET /tanks`, `/customers`, `/tanks/{id}/refill-policy`: por organización activa del token (membresía), no por rol.

### 2.4 Eliminados/renombrados respecto al backend previo al refactor (referencia)
`/api/fuel-requests` (v1), `/api/vehicles` y `/api/drivers` de fulfillment (ahora `/api/tankers` y `/api/drivers` de fleet), `/api/notifications` (ahora `/api/me/notifications`), `/api/provider-ratings`, favorito de proveedor, `/api/inventory` y catálogo `/products`, `/api/reporting/*` (ahora `/api/analytics/*`), `/api/directory`. El frontend no los usa.

---

## 3. Roturas y regresiones a corregir primero

| ID | Severidad | Hallazgo | Evidencia | Corrección |
|---|---|---|---|---|
| R1 | Alta | Commit `6c8892c` (dashboard con solicitudes pendientes) perdido en el rebase | `git reflog` del frontend; `dashboard.ts` no importa `requestInbox`; `git branch --contains 6c8892c` vacío; el objeto aún existe | T0: `git cherry-pick 6c8892c` (verificar antes con `git show`) |
| R2 | Alta | `/tanks` con `buyerGuard` y lógica de organización: no sirve para el distribuidor (decisión roadmap). `EquipmentStore.resolveCustomer()` crea una `Customer` en la organización del usuario | `equipment.store.ts`, `TanksController`, `CustomersController` usan `membershipAccess.currentOrganizationId()` | T6/T7: vistas de distribuidor sobre `/api/provider/*`; el comprador queda en solo lectura (ver E-2) |
| R3 | Media | Unidades inconsistentes: `LITRE/GALLON` (provider API, requests de reposición) vs `LITERS/GALLONS` (tanque comprador, cisternas, productos) | grep `LITERS`; `Unit.fromCode` del backend acepta ambos pero el POST de proveedor valida regex `LITRE|GALLON` | T5: helper `unitKey()` y constante de unidades de proveedor; no tocar los formularios existentes |
| R4 | Media | Modelo de entrega obsoleto: `Delivery`, `DeliveryResource` (`vehicleId`, `actualDeliveryDate`, `notes`, `createdAt`, `DeliveriesResponse {deliveries}`) y `DeliveryAssembler` no coinciden con ningún endpoint. `DeliveryApiEndpoint extends BaseApiEndpoint` hace que `getAll()` herede `GET /deliveries` y tipe mal la respuesta nueva | `fulfillment/domain/model/delivery.entity.ts`, `infrastructure/delivery-response.ts`, `delivery-assembler.ts` | T1: reemplazar por `ProviderDelivery` y quitar la herencia |
| R5 | Media | `ProviderAnalytics` del frontend no tiene `pendingOrders`, `totalFuelSoldLitres`, `salesTrend`, `providerId`; `getProviderAnalytics` no admite `from`/`to` | `analytics.entity.ts`, `analytics-api.ts` | T3 (aditivo) |
| R6 | Media | `payment-history` es solo comprador (`buyerGuard`, `loadPayments` exige `isBuyer`, `refundPayment` bloquea al distribuidor) mientras el roadmap pide pagos del distribuidor; el backend sí permite complete/refund al proveedor pero no listar | `ordering-routes.ts`, `ordering.store.ts` | Condicionado a D3; no tocar hasta decidir |
| R7 | Baja | `refundPayment` del store usa `error?.message` pero `catchError(handleError(..., true))` ya devuelve claves i18n (`errors.http-409`): correcto. Añadir clave i18n específica para 409 de reembolso (pago no COMPLETED) si se quiere mensaje preciso | `ordering-api.ts`, `ordering.store.ts` | Opcional, en T16 |
| R8 | Baja | `IamApi.updateProviderCompany` reenvía `rating` (backend lo ignora) | `iam-api.ts` | Sin acción; documentar |
| R9 | Info | `node_modules` contiene `vitest` y `jsdom` pero `package.json` no los declara (y `package-lock.json` aparece modificado) | `ls node_modules`, `git status` | No instalar ni editar `package.json` sin preguntar a Samuel (D6) |
| R10 | Info | `environment.prod.serverBasePath = 'TODO: deployed backend URL'` | `environment.prod.ts` | Bloqueado: no hay deploy en Render |

Compatibles sin cambio (verificado contra backend): `OrderingApi` (requests, inbox, accept/reject/cancel, orders, payments, fuel-products, alert), `FulfillmentApi` (drivers, tankers, eligible, eligibility, activate/deactivate), `delivery-detail` (GET, tracking, samples, transitions, timeline, comandos, geofence), notificaciones (`/me/notifications`, tipos coinciden con el enum del backend), IAM (`/authentication`, `/me/organizations`, `/onboarding`, invitaciones), admin (`/users`, `/admin/*`, `/payments`), `AnalyticsApi` buyer/platform, `Order`/`Request` entities (campos coinciden con los records).

---

## 4. Tareas atómicas ordenadas (una por commit)

Reglas comunes a TODAS las tareas:
- Rama actual del frontend (`feat/w1-backend-integration`), commit atómico por tarea, sin force-push, nunca a `main`. Mensaje convencional (`feat(scope): ...`) y pie de atribución del entorno.
- Arquitectura por bounded context: `domain/model`, `application` (store con signals), `infrastructure` (api/endpoint/response/assembler), `presentation` (views + routes). Standalone components, `inject()`, signals, control flow `@if/@for`, `TranslatePipe`.
- Todo texto visible con clave i18n en `public/i18n/es.json` Y `public/i18n/en.json` (misma estructura). Estados obligatorios en cada vista: cargando (`role="status"`), vacío (mensaje claro), error con "Reintentar" (`role="alert"`).
- Errores HTTP: usar `ErrorHandlingEnabledBaseType.handleError(op, true)` (devuelve claves `errors.http-4xx`) y, para mensajes específicos, mapear por `error.error.code`. No mostrar `details` en inglés al usuario.
- Fechas "hoy": calcular en `America/Lima`, nunca con `toISOString().slice(0,10)` en UTC.
- Sé mínimo: nada fuera de lo listado. Antes de cada tarea con UI no trivial: AskUserQuestion a Samuel (sección 5).
- Verificación por tarea: `ng build` debe pasar. NO ejecutar `ng test` hasta resolver D6. Si se agregan specs, que compilen con el builder `@angular/build:unit-test` ya configurado.

### T0. Recuperar el dashboard con solicitudes pendientes (R1)
- Acción: `git show 6c8892c` para confirmar contenido; `git cherry-pick 6c8892c`. Si hay conflicto con `f30a9e8` o `17f8aeb`, resolverlo manteniendo ambos cambios.
- Archivos: `src/app/dashboard/presentation/views/dashboard/dashboard.{ts,html}`, `public/i18n/{es,en}.json` (4 archivos tocados por el commit original).
- Endpoint: `GET /replenishment-requests/inbox` (ya existe en `OrderingApi.requestInbox`).
- Aceptación: el distribuidor ve en el panel sus solicitudes PENDING (estado vacío si no hay, error con reintento). `ng build` OK.
- Historia: US-47 (panel), cap. 5 "solicitudes pendientes".

### T1. Alinear dominio/infra de entregas con el backend (R4)
- Crear: `fulfillment/domain/model/provider-delivery.entity.ts` (interfaz `ProviderDelivery` con los campos de N1, `physicalState` tipado con la unión de 7 valores, `status` legado como `string`, nulables explícitos), `fulfillment/infrastructure/provider-delivery-response.ts`.
- Modificar: `delivery-api-endpoint.ts` -> clase que extienda `ErrorHandlingEnabledBaseType` (no `BaseApiEndpoint`), con `list(date?: string): Observable<ProviderDelivery[]>` que llame `GET /deliveries` (+ `?date=`), `recommendation(orderId, windowStart?, windowEnd?)`, `valveObservations(id)`; mantener los métodos existentes (`detail`, `tracking`, `samples`, `transitions`, `timeline`, `command`, `geofence`, `assign`). `fulfillment-api.ts`: exponer `deliveries(date?)`, `recommendation(...)`, `valveObservations(id)`.
- Eliminar: `delivery.entity.ts` (clase `Delivery`), `delivery-response.ts` (`DeliveryResource`, `DeliveriesResponse`), `delivery-assembler.ts`, tras confirmar con grep que nada más los importa.
- Endpoints: N1, N2, N3 (solo métodos de API; sin UI).
- Aceptación: `ng build` OK; no queda referencia a `DeliveriesResponse`/`Delivery` huérfanos; `delivery-detail` sigue funcionando (usa `any`).
- i18n: ninguna.

### T2. Lista de entregas del distribuidor (pantalla "Entregas")
- Crear: `fulfillment/presentation/views/delivery-list/delivery-list.{ts,html,css}`; ruta `delivery-list` en `fulfillment-routes.ts` (ya bajo `authGuard, providerGuard`); store: ampliar `FulfillmentStore` con `deliveries` signal, `loadDeliveries(date?)` o crear `DeliveryStore` en `application/` si el existente crece demasiado (preferir ampliar).
- Navegación: agregar hijo `{ label: 'fulfillment.deliveries', link: '/fulfillment/delivery-list' }` en `layout.ts` (rol PROVIDER).
- Endpoint: N1 con `date` por defecto = hoy Lima ("Entregas de hoy"); control para cambiar fecha y para "todas".
- Contenido (cap. 5.4.1 y 5.2.4): tabla/lista con id de entrega, orden (enlace a `/ordering/order-detail/:orderId`), comprador, dirección, conductor, cisterna (placa), ventana (`windowStart`-`windowEnd`, hora local), volumen solicitado + unidad, estado `physicalState` con chip; fila enlaza a `/fulfillment/delivery-detail/:id`. Filtros por estado, conductor, cisterna y fecha (filtro en cliente sobre la colección, con chips removibles y mensaje "qué filtro oculta resultados").
- Estados: cargando; vacío ("No hay entregas para la fecha"); error con reintento; campos `null` => "-".
- Aceptación: sin `date` el listado muestra todas; con fecha filtra por `scheduledDate`; 403 se muestra como acceso denegado; no se envía `providerId`.
- i18n: `fulfillment.deliveries`, `fulfillment.delivery-list.*` (título, fecha, hoy, todas, columnas, filtros, vacío, error), `delivery-state.assigned|started|arrived|delivering|completed|failed|cancelled` (verificar claves existentes `delivery-status` antes de duplicar).
- Historias: wireflow 3 (Entregas de hoy), US-12, US-13 (lista), 5.2.4 filtros de Entregas.

### T3. Analytics del distribuidor con período y serie de ventas (R5)
- Modificar: `analytics/domain/model/analytics.entity.ts` (`ProviderAnalytics` + `providerId`, `pendingOrders`, `totalFuelSoldLitres`, `salesTrend: SalesTrendPoint[]`; nuevo `SalesTrendPoint {date: string; litres: number}`), `analytics/infrastructure/analytics-api.ts` (`getProviderAnalytics(providerId, from?, to?)` con `HttpParams`, solo si hay valor).
- Función pura en `analytics/domain/` (p. ej. `sales-trend.ts`): `groupSalesTrend(points, 'day'|'week'|'month', from, to)` que completa días vacíos con 0 y suma por semana (lunes ISO) o mes (`yyyy-MM`). Cubrir con un spec de 3 casos (dispersa, semana, mes) si el runner de tests está disponible.
- Aceptación: `ng build`; llamadas existentes (`getProviderAnalytics(id)`) siguen compilando; 400 por `from > to` se previene en UI (validación) y se muestra clave `errors.http-400` si ocurre.
- i18n: ninguna (modelo/servicio).
- Historia: US-47 esc. 1, US-34.

### T4. Dashboard del distribuidor: KPIs del mes, litros y tendencia (US-47)
- Requiere T3 y T0. Modificar `dashboard.{ts,html,css}` solo para rol PROVIDER (el bloque comprador no cambia).
- Datos: `GET /analytics/providers/{providerId}?from=<primer día del mes Lima>&to=<hoy Lima>`.
- UI: tarjetas "Combustible total vendido (L)" (`totalFuelSoldLitres`) y "Pedidos pendientes" (`pendingOrders`), más los KPIs existentes (ingresos, pedidos, etc.); gráfico de tendencia (reutilizar `ng2-charts`/`chart.js` ya instalados, como `analytics.ts`) con selector Diario/Semanal/Mensual usando `groupSalesTrend`; accesos directos (esc. 2): "Pedidos activos" -> `/ordering/order-list` (o `/ordering/request-list`), "Reportes" -> `/analytics` (sin perder sesión).
- Estados: cargando, error con reintento, vacío ("Aún no hay ventas en el período": `salesTrend` vacío).
- Aceptación: cambiar la vista agrupa sin pedir de nuevo; los litros se rotulan como "venta comercial" (no volumen descargado) en un `hint`.
- i18n: `dashboard.provider.fuel-sold`, `dashboard.provider.pending`, `dashboard.provider.trend`, `dashboard.provider.view-day|week|month`, `dashboard.provider.no-sales`, `dashboard.provider.litres-hint`.
- Entrevista previa: SI (E-1).

### T5. Dominio e infraestructura de "Clientes y tanques" del distribuidor (sin UI)
- Crear en `equipment/`:
  - `domain/model/provider-equipment.entity.ts`: `ProviderBuyerCompany`, `ProviderSite`, `ProviderTank`, `ProviderTankDevice`, `ProviderTankReading` (campos de 2.1; unidades como `'LITRE' | 'GALLON'`).
  - `infrastructure/provider-equipment.api.ts`: `buyerCompanies()`, `registerBuyerCompany(body)`, `tanks(buyerCompanyId?)`, `registerTank(body)`, `updateTank(id, body)`, `readings(id, from?, to?)`, `episodes(id)` (reusar tipo `RefillEpisode`, ampliándolo aditivamente con los campos nuevos).
  - helper `unitKey(unit)` que mapee `LITRE|LITERS -> unit.liters` y `GALLON|GALLONS -> unit.gallons` (ya existe lógica equivalente inline en `tank-list.ts` y `request-detail.html`; centralizar solo para el código nuevo, sin refactorizar lo antiguo).
  - función `errorKey(e)`: `code` -> clave i18n (`DEVICEBINDING_CONFLICT -> equipment.provider.err-device-duplicate`, `BUYERCOMPANY_CONFLICT -> ...err-ruc-duplicate`, `PROVIDERBUYERLINK_CONFLICT -> ...err-already-linked`, `BUYERCOMPANY_NOT_FOUND`, `FUELPRODUCT_NOT_FOUND`, `TANK_NOT_FOUND`, `VALIDATION_ERROR -> errors.http-400`, otros -> `errors.http-<status>`).
- Aceptación: `ng build`; sin cambios de comportamiento visibles.
- Endpoints: N4, N5, N6, N7, N8, N9, N10.

### T6. Rutas, guards y navegación de "Clientes y tanques" (decisión roadmap sobre `/tanks`)
- Pendiente de la respuesta E-2 (misma URL con dos vistas por rol vs rutas separadas). Recomendación del plan: en `app.routes.ts`, `tanks` pasa a `canActivate: [authGuard, supportedRoleGuard]` y `equipment-routes.ts` usa dos ramas con `canMatch` por rol: PROVIDER -> vistas de distribuidor (T7-T11); BUYER -> `tank-list`/`tank-detail` actuales en SOLO LECTURA. Alternativa si Samuel prefiere separar: `/clients` con `providerGuard` y `/tanks` queda buyer.
- Layout: entrada de navegación `nav.clients` (rol PROVIDER) que apunte a la ruta de distribuidor; la entrada `nav.equipment` (BUYER) se mantiene.
- Archivos: `app.routes.ts`, `equipment-routes.ts`, `layout.ts`, i18n `nav.clients`.
- Aceptación: distribuidor entrando por la entrada de menú ve la vista de distribuidor (placeholder funcional mínimo hasta T7); comprador sigue viendo sus tanques; usuario sin rol => `/access-denied`.
- Entrevista previa: SI (E-2).

### T7. Listado de compradores (US-31)
- Crear `equipment/presentation/views/provider-clients/provider-clients.{ts,html,css}` + `application/provider-equipment.store.ts` (signals: `buyers`, `loading`, `error`).
- Endpoint: N4.
- UI: nombre, pedidos activos (`activeOrderCount`), total histórico (`historicalOrderCount`), tanques (`tankCount`) y crítico (`criticalTankCount` con chip/aviso), número de sitios; filtro por nombre (sin RUC: no viene en el recurso, ver 1.4-5); botón "Registrar comprador" (T8); fila -> detalle (T9).
- Estados: cargando; vacío con mensaje "No hay empresas disponibles" (esc. 2 de US-31) y CTA a registrar; error con reintento.
- i18n: `equipment.provider.clients.*`.
- Aceptación: US-31 esc. 1 y 2.

### T8. Alta/vínculo de comprador antes del primer pedido
- Crear `equipment/presentation/views/provider-buyer-form/*` (formulario reactivo: `name`, `ruc` 11 dígitos, `sector`, `address`, `contactEmail`, `phone`, `siteName`). Ruta hija dentro de T6.
- Endpoint: N5 (modo nuevo). El modo `{buyerCompanyId}` NO se expone en UI hasta resolver D2 (el distribuidor no puede obtener ese id).
- Errores: 400 (campos), 403, 409 `BUYERCOMPANY_CONFLICT` (mostrar "RUC ya registrado; contacte soporte para vincularlo" hasta resolver D2), 404.
- Al 201: volver al listado y resaltar el comprador creado; ofrecer "Asociar tanque" (T10).
- Aceptación: crear comprador sin pedidos previos y verlo en la lista con 0 tanques y 1 sitio; no se envía contraseña ni se promete acceso del comprador.
- i18n: `equipment.provider.buyer-form.*` incluyendo mensajes de validación.
- Entrevista previa: SI (E-3).

### T9. Detalle de comprador (US-32)
- Crear `provider-client-detail.*`; ruta `:buyerId`. Datos: N4 (el comprador y sus `sites`), N6 con `buyerCompanyId`, `GET /fuel-orders/provider/{id}` filtrado por `companyId === buyerId` (cantidades/fechas: `requestedQuantity`, `scheduledDate`, `status`), inbox filtrado por `organizationId` si no es null.
- UI: cabecera (nombre, sitios con dirección), tanques con barra de nivel, `lowLevelPercent` y badge crítico, dispositivos (`deviceId`/`channel`), lista de pedidos del comprador; botones "Asociar tanque" (T10) y "Editar" por tanque (T11).
- Estados: sin pedidos => "No hay historial disponible" (US-32 esc. 2); cargando por sección; error por sección con reintento (un fallo de pedidos no oculta los tanques).
- i18n: `equipment.provider.detail.*`.
- Nota: las entregas del comprador pueden filtrarse con N1 por `buyerCompanyId` (opcional, solo si no complica la tarea).
- Entrevista previa: SI (E-3).

### T10. Asociar tanque y dispositivo IoT (US-51)
- Crear `provider-tank-form.*` (modo crear). Selects: sitio (de `sites[]` -> `siteId` y `customerAccountId` salen del mismo objeto), producto (`GET /fuel-products/provider/{providerId}` filtrando `active`, ya en `InventoryApi.getProductsByProvider`), unidad `LITRE|GALLON`.
- Campos: nombre, producto, capacidad, unidad, nivel inicial (<= capacidad), umbral `lowLevelPercent` (>0 y <=90; rótulo "histéresis inicial 10 puntos" informativo), `deviceId` (<=120), `channel` (<=60, sugerir "level"), checkbox generación automática (por defecto activo).
- Endpoint: N7.
- Errores: 409 `DEVICEBINDING_CONFLICT` => mensaje "El dispositivo ya está asociado a otro tanque" (US-51 esc. 2); si `details` contiene `tank <n>` mostrar el número como pista, sin depender de ello; 404 producto/comprador; 400 validaciones; 403.
- Aceptación: US-51 esc. 1 (asociación guardada y umbral visible) y esc. 2 (duplicado rechazado con mensaje). Leyenda visible: "La asociación no emite credenciales; el hardware necesita su token técnico ya provisionado" (hardware fuera de alcance).
- i18n: `equipment.provider.tank-form.*`, `equipment.provider.err-*`.
- Entrevista previa: SI (E-3).

### T11. Editar umbral, producto y dispositivo del tanque
- Reusar `provider-tank-form.*` en modo editar (campos: producto, umbral, dispositivo+canal; el resto en solo lectura).
- Endpoint: N8. Enviar solo campos modificados; `deviceId` y `channel` siempre juntos.
- Aceptación: cambiar el umbral refleja `critical`/`levelPercent` al recargar; cambiar dispositivo conserva historial (mensaje informativo); 409 y 404 manejados.
- i18n: reutiliza claves de T10 + `equipment.provider.tank-form.edit-title`.

### T12. Detalle de tanque del distribuidor: nivel, última lectura y episodios (US-52, US-32)
- Crear `provider-tank-detail.*`; ruta `tank/:id` (dentro de la rama de distribuidor).
- Endpoints: N6 (tanque), N9 (últimas lecturas; por defecto últimas 48 h con `from`), N10 (episodios).
- UI: barra de nivel (mock 5.7a: barra vertical con línea del umbral `lowLevelPercent`), última lectura con antigüedad calculada desde `capturedAt` (p. ej. "hace 12 min") y calidad, listado de lecturas (nivel vs tiempo; tabla o gráfico simple con `chart.js`), episodios de reposición (estado, apertura, volumen, `requestEmitted`, enlace a `/ordering/request-detail/:requestId` si hay `requestId`).
- Estados: `[]` de lecturas => "Sin lecturas del dispositivo" (distinto de error); 404 de episodios (cuerpo vacío) => mensaje genérico; cada sección carga y falla de forma independiente.
- i18n: `equipment.provider.tank-detail.*`.
- Entrevista previa: SI (E-4).

### T13. Recomendación de conductor y cisterna en la asignación (US-49)
- Modificar `ordering/presentation/views/order-detail/order-detail.{ts,html}` (flujo de asignación existente; no mover de lugar).
- Al abrir la asignación (`openAssignment`): llamar N2 con `orderId` (y ventana si ya fue ingresada). Si `recommended`: preseleccionar `driverId`/`tankerId` en los selects de elegibles existentes y mostrar resumen (conductor, placa, capacidad vs volumen requerido, criterio); la ventana ya viene (`windowStart`/`windowEnd`) para precargar los inputs. Si `!recommended`: mostrar el motivo traducido (`NO_ELIGIBLE_DRIVER`, `NO_SUFFICIENT_ELIGIBLE_TANKER`, `RESERVATION_CONFLICT`) y mantener selección manual. Recalcular cuando cambie la ventana.
- Mantener el override manual y la confirmación; `POST /deliveries` revalida disponibilidad (409 con su mensaje existente `fulfillment.assignment-failed`).
- Errores N2: 409 `ORDER_CONFLICT` (solicitud no aceptada/ya asignada) => ocultar recomendación con aviso; 404; 400 de ventana.
- Aceptación: US-49 esc. 1 (asignación con recursos recomendados y entrega en estado ASSIGNED) y esc. 2 (conflicto visible, no se completa). Aclarar en UI que la recomendación no considera compatibilidad de producto ni ruta.
- i18n: `fulfillment.recommendation.*`, `fulfillment.recommendation.reason.<CODE>`.
- Entrevista previa: SI (E-5).

### T14. Observaciones de válvula en el detalle de entrega (US-53)
- Modificar `delivery-detail.{ts,html}`: nueva sección con N3 (carga junto con `reload()`).
- UI: lista cronológica (estado OPEN/CLOSED, `recordedAt`, `commandId` si existe); badge de alerta "Apertura no autorizada" cuando `unauthorized`; estado vacío "Sin observaciones registradas" (NO mostrar "Cerrada"); leyenda "Estado lógico, no físico".
- Aceptación: US-53 esc. 2 (alerta visible ante apertura no autorizada); 404/403 muestran error de sección sin romper el resto del detalle.
- i18n: `fulfillment.valve.*`.

### T15. Nivel del tanque asociado en el detalle de entrega (US-52)
- Modificar `delivery-detail`: cadena `delivery.orderId -> order.requestId (GET /fuel-orders/{id}) -> request.tankId (GET /replenishment-requests/{id}) -> N9 readings`. Mostrar último nivel y antigüedad junto al bloque de tracking existente; si falta algún eslabón (`requestId` o `tankId` null, 404) ocultar la sección sin error.
- Aceptación: US-52 esc. 1 parcial (último dato + antigüedad + ubicación ya existente). Esc. 2 (sincronización de eventos pendientes) no se valida desde frontend.
- i18n: `fulfillment.tank-level.*`.

### T16. Panel del distribuidor: tanques críticos y entregas del día
- Requiere T0, T1, T5. Modificar `dashboard` (rol PROVIDER): sección "Tanques críticos" (N6 filtrado por `critical`, ordenar por `levelPercent` asc, enlace al detalle de tanque T12) y "Entregas del día" (N1 con `date` hoy Lima, enlace a `delivery-list`).
- Estados independientes por tarjeta (cargando/vacío/error).
- Aceptación: cap. 5.4.1 Panel (tanques críticos, solicitudes pendientes, entregas del día).
- i18n: `dashboard.provider.critical-tanks`, `dashboard.provider.today-deliveries`, vacíos.
- Entrevista previa: SI (E-1; la definición de "en observación" no existe en backend, ver D4).

### T17. Pantalla Pagos del distribuidor (SOLO si se resuelve D3)
- No ejecutar hasta confirmar la opción. Opción A (sin backend): derivar de `GET /fuel-orders/provider/{id}` + `GET /payments/order/{orderId}` por cada orden en estados PENDING_PAYMENT/PAID/IN_PROGRESS/DELIVERED (N+1 acotado, con paginación en cliente) y permitir `complete`/`refund` (el backend ya lo autoriza). Opción B (recomendada): pedir `GET /api/payments/provider/{providerId}` al backend.
- Ruta de proveedor separada de `/ordering/payment-history` (que sigue siendo `buyerGuard`).
- Aceptación: tabla por orden con estado, confirmar (`complete` con referencia) y reembolsar con diálogo de confirmación; maneja 409 de reembolso (R7).

### T18 (opcional P3, no abrir sin pedido): pulido ya listado en el roadmap
Resumen previo y cisternas deshabilitadas con motivo (mock 5.7b), `request-form` como contingencia, US-24, US-17. Cada uno con su propio commit y entrevista.

Orden de ejecución recomendado: T0 -> T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> (T17 según D3). Dependencias: T2<-T1; T4<-T0,T3; T7-T12<-T5,T6; T16<-T0,T1,T5,T12.

---

## 5. Entrevistas de UI previas con Samuel (AskUserQuestion, en español, antes de codificar)

- E-1 (T4, T16 Panel): disposición del panel (orden de tarjetas, gráfico arriba/abajo), granularidad por defecto del gráfico (diario/semanal/mensual), período por defecto (mes corriente), y definición de "tanque crítico" vs "en observación" (backend solo da `critical`; ¿"observación" = nivel <= umbral + X puntos?), cuántos críticos mostrar.
- E-2 (T6): ¿misma URL `/tanks` con vistas por rol (recomendado por roadmap) o `/clients` para distribuidor? ¿Qué ve exactamente el comprador (solo lectura: ¿se oculta crear sitio/tanque y política de reposición?). El backend aún permite al comprador crear tanques por `/api/tanks` y editar su política; la decisión del roadmap dice lectura.
- E-3 (T8, T9, T10, T11): flujo de alta (¿wizard comprador -> sitio -> tanque -> dispositivo o formularios separados?), campos obligatorios mostrados, dónde vive "Asociar tanque", copy de las leyendas de hardware/token, política de producto (¿permitir solo productos activos del catálogo?), tratamiento del 409 de RUC (ver D2).
- E-4 (T12): visualización de lecturas (tabla vs gráfico de línea), ventana por defecto (48 h), umbral de "dato antiguo" para marcar la lectura en ámbar (no definido por backend).
- E-5 (T13): ubicación del resumen de recomendación, si se autoselecciona o solo se sugiere con botón "Usar recomendación", y copy cuando no hay recomendación.
- E-6 (T2): columnas visibles y filtros por defecto de la lista de entregas (fecha = hoy vs todas).

---

## 6. Bloqueos, dudas abiertas y estado por ítem del roadmap

### 6.1 Desbloqueado por el backend actual
| Ítem roadmap | Tareas | Endpoint(s) |
|---|---|---|
| Lista de entregas / "Entregas de hoy" | T1, T2 | N1 |
| Dashboard US-47 (KPIs del mes, litros, tendencia) | T3, T4 | analytics ampliado |
| Dashboard US-47 (críticos, entregas del día, inbox) | T0, T16 | N6, N1, inbox |
| US-31 / US-32 compradores y tanques | T5, T7, T9, T12 | N4, N6, N10 |
| US-51 asociar tanque + dispositivo, alta de comprador vinculado | T8, T10, T11 | N5, N7, N8 |
| US-49 recomendación | T13 | N2 |
| US-52 lecturas de nivel | T12, T15 | N9 |
| US-53 válvula | T14 | N3 |
| Refill-episodes del proveedor | T12 | N10 |
| Guards `/tanks` y pagos | T6 (tanks); T17 (pagos, condicionado) | - |

### 6.2 Sigue bloqueado
| Ítem | Motivo verificado |
|---|---|
| US-54 alertas de operación | Sin endpoint de alertas ni acuse. Solo hay notificaciones (`/me/notifications`) y `unauthorized` en válvula. |
| US-55 expediente de entrega | Sin endpoint de expediente. Hay `GET /deliveries/{id}`, `/transitions`, `/timeline`, `/tracking`, `/valve-observations` que podrían ensamblar una vista parcial; no hay recepción/firma ni conciliación. Decisión pendiente (D5). |
| US-35 PDF / US-14 | Backend sin generación de PDF; hoy `window.print`. |
| US-48 distribución por sector | `ProviderBuyerCompanyResource` y analytics no traen `sector`; imposible sin backend. |
| `environment.prod` | Sin deploy en Render. |
| US-49 compatibilidad cisterna/producto y ruta | El modelo no las tiene; la UI no debe sugerirlas. |
| US-51 hardware/token | Fuera de alcance: la asociación no emite credencial; el dispositivo necesita `X-Device-Token` provisionado aparte. |
| Vista de entregas para el comprador | Todos los endpoints de entrega son solo proveedor. |

### 6.3 Dudas abiertas
- D1. Commits del encargo con hashes inexistentes: ¿se hizo rebase/reescritura en el backend? Los contratos se verificaron contra `HEAD 99d0f0f`. Revalidar si el backend cambia de nuevo.
- D2. Vincular un comprador YA registrado: el POST nuevo falla por RUC duplicado (409) y el modo `{buyerCompanyId}` exige un id que el distribuidor no puede consultar (`GET /api/buyer-companies` es solo ADMIN). Además no se verificó qué ocurre si el comprador se auto-registra después con el mismo RUC. Pedir al backend un buscador por RUC o devolver `buyerCompanyId` en el 409.
- D3. Pagos del distribuidor: no hay listado por proveedor. ¿Opción A (N+1 desde órdenes) o pedir endpoint?
- D4. "En observación": sin umbral definido por backend; decidir regla de UI.
- D5. US-55: ¿se arma un expediente parcial con los endpoints existentes o se espera backend?
- D6. Pruebas: `ng test` no corre según roadmap; `node_modules` ya trae `vitest` y `jsdom` sin declararse en `package.json` y `package-lock.json` está modificado y sin commitear. No instalar ni editar dependencias sin preguntar. Hasta confirmar, validar con `ng build` y revisión manual.
- D7. Stores: el patrón actual mezcla signals en stores `providedIn: 'root'` (fulfillment, ordering) y stores por componente (`providers: [EquipmentStore]`). Para el equipo del distribuidor se propone un store por componente (como `EquipmentStore`) para evitar estado obsoleto entre usuarios; confirmar.
- D8. Valores no verificados: dominio completo de `levelSource`, `quality` de lecturas y `status` de episodios más allá de los observados (`MANUAL`, `VALIDATED`, `ACCEPTED`, `OPEN`); tratar como `string` y mostrar el valor crudo con clave i18n por defecto.
- D9. Migración V38 entregada como código; el backend declara que NO se corrió contra MySQL real (solo H2). Los endpoints de proveedor pueden fallar en un entorno MySQL hasta validarla.
- D10. Mensajes del backend se localizan con `Accept-Language`; el frontend manda `en`/`es` según el idioma activo. El `details` de algunos errores está en inglés fijo: no mostrarlo directamente.

---

## 7. Checklist de cierre de la tanda
- [ ] `ng build` pasa tras cada tarea; ningún warning nuevo de templates.
- [ ] i18n ES y EN con las mismas claves en cada commit.
- [ ] Cada pantalla nueva: carga, vacío, error con reintento, `null` tolerado.
- [ ] Guards: rutas de distribuidor con `providerGuard`; ninguna ruta nueva abierta a comprador/admin.
- [ ] Ningún `providerId`/`organizationId` enviado para ampliar acceso (el backend los ignora o los rechaza).
- [ ] Validación contra las historias (US-31, 32, 47, 49, 51, 52 parcial, 53) y la matriz de pantallas de cap. 5 antes de dar por terminado.
- [ ] ROADMAP actualizado (checkboxes) solo al final de la tanda y solo para lo verificado.
