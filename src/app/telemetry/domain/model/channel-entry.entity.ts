/** Lectura publicada por el ESP32 en `<tópico>/datos`, ya validada. Las claves del payload llegan en español. */
export interface TankReading {
  boot: number | null;
  seq: number | null;
  uptime: number | null;
  distance: number;
  level: number | null;
  rssi: number | null;
  alarm: 0 | 1 | null;
  status: string;
}

/** Lectura aceptada y guardada en el historial local del canal. */
export interface ChannelEntry extends Omit<TankReading, 'distance'> {
  entryId: number;
  createdAt: string;
  /** Conexión del monitor al broker en la que llegó la lectura. */
  session: number;
  distance: number | null;
}

export type ChannelField = 'distance' | 'level' | 'rssi' | 'alarm';
export type BrokerState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';
export type DeviceState = 'unknown' | 'online' | 'offline';
