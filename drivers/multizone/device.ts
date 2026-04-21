import Homey from 'homey';

import type LifxApp from '../../app';
import type { LifxClient } from '../../lib/LifxClient';
import type { EffectManager } from '../../lib/effects';
import { powerFor } from '../../lib/energy';
import type { HSBK } from '../../lib/types';

const POLL_INTERVAL_MS = 15_000;
const FIRST_REFRESH_DELAY_MS = 3_000;
const UNAVAILABLE_THRESHOLD = 3;

/**
 * Multi-zone LIFX device (Tube/Beam/Z/strip). Homey has no per-zone capability,
 * so standard capability changes paint all zones uniformly. The effect & theme
 * system is zone-aware and distributes palette colors across zones.
 */
export default class LifxMultizoneDevice extends Homey.Device {
  private pollTimer?: NodeJS.Timeout;
  private failures = 0;

  override async onInit(): Promise<void> {
    this.log(`LifxMultizoneDevice init: ${this.getName()}`);

    await this.migrateCapabilities();
    await this.applyPowerProfile();

    const address = this.getStoreValue('address') as string | undefined;
    if (address) {
      (this.homey.app as LifxApp).getClient().addManualIp(address);
    }

    this.registerCapabilityListener('onoff', this.onCapOnOff.bind(this));
    this.registerMultipleCapabilityListener(
      ['dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode'],
      this.onCapColor.bind(this),
      150,
    );

    if (this.hasCapability('lifx_scene')) {
      this.registerCapabilityListener('lifx_scene', this.onCapScene.bind(this));
      void this.syncScenePicker();
    }

    this.pollTimer = setInterval(() => {
      this.refresh().catch((err) => this.error('refresh failed:', err));
    }, POLL_INTERVAL_MS);

    setTimeout(() => {
      this.refresh().catch(() => {});
    }, FIRST_REFRESH_DELAY_MS);
  }

  override async onDeleted(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    const address = this.getStoreValue('address') as string | undefined;
    if (address) (this.homey.app as LifxApp).forgetManualIp(address);
  }

  override async onDiscoveryAvailable(r: Homey.DiscoveryResult): Promise<void> {
    const addr = (r as { address?: string }).address;
    if (addr) {
      await this.setStoreValue('address', addr);
      (this.homey.app as LifxApp).getClient().addManualIp(addr);
    }
  }

  override async onDiscoveryAddressChanged(r: Homey.DiscoveryResult): Promise<void> {
    const addr = (r as { address?: string }).address;
    if (addr) {
      await this.setStoreValue('address', addr);
      (this.homey.app as LifxApp).getClient().addManualIp(addr);
    }
  }

  getLifxId(): string {
    return this.getData().id as string;
  }

  getEffects(): EffectManager {
    return (this.homey.app as LifxApp).getEffects();
  }

  isMultiZone(): boolean {
    return true;
  }

  private async onCapOnOff(value: boolean): Promise<void> {
    await this.client().setPower(this.getLifxId(), value, 400);
  }

  private async onCapScene(value: string): Promise<void> {
    if (!value || value === '__none__') return;
    await (this.homey.app as LifxApp).activateSceneById(value);
  }

  private async applyPowerProfile(): Promise<void> {
    const productId = this.getStoreValue('productId') as number | undefined;
    const profile = powerFor(productId);
    if (!profile) return;
    try {
      await this.setEnergy({
        approximation: { usageOn: profile.usageOn, usageOff: profile.usageOff },
      });
      this.log(`energy: productId ${productId} → ${profile.usageOn}W on / ${profile.usageOff}W off`);
    } catch (err) {
      this.error('setEnergy failed:', err);
    }
  }

  private async migrateCapabilities(): Promise<void> {
    const want = [
      'onoff',
      'dim',
      'light_hue',
      'light_saturation',
      'light_temperature',
      'light_mode',
      'lifx_scene',
    ];
    for (const cap of want) {
      if (!this.hasCapability(cap)) {
        try {
          await this.addCapability(cap);
          this.log(`migrated: added capability ${cap}`);
        } catch (err) {
          this.error(`failed to add capability ${cap}:`, err);
        }
      }
    }
  }

  private async syncScenePicker(): Promise<void> {
    try {
      const values = await (this.homey.app as LifxApp).getScenePickerValues();
      await this.setCapabilityOptions('lifx_scene', { values });
    } catch (err) {
      this.log('scene picker sync failed:', (err as Error).message);
    }
  }

  private async onCapColor(changed: Record<string, unknown>): Promise<void> {
    const colorChanged =
      'light_hue' in changed ||
      'light_saturation' in changed ||
      'light_temperature' in changed ||
      'light_mode' in changed;
    if (colorChanged) {
      void (this.homey.app as LifxApp).maybeStopCloudEffects(this.getLifxId());
    }
    const pick = <T>(cap: string): T | undefined =>
      cap in changed ? (changed[cap] as T) : (this.getCapabilityValue(cap) as T);

    const mode = pick<string>('light_mode') ?? 'color';
    const dim = clamp01(asNumber(pick<number>('dim'), 1));
    const brightness = dim * 100;

    let hsbk: HSBK;
    if (mode === 'temperature') {
      const t = asNumber(pick<number>('light_temperature'), 0.5);
      hsbk = { hue: 0, saturation: 0, brightness, kelvin: tempToKelvin(t) };
    } else {
      const hue = asNumber(pick<number>('light_hue'), 0) * 360;
      const saturation = asNumber(pick<number>('light_saturation'), 1) * 100;
      hsbk = { hue, saturation, brightness, kelvin: 3500 };
    }

    // Paint the entire zone range uniformly when standard caps change
    await this.client().setColorZones(this.getLifxId(), 0, 255, hsbk, 200, true);
  }

  private async refresh(): Promise<void> {
    try {
      const info = await this.client().getInfo(this.getLifxId());
      await this.setCapabilityValue('onoff', info.power);
      await this.setCapabilityValue('dim', info.color.brightness / 100);
      if (info.color.saturation > 0) {
        await this.setCapabilityValue('light_mode', 'color');
        await this.setCapabilityValue('light_hue', info.color.hue / 360);
        await this.setCapabilityValue('light_saturation', info.color.saturation / 100);
      } else {
        await this.setCapabilityValue('light_mode', 'temperature');
        await this.setCapabilityValue('light_temperature', kelvinToTemp(info.color.kelvin));
      }
      this.failures = 0;
      if (!this.getAvailable()) await this.setAvailable();
    } catch (err) {
      this.failures++;
      this.log(`refresh miss ${this.failures}: ${(err as Error).message}`);
      if (this.failures >= UNAVAILABLE_THRESHOLD && this.getAvailable()) {
        await this.setUnavailable('Device unreachable');
      }
    }
  }

  private client(): LifxClient {
    return (this.homey.app as LifxApp).getClient();
  }
}

module.exports = LifxMultizoneDevice;

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function tempToKelvin(t: number): number {
  return Math.round(2500 + clamp01(t) * (9000 - 2500));
}
function kelvinToTemp(kelvin: number): number {
  return clamp01((kelvin - 2500) / (9000 - 2500));
}
