import { EventEmitter } from 'node:events';

// lifx-lan-client ships as CommonJS. The typings it ships are mostly `any`,
// so we keep its shapes loose and add our own helpers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lifx = require('lifx-lan-client');

import type { HSBK } from './types';

interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface LightInfo {
  id: string;
  address: string;
  label: string;
  productId: number;
  productName?: string;
  vendorName?: string;
  firmwareWifi?: string;
  firmwareBle?: string;
  isMultiZone: boolean;
  power: boolean;
  color: HSBK;
}

// LIFX products.json, multizone=true only. Linear strips/beams.
// Matrix devices (Tile, Tube, Candle) are NOT multizone; they use
// SetTileEffect and route through the `bulb` driver today since the
// standard light capabilities map cleanly via SetColor.
const MULTIZONE_PRODUCT_IDS = new Set<number>([
  31,
  32, // LIFX Z (original + v2)
  38, // LIFX Beam
  117,
  118, // LIFX Z US/Intl
  119,
  120, // LIFX Beam US/Intl
  141,
  142, // LIFX Neon US/Intl
  143,
  144, // LIFX String US/Intl
  161,
  162, // LIFX Outdoor Neon US/Intl
  203,
  204, // LIFX String US/Intl (newer)
  205,
  206, // LIFX Indoor Neon US/Intl
  213,
  214, // LIFX Permanent Outdoor US/Intl
]);

export class LifxClient extends EventEmitter {
  private logger: Logger;
  private client: any;
  private manualIps: Set<string>;
  private started = false;

  constructor(logger: Logger, manualIps: string[] = []) {
    super();
    this.logger = logger;
    this.manualIps = new Set(manualIps);
    this.client = new Lifx.Client();

    this.client.on('light-new', (light: any) => {
      this.logger.log(`lifx: discovered ${light.id} @ ${light.address}`);
      this.emit('light-new', light.id);
    });
    this.client.on('light-online', (light: any) => this.emit('light-online', light.id));
    this.client.on('light-offline', (light: any) => this.emit('light-offline', light.id));
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    return new Promise((resolve) => {
      this.client.init({ lights: [...this.manualIps] }, () => {
        this.logger.log(`lifx client started (manual IPs: ${this.manualIps.size})`);
        resolve();
      });
    });
  }

  stop(): void {
    try {
      this.client.destroy();
    } catch {
      // ignore
    }
    this.started = false;
  }

  addManualIp(ip: string): void {
    if (this.manualIps.has(ip)) return;
    this.manualIps.add(ip);
    try {
      this.client.startDiscovery([...this.manualIps]);
    } catch (err) {
      this.logger.error('lifx: failed to update manual IP list:', err);
    }
  }

  removeManualIp(ip: string): void {
    this.manualIps.delete(ip);
  }

  getManualIps(): string[] {
    return [...this.manualIps];
  }

  getLight(id: string): any {
    const light = this.client.light(id);
    return light === false ? null : light;
  }

  getAllLights(): any[] {
    // client.lights('') returns the raw `this.devices` object keyed by id,
    // not an array. Flatten it so callers can .find() / iterate consistently.
    const raw = this.client.lights('');
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    return [];
  }

