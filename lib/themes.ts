import { BUILTIN_THEMES } from './builtin-themes';
import type { PaletteColor, Theme } from './types';

/**
 * Theme access and persistence. The store always exposes the built-in LIFX-
 * style palettes first, then any user-defined themes from Homey settings.
 * User themes share the same shape; only built-ins have IDs prefixed with
 * `builtin:` and are treated as read-only.
 */

const SETTINGS_KEY = 'lifx.themes';
const CURSOR_KEY = 'lifx.theme_cursor';

interface HomeySettings {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

export class ThemeStore {
  constructor(private readonly settings: HomeySettings) {}

  list(): Theme[] {
    return [...BUILTIN_THEMES, ...this.listUser()];
  }

  listUser(): Theme[] {
    const raw = this.settings.get(SETTINGS_KEY);
    return Array.isArray(raw) ? (raw as Theme[]) : [];
  }

  listBuiltin(): Theme[] {
    return [...BUILTIN_THEMES];
  }

  get(id: string): Theme | null {
    return this.list().find((t) => t.id === id) ?? null;
  }

  upsert(theme: Theme): void {
    if (theme.id.startsWith('builtin:')) {
      throw new Error('Built-in themes are read-only');
    }
    const user = this.listUser();
    const idx = user.findIndex((t) => t.id === theme.id);
    if (idx >= 0) user[idx] = theme;
    else user.push(theme);
    this.settings.set(SETTINGS_KEY, user);
  }

  remove(id: string): void {
    if (id.startsWith('builtin:')) {
      throw new Error('Built-in themes are read-only');
    }
    this.settings.set(
      SETTINGS_KEY,
      this.listUser().filter((t) => t.id !== id),
    );
  }

  /**
   * Returns the next color from a theme's palette for a given device, advancing
   * the per-device cursor. For cycling distribution: each apply on the same
   * (theme, device) pair returns a successive palette color.
   */
  nextColorFor(themeId: string, deviceId: string): PaletteColor | null {
    const theme = this.get(themeId);
    if (!theme || theme.colors.length === 0) return null;
    const cursors = this.readCursors();
    const key = `${themeId}::${deviceId}`;
    const next = (cursors[key] ?? -1) + 1;
    const idx = ((next % theme.colors.length) + theme.colors.length) % theme.colors.length;
    cursors[key] = idx;
    this.settings.set(CURSOR_KEY, cursors);
    return theme.colors[idx];
  }

  /**
   * Returns N colors from a palette starting at this device's current cursor,
   * wrapping as needed. Used for multi-zone distribution.
   */
  zoneColorsFor(themeId: string, deviceId: string, count: number): PaletteColor[] {
    const theme = this.get(themeId);
    if (!theme || theme.colors.length === 0) return [];
    const cursors = this.readCursors();
    const key = `${themeId}::${deviceId}`;
    const start = (cursors[key] ?? 0) + 1;
    cursors[key] = start;
    this.settings.set(CURSOR_KEY, cursors);
    const out: PaletteColor[] = [];
    for (let i = 0; i < count; i++) {
      out.push(theme.colors[(start + i) % theme.colors.length]);
    }
    return out;
  }

  private readCursors(): Record<string, number> {
    const raw = this.settings.get(CURSOR_KEY);
    return raw && typeof raw === 'object' ? (raw as Record<string, number>) : {};
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `theme-${Date.now().toString(36)}`;
}
