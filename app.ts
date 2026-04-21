import Homey from 'homey';

import type LifxBulbDevice from './drivers/bulb/device';
import type LifxMultizoneDevice from './drivers/multizone/device';
import { LifxClient } from './lib/LifxClient';
import { LifxCloudClient } from './lib/LifxCloudClient';
import { EffectManager } from './lib/effects';
import { ThemeStore } from './lib/themes';
import type { PaletteColor } from './lib/types';

const SETTINGS_MANUAL_IPS = 'lifx.manual_ips';
const SETTINGS_CLOUD_TOKEN = 'lifx.cloud_token';

type LifxDevice = LifxBulbDevice | LifxMultizoneDevice;

export default class LifxApp extends Homey.App {
  private client!: LifxClient;
  private effects!: EffectManager;
  private themes!: ThemeStore;
  private cloud: LifxCloudClient | null = null;

  override async onInit(): Promise<void> {
    this.log('LIFX (LAN) app starting');

    const manualIps = (this.homey.settings.get(SETTINGS_MANUAL_IPS) as string[] | undefined) ?? [];

    this.client = new LifxClient(
      { log: (...a) => this.log(...a), error: (...a) => this.error(...a) },
      manualIps,
    );
    this.effects = new EffectManager(this.client);
    this.themes = new ThemeStore(this.homey.settings);
    this.rebuildCloud();

    this.homey.settings.on('set', (key: string) => {
      if (key === SETTINGS_CLOUD_TOKEN) {
        this.rebuildCloud();
        this.refreshAllScenePickers().catch((err) =>
          this.error('scene picker refresh failed:', err),
        );
      }
    });

    await this.client.start();
    this.registerFlow();

    // Warm the scenes cache in the background
    if (this.cloud) {
      this.cloud.listScenes().catch((err) => this.error('scene warm failed:', err));
    }
  }

  private rebuildCloud(): void {
    const token = (this.homey.settings.get(SETTINGS_CLOUD_TOKEN) as string | undefined)?.trim();
    if (!token) {
      this.cloud = null;
      return;
    }
    this.cloud = new LifxCloudClient(token, {
      log: (...a) => this.log('[cloud]', ...a),
      error: (...a) => this.error('[cloud]', ...a),
    });
  }

  getCloud(): LifxCloudClient | null {
    return this.cloud;
  }

  /**
   * Returns the dropdown options for the `lifx_scene` capability, fresh from
   * the cloud (or the 30-min cache). Includes a leading "(Pick a scene)"
   * placeholder so the picker has a neutral default.
   */
  async getScenePickerValues(): Promise<Array<{ id: string; title: { en: string } }>> {
    if (!this.cloud) {
      return [{ id: '__none__', title: { en: 'No cloud token configured' } }];
    }
    try {
      const scenes = await this.cloud.listScenes();
      if (scenes.length === 0) {
        return [{ id: '__none__', title: { en: 'No scenes saved in LIFX app' } }];
      }
      return [
        { id: '__none__', title: { en: '— Pick a scene —' } },
        ...scenes.map((s) => ({ id: s.uuid, title: { en: s.name } })),
      ];
    } catch (err) {
      this.error('scene picker fetch failed:', err);
      return [{ id: '__none__', title: { en: 'Cloud error — check token' } }];
    }
  }

  async activateSceneById(uuid: string, durationSec?: number): Promise<void> {
    if (!this.cloud) throw new Error('LIFX cloud token not configured.');
    await this.cloud.activateScene(uuid, durationSec);
    this.lastCloudStop.clear();
  }

  async refreshAllScenePickers(): Promise<void> {
    if (this.cloud) this.cloud.invalidate();
    const values = await this.getScenePickerValues();
    for (const driverId of ['bulb', 'multizone']) {
      try {
        const driver = this.homey.drivers.getDriver(driverId);
        for (const device of driver.getDevices()) {
          if (device.hasCapability('lifx_scene')) {
            await device.setCapabilityOptions('lifx_scene', { values });
          }
        }
      } catch {
        // driver not ready — fine
      }
    }
  }

  /**
   * Best-effort: tell the LIFX cloud to cancel any firmware effect (Morph,
   * Flame, etc.) running on this bulb, so a subsequent LAN write will stick.
   * Debounced per device so slider drags don't spam the cloud's rate limit.
   */
  async maybeStopCloudEffects(deviceId: string): Promise<void> {
    if (!this.cloud) return;
    const now = Date.now();
    const last = this.lastCloudStop.get(deviceId) ?? 0;
    if (now - last < 3_000) return;
    this.lastCloudStop.set(deviceId, now);
    try {
      await this.cloud.stopEffects(`id:${deviceId}`);
    } catch (err) {
      this.error('cloud stopEffects failed:', err);
    }
  }
  private lastCloudStop = new Map<string, number>();

  override async onUninit(): Promise<void> {
    await this.effects.stopAll().catch(() => {});
    this.client.stop();
  }

  getClient(): LifxClient {
    return this.client;
  }

  getEffects(): EffectManager {
    return this.effects;
  }

