/**
 * Per-product power estimates (watts). Used to override the driver-level
 * default so Homey's energy meter is more accurate per bulb model.
 *
 * `usageOn` = watts at full brightness. Homey auto-scales by the dim value.
 * `usageOff` = standby draw (all LIFX products are well under 0.5W).
 *
 * Values compiled from LIFX spec sheets and product pages. When a product ID
 * isn't listed here, the driver-level default applies.
 */
export interface BulbPower {
  usageOn: number;
  usageOff: number;
}

export const POWER_BY_PRODUCT_ID: Record<number, BulbPower> = {
  // LIFX Original A19 (Color 1000)
  1: { usageOn: 11, usageOff: 0.5 },
  3: { usageOn: 11, usageOff: 0.5 },
  10: { usageOn: 11, usageOff: 0.5 },
  15: { usageOn: 11, usageOff: 0.5 },

  // LIFX Color A19 / SuperColor (current gen, 1100lm)
  22: { usageOn: 11, usageOff: 0.5 },
  27: { usageOn: 11, usageOff: 0.5 },
  43: { usageOn: 11, usageOff: 0.5 },
  91: { usageOn: 11, usageOff: 0.5 },
  93: { usageOn: 11, usageOff: 0.5 },
  97: { usageOn: 11, usageOff: 0.5 },

  // LIFX BR30 (floodlight bulbs)
  20: { usageOn: 11, usageOff: 0.5 },
  29: { usageOn: 11, usageOff: 0.5 },
  45: { usageOn: 11, usageOff: 0.5 },
  94: { usageOn: 11, usageOff: 0.5 },

  // LIFX Mini Color / Mini Day & Dusk / Mini White
  49: { usageOn: 9, usageOff: 0.5 },
  50: { usageOn: 9, usageOff: 0.5 },
  51: { usageOn: 9, usageOff: 0.5 },
  53: { usageOn: 9, usageOff: 0.5 },
  60: { usageOn: 9, usageOff: 0.5 },
  61: { usageOn: 9, usageOff: 0.5 },
  62: { usageOn: 9, usageOff: 0.5 },
  63: { usageOn: 9, usageOff: 0.5 },
  64: { usageOn: 9, usageOff: 0.5 },
  65: { usageOn: 9, usageOff: 0.5 },
  66: { usageOn: 9, usageOff: 0.5 },

  // LIFX White 800 / White 900
  19: { usageOn: 9, usageOff: 0.5 },
  28: { usageOn: 9, usageOff: 0.5 },
  30: { usageOn: 9, usageOff: 0.5 },
  36: { usageOn: 9, usageOff: 0.5 },

  // LIFX Candle Color / Candle White-to-Warm (matrix)
  57: { usageOn: 6, usageOff: 0.5 },
  68: { usageOn: 6, usageOff: 0.5 },

  // LIFX Tile (matrix, ~12W per tile at full brightness)
  55: { usageOn: 12, usageOff: 0.5 },

  // LIFX Tube (matrix, measured 9W per tube)
  217: { usageOn: 9, usageOff: 0.5 },
  218: { usageOn: 9, usageOff: 0.5 },

  // LIFX GU10 / downlights
  74: { usageOn: 6, usageOff: 0.5 },
  81: { usageOn: 6, usageOff: 0.5 },
  82: { usageOn: 6, usageOff: 0.5 },
  85: { usageOn: 6, usageOff: 0.5 },
  86: { usageOn: 6, usageOff: 0.5 },

  // LIFX Beam (per beam = 12W max)
  38: { usageOn: 12, usageOff: 0.5 },
  119: { usageOn: 12, usageOff: 0.5 },
  120: { usageOn: 12, usageOff: 0.5 },

  // LIFX Z (strip, per 2m kit ~17W)
  31: { usageOn: 17, usageOff: 0.5 },
  32: { usageOn: 17, usageOff: 0.5 },
  117: { usageOn: 17, usageOff: 0.5 },
  118: { usageOn: 17, usageOff: 0.5 },
};

export function powerFor(productId: number | undefined): BulbPower | null {
  if (productId === undefined) return null;
  return POWER_BY_PRODUCT_ID[productId] ?? null;
}
