# Spec: cerrar huecos entre frontend y backend (sin ADMIN)

Estado: listo para agente. Fecha: 2026-09-28. Fuente: auditoría de 3 subagentes (swagger vía snapshot, backend→front, front→backend). Una 4.ª verificación con `playwright-cli` está en curso y puede confirmar o refutar los hallazgos marcados "por verificar".

## Problem Statement

Como equipo integrando el frontend Angular contra el backend real de FullTank/PrimeFuel, hoy el usuario final (comprador o distribuidor) se encuentra con: un conductor que vuelve a "disponible" al editarlo, claves de traducción crudas en pantalla, una entrega inalcanzable después de asignarla, un menú que lleva a "acceso denegado", errores del backend que se muestran como texto genérico, y varias funciones del backend (pagos, invitaciones, onboarding) sin ninguna pantalla. Además, algunas necesidades no se pueden resolver en el front porque el backend no expone el endpoint.

## Solution

Cerrar, por etapas y de la más dañina a la menos, los huecos del frontend detectados; dejar explícitamente marcados como "bloqueado por backend" los que dependen de endpoints inexistentes, sin simularlos; y verificar cada etapa en el navegador y con `npm run build`.

## User Stories

### Integridad de datos y flujos rotos (etapa 1)
1. Como distribuidor, quiero editar los datos de un conductor sin que su estado vuelva a "disponible", para no asignar a alguien suspendido o no apto.
2. Como distribuidor, quiero poder poner un conductor en estado suspendido y una cisterna en mantenimiento o suspendida, para reflejar su disponibilidad real.
3. Como usuario, quiero ver los estados de conductor, cisterna, pago y entrega con texto traducido, para no leer claves técnicas.
4. Como usuario, quiero que las 15 clases de notificación tengan etiqueta traducida y ícono coherente, para entender qué pasó.
5. Como usuario, quiero que una notificación me lleve a la solicitud, orden, entrega o pago al que se refiere, para actuar sobre ella.
6. Como distribuidor, quiero llegar al detalle de una entrega ya creada desde la orden o desde una notificación, para arrancar, llegar, completar, fallar o cancelar después de asignarla.
7. Como distribuidor, quiero ver un estado de carga, vacío o error cuando el detalle de entrega no se puede cargar, para no ver una pantalla en blanco.
8. Como distribuidor, no quiero ver la opción "Crear solicitud" en el menú, para no caer en "acceso denegado".
9. Como visitante con cuenta, quiero un enlace visible a iniciar sesión en la landing, para entrar sin conocer la URL.
10. Como equipo, quiero definir la URL del backend de producción en el entorno de producción, para que el build desplegado funcione.
11. Como usuario, quiero que los mensajes de error de órdenes y solicitudes se traduzcan, para no ver claves como `ordering.request-failed`.

### Errores y estados (etapa 2)
12. Como usuario, quiero un mensaje claro cuando el backend responde 403, 404, 409 o 401 con cuerpo vacío, para saber qué pasó.
13. Como usuario, quiero ver qué campo falló cuando el backend responde 400 con detalles, para corregirlo.
14. Como usuario, quiero que los errores del backend salgan en el idioma de la interfaz, para no mezclar idiomas.
15. Como usuario, quiero que el idioma elegido se recuerde entre visitas, y que la app no arranque siempre en inglés.
16. Como usuario, quiero que los mensajes de éxito y error de un módulo no reaparezcan en otra pantalla, para no ver avisos viejos.
17. Como usuario, quiero confirmación antes de borrar un producto o desactivar una cisterna o conductor, para evitar errores.
18. Como usuario, quiero que un formulario que falla conserve lo que escribí, para no perderlo (clientes, sitios y tanques).
19. Como usuario, quiero mensajes de validación por campo en los formularios de producto, solicitud, conductor y cisterna.
20. Como usuario, quiero que el botón de login y de restablecer contraseña se deshabilite mientras se envía, para evitar doble envío.