  async identify(ip: string, timeoutMs = 4000): Promise<LightInfo> {
    this.addManualIp(ip);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const light = this.getAllLights().find((l: any) => l.address === ip);
      if (light) {
        try {
          return await this.collectInfo(light);
        } catch {
          // not ready yet
        }
      }
      await sleep(200);
    }
    throw new Error(`No LIFX bulb responded at ${ip} within ${timeoutMs}ms`);
  }

  async collectInfo(light: any): Promise<LightInfo> {
    const state = await promisify1<LightState>((cb) => light.getState(cb));
    const hw = await promisify1<HardwareVersion>((cb) => light.getHardwareVersion(cb));

    // Firmware queries can fail silently on older firmware — non-fatal.
    let firmwareWifi: string | undefined;
    let firmwareBle: string | undefined;
    try {
      const wifi = await promisify1<FirmwareVersion>((cb) => light.getFirmwareVersion(cb));
      firmwareWifi = formatFirmware(wifi);
    } catch {
      // ignore
    }
    try {
      const fw = await promisify1<FirmwareVersion>((cb) => light.getFirmwareInfo(cb));
      firmwareBle = formatFirmware(fw);
    } catch {
      // ignore
    }

    return {
      id: light.id,
      address: light.address,
      label: state.label || `LIFX ${String(light.id).slice(-6)}`,
      productId: hw.productId,
      productName: hw.productName,
      vendorName: hw.vendorName,
      firmwareWifi,
      firmwareBle,
      isMultiZone: MULTIZONE_PRODUCT_IDS.has(hw.productId),
      power: state.power > 0,
      color: normalizeColor(state.color),
    };
  }

  async getInfo(id: string): Promise<LightInfo> {
    const light = this.mustGet(id);
    return this.collectInfo(light);
  }

  async setPower(id: string, on: boolean, durationMs = 0): Promise<void> {
    const light = this.mustGet(id);
    await promisifyVoid((cb) => (on ? light.on(durationMs, cb) : light.off(durationMs, cb)));
  }

  async setColor(id: string, hsbk: HSBK, durationMs = 0): Promise<void> {
    const light = this.mustGet(id);
    await promisifyVoid((cb) =>
      light.color(hsbk.hue, hsbk.saturation, hsbk.brightness, hsbk.kelvin, durationMs, cb),
    );
  }

  async setColorZones(
    id: string,
    start: number,
    end: number,
    hsbk: HSBK,
    durationMs = 0,
    apply = true,
  ): Promise<void> {
    const light = this.mustGet(id);
    await promisifyVoid((cb) =>
      light.colorZones(
        start,
        end,
        hsbk.hue,
        hsbk.saturation,
        hsbk.brightness,
        hsbk.kelvin,
        durationMs,
        apply,
        cb,
      ),
    );
  }

  async getColorZones(id: string): Promise<HSBK[]> {
    const light = this.mustGet(id);
    const result = await promisify1<any>((cb) => light.getColorZones(0, 255, cb));
    const zones = result?.zones ?? result?.colors ?? [];
    return zones.map((z: any) => normalizeColor(z));
  }

  async setMultiZoneEffect(
    id: string,
    effect: 'MOVE' | 'OFF',
    speedMs: number,
    direction: 'TOWARDS' | 'AWAY',
  ): Promise<void> {
    const light = this.mustGet(id);
    await promisifyVoid((cb) => light.setMultiZoneEffect(effect, speedMs, direction, cb));
  }

  private mustGet(id: string): any {
    const light = this.getLight(id);
    if (!light) throw new Error(`LIFX bulb ${id} is not reachable`);
    return light;
  }
}

interface LightState {
  color: { hue: number; saturation: number; brightness: number; kelvin: number };
  power: number;
  label: string;
}

interface HardwareVersion {
  productId: number;
  productName: string;
  vendorId: number;
  vendorName: string;
}

interface FirmwareVersion {
  majorVersion?: number;
  minorVersion?: number;
  build?: number;
}

function formatFirmware(v: FirmwareVersion | undefined): string | undefined {
  if (!v) return undefined;
  if (v.majorVersion === undefined && v.minorVersion === undefined) return undefined;
  const major = v.majorVersion ?? 0;
  const minor = v.minorVersion ?? 0;
  return `${major}.${String(minor).padStart(2, '0')}`;
}

function normalizeColor(c: {
  hue: number;
  saturation: number;
  brightness: number;
  kelvin: number;
}): HSBK {
  return {
    hue: c.hue,
    saturation: c.saturation,
    brightness: c.brightness,
    kelvin: c.kelvin,
  };
}

function promisify1<R>(fn: (cb: (err: Error | null, result: R) => void) => void): Promise<R> {
  return new Promise((resolve, reject) => {
    fn((err, result) => (err ? reject(err) : resolve(result)));
  });
}

function promisifyVoid(fn: (cb: (err: Error | null) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    fn((err) => (err ? reject(err) : resolve()));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
