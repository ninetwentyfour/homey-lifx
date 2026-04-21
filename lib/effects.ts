import type { LifxClient } from './LifxClient';
import type { EffectKind, EffectSnapshot, HSBK, PaletteColor } from './types';

/**
 * Per-device effect runners. Each device can have at most one effect active.
 * Morph cycles a palette via repeated setColor calls with smooth duration.
 * Candle simulates flame flicker via randomized brightness + hue jitter.
 * Stop cancels the timer and restores the pre-effect snapshot.
 */

interface ActiveEffect {
  kind: EffectKind;
  timer: NodeJS.Timeout;
  snapshot: EffectSnapshot;
}

export class EffectManager {
  private active = new Map<string, ActiveEffect>();

  constructor(private readonly client: LifxClient) {}

  async startMorph(
    id: string,
    palette: PaletteColor[],
    opts: { cycleMs: number; isMultiZone: boolean } = { cycleMs: 6000, isMultiZone: false },
  ): Promise<void> {
    if (palette.length === 0) throw new Error('Morph requires a non-empty palette');
    await this.stop(id); // snapshot-and-restore semantics: prior effect is canceled

    const snapshot = await this.snapshot(id, opts.isMultiZone);
    const stepMs = Math.max(600, Math.round(opts.cycleMs / Math.max(palette.length, 2)));

    let index = 0;
    const tick = async (): Promise<void> => {
      const color = palette[index % palette.length];
      try {
        if (opts.isMultiZone) {
          // Distribute two consecutive palette colors across alternating zones
          const zones = await this.client.getColorZones(id).catch(() => []);
          const half = Math.max(1, Math.floor(zones.length / 2));
          await this.client.setColorZones(id, 0, half - 1, toHSBK(color), stepMs, false);
          const next = palette[(index + 1) % palette.length];
          await this.client.setColorZones(id, half, 255, toHSBK(next), stepMs, true);
        } else {
          await this.client.setColor(id, toHSBK(color), stepMs);
        }
      } catch {
        // swallow transient errors; next tick will retry
      }
      index++;
    };

    void tick();
    const timer = setInterval(tick, stepMs);
    this.active.set(id, { kind: 'morph', timer, snapshot });
  }

  async startCandle(
    id: string,
    opts: { intensity?: number; isMultiZone?: boolean } = {},
  ): Promise<void> {
    await this.stop(id);

    const snapshot = await this.snapshot(id, opts.isMultiZone ?? false);
    const intensity = clamp01(opts.intensity ?? 0.6);

    const baseHue = 30;         // warm amber
    const baseSat = 75;         // saturated warm
    const baseKelvin = 2500;    // warm white end (unused at high sat, but polite)
    const baseBri = 60;

    const tick = async (): Promise<void> => {
      const flickerBri = clampPct(baseBri + (Math.random() - 0.5) * 50 * intensity);
      const flickerHue = (baseHue + (Math.random() - 0.5) * 10) % 360;
      const flickerSat = clampPct(baseSat + (Math.random() - 0.5) * 15);
      try {
        await this.client.setColor(
          id,
          { hue: flickerHue, saturation: flickerSat, brightness: flickerBri, kelvin: baseKelvin },
          150,
        );
      } catch {
        // ignore
      }
    };

    void tick();
    const timer = setInterval(tick, 200);
    this.active.set(id, { kind: 'candle', timer, snapshot });
  }

  async stop(id: string): Promise<void> {
    const entry = this.active.get(id);
    if (!entry) return;
    clearInterval(entry.timer);
    this.active.delete(id);
    await this.restore(id, entry.snapshot);
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  async stopAll(): Promise<void> {
    const ids = [...this.active.keys()];
    for (const id of ids) await this.stop(id);
  }

  private async snapshot(id: string, isMultiZone: boolean): Promise<EffectSnapshot> {
    const info = await this.client.getInfo(id);
    const snap: EffectSnapshot = { power: info.power, color: info.color };
    if (isMultiZone) {
      try {
        snap.zones = await this.client.getColorZones(id);
      } catch {
        // ignore — device may be off or slow
      }
    }
    return snap;
  }

  private async restore(id: string, snap: EffectSnapshot): Promise<void> {
    try {
      if (snap.zones && snap.zones.length > 0) {
        // Restore zones: write each unique zone run; simplistic but correct for small N
        for (let i = 0; i < snap.zones.length; i++) {
          await this.client.setColorZones(id, i, i, snap.zones[i], 400, i === snap.zones.length - 1);
        }
      } else {
        await this.client.setColor(id, snap.color, 400);
      }
      await this.client.setPower(id, snap.power, 300);
    } catch {
      // non-fatal; user can toggle in Homey
    }
  }
}

function toHSBK(c: PaletteColor): HSBK {
  return {
    hue: c.hue,
    saturation: c.saturation,
    brightness: c.brightness,
    kelvin: c.kelvin ?? 3500,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}