### Campos y contratos (etapa 3)
21. Como comprador, quiero que la solicitud exija dirección de entrega o me avise de que se tomará la de la sede, para evitar el 409 al aceptar.
22. Como comprador, quiero elegir el tanque como opcional, como permite el backend.
23. Como comprador, quiero ver en mis solicitudes el proveedor, producto (por nombre), precio unitario, dirección y enlace a la orden generada.
24. Como usuario, quiero ver nombres de empresa, proveedor y producto en órdenes, no solo IDs.
25. Como comprador, quiero ver el pago de una orden ya pagada, con monto y fecha, no solo cuando está pendiente.
26. Como usuario, quiero filtrar órdenes por todos los estados, incluidos en curso y entregada, y que el dashboard sume todos.
27. Como distribuidor, quiero ver en el detalle de entrega el conductor, cisterna, volúmenes solicitado y entregado, y las marcas de tiempo.
28. Como distribuidor, quiero ver en el tracking la precisión, el hito de carga y el volumen, y una ubicación en mapa si es viable.
29. Como comprador, quiero elegir unidad y tipo de combustible del tanque desde listas, para que coincidan con producto y solicitud.
30. Como comprador, quiero elegir distribuidor y producto de la política de reposición desde listas, y que se validen las reglas cruzadas de umbrales.
31. Como distribuidor, quiero seleccionar los tipos de combustible que ofrezco desde una lista al registrarme y en el perfil.
32. Como usuario, quiero que los formularios respeten los máximos de longitud del backend, para no recibir un 400 tardío.
33. Como usuario, quiero que la geocerca valide latitud y longitud, para no enviar coordenadas imposibles.
34. Como proveedor, no quiero poder editar mi propia calificación, si el backend no lo pretende.

### Funciones sin pantalla (etapa 4)
35. Como comprador, quiero ver el historial de mis pagos.
36. Como comprador, quiero solicitar el reembolso de un pago, si el backend lo permite para mi rol.
37. Como miembro de una organización, quiero invitar a otros miembros por correo, y revocar invitaciones.
38. Como invitado, quiero aceptar una invitación con mi token.
39. Como usuario autenticado, quiero registrar una organización (onboarding) y elegir mi organización activa cuando pertenezco a varias.
40. Como distribuidor, quiero consultar la elegibilidad de una cisterna, igual que la del conductor.
41. Como usuario, quiero ver el detalle de una solicitud individual.

### Bloqueado por backend (no simular)
42. Como distribuidor, quiero una bandeja de solicitudes entrantes (B1).
43. Como distribuidor, quiero un listado de entregas y `deliveryId` en la orden (B2).
44. Como comprador, quiero seguir mi entrega (B4).
45. Como usuario, quiero un endpoint para conocer mi perfil (B5).
46. Como comprador, quiero vincular un sensor a mi tanque, y ver ventas por sector (B6).
47. Como conductor, quiero registrar evidencia de transporte y observaciones de válvula (falta rol y app de conductor).

## Implementation Decisions

- Orden de ejecución: etapa 1, luego 2, 3 y 4. Cada etapa termina en estado que compila y se puede recorrer. No mezclar etapas.
- Los huecos de la sección "Bloqueado por backend" NO se implementan ni se simulan con datos falsos. Donde ya hay un workaround (aceptar o rechazar por ID), se conserva, y se documenta en la pantalla.
- Reutilizar Angular Material y los patrones de módulos existentes (por contexto delimitado, con stores de signals). No crear abstracciones nuevas. Borrar el código muerto que se toque (endpoints y assemblers sin uso, claves i18n huérfanas), sin refactors extra.
- El estado del conductor debe enviarse siempre en la edición para no depender del valor por defecto del backend.
- Los estados y tipos que llegan del backend se traducen mediante claves i18n, con paridad exacta entre inglés y español. Los tipos del frontend deben coincidir con los enums del backend (sin valores fantasma).
- Manejo de errores: una sola vía común que mira el estado HTTP y el cuerpo `{code, message, details}`, tolera cuerpo vacío y traduce. Enviar `Accept-Language` según el idioma activo.
- Idioma: inicial según preferencia guardada, con respaldo razonable, y persistir la elección.
- Contrato de entrega: usar el estado físico y los campos reales de la respuesta del backend, no el modelo antiguo.
- El acceso a la entrega solo se puede resolver hoy desde la asignación, la orden (si el backend añade `deliveryId`) y las notificaciones con referencia. Si la referencia no basta, se deja como bloqueado por backend.
- La configuración de producción del backend requiere la URL desplegada (Render); pedirla al usuario, no inventarla.
- Los endpoints y roles se toman del contrato real: base `/api`, sin `/v1` ni `/v2`. Verificar contra el snapshot del contrato antes de fijar rutas.
- La decisión sobre panel ADMIN queda fuera: la construye otro flujo.

