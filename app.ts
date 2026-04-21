import Homey from 'homey';

import type LifxBulbDevice from './drivers/bulb/device';
import { LifxClient } from './lib/LifxClient';
import { LifxCloudClient, type CloudScene } from './lib/LifxCloudClient';

const SETTINGS_MANUAL_IPS = 'lifx.manual_ips';
const SETTINGS_CLOUD_TOKEN = 'lifx.cloud_token';
const SCENE_REFRESH_MS = 30 * 60 * 1000;

export default class LifxApp extends Homey.App {
  private client!: LifxClient;
  private cloud: LifxCloudClient | null = null;
  private sceneActivatedTrigger?: Homey.FlowCardTriggerDevice;
  private scenesTimer?: NodeJS.Timeout;
  private lastCloudStop = new Map<string, number>();

  override async onInit(): Promise<void> {
    this.log('LIFX (LAN) app starting');

    const manualIps = (this.homey.settings.get(SETTINGS_MANUAL_IPS) as string[] | undefined) ?? [];
    this.client = new LifxClient(
      { log: (...a) => this.log(...a), error: (...a) => this.error(...a) },
      manualIps,
    );
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

    if (this.cloud) {
      this.cloud.listScenes().catch((err) => this.error('scene warm failed:', err));
    }
    this.scenesTimer = setInterval(() => {
      this.refreshAllScenePickers().catch(() => {});
    }, SCENE_REFRESH_MS);
  }

  override async onUninit(): Promise<void> {
    if (this.scenesTimer) clearInterval(this.scenesTimer);
    this.client.stop();
  }

  getClient(): LifxClient {
    return this.client;
  }

  getCloud(): LifxCloudClient | null {
    return this.cloud;
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

  /**
   * API endpoint — called from settings page to validate a token before saving.
   * Uses an ad-hoc client (not the singleton) so we don't clobber the current
   * configured cloud while testing.
   */
  async testCloudToken(token: string): Promise<{ ok: boolean; sceneCount?: number; error?: string }> {
    if (!token) return { ok: false, error: 'Empty token' };
    const probe = new LifxCloudClient(token, {
      log: () => {},
      error: () => {},
    });
    try {
      const scenes = await probe.listScenes(true);
      return { ok: true, sceneCount: scenes.length };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * Returns the dropdown options for the `lifx_scene` capability, fresh from
   * the cloud (or the 30-min cache). Includes a leading "— Pick a scene —"
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
      const sorted = [...scenes].sort((a, b) => a.name.localeCompare(b.name));
      return [
        { id: '__none__', title: { en: '— Pick a scene —' } },
        ...sorted.map((s) => ({ id: s.uuid, title: { en: s.name } })),
      ];
    } catch (err) {
      this.error('scene picker fetch failed:', err);
      return [{ id: '__none__', title: { en: 'Cloud error — check token' } }];
    }
  }

  async activateSceneById(uuid: string, durationSec?: number): Promise<CloudScene | null> {
    if (!this.cloud) throw new Error('LIFX cloud token not configured.');
    await this.cloud.activateScene(uuid, durationSec);
    this.lastCloudStop.clear();

    const scene = (await this.cloud.listScenes()).find((s) => s.uuid === uuid) ?? null;
    this.refreshAllDevicesSoon();
    return scene;
  }

  fireSceneActivatedTrigger(device: Homey.Device, scene: { uuid: string; name: string }): void {
    if (!this.sceneActivatedTrigger) return;
    this.sceneActivatedTrigger
      .trigger(device, { scene_name: scene.name, scene_id: scene.uuid })
      .catch((err) => this.error('scene_activated trigger failed:', err));
  }

  async refreshAllScenePickers(): Promise<void> {
    if (this.cloud) this.cloud.invalidate();
    const values = await this.getScenePickerValues();
    try {
      const driver = this.homey.drivers.getDriver('bulb');
      for (const device of driver.getDevices()) {
        if (device.hasCapability('lifx_scene')) {
          await device.setCapabilityOptions('lifx_scene', { values });
        }
      }
    } catch {
      // driver not ready
    }
  }

  /** After a scene activates on the cloud, poke each bulb to pull fresh state. */
  private refreshAllDevicesSoon(): void {
    setTimeout(() => {
      try {
        const driver = this.homey.drivers.getDriver('bulb');
        for (const device of driver.getDevices() as LifxBulbDevice[]) {
          device.refreshNow().catch(() => {});
        }
      } catch {
        // driver not ready
      }
    }, 400);
  }

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

  private registerFlow(): void {
    this.sceneActivatedTrigger = this.homey.flow.getDeviceTriggerCard('scene_activated');

    const scene = this.homey.flow.getActionCard('activate_scene');
    scene.registerArgumentAutocompleteListener('scene', async (query: string) => {
      if (!this.cloud) return [];
      try {
        const scenes = await this.cloud.listScenes();
        const q = (query ?? '').toLowerCase();
        return scenes
          .filter((s) => !q || s.name.toLowerCase().includes(q))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ name: s.name, id: s.uuid }));
      } catch (err) {
        this.error('scene autocomplete failed:', err);
        return [];
      }
    });
    scene.registerRunListener(
      async (args: {
        scene: { id: string; name: string };
        duration_sec?: number;
      }) => {
        await this.activateSceneById(args.scene.id, args.duration_sec);
      },
    );
  }
}

module.exports = LifxApp;
