import Homey from 'homey';

import type LifxApp from '../../app';

interface PairDevice {
  name: string;
  data: { id: string };
  store?: { address?: string; productId?: number; isMultiZone?: boolean };
}

export default class LifxMultizoneDriver extends Homey.Driver {
  override async onInit(): Promise<void> {
    this.log('LifxMultizoneDriver init');
  }

  override async onPairListDevices(): Promise<PairDevice[]> {
    const devices: PairDevice[] = [];
    try {
      const app = this.homey.app as LifxApp;
      const client = app.getClient();
      const strategy = this.getDiscoveryStrategy();
      const results = (strategy?.getDiscoveryResults?.() ?? {}) as Record<
        string,
        { id?: string; address?: string }
      >;
      this.log(`multizone pair: ${Object.keys(results).length} mDNS result(s)`);

      for (const key of Object.keys(results)) {
        const address = results[key]?.address;
        if (!address) continue;
        try {
          const info = await client.identify(address, 3500);
          if (!info.isMultiZone) continue;
          devices.push({
            name: info.label,
            data: { id: info.id },
            store: { address: info.address, productId: info.productId, isMultiZone: true },
          });
        } catch (err) {
          this.error('multizone pair identify failed for', address, err);
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
        if (!info.isMultiZone) {
          throw new Error(
            `This is a single-zone bulb (${info.label}). Use the "LIFX Bulb" driver instead.`,
          );
        }
        app.rememberManualIp(info.address);
        return {
          name: info.label,
          data: { id: info.id },
          store: { address: info.address, productId: info.productId, isMultiZone: true },
        };
      },
    );
  }
}

module.exports = LifxMultizoneDriver;