## Testing Decisions

- Un solo seam: recorrido en el navegador con `playwright-cli` contra `localhost:4200` y el backend real, más `npm run build` sin errores (solo se acepta el aviso conocido de presupuesto del bundle inicial).
- Un buen test observa comportamiento externo: lo que se ve y se puede hacer por rol (texto traducido, navegación, estado tras una acción), no la estructura interna.
- Por etapa, recorrer BUYER y PROVIDER con cuentas de prueba en el backend local y adjuntar captura o salida como evidencia. Nada se da por terminado sin build corrido y salida mostrada.
- No se arregla `ng test` en este spec (falta vitest; instalarlo requiere pedir permiso). Los 7 specs existentes no se ejecutan hoy.

## Out of Scope

- Todo lo ADMIN.
- Cambios de backend, incluida la bandeja del distribuidor, el listado de entregas, el tracking para comprador, `GET /me`, la vinculación de dispositivos y las ventas por sector.
- App del conductor y consumidor IoT (telemetría, evidencia de transporte, válvulas).
- El módulo legacy de equipos y la creación directa de órdenes.
- Reducir el bundle inicial y arreglar `ng test`.
- Abrir PRs.

## Further Notes

### Reglas de trabajo (obligatorias para el agente)
- **No hacer commits, ni push, ni PR, ni commits atómicos por su cuenta.** Trabaja solo sobre el árbol de trabajo. **Al final de todo el trabajo deja un único bloque de comandos de git** (`git add <rutas>` y `git commit -m "..."`, agrupados como sugerencia) para que Samuel lo ejecute. Nada a `main`.
- Modo ponytail: diff mínimo, sin abstracciones ni archivos extra, borrar código muerto.
- No instalar dependencias sin preguntar.
- No inventar datos: si el backend no responde o no tiene el dato, mostrar estado vacío o error real.
- UI no trivial: entrevistar antes con AskUserQuestion. Diseño con el skill `impeccable`.
- Trabajar poco a poco: una etapa a la vez, informando al terminar cada una, y esperando el visto bueno antes de la siguiente.

### Verificación interactiva (playwright-cli, 2026-09-28) — CORRIGE las tablas de arriba
- Swagger: NO está roto. La spec real está en `/api-docs` (no `/v3/api-docs`, que no existe y devuelve 500 por el manejador global). Es idéntica al snapshot (84 paths, 103 operaciones).
- Refutados (NO implementar): (1) el PUT de conductor NO resetea el estado (el form ya envía `status`); (3) el menú del PROVIDER NO muestra "Crear solicitud"; (5) `delivery-detail` NO queda en blanco (muestra alert "Could not load the delivery"); (9) el backend rechaza en la creación (400) una solicitud sin dirección, así que el 409 en accept no se alcanza por ahí. Sigue válido que el cliente no exige la dirección.
- Confirmados: sin bandeja del proveedor (B1); orden PAID sin su pago visible; 403/404 con cuerpo vacío y `details` del 400 no mostrados; `fuelType` y `unit` de tanques en texto libre (el backend acepta cualquier valor); política de reposición con IDs numéricos; entrega alcanzable solo tras asignar; estados de transición y timeline crudos.
- Ya corregidos en el árbol durante la prueba (verificar que no se reviertan): claves i18n de notificaciones, estados y `ordering.*`; enlace a login en la landing; idioma persistido en `fulltank.lang`.
- NUEVOS: N1 (ALTA, regresión activa) con la UI en inglés todo se ve como claves crudas (`home.title`...), en español bien; hipótesis: el cambio en el interceptor de auth inyecta `TranslateService` y crea dependencia circular con el loader HTTP. N2 `POST /drivers` con licencia duplicada devuelve 500 (restricción única global; es del backend). N3 la ventana de reserva de la asignación dice "(optional)" pero el backend exige inicio y fin. N4 el BUYER no tiene "Reportes" en el menú. N5 login muestra "User not found: <email>" en inglés y enumera usuarios. N7 columna "Request" de órdenes vacía (`requestId` null). N9 aceptar, rechazar y guardar política sin feedback. N10 título de edición de conductor dice "Register Driver". N11 `/access-denied` dice "sin rol soportado" a un BUYER o PROVIDER válido en ruta ajena. N12 no se generan notificaciones de entrega ni de pago (backend, solo ORDER_ACCEPTED).
- Pendiente de verificar en pantalla: fallo de entrega, cancelar orden o solicitud, botón "block" de conductores, elegibilidad, y el detalle del 400 tras el fix de `details`.

