interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface CloudScene {
  uuid: string;
  name: string;
  updated_at?: number;
  states?: unknown[];
}

/**
 * Minimal LIFX HTTP API client. Uses a Personal Access Token; only touches
 * the two endpoints we need for scene-based theme activation.
 *
 * - GET  /v1/scenes
 * - PUT  /v1/scenes/scene_id:{uuid}/activate
 *
 * Docs: https://api.developer.lifx.com/reference
 */
export class LifxCloudClient {
  private readonly base = 'https://api.lifx.com/v1';
  private cache?: { scenes: CloudScene[]; at: number };
  private readonly TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly token: string,
    private readonly logger: Logger,
  ) {}

  async listScenes(force = false): Promise<CloudScene[]> {
    if (!force && this.cache && Date.now() - this.cache.at < this.TTL_MS) {
      return this.cache.scenes;
    }
    const response = await fetch(`${this.base}/scenes`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`LIFX cloud /scenes ${response.status}: ${body}`);
    }
    const scenes = (await response.json()) as CloudScene[];
    this.cache = { scenes, at: Date.now() };
    this.logger.log(`lifx cloud: fetched ${scenes.length} scene(s)`);
    return scenes;
  }

  async activateScene(uuid: string, durationSec?: number): Promise<void> {
    const body = durationSec !== undefined ? JSON.stringify({ duration: durationSec }) : undefined;
    const response = await fetch(`${this.base}/scenes/scene_id:${uuid}/activate`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LIFX cloud activate ${response.status}: ${text}`);
    }
  }

  /**
   * Stops any active firmware effect (Morph, Flame, Pulse, Cycle, etc.) on
   * the selector. Selector examples: "all", "id:d073d5xxxxxx", "group:Kitchen".
   * Called whenever we want LAN writes to cleanly override a running scene.
   */
  async stopEffects(selector: string): Promise<void> {
    const response = await fetch(
      `${this.base}/lights/${encodeURIComponent(selector)}/effects/off`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LIFX cloud effects/off ${response.status}: ${text}`);
    }
  }

  /**
   * Starts a firmware-driven effect on a bulb. Effect types:
   * - breathe/pulse  — any bulb; soft/hard color cycle
   * - morph/flame    — matrix devices (Tube, Tile, Candle)
   * - move           — multizone devices (Beam, Z-Strip)
   *
   * `params` is forwarded as the request body; all fields optional (the
   * server falls back to sensible defaults).
   */
  async startEffect(
    selector: string,
    effect: 'breathe' | 'pulse' | 'morph' | 'flame' | 'move',
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const response = await fetch(
      `${this.base}/lights/${encodeURIComponent(selector)}/effects/${effect}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LIFX cloud effects/${effect} ${response.status}: ${text}`);
    }
  }

  invalidate(): void {
    this.cache = undefined;
  }
}
