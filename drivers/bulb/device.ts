import Homey from 'homey';

import type LifxApp from '../../app';
import type { LifxClient } from '../../lib/LifxClient';
import { powerFor } from '../../lib/energy';
import type { HSBK } from '../../lib/types';

const POLL_INTERVAL_MS = 15_000;
const STARTUP_FALLBACK_MS = 8_000;
const UNAVAILABLE_THRESHOLD = 3;

export default class LifxBulbDevice extends Homey.Device {
  private pollTimer?: NodeJS.Timeout;
  private failures = 0;
  private onlineHandler?: (id: string) => void;
  private primed = false;
  private sceneDebounceTimer?: NodeJS.Timeout;
  private sceneDebounceValue?: string;

  override async onInit(): Promise<void> {
    this.log(`LifxBulbDevice init: ${this.getName()}`);

    await this.migrateCapabilities();
    await this.applyPowerProfile();

    // The underlying LIFX library uses UDP broadcast for auto-discovery,
    // which doesn't cross VLANs. For every paired device we re-register its
    // last-known IP so the library can reach it via unicast regardless of
    // whether the original pair was via mDNS or manual entry.
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
      this.refreshNow().catch((err) => this.error('refresh failed:', err));
    }, POLL_INTERVAL_MS);

    // Kick the first refresh as soon as the library says the light is online,
    // with a fallback timer in case the event never fires (e.g. bulb hasn't
    // powered back on yet).
    this.onlineHandler = (id: string) => {
      if (id === this.getLifxId() && !this.primed) {
        this.primed = true;
        this.refreshNow().catch(() => {});
      }
    };
    const client = (this.homey.app as LifxApp).getClient();
    client.on('light-online', this.onlineHandler);
    client.on('light-new', this.onlineHandler);

    setTimeout(() => {
      if (!this.primed) {
        this.primed = true;
        this.refreshNow().catch(() => {});
      }
    }, STARTUP_FALLBACK_MS);
  }

  override async onDeleted(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.sceneDebounceTimer) clearTimeout(this.sceneDebounceTimer);
    if (this.onlineHandler) {
      const client = (this.homey.app as LifxApp).getClient();
      client.off('light-online', this.onlineHandler);
      client.off('light-new', this.onlineHandler);
    }
    const address = this.getStoreValue('address') as string | undefined;
    if (address) (this.homey.app as LifxApp).forgetManualIp(address);
  }

  override async onDiscoveryAvailable(discoveryResult: Homey.DiscoveryResult): Promise<void> {
    const addr = (discoveryResult as { address?: string }).address;
    if (addr) {
      this.log(`discovery available: ${addr}`);
      await this.setStoreValue('address', addr);
      (this.homey.app as LifxApp).getClient().addManualIp(addr);
    }
  }

  override async onDiscoveryAddressChanged(discoveryResult: Homey.DiscoveryResult): Promise<void> {
    const addr = (discoveryResult as { address?: string }).address;
    if (addr) {
      this.log(`discovery address changed: ${addr}`);
      await this.setStoreValue('address', addr);
      (this.homey.app as LifxApp).getClient().addManualIp(addr);
    }
  }

  // ─── External API (used by app) ─────────────────────────────────────

  getLifxId(): string {
    return this.getData().id as string;
  }

  isMultiZone(): boolean {
    return false;
  }

  /** Called from the app after a scene activation to pull fresh bulb state. */
  async refreshNow(): Promise<void> {
    return this.refresh();
  }

  /**
   * Queries hardware + firmware info from the bulb and mirrors it into the
   * Homey device store + Advanced Settings labels. Fire-and-forget; called
   * once after the first successful state refresh. Subsequent boots read the
   * store and only re-query if the bulb advertises a different firmware.
   */
  private async syncDeviceInfo(info: {
    address: string;
    productId: number;
    productName?: string;
    vendorName?: string;
    firmwareWifi?: string;
    firmwareBle?: string;
  }): Promise<void> {
    const capabilities = ['onoff', 'dim', 'color', 'temperature', 'scene'];
    const patch = {
      info_model: info.productName ?? `Product ${info.productId}`,
      info_product_id: String(info.productId),
      info_serial: this.getLifxId(),
      info_ip: info.address,
      info_firmware_wifi: info.firmwareWifi ?? '—',
      info_firmware_ble: info.firmwareBle ?? '—',
      info_capabilities: capabilities.join(', '),
    };
    try {
      await this.setSettings(patch);
    } catch (err) {
      this.log('setSettings failed:', (err as Error).message);
    }
    await this.setStoreValue('productName', info.productName ?? null);
    await this.setStoreValue('vendorName', info.vendorName ?? null);
    await this.setStoreValue('firmwareWifi', info.firmwareWifi ?? null);
    await this.setStoreValue('firmwareBle', info.firmwareBle ?? null);
  }

  // ─── Capability handlers ────────────────────────────────────────────

  private async onCapOnOff(value: boolean): Promise<void> {
    await this.client().setPower(this.getLifxId(), value, 400);
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
    const pick = (cap: string): unknown =>
      cap in changed ? changed[cap] : this.getCapabilityValue(cap);

    // Infer mode from which capability actually changed. Homey's UI often
    // sends just `light_temperature` (or just `light_hue`/`light_saturation`)
    // without an accompanying `light_mode`, so trusting the stored mode would
    // route a temperature drag through the color path.
    let mode: string;
    if ('light_mode' in changed) {
      mode = changed['light_mode'] as string;
    } else if ('light_temperature' in changed) {
      mode = 'temperature';
    } else if ('light_hue' in changed || 'light_saturation' in changed) {
      mode = 'color';
    } else {
      mode = (this.getCapabilityValue('light_mode') as string | undefined) ?? 'color';
    }

    const dim = clamp01(asNumber(pick('dim') as number | undefined, 1));
    const brightness = dim * 100;

    let hsbk: HSBK;
    if (mode === 'temperature') {
      const temperature = asNumber(pick('light_temperature') as number | undefined, 0.5);
      hsbk = { hue: 0, saturation: 0, brightness, kelvin: tempToKelvin(temperature) };
    } else {
      const hue = asNumber(pick('light_hue') as number | undefined, 0) * 360;
      const saturation = asNumber(pick('light_saturation') as number | undefined, 1) * 100;
      hsbk = { hue, saturation, brightness, kelvin: 3500 };
    }

    if (this.getCapabilityValue('light_mode') !== mode) {
      await this.setCapabilityValue('light_mode', mode).catch(() => {});
    }

    await this.client().setColor(this.getLifxId(), hsbk, 200);
  }

  private async onCapScene(value: string): Promise<void> {
    if (!value || value === '__none__') return;

    // Debounce: if the user keeps scrolling through scenes, don't fire on
    // every intermediate value — wait until they've settled for 1s.
    this.sceneDebounceValue = value;
    if (this.sceneDebounceTimer) clearTimeout(this.sceneDebounceTimer);
    this.sceneDebounceTimer = setTimeout(() => {
      const pick = this.sceneDebounceValue;
      if (!pick || pick === '__none__') return;
      this.activateScene(pick).catch((err) => this.error('scene activate failed:', err));
    }, 1000);
  }

  private async activateScene(sceneId: string): Promise<void> {
    const app = this.homey.app as LifxApp;
    const scene = await app.activateSceneById(sceneId);
    if (scene) app.fireSceneActivatedTrigger(this, scene);
  }

  // ─── Migrations + setup ─────────────────────────────────────────────

  private async applyPowerProfile(): Promise<void> {
    const productId = this.getStoreValue('productId') as number | undefined;
    const profile = powerFor(productId);
    if (!profile) return;
    try {
      await this.setEnergy({
        approximation: { usageOn: profile.usageOn, usageOff: profile.usageOff },
      });
      this.log(
        `energy: productId ${productId} → ${profile.usageOn}W on / ${profile.usageOff}W off`,
      );
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

  // ─── Polling ────────────────────────────────────────────────────────

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

      // One-shot info mirror: update Advanced Settings when the info drifts
      // from what we've stored (e.g. firmware updated, DHCP reassigned IP).
      const storedIp = this.getStoreValue('address') as string | undefined;
      const storedFw = this.getStoreValue('firmwareWifi') as string | undefined;
      if (storedIp !== info.address || storedFw !== info.firmwareWifi) {
        await this.setStoreValue('address', info.address);
        await this.syncDeviceInfo({
          address: info.address,
          productId: info.productId,
          productName: info.productName,
          vendorName: info.vendorName,
          firmwareWifi: info.firmwareWifi,
          firmwareBle: info.firmwareBle,
        });
      }
    } catch (err) {
      this.failures++;
      this.log(`refresh miss ${this.failures}: ${(err as Error).message}`);
      if (this.failures >= UNAVAILABLE_THRESHOLD && this.getAvailable()) {
        await this.setUnavailable('Bulb unreachable');
      }
    }
  }

  private client(): LifxClient {
    return (this.homey.app as LifxApp).getClient();
  }
}

module.exports = LifxBulbDevice;

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
// Homey convention: light_temperature 0 = cool (high K), 1 = warm (low K).
// Range spans LIFX's widest: 1500K (newer bulbs) to 9000K. Older bulbs
// (Original, 2500K min) will clamp internally.
const K_MIN = 1500;
const K_MAX = 9000;
function tempToKelvin(t: number): number {
  return Math.round(K_MAX - clamp01(t) * (K_MAX - K_MIN));
}
function kelvinToTemp(kelvin: number): number {
  return clamp01((K_MAX - kelvin) / (K_MAX - K_MIN));
}