### Apéndice A — Tabla 1: endpoints sin cobertura completa (93 no-admin: 59 cubiertos, 14 parciales, 20 sin cobertura)

| Módulo | Endpoint | Estado | Tipo de hueco | Prio |
|---|---|---|---|---|
| Solicitudes | GET /replenishment-requests (proveedor) | Parcial | Backend (B1) | Alta |
| Solicitudes | POST .../{id}/accept, /reject | Parcial | Backend (B1): solo por ID tipeado | Alta |
| Solicitudes | GET /replenishment-requests/{id} | Sin pantalla | Front | Baja |
| Entregas | GET /deliveries/{id} | Parcial | Ambos (B2): sin lista ni deliveryId en la orden; usa 2 de 15 campos | Alta |
| Entregas | GET .../tracking | Parcial | Front: usa 4 de 15 campos, sin mapa | Media |
| Entregas | POST .../{id}/assign | Sin llamada | Front (legacy) | Baja |
| Evidencia de transporte | POST .../transport-evidence | Sin llamada | Front: falta rol y app de conductor | Media |
| Válvulas | POST .../valve-observations | Sin llamada | Front: flujo de conductor | Media |
| Pagos | POST /payments/{id}/refund | Sin llamada | Front | Media |
| Pagos | GET /payments/company/{id} | Sin llamada | Front: sin historial | Media |
| Pagos | GET /payments/{id} | Sin llamada | Front | Baja |
| Invitaciones | POST invitar, POST aceptar, DELETE revocar (3) | Sin llamada | Front | Media |
| Onboarding | POST /onboarding | Sin llamada | Front | Media |
| Mis organizaciones | GET /me/organizations | Parcial | Front: sin selector de organización activa | Media |
| Conductores | PUT /drivers/{id}, POST /drivers | Parcial | Front: el PUT no envía status y resetea a AVAILABLE (bug de datos) | Alta |
| Cisternas | PUT /tankers/{id} | Parcial | Front: sin input de status | Baja |
| Cisternas | GET /tankers/{id}/eligibility | Sin llamada | Front | Baja |
| Política de reposición | PUT y GET refill-policy | Parcial | Front: providerId y productId crudos, sin regla cruzada | Media |
| Reposición | GET .../refill-episodes | Parcial | Front: subconjunto | Baja |
| Notificaciones | GET /me/notifications, /unread | Parcial | Front: 9 de 15 tipos sin traducción | Alta |
| Analítica | GET /analytics/providers/{id}, /buyers/{id} | Parcial | Front: ignora providerId | Baja |
| Órdenes | POST /fuel-orders | Sin llamada | Ambos (las órdenes nacen del accept) | Baja |
| Equipos legacy | 4 endpoints de /equipment | Sin llamada | Front (sustituido por tanks) | Baja |
| Compañías | POST /buyer-companies, POST /provider-companies | Sin llamada | Front (se usa sign-up) | Baja |
| Telemetría | POST /telemetry/readings | Sin llamada | Dispositivo IoT | Baja |

### Apéndice B — Tabla 2: módulos completos sin cobertura

| Módulo | Endpoints | Nota |
|---|---|---|
| Invitaciones | 3 | Sin vista |
| Onboarding | 1 | Sin vista |
| Reembolso e historial de pagos | 3 | Sin vista |
| Conductor: evidencia y válvulas | 2 | No existe rol ni app de conductor |
| Equipos legacy | 4 | Sustituido por tanks |
| Telemetría | 1 | Es para el dispositivo |
| Vinculación de dispositivos IoT | 0 | No existe en el backend (B6) |
| Ventas por sector | 0 | No existe en el backend (B6) |

### Apéndice C — Tabla 3: campos y contratos

