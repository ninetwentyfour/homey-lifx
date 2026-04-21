import type { Theme } from './types';

/**
 * Built-in LIFX theme palettes.
 *
 * The 24 official classic themes (Autumn through Warming) are sourced from
 * https://github.com/wborn/lifx-themes (MIT), which mirrors the palettes
 * shipped in older LIFX apps. HSBK values normalized to hue 0-360,
 * saturation/brightness 0-100, kelvin 2500-9000.
 *
 * The newer category themes (Art Series, Music, Moods) are approximated by
 * hand from their visual identity in the current LIFX app — they're not
 * exposed via a LIFX LAN endpoint, so exact palette match isn't possible.
 */
export const BUILTIN_THEMES: readonly Theme[] = [
  // ── Classic (from wborn/lifx-themes) ──────────────────────────────────
  {
    id: 'builtin:autumn',
    name: 'Autumn',
    colors: [
      { hue: 31, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 83, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 49, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 58, saturation: 100, brightness: 50, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:blissful',
    name: 'Blissful',
    colors: [
      { hue: 303, saturation: 18, brightness: 82, kelvin: 3500 },
      { hue: 232, saturation: 46, brightness: 53, kelvin: 3500 },
      { hue: 252, saturation: 37, brightness: 69, kelvin: 3500 },
      { hue: 245, saturation: 29, brightness: 81, kelvin: 3500 },
      { hue: 303, saturation: 37, brightness: 18, kelvin: 3500 },
      { hue: 56, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 321, saturation: 39, brightness: 78, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:cheerful',
    name: 'Cheerful',
    colors: [
      { hue: 310, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 266, saturation: 87, brightness: 47, kelvin: 3500 },
      { hue: 248, saturation: 100, brightness: 60, kelvin: 3500 },
      { hue: 51, saturation: 100, brightness: 67, kelvin: 3500 },
      { hue: 282, saturation: 90, brightness: 67, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:dream',
    name: 'Dream',
    colors: [
      { hue: 201, saturation: 76, brightness: 23, kelvin: 3500 },
      { hue: 183, saturation: 75, brightness: 32, kelvin: 3500 },
      { hue: 199, saturation: 22, brightness: 62, kelvin: 3500 },
      { hue: 223, saturation: 22, brightness: 91, kelvin: 3500 },
      { hue: 219, saturation: 29, brightness: 52, kelvin: 3500 },
      { hue: 167, saturation: 62, brightness: 55, kelvin: 3500 },
      { hue: 201, saturation: 76, brightness: 23, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:energizing',
    name: 'Energizing',
    colors: [
      { hue: 0, saturation: 0, brightness: 100, kelvin: 9000 },
      { hue: 205, saturation: 47, brightness: 100, kelvin: 3500 },
      { hue: 191, saturation: 89, brightness: 100, kelvin: 3500 },
      { hue: 242, saturation: 100, brightness: 42, kelvin: 3500 },
      { hue: 180, saturation: 87, brightness: 27, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 30, kelvin: 9000 },
    ],
  },
  {
    id: 'builtin:epic',
    name: 'Epic',
    colors: [
      { hue: 226, saturation: 100, brightness: 96, kelvin: 3500 },
      { hue: 233, saturation: 100, brightness: 49, kelvin: 3500 },
      { hue: 184, saturation: 60, brightness: 57, kelvin: 3500 },
      { hue: 249, saturation: 29, brightness: 95, kelvin: 3500 },
      { hue: 261, saturation: 84, brightness: 58, kelvin: 3500 },
      { hue: 294, saturation: 78, brightness: 51, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:exciting',
    name: 'Exciting',
    colors: [
      { hue: 0, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 40, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 60, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 122, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 239, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 271, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 294, saturation: 100, brightness: 100, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:focusing',
    name: 'Focusing',
    colors: [
      { hue: 338, saturation: 38, brightness: 100, kelvin: 3500 },
      { hue: 42, saturation: 36, brightness: 100, kelvin: 3500 },
      { hue: 52, saturation: 21, brightness: 100, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 100, kelvin: 9000 },
      { hue: 0, saturation: 0, brightness: 100, kelvin: 2500 },
    ],
  },
  {
    id: 'builtin:halloween',
    name: 'Halloween',
    colors: [
      { hue: 31, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 32, saturation: 100, brightness: 60, kelvin: 2800 },
      { hue: 32, saturation: 100, brightness: 100, kelvin: 4200 },
      { hue: 33, saturation: 100, brightness: 60, kelvin: 4900 },
      { hue: 33, saturation: 100, brightness: 100, kelvin: 2450 },
      { hue: 34, saturation: 100, brightness: 70, kelvin: 2800 },
    ],
  },
  {
    id: 'builtin:hanukkah',
    name: 'Hanukkah',
    colors: [
      { hue: 213, saturation: 52, brightness: 100, kelvin: 3500 },
      { hue: 219, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 32, kelvin: 7000 },
      { hue: 199, saturation: 100, brightness: 34, kelvin: 3500 },
      { hue: 232, saturation: 100, brightness: 35, kelvin: 3500 },
      { hue: 225, saturation: 25, brightness: 13, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:holly',
    name: 'Holly',
    colors: [
      { hue: 117, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 116, saturation: 90, brightness: 100, kelvin: 3500 },
      { hue: 1, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 118, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 360, saturation: 100, brightness: 90, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:independence-day',
    name: 'Independence Day',
    colors: [
      { hue: 360, saturation: 0, brightness: 100, kelvin: 3500 },
      { hue: 360, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 240, saturation: 100, brightness: 100, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:intense',
    name: 'Intense',
    colors: [
      { hue: 242, saturation: 75, brightness: 100, kelvin: 3500 },
      { hue: 300, saturation: 100, brightness: 87, kelvin: 3500 },
      { hue: 164, saturation: 99, brightness: 100, kelvin: 3500 },
      { hue: 248, saturation: 100, brightness: 23, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:mellow',
    name: 'Mellow',
    colors: [
      { hue: 359, saturation: 31, brightness: 59, kelvin: 3500 },
      { hue: 315, saturation: 24, brightness: 82, kelvin: 3500 },
      { hue: 241, saturation: 100, brightness: 40, kelvin: 3500 },
      { hue: 256, saturation: 36, brightness: 50, kelvin: 3500 },
      { hue: 79, saturation: 5, brightness: 40, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:peaceful',
    name: 'Peaceful',
    colors: [
      { hue: 198, saturation: 48, brightness: 11, kelvin: 3500 },
      { hue: 2, saturation: 46, brightness: 85, kelvin: 3500 },
      { hue: 54, saturation: 36, brightness: 85, kelvin: 3500 },
      { hue: 4, saturation: 63, brightness: 56, kelvin: 3500 },
      { hue: 203, saturation: 34, brightness: 56, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:powerful',
    name: 'Powerful',
    colors: [
      { hue: 10, saturation: 99, brightness: 66, kelvin: 3500 },
      { hue: 59, saturation: 70, brightness: 98, kelvin: 3500 },
      { hue: 11, saturation: 99, brightness: 41, kelvin: 3500 },
      { hue: 61, saturation: 44, brightness: 99, kelvin: 3500 },
      { hue: 18, saturation: 98, brightness: 98, kelvin: 3500 },
      { hue: 52, saturation: 88, brightness: 97, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:relaxing',
    name: 'Relaxing',
    colors: [
      { hue: 110, saturation: 95, brightness: 100, kelvin: 3500 },
      { hue: 71, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 123, saturation: 85, brightness: 33, kelvin: 3500 },
      { hue: 120, saturation: 50, brightness: 10, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:santa',
    name: 'Santa',
    colors: [
      { hue: 0, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 351, saturation: 5, brightness: 100, kelvin: 3500 },
      { hue: 2, saturation: 100, brightness: 58, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 52, kelvin: 6000 },
    ],
  },
  {
    id: 'builtin:serene',
    name: 'Serene',
    colors: [
      { hue: 179, saturation: 10, brightness: 91, kelvin: 3500 },
      { hue: 215, saturation: 85, brightness: 98, kelvin: 3500 },
      { hue: 205, saturation: 44, brightness: 37, kelvin: 3500 },
      { hue: 94, saturation: 63, brightness: 25, kelvin: 3500 },
      { hue: 100, saturation: 26, brightness: 42, kelvin: 3500 },
      { hue: 132, saturation: 46, brightness: 88, kelvin: 3500 },
      { hue: 211, saturation: 73, brightness: 97, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:soothing',
    name: 'Soothing',
    colors: [
      { hue: 336, saturation: 18, brightness: 67, kelvin: 3500 },
      { hue: 335, saturation: 50, brightness: 67, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 100, kelvin: 8000 },
      { hue: 302, saturation: 69, brightness: 100, kelvin: 3500 },
      { hue: 330, saturation: 45, brightness: 58, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:sports',
    name: 'Sports',
    colors: [
      { hue: 59, saturation: 81, brightness: 96, kelvin: 3500 },
      { hue: 120, saturation: 100, brightness: 96, kelvin: 3500 },
      { hue: 120, saturation: 74, brightness: 100, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:spring',
    name: 'Spring',
    colors: [
      { hue: 184, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 299, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 49, saturation: 100, brightness: 50, kelvin: 3500 },
      { hue: 198, saturation: 100, brightness: 50, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:tranquil',
    name: 'Tranquil',
    colors: [
      { hue: 0, saturation: 0, brightness: 0, kelvin: 8500 },
      { hue: 205, saturation: 74, brightness: 96, kelvin: 3500 },
      { hue: 203, saturation: 94, brightness: 96, kelvin: 3500 },
      { hue: 241, saturation: 99, brightness: 100, kelvin: 3500 },
      { hue: 37, saturation: 75, brightness: 99, kelvin: 3500 },
      { hue: 43, saturation: 83, brightness: 53, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:warming',
    name: 'Warming',
    colors: [
      { hue: 4, saturation: 100, brightness: 76, kelvin: 3500 },
      { hue: 42, saturation: 36, brightness: 96, kelvin: 3500 },
      { hue: 355, saturation: 81, brightness: 86, kelvin: 3500 },
      { hue: 44, saturation: 44, brightness: 65, kelvin: 3500 },
      { hue: 51, saturation: 85, brightness: 59, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 30, kelvin: 3500 },
    ],
  },

  // ── Art Series (approximated; newer LIFX themes, not publicly documented) ──
  {
    id: 'builtin:mondrian',
    name: 'Mondrian',
    colors: [
      { hue: 0, saturation: 95, brightness: 100, kelvin: 3500 }, // red
      { hue: 220, saturation: 100, brightness: 95, kelvin: 3500 }, // blue
      { hue: 55, saturation: 95, brightness: 100, kelvin: 3500 }, // yellow
      { hue: 0, saturation: 0, brightness: 100, kelvin: 3500 }, // white
      { hue: 0, saturation: 0, brightness: 10, kelvin: 3500 }, // black
    ],
  },
  {
    id: 'builtin:gauguin',
    name: 'Gauguin',
    colors: [
      { hue: 18, saturation: 85, brightness: 95, kelvin: 3500 },
      { hue: 330, saturation: 75, brightness: 80, kelvin: 3500 },
      { hue: 170, saturation: 70, brightness: 75, kelvin: 3500 },
      { hue: 45, saturation: 80, brightness: 90, kelvin: 3500 },
      { hue: 100, saturation: 65, brightness: 60, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:kandinsky',
    name: 'Kandinsky',
    colors: [
      { hue: 55, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 0, saturation: 95, brightness: 90, kelvin: 3500 },
      { hue: 210, saturation: 100, brightness: 85, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 15, kelvin: 3500 },
      { hue: 30, saturation: 80, brightness: 95, kelvin: 3500 },
      { hue: 280, saturation: 70, brightness: 75, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:rousseau',
    name: 'Rousseau',
    colors: [
      { hue: 135, saturation: 85, brightness: 65, kelvin: 3500 },
      { hue: 95, saturation: 75, brightness: 80, kelvin: 3500 },
      { hue: 45, saturation: 80, brightness: 90, kelvin: 3500 },
      { hue: 20, saturation: 70, brightness: 75, kelvin: 3500 },
      { hue: 155, saturation: 90, brightness: 45, kelvin: 3500 },
    ],
  },

  // ── Music (approximated) ─────────────────────────────────────────────
  {
    id: 'builtin:synthwave',
    name: 'Synthwave',
    colors: [
      { hue: 320, saturation: 100, brightness: 100, kelvin: 3500 }, // hot pink
      { hue: 270, saturation: 100, brightness: 90, kelvin: 3500 }, // purple
      { hue: 190, saturation: 100, brightness: 100, kelvin: 3500 }, // cyan
      { hue: 300, saturation: 90, brightness: 80, kelvin: 3500 }, // magenta
      { hue: 25, saturation: 95, brightness: 100, kelvin: 3500 }, // sunset orange
    ],
  },
  {
    id: 'builtin:punk',
    name: 'Punk',
    colors: [
      { hue: 0, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 0, saturation: 0, brightness: 10, kelvin: 3500 },
      { hue: 210, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 55, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 330, saturation: 100, brightness: 95, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:pop',
    name: 'Pop',
    colors: [
      { hue: 330, saturation: 95, brightness: 100, kelvin: 3500 },
      { hue: 55, saturation: 100, brightness: 100, kelvin: 3500 },
      { hue: 190, saturation: 90, brightness: 100, kelvin: 3500 },
      { hue: 280, saturation: 85, brightness: 95, kelvin: 3500 },
    ],
  },
  {
    id: 'builtin:garage-rock',
    name: 'Garage Rock',
    colors: [
      { hue: 15, saturation: 95, brightness: 85, kelvin: 3500 },
      { hue: 30, saturation: 90, brightness: 90, kelvin: 3500 },
      { hue: 45, saturation: 85, brightness: 80, kelvin: 3500 },
      { hue: 0, saturation: 80, brightness: 70, kelvin: 3500 },
      { hue: 25, saturation: 70, brightness: 45, kelvin: 3500 },
    ],
  },
];
