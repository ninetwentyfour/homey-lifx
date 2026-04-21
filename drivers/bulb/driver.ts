import Homey from 'homey';

import type LifxApp from '../../app';

interface PairDevice {
  name: string;
  data: { id: string };
  icon?: string;
  store?: { address?: string; productId?: number; isMultiZone?: boolean };
}

// LIFX matrix/tube product IDs — see LIFX products.json. These get the
// linear tube icon; everything else gets the A19 default.
const TUBE_PRODUCT_IDS = new Set<number>([217, 218]);

function iconForProduct(productId: number | undefined): string | undefined {
  if (productId !== undefined && TUBE_PRODUCT_IDS.has(productId)) {
    return '/drivers/bulb/assets/tube.svg';
  }
  return undefined; // default driver icon
}

/**
 * Driver for all LIFX bulbs (A19, Original, Mini, BR30, Candle, GU10, Tube,
 * Tile, …). Handles mDNS auto-pair and manual-IP entry for legacy firmware.
 * Picks a per-device icon at pair time so the Tube doesn't look like an A19
 * in the device list.
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
          devices.push({
            name: info.label,
            data: { id: info.id },
            icon: iconForProduct(info.productId),
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
        app.rememberManualIp(info.address);
        return {
          name: info.label,
          data: { id: info.id },
          icon: iconForProduct(info.productId),
          store: { address: info.address, productId: info.productId, isMultiZone: false },
        };
      },
    );
  }
}

module.exports = LifxBulbDriver;