| Área | Hueco | Tipo | Prio |
|---|---|---|---|
| Notificaciones | NotificationType del front declara 4 tipos, el backend 15. Faltan 9 claves (new_request, request_pending, order_confirmed, order_cancelled, delivery_dispatched, payment_received, payment_completed, payment_refunded, general) y sobran 7 | Front | Alta |
| Notificaciones | referenceId se rotula siempre "Orden" y no enlaza | Front | Media |
| Cisternas y conductores | Faltan claves suspended e inactive (tanker) y suspended (driver). ON_LEAVE del front no existe en el backend. SUSPENDED y MAINTENANCE no se pueden fijar | Front | Alta |
| Entregas | 13 campos de DeliveryResource ignorados; physicalState crudo | Front | Media |
| Entregas | Modelos Delivery, assembler y response con contrato antiguo | Front (código muerto) | Baja |
| Solicitudes | deliveryAddress opcional en el front, y accept responde 409 si falta dirección o fecha | Ambos | Alta |
| Solicitudes | tankId obligatorio en el front, opcional en el backend; proveedor, precio, orden y producto sin mostrar o crudos | Front | Media |
| Órdenes | Filtro y dashboard omiten IN_PROGRESS y DELIVERED; solo IDs sin nombres | Front | Media |
| Pagos | PaymentStatus crudo; una orden PAID no muestra su pago | Front | Media |
| Tanques | fuelType y unit texto libre (L frente a LITERS/GALLONS); Unit.fromCode mapea a LITRE en silencio | Ambos | Media |
| Registro | fuelTypesOffered en texto libre; contactEmail copiado de username | Front | Media |
| Proveedor | rating reenviado en el PUT y autoeditable | Ambos | Media |
| Geocerca | Sin rango de latitud y longitud; solo existe POST | Ambos | Baja |
| Longitudes | Sin maxLength en conductor (80/60/30/160), cisterna (20/80), sign-up (100/120), solicitud (255) | Front | Baja |

### Apéndice D — Tabla 4: errores, navegación, i18n y código muerto

| Área | Hueco | Prio |
|---|---|---|
| Producción | serverBasePath de producción con TODO; el build de producción queda sin backend | Alta |
| Errores | 403/404 con cuerpo vacío muestran un genérico; details del 400 no se usa | Alta |
| Errores | Claves ordering.missing-organization y ordering.request-failed inexistentes; mensaje de error del detalle de orden sin traducir | Alta |
| Entregas | Si GET /deliveries/{id} falla, pantalla en blanco | Alta |
| Navegación | Menú "Crear solicitud" visible al proveedor y lleva a acceso denegado | Alta |
| Navegación | Landing sin enlace a /login (por verificar en pantalla) | Alta |
| Navegación | /about sin enlace en ningún menú | Baja |
| Buyer | Sin tracking ni detalle de entrega (B4, backend) | Media |
| Idioma | Inicial fijo en inglés, no persiste; sin Accept-Language | Media |
| Idioma | Fallbacks por estado, títulos de ruta y mensajes de stores en inglés fijo | Media |
| Inventario | Error no se limpia entre acciones; borrar producto sin confirmación | Media |
| Tanques | Formularios de cliente, sitio y tanque se resetean aunque el POST falle | Media |
| Formularios | Sin mensajes de error por campo en solicitud y producto; sin feedback de éxito | Media |
| Sesión | No se comprueba la expiración del JWT al arrancar | Baja |
| Accesibilidad | Ítems del menú son div con click, sin rol ni tabindex | Baja |
| Código muerto | Endpoints, assemblers y responses sin uso en ordering y fulfillment; métodos heredados hacia rutas inexistentes; claves i18n huérfanas | Baja |

### Apéndice E — Brechas de backend conocidas (todas vigentes)

| # | Brecha | Tipo |
|---|---|---|
| B1 | El PROVIDER no puede listar solicitudes entrantes | Backend |
| B2 | Sin listado de entregas ni deliveryId en la orden | Ambos |
| B3 | Clientes, sitios y tanques viven en la organización del comprador | Por diseño |
| B4 | El BUYER no tiene entregas ni tracking | Backend |
| B5 | No hay GET /api/me | Backend |
| B6 | Sin vínculo de dispositivos ni ventas por sector | Backend |