  getThemes(): ThemeStore {
    return this.themes;
  }

  rememberManualIp(ip: string): void {
    const current = (this.homey.settings.get(SETTINGS_MANUAL_IPS) as string[] | undefined) ?? [];
    if (current.includes(ip)) return;
    this.homey.settings.set(SETTINGS_MANUAL_IPS, [...current, ip]);
    this.client.addManualIp(ip);
  }

  forgetManualIp(ip: string): void {
    const current = (this.homey.settings.get(SETTINGS_MANUAL_IPS) as string[] | undefined) ?? [];
    this.homey.settings.set(
      SETTINGS_MANUAL_IPS,
      current.filter((x) => x !== ip),
    );
    this.client.removeManualIp(ip);
  }

  private registerFlow(): void {
    const themeAutocomplete = async (query: string): Promise<{ name: string; id: string }[]> => {
      const q = (query ?? '').toLowerCase();
      return this.themes
        .list()
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .map((t) => ({ name: t.name, id: t.id }));
    };

    const morph = this.homey.flow.getActionCard('effect_morph');
    morph.registerArgumentAutocompleteListener('theme', themeAutocomplete);
    morph.registerRunListener(
      async (args: {
        device: LifxDevice;
        theme: { id: string };
        cycle_ms?: number;
      }) => {
        const theme = this.themes.get(args.theme.id);
        if (!theme) throw new Error(`Theme "${args.theme.id}" no longer exists.`);
        if (theme.colors.length === 0) throw new Error(`Theme "${theme.name}" has no colors.`);
        await this.effects.startMorph(args.device.getLifxId(), theme.colors, {
          cycleMs: args.cycle_ms ?? 6000,
          isMultiZone: args.device.isMultiZone(),
        });
      },
    );

    const candle = this.homey.flow.getActionCard('effect_candle');
    candle.registerRunListener(
      async (args: { device: LifxDevice; intensity?: number }) => {
        await this.effects.startCandle(args.device.getLifxId(), {
          intensity: args.intensity ?? 0.6,
          isMultiZone: args.device.isMultiZone(),
        });
      },
    );

    const stop = this.homey.flow.getActionCard('effect_stop');
    stop.registerRunListener(async (args: { device: LifxDevice }) => {
      const id = args.device.getLifxId();
      await this.effects.stop(id);
      if (this.cloud) {
        try {
          await this.cloud.stopEffects(`id:${id}`);
        } catch (err) {
          this.error('cloud stopEffects failed:', err);
        }
      }
    });

    const scene = this.homey.flow.getActionCard('activate_scene');
    scene.registerArgumentAutocompleteListener('scene', async (query: string) => {
      if (!this.cloud) return [];
      try {
        const scenes = await this.cloud.listScenes();
        const q = (query ?? '').toLowerCase();
        return scenes
          .filter((s) => !q || s.name.toLowerCase().includes(q))
          .map((s) => ({ name: s.name, id: s.uuid }));
      } catch (err) {
        this.error('scene autocomplete failed:', err);
        return [];
      }
    });
    scene.registerRunListener(
      async (args: { scene: { id: string; name: string }; duration_sec?: number }) => {
        if (!this.cloud) {
          throw new Error(
            'LIFX cloud token not configured. Open the LIFX app in Homey, go to Settings, and paste a Personal Access Token from cloud.lifx.com/settings.',
          );
        }
        await this.cloud.activateScene(args.scene.id, args.duration_sec);
        // Fresh scene → next capability write should re-stop effects, so
        // clear the per-device debounce window.
        this.lastCloudStop.clear();
      },
    );

    const theme = this.homey.flow.getActionCard('apply_theme');
    theme.registerArgumentAutocompleteListener('theme', themeAutocomplete);
    theme.registerRunListener(
      async (args: { device: LifxDevice; theme: { id: string } }) => {
        const id = args.device.getLifxId();
        if (args.device.isMultiZone()) {
          const zones = await this.client.getColorZones(id).catch(() => []);
          const palette = this.themes.zoneColorsFor(
            args.theme.id,
            id,
            Math.max(zones.length || 8, 2),
          );
          if (palette.length === 0) throw new Error('Theme has no colors.');
          const chunk = Math.max(1, Math.floor(256 / palette.length));
          for (let i = 0; i < palette.length; i++) {
            const s = i * chunk;
            const e = i === palette.length - 1 ? 255 : s + chunk - 1;
            await this.client.setColorZones(id, s, e, toHSBK(palette[i]), 400, i === palette.length - 1);
          }
        } else {
          const next = this.themes.nextColorFor(args.theme.id, id);
          if (!next) throw new Error('Theme has no colors.');
          await this.client.setColor(id, toHSBK(next), 400);
        }
      },
    );
  }
}

function toHSBK(c: PaletteColor): { hue: number; saturation: number; brightness: number; kelvin: number } {
  return {
    hue: c.hue,
    saturation: c.saturation,
    brightness: c.brightness,
    kelvin: c.kelvin ?? 3500,
  };
}

module.exports = LifxApp;
