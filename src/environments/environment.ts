import { mapbox } from './mapbox';
export const environment = {
  mapbox,
  production: true,

  // Base API URL
  serverBasePath: 'https://fulltank-backend.onrender.com/api',
  // Ordering (Solicitudes y Órdenes)
  orderingRequestsEndpointPath: '/replenishment-requests',
  orderingOrdersEndpointPath: '/fuel-orders',
  // Fulfillment (Entregas)
  fulfillmentDeliveriesEndpointPath: '/deliveries',
};
