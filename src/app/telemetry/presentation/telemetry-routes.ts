import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const telemetryRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: '', loadComponent: () => import('./views/mqtt-monitor/mqtt-monitor').then((m) => m.MqttMonitor) },
  ],
}];
