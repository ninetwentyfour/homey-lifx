import Homey from 'homey';

import type LifxApp from '../../app';

interface PairDevice {
  name: string;
  data: { id: string };
  store?: { address?: string; productId?: number; isMultiZone?: boolean };
}

/**
 * Driver for all single-zone LIFX bulbs (Original, Color A19, White 800, etc.).
 * Handles both mDNS-discovered pairing and manual-IP entry for legacy bulbs.
 *
 * Multi-zone devices (Tube, Beam, Z) go through the `multizone` driver so the
 * capability set and effect distribution can differ.
 */
export default class LifxBulbDriver extends Homey.Driver {
  override async onInit(): Promise<void> {
    this.log('LifxBulbDriver init');
  }

  override async onPairListDevices(): Promise<PairDevice[]> {
    const devices: PairDevice[] = [];
    try {
      const app = this.homey.app as LifxApp;
      const client = app.getClient();
      const strategy = this.getDiscoveryStrategy();
      const results = (strategy?.getDiscoveryResults?.() ?? {}) as Record<
        string,
        { id?: string; address?: string; txt?: { id?: string } }
      >;
      this.log(`bulb pair: ${Object.keys(results).length} mDNS result(s)`);

      for (const key of Object.keys(results)) {
        const address = results[key]?.address;
        if (!address) continue;
        try {
          const info = await client.identify(address, 3500);
          if (info.isMultiZone) continue;
          devices.push({
            name: info.label,
            data: { id: info.id },
            store: { address: info.address, productId: info.productId, isMultiZone: false },
          });
        } catch (err) {
          this.error('bulb pair identify failed for', address, err);
        }
      }
    } catch (err) {
      this.error('onPairListDevices failed:', err);
    }
    return devices;
  }

  override async onPair(session: Homey.Driver.PairSession): Promise<void> {
    const app = this.homey.app as LifxApp;

    session.setHandler('list_devices', async () => {
      return await this.onPairListDevices();
    });

    session.setHandler(
      'manual_identify',
      async (data: { ip: string }): Promise<PairDevice> => {
        const info = await app.getClient().identify(data.ip, 5000);
        if (info.isMultiZone) {
          throw new Error(
            `This appears to be a multi-zone device (${info.label}). Use the "LIFX Multizone" driver instead.`,
          );
        }
        app.rememberManualIp(info.address);
        return {
          name: info.label,
          data: { id: info.id },
          store: { address: info.address, productId: info.productId, isMultiZone: false },
        };
      },
    );
  }
}

module.exports = LifxBulbDriver;
